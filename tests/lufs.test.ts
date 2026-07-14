import test from "node:test";
import assert from "node:assert/strict";
import { integratedLoudness, samplePeakDb } from "../lib/audio/lufs";

// BS.1770-4 / EBU R128 golden values (EBU Tech 3341 compliance case): a
// 997 Hz STEREO sine at N dBFS per-channel peak must read N LUFS — the
// spec's -0.691 offset exists precisely to cancel the K-weighting gain at
// 997 Hz. Tolerance 0.5 LU (the K-filter is a 48k-designed biquad).

function sine(freq: number, seconds: number, sampleRate: number, amplitude: number): Float32Array {
  const out = new Float32Array(Math.round(seconds * sampleRate));
  for (let i = 0; i < out.length; i += 1) out[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  return out;
}

test("997 Hz full-scale stereo sine reads ~0 LUFS", () => {
  const s = sine(997, 5, 48000, 1.0);
  const lufs = integratedLoudness(s, s, 48000);
  assert.ok(Math.abs(lufs - 0) < 0.5, `expected ~0, got ${lufs}`);
});

test("997 Hz stereo sine at -20 dBFS reads -20 LUFS (EBU 3341)", () => {
  const s = sine(997, 5, 48000, 0.1);
  const lufs = integratedLoudness(s, s, 48000);
  assert.ok(Math.abs(lufs - -20) < 0.5, `expected ~-20, got ${lufs}`);
});

test("gain linearity: +6 dB of amplitude is +6 LU of loudness", () => {
  const a = sine(997, 5, 48000, 0.25);
  const b = sine(997, 5, 48000, 0.5);
  const diff = integratedLoudness(b, b, 48000) - integratedLoudness(a, a, 48000);
  assert.ok(Math.abs(diff - 6.02) < 0.1, `expected ~6.02 LU, got ${diff}`);
});

test("silence gates to -Infinity (or far below any target)", () => {
  const s = new Float32Array(48000 * 3);
  const lufs = integratedLoudness(s, s, 48000);
  assert.ok(lufs < -60, `expected gated silence, got ${lufs}`);
});

test("samplePeakDb reports the true peak sample", () => {
  const s = new Float32Array(1000);
  s[500] = 0.5; // -6.02 dBFS
  const db = samplePeakDb([s]);
  assert.ok(Math.abs(db - -6.02) < 0.01, `expected -6.02, got ${db}`);
});
