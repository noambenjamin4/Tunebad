// Min/max peak pyramid for fast, exact waveform rendering (ported from the
// TuneBad extension's sampler, where it's proven at retina resolution). One
// pyramid per decoded buffer, built once at add time; windowMinMax then
// answers "min/max over samples [from, to)" in O(range/256) instead of
// O(range), with raw samples at the ragged edges so a single-sample spike is
// never lost at any zoom level.

const PYRAMID_BLOCK = 256;

export interface PeakPyramid {
  mins: Float32Array;
  maxs: Float32Array;
  /**
   * Sum of squares per block. Peaks alone draw a spiky outline that says
   * nothing about how LOUD a passage is — a lone transient looks like a
   * wall of sound. Carrying energy too lets the renderer fill an RMS body
   * inside the peak outline, which is how a waveform reads as music.
   */
  sums: Float32Array;
  /** Source length in samples. */
  length: number;
}

export function buildPeakPyramid(data: Float32Array): PeakPyramid {
  const blocks = Math.max(1, Math.ceil(data.length / PYRAMID_BLOCK));
  const mins = new Float32Array(blocks);
  const maxs = new Float32Array(blocks);
  const sums = new Float32Array(blocks);
  for (let b = 0; b < blocks; b++) {
    const from = b * PYRAMID_BLOCK;
    const to = Math.min(from + PYRAMID_BLOCK, data.length);
    let mn = Infinity;
    let mx = -Infinity;
    let sq = 0;
    for (let i = from; i < to; i++) {
      const v = data[i];
      if (v < mn) mn = v;
      if (v > mx) mx = v;
      sq += v * v;
    }
    mins[b] = mn;
    maxs[b] = mx;
    sums[b] = sq;
  }
  return { mins, maxs, sums, length: data.length };
}

export interface MinMax {
  min: number;
  max: number;
  /** Root-mean-square over the same window: the body of the waveform. */
  rms: number;
}

/**
 * Exact min/max over samples [from, to): whole pyramid blocks for the
 * interior, raw samples for the edges. `data` must be the same channel the
 * pyramid was built from. Returns {0,0} for an empty range.
 */
export function windowMinMax(
  data: Float32Array,
  pyramid: PeakPyramid,
  from: number,
  to: number,
): MinMax {
  const lo = Math.max(0, Math.floor(from));
  const hi = Math.min(data.length, Math.ceil(to));
  if (hi <= lo) return { min: 0, max: 0, rms: 0 };

  let mn = Infinity;
  let mx = -Infinity;
  let sq = 0;
  const firstFull = Math.ceil(lo / PYRAMID_BLOCK);
  const lastFull = Math.floor(hi / PYRAMID_BLOCK);

  if (firstFull >= lastFull) {
    for (let i = lo; i < hi; i++) {
      const v = data[i];
      if (v < mn) mn = v;
      if (v > mx) mx = v;
      sq += v * v;
    }
  } else {
    for (let i = lo, edge = firstFull * PYRAMID_BLOCK; i < edge; i++) {
      const v = data[i];
      if (v < mn) mn = v;
      if (v > mx) mx = v;
      sq += v * v;
    }
    for (let b = firstFull; b < lastFull; b++) {
      if (pyramid.mins[b] < mn) mn = pyramid.mins[b];
      if (pyramid.maxs[b] > mx) mx = pyramid.maxs[b];
      sq += pyramid.sums[b];
    }
    for (let i = lastFull * PYRAMID_BLOCK; i < hi; i++) {
      const v = data[i];
      if (v < mn) mn = v;
      if (v > mx) mx = v;
      sq += v * v;
    }
  }
  return { min: mn, max: mx, rms: Math.sqrt(sq / (hi - lo)) };
}
