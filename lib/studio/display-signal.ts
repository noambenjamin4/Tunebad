// What the timeline DRAWS. Separate from what it plays, on purpose.
//
// Two things the raw buffer can't show:
//   1. Resolution. A 5-minute stereo track is 13M samples; the timeline never
//      shows more than a few thousand columns. Every display signal is a mono
//      copy at DISPLAY_RATE, so scanning is ~4x cheaper and the pyramid is
//      4x smaller, with no visible difference at any zoom this UI offers.
//   2. Character effects. When a clip is in phone/underwater/lo-fi mode, the
//      wave you see should be the wave you hear — a phone-filtered track has
//      no lows, so it must LOOK thinner, not identical.
//
// A clip passes through its OWN effect and then the master's, so the drawing
// has to do the same, in that order. Keying this on the master alone was
// right until clips got their own effects and then quietly wasn't: a clip
// set to underwater sounded filtered and drew its full-band shape.
//
// Effect variants are rendered through the same filter frequencies the audio
// path uses (EFFECTS in lib/audio/remix.ts is the single source of truth) and
// cached per (bufferId, chain); switching effects re-renders once, then every
// later switch is a map hit.

import { type EffectId, EFFECTS } from "@/lib/audio/remix";
import { type PeakPyramid, buildPeakPyramid } from "./waveform-pyramid";

/** Plenty for drawing, and above 2x the highest effect cutoff (3.8 kHz). */
const DISPLAY_RATE = 11025;

export interface DisplaySignal {
  data: Float32Array;
  pyramid: PeakPyramid;
  sampleRate: number;
}

const cache = new Map<string, DisplaySignal>();
const pending = new Map<string, Promise<DisplaySignal>>();

/**
 * Cache key, and the map key both the hook and the Timeline look a clip up
 * by. Exported so there is ONE spelling of it — the signal a clip is drawn
 * with has to be the one rendered for that clip.
 */
export function displayKey(
  bufferId: string,
  clipEffect: EffectId | undefined,
  masterEffect: EffectId,
): string {
  return `${bufferId}::${clipEffect ?? "none"}>${masterEffect}`;
}

/**
 * Mono, DISPLAY_RATE, filtered through each effect in the chain in turn —
 * the clip's own, then the master's, the order the audio takes.
 *
 * The waveshaper is deliberately NOT applied: it is a soft clipper, so it
 * changes harmonics rather than the envelope this draws.
 */
async function render(buffer: AudioBuffer, chain: EffectId[]): Promise<DisplaySignal> {
  const length = Math.max(1, Math.ceil(buffer.duration * DISPLAY_RATE));
  const offline = new OfflineAudioContext(1, length, DISPLAY_RATE);
  const source = offline.createBufferSource();
  source.buffer = buffer;

  let tail: AudioNode = source;
  for (const effect of chain) {
    if (effect === "none") continue;
    const preset = EFFECTS[effect];
    const highpass = offline.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = preset.highpassHz;
    const lowpass = offline.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = Math.min(preset.lowpassHz, DISPLAY_RATE / 2 - 100);
    tail.connect(highpass);
    highpass.connect(lowpass);
    tail = lowpass;
  }
  tail.connect(offline.destination);
  source.start(0);

  const rendered = await offline.startRendering();
  const data = rendered.getChannelData(0);
  return { data, pyramid: buildPeakPyramid(data), sampleRate: DISPLAY_RATE };
}

/** Cached lookup; returns null on a miss and kicks off the render. */
export function peekDisplaySignal(key: string): DisplaySignal | null {
  return cache.get(key) ?? null;
}

/**
 * Resolves the signal, rendering it once per (buffer, effect). Concurrent
 * callers for the same key share one render.
 */
export function getDisplaySignal(
  key: string,
  buffer: AudioBuffer,
  chain: EffectId[],
): Promise<DisplaySignal> {
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const job = render(buffer, chain)
    .then((signal) => {
      cache.set(key, signal);
      pending.delete(key);
      return signal;
    })
    .catch((err) => {
      pending.delete(key);
      throw err;
    });
  pending.set(key, job);
  return job;
}

/** Drop every variant of one buffer (clip removed, library cleared). */
export function forgetDisplaySignals(bufferId: string): void {
  for (const key of [...cache.keys()]) {
    if (key.startsWith(`${bufferId}::`)) cache.delete(key);
  }
}
