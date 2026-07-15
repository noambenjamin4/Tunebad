// Key-detector experiment. Read-only: fetches previews, runs KeyExtractor under
// different profiles and sample rates, scores against scripts/key-truth.mjs.
// Writes NOTHING to the DB and changes no shipped code.
//
// TWO HYPOTHESES UNDER TEST:
//  1. PROFILE. The analyzer uses "bgate". Essentia ships several key profiles;
//     "edma" is tuned for electronic music, "temperley"/"krumhansl" for
//     common-practice tonal music. Nobody measured which is best for THIS mix
//     of songs — bgate may just be the default someone reached for.
//  2. SAMPLE RATE. The analyzer resamples to 16 kHz before analysis
//     (hooks/useAnalyzer.ts). Essentia's key defaults assume 44.1 kHz; the HPCP
//     bins are computed from the spectrum, so a 2.75x coarser one may cost
//     resolution. 16 kHz is a real speed win, so the question is what it COSTS.
//
//   node scripts/key-experiment.mjs [limit]

import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { KEY_TRUTH, relativeOf } from "./key-truth.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FFMPEG = resolve(ROOT, "node_modules/ffmpeg-static/ffmpeg");

if (typeof globalThis.self === "undefined") globalThis.self = globalThis;
globalThis.require = createRequire(import.meta.url);
globalThis.__dirname = resolve(ROOT, "node_modules/essentia.js/dist");

const FLAT_TO_SHARP = { Ab: "G#", Bb: "A#", Cb: "B", Db: "C#", Eb: "D#", Fb: "E", Gb: "F#" };

// The shipped call, verbatim, so "current" is the real baseline:
//   KeyExtractor(signal, true, 4096, 4096, 12, 3500, 60, 25, 0.2, "bgate", 16000, 0.0001, 440, "cosine", "hann")
const PROFILES = ["bgate", "edma", "temperley", "krumhansl", "shaath", "braw"];
const RATES = [16000, 44100];

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

async function findPreview(q) {
  const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=5`);
  if (!res.ok) return null;
  const json = await res.json();
  const hit = (json.data || []).find((d) => d.preview);
  return hit ? hit.preview : null;
}

function detect(es, samples, profile, rate) {
  const signal = es.arrayToVector(samples);
  try {
    const k = es.KeyExtractor(signal, true, 4096, 4096, 12, 3500, 60, 25, 0.2, profile, rate, 0.0001, 440, "cosine", "hann");
    const root = FLAT_TO_SHARP[k.key] || k.key;
    const scale = k.scale === "minor" ? "Minor" : "Major";
    return `${root} ${scale}`;
  } catch {
    return null;
  } finally {
    signal.delete?.();
  }
}

async function main() {
  const limit = Number(process.argv[2]) || KEY_TRUTH.length;
  const list = KEY_TRUTH.slice(0, limit);
  const es = await getEssentia();

  const combos = [];
  for (const rate of RATES) for (const profile of PROFILES) combos.push({ rate, profile });
  const score = {};
  for (const c of combos) score[`${c.profile}@${c.rate}`] = { exact: 0, relative: 0, wrong: 0, byGenre: {} };

  let n = 0, done = 0;
  for (const t of list) {
    done++;
    let preview;
    try { preview = await findPreview(t.q); } catch { preview = null; }
    if (!preview) { console.log(`[${done}/${list.length}] SKIP ${t.title}`); continue; }
    let mp3;
    try { mp3 = Buffer.from(await (await fetch(preview)).arrayBuffer()); } catch { continue; }

    const byRate = {};
    for (const rate of RATES) {
      try { byRate[rate] = await decode(mp3, rate); } catch { byRate[rate] = null; }
    }
    if (!byRate[16000]) continue;
    n++;

    const rel = relativeOf(t.key);
    const line = [];
    for (const { rate, profile } of combos) {
      const samples = byRate[rate];
      const key = `${profile}@${rate}`;
      if (!samples) { score[key].wrong++; continue; }
      const got = detect(es, samples, profile, rate);
      const s = got === t.key ? "exact" : got === rel ? "relative" : "wrong";
      score[key][s]++;
      const g = score[key].byGenre[t.genre] || (score[key].byGenre[t.genre] = { exact: 0, n: 0 });
      g.n++; if (s === "exact") g.exact++;
      if (profile === "bgate" && rate === 16000) line.push(`cur=${got}`);
      if (profile === "edma" && rate === 44100) line.push(`edma44=${got}`);
    }
    console.log(`[${done}/${list.length}] ${t.title.slice(0, 26).padEnd(26)} truth=${t.key.padEnd(9)} ${line.join("  ")}`);
  }

  console.log(`\n${"=".repeat(74)}\nSCORED ${n} songs\n${"=".repeat(74)}`);
  console.log("combo".padEnd(20) + "exact".padStart(7) + "  +rel".padStart(8) + "  wrong".padStart(8) + "   elec/pop/rock");
  const rows = Object.entries(score).sort((a, b) => b[1].exact - a[1].exact);
  for (const [name, r] of rows) {
    const pct = (x) => (n ? Math.round((100 * x) / n) : 0);
    const g = ["electronic", "pop", "rock"].map((k) => {
      const b = r.byGenre[k];
      return b && b.n ? `${Math.round((100 * b.exact) / b.n)}%` : "-";
    }).join("/");
    console.log(
      name.padEnd(20) + `${pct(r.exact)}%`.padStart(7) + `${pct(r.exact + r.relative)}%`.padStart(8) +
      `${pct(r.wrong)}%`.padStart(8) + "   " + g,
    );
  }
  console.log("\nexact = same root AND scale. +rel = also counting the relative major/minor");
  console.log("(shares all 7 notes; a DJ can often still mix it, but it IS a different answer).");
}

main().catch((e) => { console.error(e); process.exit(1); });
