// One-off / re-runnable seeder for the programmatic /song/<slug> pages.
//
// For each popular track from Deezer's public charts it downloads the free 30s
// preview, decodes it with the bundled ffmpeg, and runs the SAME essentia
// analysis the browser worker uses (identical PercivalBpmEstimator + KeyExtractor
// params and the same [105,210) BPM fold), then upserts a row into the Supabase
// `link_analysis` table — the exact table the live "analyze from link" feature
// writes to. The DB trigger fills the SEO slug. Results are labeled source
// "preview" so pages can disclose they come from a 30-second sample.
//
//   node scripts/seed-songs.mjs            # full run (~300 songs)
//   node scripts/seed-songs.mjs 3          # smoke test: first 3 only
//
// Env: reads SUPABASE_URL + SUPABASE_ANON_KEY from .env.local.

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// essentia's emscripten wasm build takes its Node branch (process exists) and
// references CommonJS `__dirname`/`require`, which don't exist in an ESM module.
// Shim them as globals, pointed at the dist dir so it can locate the .wasm.
globalThis.require = createRequire(import.meta.url);
globalThis.__dirname = resolve(ROOT, "node_modules/essentia.js/dist");
const FFMPEG = resolve(ROOT, "node_modules/ffmpeg-static/ffmpeg");
const LIMIT = Number(process.argv[2]) || Infinity;

// ---- env ------------------------------------------------------------------
const env = Object.fromEntries(
  readFileSync(resolve(ROOT, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);
const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Missing Supabase creds in .env.local");

// ---- analysis constants (mirror workers/analysis.worker.ts) ----------------
const ANALYSIS_RATE = 16000;
const FOLD_MIN = 105;
const FOLD_MAX = 210;
const FLAT_TO_SHARP = { Ab: "G#", Bb: "A#", Cb: "B", Db: "C#", Eb: "D#", Fb: "E", Gb: "F#" };
const CAMELOT = {
  "C Major": "8B", "G Major": "9B", "D Major": "10B", "A Major": "11B", "E Major": "12B", "B Major": "1B",
  "F# Major": "2B", "C# Major": "3B", "G# Major": "4B", "D# Major": "5B", "A# Major": "6B", "F Major": "7B",
  "A Minor": "8A", "E Minor": "9A", "B Minor": "10A", "F# Minor": "11A", "C# Minor": "12A", "G# Minor": "1A",
  "D# Minor": "2A", "A# Minor": "3A", "F Minor": "4A", "C Minor": "5A", "G Minor": "6A", "D Minor": "7A",
};

function foldBpm(rawBpm) {
  let folded = rawBpm;
  let dir = null;
  while (folded > 0 && folded < FOLD_MIN) { folded *= 2; dir = "up"; }
  while (folded >= FOLD_MAX) { folded /= 2; dir = "down"; }
  const bpm = Math.round(folded);
  const alt = dir === "up" ? Math.round(folded / 2) : dir === "down" ? Math.round(folded * 2) : null;
  return { bpm, alt };
}

// ---- essentia (same ES builds as the worker) -------------------------------
// Some emscripten globals are browser-shaped; shim before importing the wasm.
if (typeof globalThis.self === "undefined") globalThis.self = globalThis;
let essentia = null;
async function getEssentia() {
  if (essentia) return essentia;
  const [{ default: Essentia }, { EssentiaWASM }] = await Promise.all([
    import("essentia.js/dist/essentia.js-core.es.js"),
    import("essentia.js/dist/essentia-wasm.es.js"),
  ]);
  const wasm = EssentiaWASM;
  const deadline = Date.now() + 8000;
  while (!wasm.calledRun && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20));
  essentia = new Essentia(EssentiaWASM);
  return essentia;
}

function rms(s) {
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += s[i] * s[i];
  return Math.sqrt(sum / Math.max(1, s.length));
}

function analyze(es, samples) {
  const cleanup = [];
  try {
    const signal = es.arrayToVector(samples);
    cleanup.push(signal);
    const rawBpm = es.PercivalBpmEstimator(signal, 1024, 2048, 128, 128, 210, 50, ANALYSIS_RATE).bpm;
    const k = es.KeyExtractor(signal, true, 4096, 4096, 12, 3500, 60, 25, 0.2, "bgate", ANALYSIS_RATE, 0.0001, 440, "cosine", "hann");
    const dance = es.Danceability(signal, 8800, 310, ANALYSIS_RATE);
    if (dance.dfa) cleanup.push(dance.dfa);
    const loud = rms(samples) > 0 ? 20 * Math.log10(rms(samples)) : -96;
    const energy = Math.max(0, Math.min(1, (loud + 30) / 25));
    const danceability = Math.max(0, Math.min(1, dance.danceability / 3));
    const root = FLAT_TO_SHARP[k.key] || k.key;
    const scale = k.scale === "minor" ? "Minor" : "Major";
    const { bpm, alt } = foldBpm(rawBpm);
    const key = `${root} ${scale}`;
    return {
      bpm, bpm_alt: alt, key, camelot: CAMELOT[key] ?? null,
      energy: Math.round(energy * 1000) / 1000,
      danceability: Math.round(danceability * 1000) / 1000,
      loudness_db: Math.round(loud * 10) / 10,
    };
  } finally {
    for (const c of cleanup) { try { c.delete?.(); } catch {} }
  }
}

// ---- ffmpeg decode: mp3 buffer -> 16kHz mono Float32Array -------------------
function decode(mp3) {
  return new Promise((res, rej) => {
    const ff = spawn(FFMPEG, ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-ac", "1", "-ar", String(ANALYSIS_RATE), "-f", "f32le", "pipe:1"]);
    const out = [];
    ff.stdout.on("data", (d) => out.push(d));
    ff.on("error", rej);
    ff.on("close", (code) => {
      if (code !== 0) return rej(new Error("ffmpeg exit " + code));
      const buf = Buffer.concat(out);
      res(new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4)));
    });
    ff.stdin.on("error", () => {});
    ff.stdin.end(mp3);
  });
}

// ---- Deezer charts (keyless) ----------------------------------------------
const CHARTS = [
  ["global", "https://api.deezer.com/chart/0/tracks?limit=100"],
  ["pop", "https://api.deezer.com/chart/132/tracks?limit=100"],
  ["rap", "https://api.deezer.com/chart/116/tracks?limit=100"],
  ["dance", "https://api.deezer.com/chart/113/tracks?limit=100"],
  ["rock", "https://api.deezer.com/chart/152/tracks?limit=50"],
  ["rnb", "https://api.deezer.com/chart/165/tracks?limit=50"],
  ["electro", "https://api.deezer.com/chart/106/tracks?limit=50"],
  ["alt", "https://api.deezer.com/chart/85/tracks?limit=50"],
];

async function collectTracks() {
  const byId = new Map();
  for (const [name, url] of CHARTS) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const j = await r.json();
      for (const t of j.data || []) {
        if (t.preview && t.id && t.title && !byId.has(t.id)) {
          byId.set(t.id, { id: t.id, title: t.title, artist: t.artist?.name || "", preview: t.preview, duration: t.duration || null });
        }
      }
      console.log(`chart ${name}: ${j.data?.length ?? 0} tracks (${byId.size} unique so far)`);
    } catch (e) {
      console.log(`chart ${name}: failed (${e.message})`);
    }
  }
  return [...byId.values()];
}

async function upsert(row) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/link_analysis`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates",
    },
    body: JSON.stringify(row),
    signal: AbortSignal.timeout(10000),
  });
  return r.ok;
}

// ---- main ------------------------------------------------------------------
const es = await getEssentia();
console.log("essentia ready:", !!es);
const tracks = (await collectTracks()).slice(0, LIMIT);
console.log(`\nseeding ${tracks.length} tracks...\n`);

let ok = 0, fail = 0;
for (const [i, t] of tracks.entries()) {
  const label = `${t.artist} - ${t.title}`.slice(0, 50);
  try {
    const resp = await fetch(t.preview, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) throw new Error("preview " + resp.status);
    const mp3 = Buffer.from(await resp.arrayBuffer());
    const samples = await decode(mp3);
    if (samples.length < ANALYSIS_RATE * 5) throw new Error("too short");
    const a = analyze(es, samples);
    const row = {
      id: `dz:${t.id}`,
      title: t.title.slice(0, 200),
      artist: (t.artist || null)?.slice(0, 200) ?? null,
      ...a,
      duration_s: t.duration || null,
      source: "preview",
    };
    const wrote = await upsert(row);
    if (wrote) { ok++; console.log(`[${i + 1}/${tracks.length}] OK   ${label}  ->  ${a.bpm} BPM ${a.key} ${a.camelot ?? ""}`); }
    else { fail++; console.log(`[${i + 1}/${tracks.length}] WRITE-FAIL ${label}`); }
  } catch (e) {
    fail++;
    console.log(`[${i + 1}/${tracks.length}] SKIP ${label} (${e.message})`);
  }
}
console.log(`\ndone: ${ok} written, ${fail} skipped`);
