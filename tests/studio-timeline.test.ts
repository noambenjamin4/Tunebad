import test from "node:test";
import assert from "node:assert/strict";
import {
  type StudioClip,
  MIN_CLIP_SECONDS,
  clipDuration,
  timelineDuration,
  assignDisplayRows,
  computeClipSchedule,
  moveClip,
  trimClipStart,
  trimClipEnd,
  splitClip,
} from "../lib/studio/timeline";
import { rulerStepSeconds } from "../lib/studio/timeline-math";
import { automatedOutputDuration } from "../lib/audio/remix";

let nextId = 100;
const makeId = () => `t${nextId++}`;

function clip(overrides: Partial<StudioClip>): StudioClip {
  return {
    id: overrides.id ?? makeId(),
    name: "clip",
    bufferId: "buf",
    timelineStart: 0,
    clipStart: 0,
    clipEnd: 10,
    gain: 1,
    fadeInSec: 0,
    fadeOutSec: 0,
    colorIndex: 0,
    ...overrides,
  };
}

test("timelineDuration is the end of the last clip", () => {
  assert.equal(timelineDuration([]), 0);
  const a = clip({ timelineStart: 0, clipStart: 0, clipEnd: 10 });
  const b = clip({ timelineStart: 7, clipStart: 5, clipEnd: 20 }); // 15s long, ends at 22
  assert.equal(timelineDuration([a, b]), 22);
});

test("assignDisplayRows: disjoint clips share row 0", () => {
  const a = clip({ id: "a", timelineStart: 0, clipEnd: 5 });
  const b = clip({ id: "b", timelineStart: 5, clipEnd: 5, clipStart: 0 });
  const rows = assignDisplayRows([b, a]);
  assert.equal(rows.get("a"), 0);
  assert.equal(rows.get("b"), 0);
});

test("assignDisplayRows: overlap stacks, third clip reuses freed row", () => {
  const a = clip({ id: "a", timelineStart: 0, clipEnd: 10 }); // [0,10)
  const b = clip({ id: "b", timelineStart: 7, clipEnd: 10 }); // [7,17) overlaps a
  const c = clip({ id: "c", timelineStart: 12, clipEnd: 5 }); // [12,17) after a ended
  const rows = assignDisplayRows([a, b, c]);
  assert.equal(rows.get("a"), 0);
  assert.equal(rows.get("b"), 1);
  assert.equal(rows.get("c"), 0); // row 0 free again at t=12
});

test("assignDisplayRows: triple overlap needs three rows", () => {
  const a = clip({ id: "a", timelineStart: 0, clipEnd: 10 });
  const b = clip({ id: "b", timelineStart: 1, clipEnd: 10 });
  const c = clip({ id: "c", timelineStart: 2, clipEnd: 10 });
  const rows = assignDisplayRows([a, b, c]);
  assert.deepEqual(
    [rows.get("a"), rows.get("b"), rows.get("c")],
    [0, 1, 2],
  );
});

test("computeClipSchedule at position 0, speed 1: beat-switch overlap", () => {
  // A: 30s starting at 0; B: 20s starting at 25 (over A's last 5s).
  const a = clip({ id: "a", timelineStart: 0, clipStart: 0, clipEnd: 30 });
  const b = clip({ id: "b", timelineStart: 25, clipStart: 10, clipEnd: 30 });
  const sched = computeClipSchedule([b, a], 0, 1);
  assert.equal(sched.length, 2);
  assert.equal(sched[0].clipId, "a");
  assert.equal(sched[0].when, 0);
  assert.equal(sched[0].offsetInBuffer, 0);
  assert.equal(sched[0].sourceDuration, 30);
  assert.equal(sched[1].clipId, "b");
  assert.equal(sched[1].when, 25);
  assert.equal(sched[1].offsetInBuffer, 10);
  assert.equal(sched[1].sourceDuration, 20);
});

test("computeClipSchedule mid-clip position: offset advances, when clamps to 0", () => {
  const a = clip({ id: "a", timelineStart: 0, clipStart: 2, clipEnd: 32 }); // 30s of source
  const sched = computeClipSchedule([a], 12, 1);
  assert.equal(sched.length, 1);
  assert.equal(sched[0].when, 0);
  assert.equal(sched[0].offsetInBuffer, 14); // clipStart 2 + 12 into the clip
  assert.equal(sched[0].sourceDuration, 18);
});

test("computeClipSchedule: clip fully behind the playhead is dropped", () => {
  const a = clip({ id: "a", timelineStart: 0, clipEnd: 10 });
  const b = clip({ id: "b", timelineStart: 20, clipEnd: 10, clipStart: 0 });
  const sched = computeClipSchedule([a, b], 15, 1);
  assert.equal(sched.length, 1);
  assert.equal(sched[0].clipId, "b");
  assert.equal(sched[0].when, 5);
});

test("computeClipSchedule at speed 0.5: wall-clock times double, source times don't", () => {
  const b = clip({ id: "b", timelineStart: 10, clipStart: 0, clipEnd: 20, fadeInSec: 2 });
  const sched = computeClipSchedule([b], 0, 0.5);
  assert.equal(sched[0].when, 20); // 10 timeline secs at half speed
  assert.equal(sched[0].offsetInBuffer, 0);
  assert.equal(sched[0].sourceDuration, 20); // source material untouched by rate
  // fade-in ends 2 timeline secs into the clip = wall 24s
  const points = sched[0].fadePoints;
  assert.equal(points[0].at, 20);
  assert.equal(points[0].gain, 0);
  assert.equal(points[1].at, 24);
  assert.equal(points[1].gain, 1);
});

test("computeClipSchedule fades: full envelope with gain scaling", () => {
  const a = clip({
    id: "a", timelineStart: 0, clipStart: 0, clipEnd: 10,
    fadeInSec: 2, fadeOutSec: 4, gain: 0.5,
  });
  const [s] = computeClipSchedule([a], 0, 1);
  // start(0)=0, fadeInEnd(2)=full, fadeOutStart(6)=full, end(10)=0 — all ×0.5
  assert.deepEqual(
    s.fadePoints.map((p) => [p.at, p.gain]),
    [[0, 0], [2, 0.5], [6, 0.5], [10, 0]],
  );
});

test("computeClipSchedule: position inside a fade starts at the envelope's mid value", () => {
  const a = clip({ id: "a", timelineStart: 0, clipStart: 0, clipEnd: 10, fadeInSec: 4 });
  const [s] = computeClipSchedule([a], 2, 1);
  assert.equal(s.fadePoints[0].at, 0);
  assert.equal(s.fadePoints[0].gain, 0.5); // halfway up the 4s fade-in
});

test("moveClip clamps into the timeline", () => {
  const a = clip({ timelineStart: 5, clipEnd: 10 });
  assert.equal(moveClip(a, -3).timelineStart, 0);
  assert.equal(moveClip(a, 42).timelineStart, 42);
});

test("trim clamps preserve MIN_CLIP_SECONDS and buffer bounds", () => {
  const a = clip({ timelineStart: 10, clipStart: 2, clipEnd: 8 });
  const overTrimmed = trimClipStart(a, 7.99, 30);
  assert.ok(clipDuration(overTrimmed) >= MIN_CLIP_SECONDS - 1e-9);
  // Left-edge trim moves timelineStart by the same delta (content stays put).
  const trimmed = trimClipStart(a, 4, 30);
  assert.equal(trimmed.clipStart, 4);
  assert.equal(trimmed.timelineStart, 12);
  const extended = trimClipEnd(a, 99, 30);
  assert.equal(extended.clipEnd, 30); // clamped to buffer duration
});

test("splitClip produces abutting halves whose spans sum", () => {
  const a = clip({ id: "a", timelineStart: 10, clipStart: 5, clipEnd: 25, fadeInSec: 1, fadeOutSec: 2 });
  const halves = splitClip(a, 18, makeId);
  assert.ok(halves);
  const [left, right] = halves;
  assert.equal(left.clipEnd, 13); // 5 + (18 - 10)
  assert.equal(right.clipStart, 13);
  assert.equal(right.timelineStart, 18);
  assert.equal(clipDuration(left) + clipDuration(right), clipDuration(a));
  assert.equal(left.fadeOutSec, 0); // no fade across the cut
  assert.equal(right.fadeInSec, 0);
  assert.equal(left.fadeInSec, 1); // outer fades preserved
  assert.equal(right.fadeOutSec, 2);
  // Cuts outside or too close to an edge are rejected.
  assert.equal(splitClip(a, 10.01, makeId), null);
  assert.equal(splitClip(a, 40, makeId), null);
});

test("speed-event take composes with automatedOutputDuration", () => {
  // 60s mixdown, base speed 1, drop to 0.5 at output t=40:
  // 40s at speed 1 (40 source secs) + remaining 20 source secs at 0.5 = 40 + 40.
  const events = [{ t: 40, kind: "speed" as const, value: 0.5 }];
  assert.equal(automatedOutputDuration(60, 1, events), 80);
});

test("rulerStepSeconds keeps ticks at least 60px apart", () => {
  assert.equal(rulerStepSeconds(100), 1);
  assert.equal(rulerStepSeconds(25), 5);
  assert.equal(rulerStepSeconds(6), 10);
});
