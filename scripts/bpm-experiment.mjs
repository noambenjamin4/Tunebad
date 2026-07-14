// BPM octave experiment. Read-only: fetches previews, runs estimators, scores
// candidate strategies against scripts/bpm-truth.mjs. Writes NOTHING to the DB.
//
// The question it answers: the seeder folds every tempo into [105, 210), which
// doubles 35% of the catalog. That's right for genuinely fast tracks and wrong
// for genuinely slow ones, and no single fixed window can be right for both.
// So: does a better ESTIMATOR (RhythmExtractor2013 multifeature, which makes its
// own octave decision) beat the current Percival+fold, measured on real songs?
//
//   node scripts/bpm-experiment.mjs [limit]

import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { TRUTH, BANDS } from "./bpm-truth.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FFMPEG = resolve(ROOT, "node_modules/ffmpeg-static/ffmpeg");
const ANALYSIS_RATE = 16000;
const FOLD_MIN = 105;
const FOLD_MAX = 210;
const DANCE_T = Number(process.env.DANCE_T || 1.15);

// essentia's emscripten build is CommonJS-shaped; same shims the seeder uses.
if (typeof globalThis.self === "undefined") globalThis.self = globalThis;
globalThis.require = createRequire(import.meta.url);
globalThis.__dirname = resolve(ROOT, "node_modules/essentia.js/dist");

let essentia = null;
async function getEssentia() {
  if (essentia) return essentia;
  const [{ default: Essentia }, { EssentiaWASM }] = await Promise.all([
    import("essentia.js/dist/essentia.js-core.es.js"),
    import("essentia.js/dist/essentia-wasm.es.js"),
  ]);
  const deadline = Date.now() + 8000;
  while (!EssentiaWASM.calledRun && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20));
  essentia = new Essentia(EssentiaWASM);
  return essentia;
}

function decode(mp3) {
  return new Promise((res, rej) => {
    const ff = spawn(FFMPEG, ["-hide_banner", "-loglevel", "error", "-i", "pipe:0",
      "-ac", "1", "-ar", String(ANALYSIS_RATE), "-f", "f32le", "pipe:1"]);
    const chunks = [];
    ff.stdout.on("data", (d) => chunks.push(d));
    ff.on("close", (code) => {
      if (code !== 0) return rej(new Error("ffmpeg exit " + code));
      const buf = Buffer.concat(chunks);
      res(new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4)));
    });
    ff.on("error", rej);
    ff.stdin.on("error", () => {});
    ff.stdin.end(mp3);
  });
}

async function findPreview(q) {
  const url = `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=5`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const hit = (json.data || []).find((d) => d.preview);
  return hit ? { preview: hit.preview, title: hit.title, artist: hit.artist?.name } : null;
}

// --- the strategies under test ---------------------------------------------

/** CURRENT: Percival, folded into [105,210). */
function foldCurrent(raw) {
  let f = raw;
  while (f > 0 && f < FOLD_MIN) f *= 2;
  while (f >= FOLD_MAX) f /= 2;
  return Math.round(f);
}

/** Percival with a musically honest window [60,180) instead of [105,210). */
function foldWide(raw) {
  let f = raw;
  while (f > 0 && f < 60) f *= 2;
  while (f >= 180) f /= 2;
  return Math.round(f);
}

/** Raw Percival, no folding at all (it is already constrained to 50..210). */
function foldNone(raw) {
  return Math.round(raw);
}

// Raw ~85 means 86 for Bitter Sweet Symphony and 171 for Blinding Lights —
// identical estimate, opposite truth. Tempo alone cannot separate them, so use
// how DANCEABLE the track is: an 85-BPM record that feels like a floor-filler is
// really a 170 record. Threshold is swept below, not guessed.
function foldDanceAware(raw, dance, threshold = DANCE_T) {
  let f = raw;
  while (f > 0 && f < 60) f *= 2;
  while (f >= 180) f /= 2;
  if (dance != null && f < 100 && dance >= threshold) f *= 2;
  return Math.round(f);
}

function scoreOne(pred, truth) {
  if (!pred || !truth) return "miss";
  if (Math.abs(pred - truth) <= 2) return "exact";
  // Octave error: right pulse, wrong multiple. Tracked separately because it's
  // the specific failure we're hunting.
  for (const m of [0.5, 2, 1 / 3, 3, 2 / 3, 1.5]) {
    if (Math.abs(pred - truth * m) <= 2) return "octave";
  }
  return "miss";
}

async function main() {
  const limit = Number(process.argv[2]) || TRUTH.length;
  const list = TRUTH.slice(0, limit);
  const es = await getEssentia();

  const strategies = {
    "current (Percival, fold 105-210)": (raw) => foldCurrent(raw),
    "Percival, fold 60-180": (raw) => foldWide(raw),
    "Percival, no fold": (raw) => foldNone(raw),
    "RhythmExtractor2013 (multifeature)": null, // filled per-song below
    "dance-aware fold": null, // needs danceability, filled per-song below
  };
  const results = {};
  for (const name of Object.keys(strategies)) {
    results[name] = { exact: 0, octave: 0, miss: 0, byBand: {} };
    for (const b of BANDS) results[name].byBand[b] = { exact: 0, n: 0 };
  }

  const rows = [];
  let done = 0;
  for (const t of list) {
    done++;
    let hit;
    try {
      hit = await findPreview(t.q);
    } catch {
      hit = null;
    }
    if (!hit) {
      console.log(`[${done}/${list.length}] SKIP (no preview)  ${t.title}`);
      continue;
    }
    let samples;
    try {
      const mp3 = Buffer.from(await (await fetch(hit.preview)).arrayBuffer());
      samples = await decode(mp3);
    } catch (e) {
      console.log(`[${done}/${list.length}] SKIP (decode)  ${t.title}`);
      continue;
    }

    const signal = es.arrayToVector(samples);
    const rawPercival = es.PercivalBpmEstimator(signal, 1024, 2048, 128, 128, 210, 50, ANALYSIS_RATE).bpm;
    let dance = null;
    try {
      const d = es.Danceability(signal, 8800, 310, ANALYSIS_RATE);
      dance = d.danceability;
      d.dfa?.delete?.();
    } catch { dance = null; }
    let rhythm = null;
    try {
      const r = es.RhythmExtractor2013(signal, 208, "multifeature", 40);
      rhythm = r.bpm;
      r.ticks?.delete?.();
      r.estimates?.delete?.();
      r.bpmIntervals?.delete?.();
    } catch {
      rhythm = null;
    }
    signal.delete?.();

    const preds = {
      "current (Percival, fold 105-210)": foldCurrent(rawPercival),
      "Percival, fold 60-180": foldWide(rawPercival),
      "Percival, no fold": foldNone(rawPercival),
      "RhythmExtractor2013 (multifeature)": rhythm ? Math.round(rhythm) : null,
      "dance-aware fold": foldDanceAware(rawPercival, dance),
    };

    const row = { song: `${t.title} — ${t.artist}`, truth: t.bpm, band: t.band, raw: Math.round(rawPercival * 10) / 10, dance: dance == null ? null : Math.round(dance * 1000) / 1000 };
    for (const [name, pred] of Object.entries(preds)) {
      const s = scoreOne(pred, t.bpm);
      results[name][s]++;
      results[name].byBand[t.band].n++;
      if (s === "exact") results[name].byBand[t.band].exact++;
      row[name] = `${pred ?? "-"} ${s === "exact" ? "OK" : s === "octave" ? "8ve" : "X"}`;
    }
    rows.push(row);
    console.log(`[${done}/${list.length}] ${t.title.slice(0, 28).padEnd(28)} truth=${String(t.bpm).padStart(3)}  raw=${String(row.raw).padStart(5)}  cur=${String(preds["current (Percival, fold 105-210)"]).padStart(3)}  wide=${String(preds["Percival, fold 60-180"]).padStart(3)}  r13=${String(preds["RhythmExtractor2013 (multifeature)"] ?? "-").padStart(3)}`);
  }

  const n = rows.length;
  console.log(`\n${"=".repeat(78)}\nSCORED ${n} songs with previews (of ${list.length})\n${"=".repeat(78)}`);
  console.log("strategy".padEnd(38) + "exact".padStart(7) + "octave".padStart(8) + "miss".padStart(6) + "   slow / mid / fast (exact%)");
  for (const [name, r] of Object.entries(results)) {
    const pct = (x) => (n ? Math.round((100 * x) / n) : 0);
    const band = BANDS.map((b) => {
      const bb = r.byBand[b];
      return bb.n ? `${Math.round((100 * bb.exact) / bb.n)}%` : "-";
    }).join(" / ");
    console.log(
      name.padEnd(38) +
        `${pct(r.exact)}%`.padStart(7) +
        `${pct(r.octave)}%`.padStart(8) +
        `${pct(r.miss)}%`.padStart(6) +
        "   " + band,
    );
  }
  console.log("\nexact = within ±2 BPM of truth. octave = right pulse, wrong multiple.");
  if (process.env.DUMP) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(process.env.DUMP, JSON.stringify(rows, null, 1));
    console.log("dumped per-song rows -> " + process.env.DUMP);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
