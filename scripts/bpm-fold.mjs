// The tempo octave fold — the single most consequential number on the site.
//
// An autocorrelation tempo estimator can't tell 90 BPM from 180: both fit the
// beat grid. So the raw estimate gets folded into a window, and the window
// choice decides whether "In Da Club" reads 90 (right) or 181 (wrong).
//
// WHY THIS FILE EXISTS: this logic lived, duplicated, in two engines
// (scripts/seed-songs.mjs and workers/analysis.worker.ts) with ZERO tests. It
// shipped with a [105, 210) window, which made every song slower than 105 BPM
// impossible to represent — 130,000 catalog rows claim a tempo no human would
// clap, and the site's core claim was wrong for a third of its songs. A window
// this load-bearing needs one home and real tests. See tests/bpm-fold.test.ts.
//
// [60, 180) is a musical range: it covers ballads and hip-hop at the bottom
// without doubling them, and drum-and-bass folds down into the same span its
// listeners count in. It is NOT free — see the test file for the measured
// trade-off against fast/EDM tracks.
export const FOLD_MIN = 60;
export const FOLD_MAX = 180;

/**
 * Fold a raw tempo estimate into [FOLD_MIN, FOLD_MAX).
 * @param {number} rawBpm estimator output, any octave
 * @returns {{ bpm: number, alt: number|null }} folded tempo, plus the other
 *   octave when a fold happened (so a page can offer "or 90 BPM").
 */
export function foldBpm(rawBpm) {
  let folded = rawBpm;
  let dir = null;
  while (folded > 0 && folded < FOLD_MIN) {
    folded *= 2;
    dir = "up";
  }
  while (folded >= FOLD_MAX) {
    folded /= 2;
    dir = "down";
  }
  const bpm = Math.round(folded);
  const alt = dir === "up" ? Math.round(folded / 2) : dir === "down" ? Math.round(folded * 2) : null;
  return { bpm, alt };
}
