import test from "node:test";
import assert from "node:assert/strict";
import { FADE_SECONDS, fadeRampSeconds, fadeEnvelopeGain } from "../lib/audio/fade";

test("ramp is FADE_SECONDS on long selections, half the selection on short ones", () => {
  assert.equal(fadeRampSeconds(30), FADE_SECONDS);
  assert.equal(fadeRampSeconds(2), 1);
  assert.equal(fadeRampSeconds(0), 0);
});

test("fade-in ramps 0 to 1 across the ramp window", () => {
  // selection [10, 30] -> ramp 2s
  assert.equal(fadeEnvelopeGain(10, 10, 30, true, false), 0);
  assert.equal(fadeEnvelopeGain(11, 10, 30, true, false), 0.5);
  assert.equal(fadeEnvelopeGain(12, 10, 30, true, false), 1);
  assert.equal(fadeEnvelopeGain(20, 10, 30, true, false), 1);
});

test("fade-out ramps 1 to 0 into the end", () => {
  assert.equal(fadeEnvelopeGain(28, 10, 30, false, true), 1);
  assert.equal(fadeEnvelopeGain(29, 10, 30, false, true), 0.5);
  assert.equal(fadeEnvelopeGain(30, 10, 30, false, true), 0);
});

test("disabled fades leave gain at 1 everywhere in the selection", () => {
  for (const t of [10, 11, 20, 29, 30]) {
    assert.equal(fadeEnvelopeGain(t, 10, 30, false, false), 1);
  }
});

test("overlapping short-selection fades take the minimum of both ramps", () => {
  // selection [0, 2] -> ramp 1s; at t=0.5 fade-in gives 0.5, fade-out gives 1
  assert.equal(fadeEnvelopeGain(0.5, 0, 2, true, true), 0.5);
  // dead center: both give 1 -> gain 1... ramp=1, fadeIn at t=1 -> outside in-window [0,1); fadeOut window (1,2] -> outside; gain 1
  assert.equal(fadeEnvelopeGain(1, 0, 2, true, true), 1);
  assert.equal(fadeEnvelopeGain(1.5, 0, 2, true, true), 0.5);
});
