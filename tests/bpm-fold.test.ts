import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
// @ts-expect-error - plain .mjs shared with the Node seeder, typed via JSDoc
import { foldBpm, FOLD_MIN, FOLD_MAX } from "../scripts/bpm-fold.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// These tests exist because the fold shipped WRONG and nothing caught it. The
// window was [105, 210), which cannot represent any tempo below 105 — so
// 130,000 catalog rows claimed a tempo no human would clap, on the one number
// the whole site is about. Every assertion below fails under that old window.

test("the window is musical: slow tempos survive unfolded", () => {
  // Each of these is a real song's true tempo that the OLD [105,210) window
  // doubled. If someone widens the floor back above these, this fails loudly.
  const realSlowTempos = [
    { bpm: 90, song: "In Da Club" },
    { bpm: 86, song: "Lose Yourself" },
    { bpm: 75, song: "HUMBLE." },
    { bpm: 67, song: "Someone Like You" },
    { bpm: 63, song: "Perfect" },
  ];
  for (const { bpm, song } of realSlowTempos) {
    assert.equal(foldBpm(bpm).bpm, bpm, `${song} (${bpm} BPM) must not be doubled`);
  }
});

test("output always lands inside [FOLD_MIN, FOLD_MAX)", () => {
  for (let raw = 20; raw <= 400; raw += 0.5) {
    const { bpm } = foldBpm(raw);
    assert.ok(bpm >= FOLD_MIN - 1, `raw ${raw} -> ${bpm} below floor`);
    assert.ok(bpm < FOLD_MAX + 1, `raw ${raw} -> ${bpm} above ceiling`);
  }
});

test("folding only ever halves or doubles — never invents a tempo", () => {
  for (let raw = 20; raw <= 400; raw += 0.5) {
    const { bpm } = foldBpm(raw);
    // bpm must be raw * 2^n for some integer n (within rounding).
    const ratio = bpm / raw;
    const log2 = Math.log2(ratio);
    assert.ok(
      Math.abs(log2 - Math.round(log2)) < 0.02,
      `raw ${raw} -> ${bpm} is not an octave of the input (ratio ${ratio})`,
    );
  }
});

test("alt carries the other octave, and only when a fold happened", () => {
  assert.equal(foldBpm(90).alt, null, "an in-window tempo has no alternate");
  assert.equal(foldBpm(45).alt, 45, "folded up: alt is the original");
  assert.equal(foldBpm(200).alt, 200, "folded down: alt is the original");
});

test("boundaries are half-open: FOLD_MIN is in, FOLD_MAX is out", () => {
  assert.equal(foldBpm(FOLD_MIN).bpm, FOLD_MIN);
  assert.equal(foldBpm(FOLD_MAX).bpm, FOLD_MAX / 2, "the ceiling itself must fold down");
});

test("the browser engine has not drifted from the seeder", () => {
  // The two engines each had their OWN copy of this logic. Both were wrong the
  // same way, which is the only reason the site was merely wrong instead of
  // self-contradicting. This asserts the worker's constants still match the
  // shared module, so a fix to one can never silently miss the other.
  const worker = readFileSync(resolve(ROOT, "workers/analysis.worker.ts"), "utf8");
  const min = worker.match(/const FOLD_MIN = (\d+)/);
  const max = worker.match(/const FOLD_MAX = (\d+)/);
  assert.ok(min && max, "worker must declare FOLD_MIN/FOLD_MAX");
  assert.equal(Number(min[1]), FOLD_MIN, "worker FOLD_MIN drifted from scripts/bpm-fold.mjs");
  assert.equal(Number(max[1]), FOLD_MAX, "worker FOLD_MAX drifted from scripts/bpm-fold.mjs");
});
