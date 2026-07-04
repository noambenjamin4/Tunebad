// Pure TypeScript ITU-R BS.1770-4 integrated loudness meter. This is the
// primary measurement engine for the Loudness Penalty tool (not a fallback) —
// callers MUST provide 48000 Hz audio since the K-weighting biquad
// coefficients below are only valid at that sample rate.

export interface PlatformTarget {
  name: string;
  lufs: number;
}

export const PLATFORM_TARGETS: PlatformTarget[] = [
  { name: "Spotify", lufs: -14 },
  { name: "YouTube", lufs: -14 },
  { name: "TIDAL", lufs: -14 },
  { name: "Apple Music", lufs: -16 },
  { name: "Amazon Music", lufs: -14 },
  { name: "Deezer", lufs: -15 },
  { name: "Pandora", lufs: -14 },
];

const REQUIRED_SAMPLE_RATE = 48000;

// Stage 1: BS.1770 pre-filter (high shelf). Stage 2: RLB high-pass.
// Coefficients are normalized (a0 = 1) and valid at 48 kHz only.
const STAGE1 = { b0: 1.53512485958697, b1: -2.69169618940638, b2: 1.19839281085285, a1: -1.69065929318241, a2: 0.73248077421585 };
const STAGE2 = { b0: 1.0, b1: -2.0, b2: 1.0, a1: -1.99004745483398, a2: 0.99007225036621 };

// Direct Form I biquad, writing into `output` (which may alias `input` for a
// true in-place pass: since we read input[i] into a local before writing
// output[i], and x1/x2/y1/y2 are kept as scalars rather than re-read from the
// array, overwriting input[i] with output[i] on the same index is safe).
function biquad(
  input: Float32Array,
  output: Float32Array,
  coeffs: { b0: number; b1: number; b2: number; a1: number; a2: number },
): Float32Array {
  const { b0, b1, b2, a1, a2 } = coeffs;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < input.length; i += 1) {
    const x0 = input[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    output[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return output;
}

// Applies both K-weighting stages using at most one scratch array: stage 1
// copies `samples` into a fresh buffer (never mutating the caller's input),
// stage 2 then runs in place on that same buffer.
function kWeight(samples: Float32Array): Float32Array {
  const scratch = new Float32Array(samples.length);
  biquad(samples, scratch, STAGE1);
  biquad(scratch, scratch, STAGE2);
  return scratch;
}

// 400 ms blocks with 75% overlap (100 ms hop), per BS.1770-4 gating.
function blockPowers(left: Float32Array, right: Float32Array, sampleRate: number): number[] {
  const blockSize = Math.round(0.4 * sampleRate);
  const hopSize = Math.round(0.1 * sampleRate);
  const powers: number[] = [];
  if (left.length < blockSize) return powers;

  for (let start = 0; start + blockSize <= left.length; start += hopSize) {
    let sumL = 0;
    let sumR = 0;
    for (let i = start; i < start + blockSize; i += 1) {
      sumL += left[i] * left[i];
      sumR += right[i] * right[i];
    }
    const z = sumL / blockSize + sumR / blockSize;
    powers.push(z);
  }
  return powers;
}

function loudnessFromPower(z: number): number {
  return -0.691 + 10 * Math.log10(z);
}

// PURE TypeScript BS.1770-4 integrated loudness meter (primary engine).
// `left`/`right` must be 48000 Hz; pass the same array twice for mono input.
export function integratedLoudness(left: Float32Array, right: Float32Array, sampleRate: number): number {
  if (sampleRate !== REQUIRED_SAMPLE_RATE) {
    throw new Error(`integratedLoudness requires ${REQUIRED_SAMPLE_RATE} Hz audio, received ${sampleRate} Hz`);
  }

  const kLeft = kWeight(left);
  const kRight = kWeight(right);
  const powers = blockPowers(kLeft, kRight, sampleRate);
  if (!powers.length) return -70;

  // Absolute gate: keep blocks louder than -70 LUFS.
  const absoluteGated = powers.filter((z) => loudnessFromPower(z) > -70);
  if (!absoluteGated.length) return -70;

  // Relative gate: threshold is 10 LU below the mean power of the
  // absolute-gated blocks.
  const meanAbsolutePower = absoluteGated.reduce((sum, z) => sum + z, 0) / absoluteGated.length;
  const relativeThreshold = loudnessFromPower(meanAbsolutePower) - 10;
  const relativeGated = absoluteGated.filter((z) => loudnessFromPower(z) > relativeThreshold);
  if (!relativeGated.length) return -70;

  const meanFinalPower = relativeGated.reduce((sum, z) => sum + z, 0) / relativeGated.length;
  return loudnessFromPower(meanFinalPower);
}

// 20*log10(max |sample|) across all channels, floored at -96 dBFS.
export function samplePeakDb(channels: Float32Array[]): number {
  let peak = 0;
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i += 1) {
      const abs = Math.abs(channel[i]);
      if (abs > peak) peak = abs;
    }
  }
  return peak > 0 ? 20 * Math.log10(peak) : -96;
}
