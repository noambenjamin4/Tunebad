// Beat grid for the DAW: the difference between "song B starts near the
// switch" and "song B starts ON the one".
//
// Two separate problems, and only the first is a solved one:
//   TEMPO  — reuse the site's analysis worker (essentia's Percival estimator,
//            the same engine behind /key-bpm-finder), off the main thread.
//   PHASE  — the estimator returns a tempo, not a downbeat. A grid at the
//            right BPM but the wrong phase is WORSE than no grid: every snap
//            lands confidently between beats. So phase is estimated here, by
//            scoring candidate offsets against an onset envelope and keeping
//            the one the transients actually agree with.
//
// Both are estimates. The UI shows the number, offers x2 / ÷2 (the site's
// tempo estimator is documented to halve fast tracks — see
// scripts/octave-map.mjs) and lets it be typed in, because a producer knows
// their own track's tempo better than any estimator does.

import type { WorkerRequest, WorkerResponse } from "@/types/analysis";
import { monoSamples, resampleMono } from "@/lib/audio/decode";
import type { DisplaySignal } from "./display-signal";

export interface BeatGrid {
  bpm: number;
  /** Timeline seconds of SOME beat; the grid repeats every 60/bpm from here. */
  anchorSec: number;
  beatsPerBar: number;
}

export const DEFAULT_BEATS_PER_BAR = 4;
export const MIN_BPM = 40;
export const MAX_BPM = 220;

/* ------------------------------ pure math ------------------------------ */

function beatPeriod(bpm: number): number {
  return 60 / Math.max(1, bpm);
}

/** The grid time nearest `t` — O(1), no list to scan. */
export function nearestGridTime(t: number, grid: BeatGrid): number {
  const period = beatPeriod(grid.bpm);
  return grid.anchorSec + Math.round((t - grid.anchorSec) / period) * period;
}

/**
 * Beat times within [from, to), each flagged as a downbeat. Returns []
 * when the beats would be closer together than `minSpacingSec` — drawing a
 * line every two pixels is a grey smear, not a grid.
 */
export function beatTimesInRange(
  grid: BeatGrid,
  from: number,
  to: number,
  minSpacingSec = 0,
): { t: number; downbeat: boolean }[] {
  const period = beatPeriod(grid.bpm);
  if (period <= 0 || to <= from) return [];
  const out: { t: number; downbeat: boolean }[] = [];
  const bars = Math.max(1, grid.beatsPerBar);
  // Bar lines survive when beat lines are too dense to read.
  const step = period >= minSpacingSec ? period : period * bars;
  if (step < minSpacingSec) return [];
  const firstIndex = Math.ceil((from - grid.anchorSec) / step);
  // Exclusive end, as documented: floor() would emit a line exactly ON `to`
  // and double up with the next range's first line when ranges are tiled.
  const lastIndex = Math.ceil((to - grid.anchorSec) / step) - 1;
  // A pathological zoom-out could ask for millions of lines; the caller's
  // minSpacing normally prevents it, this is the hard stop.
  if (lastIndex - firstIndex > 5000) return [];
  for (let i = firstIndex; i <= lastIndex; i++) {
    const t = grid.anchorSec + i * step;
    const beatIndex = Math.round((t - grid.anchorSec) / period);
    out.push({ t, downbeat: ((beatIndex % bars) + bars) % bars === 0 });
  }
  return out;
}

/**
 * How much a clip must be stretched to sit at `targetBpm`, as a tempo
 * factor for timeStretch (0.9 = play it at 90% speed).
 *
 * Octave-folded on purpose: a 70 BPM track against a 140 BPM project is
 * ALREADY in time — half-time, one beat per two — and stretching it 2x
 * would destroy it. The estimator also mislabels octaves regularly, so
 * folding protects against its known failure mode as well. Candidates are
 * scored in log space, where "twice as fast" and "half as fast" are the
 * same distance from a perfect match.
 */
/**
 * Widen a region outward to the bar lines around it.
 *
 * A loop that starts three-quarters of a beat into a bar does not sound like
 * a loop, it sounds like a stutter — the ear hears the downbeat land in the
 * wrong place on every pass. Always widening (never narrowing) means the
 * region the caller asked for is still entirely inside the result.
 */
export function expandToBars(
  region: { start: number; end: number },
  grid: BeatGrid,
): { start: number; end: number } {
  const bar = beatPeriod(grid.bpm) * Math.max(1, grid.beatsPerBar);
  if (!Number.isFinite(bar) || bar <= 0) return region;
  const barsFrom = (t: number) => (t - grid.anchorSec) / bar;
  const start = grid.anchorSec + Math.floor(barsFrom(region.start) + 1e-6) * bar;
  const end = grid.anchorSec + Math.ceil(barsFrom(region.end) - 1e-6) * bar;
  // The anchor can sit after zero, which would put the first bar line at a
  // negative time; the transport has no material there.
  return { start: Math.max(0, start), end: Math.max(start + bar, end) };
}

/** How many bars a region spans on this grid, for the readout. */
export function barsIn(region: { start: number; end: number }, grid: BeatGrid): number {
  const bar = beatPeriod(grid.bpm) * Math.max(1, grid.beatsPerBar);
  if (!Number.isFinite(bar) || bar <= 0) return 0;
  return (region.end - region.start) / bar;
}

export function tempoMatchRatio(clipBpm: number, targetBpm: number): number {
  if (!(clipBpm > 0) || !(targetBpm > 0)) return 1;
  let best = 1;
  let bestError = Infinity;
  for (let octave = -2; octave <= 2; octave++) {
    const candidate = clipBpm * Math.pow(2, octave);
    const ratio = targetBpm / candidate;
    const error = Math.abs(Math.log2(ratio));
    if (error < bestError) {
      bestError = error;
      best = ratio;
    }
  }
  return best;
}

/** Worth offering a match? Under ~0.3% the stretch is inaudible churn. */
export function needsTempoMatch(ratio: number): boolean {
  return Number.isFinite(ratio) && Math.abs(ratio - 1) > 0.003;
}

/* --------------------------- phase estimation --------------------------- */

// 64 samples at ~11 kHz is ~5.8 ms per frame. At 256 the envelope could
// only locate a beat to ~23 ms, which measured as 16 ms of downbeat slop
// after a match — audible looseness on a tight switch. Four times the
// frames costs nothing here: the envelope is one pass over already
// decimated mono either way, and the phase search is 64 candidates.
const ONSET_HOP = 64;

/**
 * Where the beats sit, in SOURCE seconds. Builds an onset envelope (rising
 * energy between frames — the percussive edges), then tries every phase
 * across one beat period and keeps the one where the most onset energy lands
 * on a beat. Uses the already-decimated display signal, so it costs one pass
 * over ~11 kHz mono rather than the full-rate audio.
 */
export function estimateBeatPhase(signal: DisplaySignal, bpm: number): number {
  const { data, sampleRate } = signal;
  const frames = Math.floor(data.length / ONSET_HOP);
  if (frames < 8) return 0;

  const onset = new Float32Array(frames);
  let prev = 0;
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const start = f * ONSET_HOP;
    for (let i = start; i < start + ONSET_HOP; i++) sum += data[i] * data[i];
    const energy = Math.sqrt(sum / ONSET_HOP);
    onset[f] = Math.max(0, energy - prev); // half-wave rectified: rises only
    prev = energy;
  }

  const framesPerSecond = sampleRate / ONSET_HOP;
  const periodFrames = beatPeriod(bpm) * framesPerSecond;
  if (!Number.isFinite(periodFrames) || periodFrames < 1) return 0;

  // 64 candidate phases across one beat is ~8 ms at 120 BPM — finer than
  // the onset envelope's own resolution, so more would buy nothing.
  const CANDIDATES = 64;
  let bestScore = -1;
  let bestPhaseFrames = 0;
  for (let c = 0; c < CANDIDATES; c++) {
    const phase = (c / CANDIDATES) * periodFrames;
    let score = 0;
    for (let beat = 0; ; beat++) {
      const f = Math.round(phase + beat * periodFrames);
      if (f >= frames) break;
      score += onset[f];
    }
    if (score > bestScore) {
      bestScore = score;
      bestPhaseFrames = phase;
    }
  }
  return bestPhaseFrames / framesPerSecond;
}

/* ---------------------------- tempo detection ---------------------------- */

let worker: Worker | null = null;
let nextId = 1;
const waiting = new Map<number, (r: WorkerResponse) => void>();

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("../../workers/analysis.worker.ts", import.meta.url));
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const resolve = waiting.get(event.data.id);
    if (resolve) {
      waiting.delete(event.data.id);
      resolve(event.data);
    }
  };
  return worker;
}

/**
 * Compile the essentia WASM before anyone asks for a tempo.
 *
 * Without this the FIRST detection pays the whole download-and-compile cost
 * while a timeout runs against it, and on a cold cache that surfaced as a
 * bogus "No tempo detected" on audio whose tempo is perfectly clear —
 * observed once, and initially misdiagnosed as a minimum-length problem
 * (8-second drums detect fine). useAnalyzer already warms the same worker
 * on the analyzer page; the DAW simply never did.
 */
export function warmTempoWorker(): void {
  try {
    ensureWorker().postMessage({ warmup: true });
  } catch {
    // No worker support: detection will fall back or fail honestly.
  }
}

export interface DetectedTempo {
  bpm: number;
  /** The other octave, when the estimator flagged one — feeds the x2 / ÷2 UI. */
  bpmAlternate: number | null;
}

/**
 * Tempo for one buffer, via the shared analysis worker. The 16 kHz `samples`
 * field drives key detection, which we do not use here but the worker
 * requires; tempo reads `bpmSamples` at the native rate, which is what its
 * frame sizes are specified for.
 */
export async function detectTempo(buffer: AudioBuffer): Promise<DetectedTempo | null> {
  try {
    const native = monoSamples(buffer);
    const sixteen = await resampleMono(native, buffer.sampleRate, 16000);
    const id = nextId++;
    const request: WorkerRequest = {
      id,
      samples: sixteen,
      sampleRate: 16000,
      bpmSamples: native,
      bpmSampleRate: buffer.sampleRate,
    };
    const response = await new Promise<WorkerResponse>((resolve, reject) => {
      // Generous: this is background work behind a "Finding the tempo…"
      // label, and a cold WASM compile on a slow connection genuinely can
      // take a while. Cutting it short just throws away a real answer.
      const timer = window.setTimeout(() => {
        waiting.delete(id);
        reject(new Error("tempo detection timed out"));
      }, 60000);
      waiting.set(id, (r) => {
        window.clearTimeout(timer);
        resolve(r);
      });
      // Structured clone, never transfer: the caller still owns these arrays.
      ensureWorker().postMessage(request);
    });
    if (!response.bpm || response.bpm < MIN_BPM || response.bpm > MAX_BPM) return null;
    return { bpm: Math.round(response.bpm), bpmAlternate: response.bpmAlternate ?? null };
  } catch {
    return null; // no grid is a fine outcome; a wrong grid is not
  }
}
