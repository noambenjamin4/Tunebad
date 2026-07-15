// Is Percival halving fast tracks because we run it at the WRONG SAMPLE RATE?
//
// THE HYPOTHESIS. The shipped call is:
//     PercivalBpmEstimator(signal, 1024, 2048, 128, 128, 210, 50, 16000)
// Those frame/hop sizes are essentia's DEFAULTS, and essentia's defaults are
// specified for sampleRate=44100. Frame sizes are in SAMPLES, so at 16k they
// describe ~2.76x more TIME than the algorithm was tuned for: the onset-strength
// signal (hopSizeOSS=128) runs at 125 Hz instead of 344 Hz. Percival searches
// for tempo lags in that OSS, so a mis-scaled OSS is a plausible mechanism for
// the octave error we measured (Blinding Lights 171 -> raw 85.2).
//
// The analyzer resamples to 16k for speed. If 44.1k fixes the halving, that
// trade is costing accuracy on the site's core claim.
//
// Tests three configs against the truth set:
//   A  16k + current params          (what ships)
//   B  44.1k + essentia defaults     (params used at the rate they were made for)
//   C  16k + time-scaled params      (keep 16k, scale hops to match 44.1k TIME)
//
// Read-only. Changes nothing.
//   node scripts/rate-experiment.mjs [limit]

import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { TRUTH as TRUTH_BASE } from "./bpm-truth.mjs";
import { TRUTH_FAST } from "./bpm-truth-fast.mjs";

// The combined set. bpm-truth.mjs alone had only 5 songs in the class that
// matters (tracks Percival halves), which is why every previous experiment
// died on noise. bpm-truth-fast.mjs adds 17 more, deliberately spread across
// dnb / punk / trance / house so a "fix" cannot pass by overfitting one genre.
const TRUTH = [...TRUTH_BASE, ...TRUTH_FAST];

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FFMPEG = resolve(ROOT, "node_modules/ffmpeg-static/ffmpeg");

if (typeof globalThis.self === "undefined") globalThis.self = globalThis;
globalThis.require = createRequire(import.meta.url);
globalThis.__dirname = resolve(ROOT, "node_modules/essentia.js/dist");

let es = null;
async function getEssentia() {
  if (es) return es;
  const [{ default: Essentia }, { EssentiaWASM }] = await Promise.all([
    import("essentia.js/dist/essentia.js-core.es.js"),
    import("essentia.js/dist/essentia-wasm.es.js"),
  ]);
  const deadline = Date.now() + 8000;
  while (!EssentiaWASM.calledRun && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20));
  es = new Essentia(EssentiaWASM);
  return es;
}

function decode(mp3, rate) {
  return new Promise((res, rej) => {
    const ff = spawn(FFMPEG, ["-hide_banner", "-loglevel", "error", "-i", "pipe:0",
      "-ac", "1", "-ar", String(rate), "-f", "f32le", "pipe:1"]);
    const chunks = [];
    ff.stdout.on("data", (d) => chunks.push(d));
    ff.on("close", (c) => {
      if (c !== 0) return rej(new Error("ffmpeg " + c));
      const b = Buffer.concat(chunks);
      res(new Float32Array(b.buffer, b.byteOffset, Math.floor(b.length / 4)));
    });
    ff.on("error", rej);
    ff.stdin.on("error", () => {});
    ff.stdin.end(mp3);
  });
}

async function preview(q) {
  const r = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=5`);
  if (!r.ok) return null;
  const j = await r.json();
  const hit = (j.data || []).find((d) => d.preview);
  return hit ? hit.preview : null;
}

// The fold we ship today, so each config is scored the way users see it.
function fold(raw) {
  let f = raw;
  while (f > 0 && f < 60) f *= 2;
  while (f >= 180) f /= 2;
  return Math.round(f);
}

const CONFIGS = [
  // [label, rate, frameSize, frameSizeOSS, hopSize, hopSizeOSS, estimator]
  ["A 16k percival (ships)", 16000, 1024, 2048, 128, 128, "percival"],
  ["B 44.1k percival", 44100, 1024, 2048, 128, 128, "percival"],
  // The synthetic octave map (scripts/octave-map.mjs) showed Percival reports
  // HALF for EVERY tempo >= 136 — identically across four drum patterns, so the
  // octave is destroyed inside the algorithm and no post-processing of its
  // single output can recover it. BeatTrackerMultiFeature has no such ceiling
  // on the same synthetic set (28/31 vs 17/31). This asks the only question
  // that matters: does that hold on REAL music?
  //   NOTE: BeatTrackerMultiFeature is documented 44100-only. At 16k it silently
  //   returns garbage in the wrong time base (~120 for every input).
  ["D 44.1k beattracker", 44100, 0, 0, 0, 0, "beattracker"],
  // THE ENSEMBLE. The two estimators fail in OPPOSITE directions on real music:
  //   Percival     slow 66%  fast 25%   (ceilings at ~134, halves fast tracks)
  //   BeatTracker  slow 41%  fast 50%   (no ceiling, but noisier on slow)
  // So their DISAGREEMENT is itself the signal. When BeatTracker reports ~2x
  // Percival, that is precisely the halving case Percival cannot escape — trust
  // BeatTracker. Otherwise keep Percival, which is the better slow estimator.
  // This is not a threshold fit to the data; it is a mechanism read off the
  // synthetic octave map (Percival's hard ceiling) and tested here.
  ["E ensemble", 44100, 1024, 2048, 128, 128, "ensemble"],
];

/** Percival, except: if BeatTracker independently says "twice that", believe it. */
function ensembleBpm(engine, sig, rate) {
  const p = engine.PercivalBpmEstimator(sig, 1024, 2048, 128, 128, 210, 50, rate).bpm;
  let b = null;
  try { b = beatTrackerBpm(engine, sig); } catch { b = null; }
  if (p && b && Math.abs(b - 2 * p) / (2 * p) < 0.06) return b;
  return p;
}

/** Tempo from BeatTrackerMultiFeature ticks: median inter-beat interval. */
function beatTrackerBpm(engine, sig) {
  const r = engine.BeatTrackerMultiFeature(sig, 208, 40);
  const ticks = engine.vectorToArray(r.ticks);
  r.ticks?.delete?.();
  r.confidence?.delete?.();
  if (!ticks || ticks.length < 4) return null;
  const gaps = [];
  for (let i = 1; i < ticks.length; i += 1) gaps.push(ticks[i] - ticks[i - 1]);
  gaps.sort((a, b) => a - b);
  const med = gaps[Math.floor(gaps.length / 2)];
  return med > 0 ? 60 / med : null;
}

async function main() {
  const limit = Number(process.argv[2]) || TRUTH.length;
  const list = TRUTH.slice(0, limit);
  const engine = await getEssentia();
  const score = {};
  for (const [label] of CONFIGS) score[label] = { exact: 0, octave: 0, miss: 0, n: 0, fast: { ok: 0, n: 0 }, slow: { ok: 0, n: 0 } };

  for (const [idx, t] of list.entries()) {
    let url;
    try { url = await preview(t.q); } catch { url = null; }
    if (!url) continue;
    let mp3;
    try { mp3 = Buffer.from(await (await fetch(url)).arrayBuffer()); } catch { continue; }

    const line = [];
    for (const [label, rate, fs, fsOss, hs, hsOss, est] of CONFIGS) {
      let bpm = null;
      try {
        const samples = await decode(mp3, rate);
        const sig = engine.arrayToVector(samples);
        const raw = est === "beattracker"
          ? beatTrackerBpm(engine, sig)
          : est === "ensemble"
            ? ensembleBpm(engine, sig, rate)
            : engine.PercivalBpmEstimator(sig, fs, fsOss, hs, hsOss, 210, 50, rate).bpm;
        sig.delete?.();
        bpm = raw == null ? null : fold(raw);
      } catch { bpm = null; }
      const s = score[label];
      s.n += 1;
      const band = t.band === "fast" ? s.fast : t.band === "slow" ? s.slow : null;
      if (band) band.n += 1;
      if (bpm != null && Math.abs(bpm - t.bpm) <= 2) {
        s.exact += 1;
        if (band) band.ok += 1;
      } else if (bpm != null && [0.5, 2].some((m) => Math.abs(bpm - t.bpm * m) <= 2)) {
        s.octave += 1;
      } else {
        s.miss += 1;
      }
      line.push(`${label.split(" ")[0]}=${String(bpm ?? "-").padStart(3)}`);
    }
    console.log(`[${idx + 1}/${list.length}] ${t.title.slice(0, 26).padEnd(26)} truth=${String(t.bpm).padStart(3)} ${line.join("  ")}`);
  }

  console.log(`\n${"=".repeat(72)}`);
  console.log("config".padEnd(24) + "exact".padStart(7) + "octave".padStart(8) + "miss".padStart(6) + "    slow      fast");
  for (const [label] of CONFIGS) {
    const s = score[label];
    const pct = (x) => `${Math.round((100 * x) / Math.max(1, s.n))}%`;
    const b = (x) => (x.n ? `${Math.round((100 * x.ok) / x.n)}%` : "-");
    console.log(label.padEnd(24) + pct(s.exact).padStart(7) + pct(s.octave).padStart(8) + pct(s.miss).padStart(6) + `    ${b(s.slow).padStart(4)}      ${b(s.fast).padStart(4)}`);
  }
  console.log("\nIf B or C beats A on FAST without losing SLOW, the sample rate was the bug.");
}

main().catch((e) => { console.error(e); process.exit(1); });
