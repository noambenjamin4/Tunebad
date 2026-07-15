// Can we DECIDE the octave instead of guessing it with a fixed window?
//
// THE FINDING THIS EXISTS TO ACT ON: Percival halves fast tracks. Measured raw
// output vs known truth:
//     Paint It Black  true 159  raw 79.8   (halved)
//     Blinding Lights true 171  raw 85.2   (halved)
//     In Da Club      true  90  raw 90.0   (correct)
//     Lose Yourself   true  86  raw 86.0   (correct)
// So raw ~80 must DOUBLE and raw ~90 must NOT. They are 10 BPM apart, which is
// why every fixed window (ours at [105,210) or [60,180)) trades one band for
// the other — [105,210) doubled everything under 105, accidentally repairing
// Percival on fast tracks while destroying genuinely slow ones.
//
// A window cannot separate those two cases. An independent feature might.
// This script measures candidate features against the truth set and reports
// whether any of them actually separates "should double" from "should not".
// It writes nothing and changes no shipped code.
//
//   node scripts/octave-experiment.mjs [limit]
//
// ============================== RESULT: NEGATIVE =============================
// Ran against the 61-song truth set. NOTHING here separates the two classes.
//
//   feature        should DOUBLE          should KEEP           verdict
//   onset/beat     med 3.80               med 3.76              identical
//   danceability   med 1.42               med 1.39              identical
//   dblRatio       med 1.18 (0.71-1.34)   med 0.84 (0.56-9.98)  heavy overlap
//   LoopBpmConfidence, as the rule "double if conf(2x) > conf(1x)":
//     overall 27/47 = 57%; catches 3/5 doubles; 18 FALSE doubles out of 42.
//     i.e. it would wreck 18 correct songs to rescue 3. Strictly worse than
//     the fixed fold we ship.
//
// Also fatal on its own: only 5 of 47 songs land in the DOUBLE class. Any
// threshold fit on n=5 is overfitting, not learning — even a feature that
// looked clean here could not be trusted.
//
// WHAT THIS MEANS: the octave decision cannot be rescued with the features
// essentia.js exposes at this sample size. Do NOT re-run this hoping for a
// different answer; re-run it only after the truth set has MANY more fast
// tracks that Percival halves (the DOUBLE class needs to be dozens, not 5).
// The shipped fixed fold [60,180) at 69% remains the best measured option.
// =============================================================================

import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { TRUTH } from "./bpm-truth.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FFMPEG = resolve(ROOT, "node_modules/ffmpeg-static/ffmpeg");
const RATE = 16000;

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

function decode(mp3) {
  return new Promise((res, rej) => {
    const ff = spawn(FFMPEG, ["-hide_banner", "-loglevel", "error", "-i", "pipe:0",
      "-ac", "1", "-ar", String(RATE), "-f", "f32le", "pipe:1"]);
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

// --- the candidate discriminator -------------------------------------------
//
// BEAT SALIENCE: build an onset-strength envelope (spectral flux), then ask how
// much onset energy actually lands on a pulse grid at period T vs at T/2. If a
// track truly runs at 159 while Percival says 79.8, the 159 grid has real
// onsets on every beat and the 79.8 grid only hits every other one — the
// doubled grid should score comparably, NOT worse. If the track truly runs at
// 90, a 180 grid lands half its beats on silence and should score clearly worse.
function onsetEnvelope(samples, rate) {
  const N = 1024, HOP = 512;
  const frames = Math.floor((samples.length - N) / HOP);
  const env = new Float32Array(Math.max(0, frames));
  let prev = null;
  for (let f = 0; f < frames; f += 1) {
    const start = f * HOP;
    // Cheap magnitude spectrum via Goertzel-free naive DFT on a decimated band
    // would be slow; use a simple energy-derivative envelope instead. Spectral
    // flux needs an FFT, so approximate onset strength with half-wave rectified
    // energy difference, which tracks percussive attacks well enough at 16k.
    let energy = 0;
    for (let i = 0; i < N; i += 1) {
      const s = samples[start + i];
      energy += s * s;
    }
    energy = Math.sqrt(energy / N);
    env[f] = prev === null ? 0 : Math.max(0, energy - prev);
    prev = energy;
  }
  return { env, envRate: rate / HOP };
}

/** Mean envelope value sampled on a pulse grid of `bpm`, normalised by the
 *  envelope mean — i.e. "how much more onset energy sits on this grid than on
 *  an average moment". */
function gridSalience(env, envRate, bpm) {
  if (!env.length) return 0;
  const period = (60 / bpm) * envRate; // frames per beat
  if (period < 2 || period > env.length) return 0;
  let sum = 0, n = 0;
  for (let pos = 0; pos < env.length; pos += period) {
    const i = Math.round(pos);
    if (i >= env.length) break;
    // small window around the grid point: real beats jitter
    let best = 0;
    for (let d = -1; d <= 1; d += 1) {
      const j = i + d;
      if (j >= 0 && j < env.length) best = Math.max(best, env[j]);
    }
    sum += best;
    n += 1;
  }
  if (!n) return 0;
  let mean = 0;
  for (let i = 0; i < env.length; i += 1) mean += env[i];
  mean /= env.length;
  return mean > 0 ? sum / n / mean : 0;
}

async function main() {
  const limit = Number(process.argv[2]) || TRUTH.length;
  const list = TRUTH.slice(0, limit);
  const engine = await getEssentia();
  const rows = [];

  for (const [idx, t] of list.entries()) {
    let url;
    try { url = await preview(t.q); } catch { url = null; }
    if (!url) { console.log(`[${idx + 1}/${list.length}] skip ${t.title}`); continue; }
    let samples;
    try {
      samples = await decode(Buffer.from(await (await fetch(url)).arrayBuffer()));
    } catch { console.log(`[${idx + 1}/${list.length}] skip(decode) ${t.title}`); continue; }

    const sig = engine.arrayToVector(samples);
    const raw = engine.PercivalBpmEstimator(sig, 1024, 2048, 128, 128, 210, 50, RATE).bpm;
    let onsetRate = null;
    try {
      onsetRate = engine.OnsetRate(sig).onsetRate;
    } catch { onsetRate = null; }
    // THE REAL INSTRUMENT: LoopBpmConfidence is purpose-built to answer "how
    // confident are you that THIS bpm is right for this audio". Ask it about
    // raw and about raw*2 and let it vote, instead of hand-rolling a salience
    // measure out of an energy derivative.
    let confRaw = null, confDouble = null;
    try { confRaw = engine.LoopBpmConfidence(sig, raw).confidence; } catch { confRaw = null; }
    try { confDouble = engine.LoopBpmConfidence(sig, raw * 2).confidence; } catch { confDouble = null; }
    let dance = null;
    try {
      const d = engine.Danceability(sig, 8800, 310, RATE);
      dance = d.danceability;
      d.dfa?.delete?.();
    } catch { dance = null; }
    sig.delete?.();

    const { env, envRate } = onsetEnvelope(samples, RATE);
    const sAtRaw = gridSalience(env, envRate, raw);
    const sAtDouble = gridSalience(env, envRate, raw * 2);
    const sAtHalf = gridSalience(env, envRate, raw / 2);

    // Ground truth for the DECISION: does the true tempo equal raw*2 (within
    // tolerance)? That is the only thing we need to predict.
    const shouldDouble = Math.abs(raw * 2 - t.bpm) <= 3;
    const isCorrect = Math.abs(raw - t.bpm) <= 3;
    if (!shouldDouble && !isCorrect) {
      console.log(`[${idx + 1}/${list.length}] ${t.title.slice(0,24).padEnd(24)} raw=${raw.toFixed(1)} truth=${t.bpm}  (neither x1 nor x2 — excluded)`);
      continue;
    }

    rows.push({
      title: t.title, truth: t.bpm, raw: +raw.toFixed(1), shouldDouble,
      onsetRate: onsetRate == null ? null : +onsetRate.toFixed(2),
      dance: dance == null ? null : +dance.toFixed(2),
      beatsPerSec: +(raw / 60).toFixed(2),
      onsetPerBeat: onsetRate == null ? null : +(onsetRate / (raw / 60)).toFixed(2),
      sRaw: +sAtRaw.toFixed(2), sDouble: +sAtDouble.toFixed(2), sHalf: +sAtHalf.toFixed(2),
      dblRatio: sAtRaw > 0 ? +(sAtDouble / sAtRaw).toFixed(2) : 0,
      confRaw: confRaw == null ? null : +confRaw.toFixed(3),
      confDouble: confDouble == null ? null : +confDouble.toFixed(3),
      // The actual decision rule under test: does the doubled grid win?
      confWinsDouble: confRaw != null && confDouble != null ? (confDouble > confRaw ? 1 : 0) : null,
    });
    const r = rows[rows.length - 1];
    console.log(`[${idx + 1}/${list.length}] ${t.title.slice(0,24).padEnd(24)} raw=${String(r.raw).padStart(5)} truth=${String(r.truth).padStart(3)} ${r.shouldDouble ? "DOUBLE" : "keep  "} onset/beat=${String(r.onsetPerBeat).padStart(5)} dance=${String(r.dance).padStart(4)} dblRatio=${String(r.dblRatio).padStart(4)}`);
  }

  const dbl = rows.filter((r) => r.shouldDouble);
  const keep = rows.filter((r) => !r.shouldDouble);
  const stat = (arr, k) => {
    const v = arr.map((r) => r[k]).filter((x) => x != null).sort((a, b) => a - b);
    if (!v.length) return "n/a";
    const med = v[Math.floor(v.length / 2)];
    return `min=${v[0]} med=${med} max=${v[v.length - 1]}`;
  };
  console.log(`\n${"=".repeat(76)}\nDECISION SET: ${rows.length} songs (${dbl.length} should DOUBLE, ${keep.length} should KEEP)\n${"=".repeat(76)}`);
  for (const k of ["onsetRate", "onsetPerBeat", "dance", "dblRatio", "confRaw", "confDouble", "confWinsDouble"]) {
    console.log(`${k.padEnd(14)} DOUBLE: ${stat(dbl, k).padEnd(34)} KEEP: ${stat(keep, k)}`);
  }
  // Score the actual rule: "double when LoopBpmConfidence prefers the double".
  const scored = rows.filter((r) => r.confWinsDouble != null);
  if (scored.length) {
    const right = scored.filter((r) => (r.confWinsDouble === 1) === r.shouldDouble).length;
    const dblRight = scored.filter((r) => r.shouldDouble && r.confWinsDouble === 1).length;
    const dblTotal = scored.filter((r) => r.shouldDouble).length;
    const keepRight = scored.filter((r) => !r.shouldDouble && r.confWinsDouble === 0).length;
    const keepTotal = scored.filter((r) => !r.shouldDouble).length;
    console.log(`\nRULE "double if LoopBpmConfidence(2x) > LoopBpmConfidence(1x)":`);
    console.log(`  overall ${right}/${scored.length} = ${Math.round(100*right/scored.length)}%`);
    console.log(`  catches DOUBLE cases: ${dblRight}/${dblTotal}`);
    console.log(`  leaves KEEP alone:    ${keepRight}/${keepTotal}   (false doubles = ${keepTotal - keepRight})`);
  }
  console.log("\nA feature is USEFUL only if the two rows barely overlap. If they overlap,");
  console.log("it cannot separate the cases and no threshold on it will help.");
}

main().catch((e) => { console.error(e); process.exit(1); });
