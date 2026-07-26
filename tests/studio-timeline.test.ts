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
  isSoloing,
  loopPassEnd,
  sliceClipsToWindow,
  snapCandidates,
} from "../lib/studio/timeline";
import {
  MAX_PX_PER_SECOND,
  MIN_PX_PER_SECOND,
  rulerStepSeconds,
  snapClipStart,
  snapTime,
  zoomAtCursor,
  zoomToFit,
} from "../lib/studio/timeline-math";
import { automatedOutputDuration } from "../lib/audio/remix";
import { scaleClipsForLock, stretchedIdFor } from "../lib/studio/lock-pitch";

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
    soloed: false,
    muted: false,
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

test("zoomAtCursor keeps the time under the cursor pinned", () => {
  // 25 px/s, scrolled 500px, cursor 300px in => t = (500+300)/25 = 32s.
  const before = (500 + 300) / 25;
  const after = zoomAtCursor(25, 2, 500, 300);
  assert.equal(after.pxPerSecond, 50);
  assert.equal((after.scrollLeft + 300) / after.pxPerSecond, before);
  // Zooming out pins the same instant.
  const out = zoomAtCursor(25, 0.5, 500, 300);
  assert.equal(out.pxPerSecond, 12.5);
  assert.equal((out.scrollLeft + 300) / out.pxPerSecond, before);
});

test("zoomAtCursor clamps and never scrolls negative", () => {
  assert.equal(zoomAtCursor(MAX_PX_PER_SECOND, 4, 0, 0).pxPerSecond, MAX_PX_PER_SECOND);
  assert.equal(zoomAtCursor(MIN_PX_PER_SECOND, 0.1, 0, 0).pxPerSecond, MIN_PX_PER_SECOND);
  assert.equal(zoomAtCursor(25, 0.5, 0, 100).scrollLeft, 0);
});

test("snapTime pulls onto a candidate only within the pixel tolerance", () => {
  // At 25 px/s the 8px tolerance is 0.32s.
  assert.equal(snapTime(10.2, [10, 30], 25), 10); // 0.2s away -> snaps
  assert.equal(snapTime(10.5, [10, 30], 25), 10.5); // 0.5s away -> free
  // Tolerance shrinks as you zoom in: same 0.2s gap is now out of reach.
  assert.equal(snapTime(10.2, [10, 30], 100), 10.2);
  // Nearest candidate wins.
  assert.equal(snapTime(10.1, [10, 10.15], 25), 10.15);
});

test("snapCandidates excludes the dragged clip's own edges", () => {
  const a = clip({ id: "a", timelineStart: 0, clipEnd: 10 });
  const b = clip({ id: "b", timelineStart: 20, clipStart: 0, clipEnd: 5 });
  const candidates = snapCandidates([a, b], "a", 7.5);
  assert.deepEqual(candidates.sort((x, y) => x - y), [0, 7.5, 20, 25]);
});

test("muted clips are skipped by the scheduler (live and export alike)", () => {
  const a = clip({ id: "a", timelineStart: 0, clipEnd: 10, muted: true });
  const b = clip({ id: "b", timelineStart: 0, clipEnd: 10 });
  const sched = computeClipSchedule([a, b], 0, 1);
  assert.equal(sched.length, 1);
  assert.equal(sched[0].clipId, "b");
});

test("zoomToFit puts the whole timeline on screen", () => {
  const zoom = zoomToFit(120, 1200); // 120s in 1200px
  assert.ok(zoom * 120 <= 1200);
  assert.ok(zoom > 9); // and uses most of the width
});

test("snapClipStart: the edge that finds a candidate wins", () => {
  // Neighbour occupies [0,8]; tolerance at 25 px/s is 0.32s.
  const candidates = [0, 8];
  // Start is 0.2s shy of 8 -> snaps flush, even though the END matches nothing.
  assert.equal(snapClipStart(7.8, 6, candidates, 25), 8);
  // Out of reach -> untouched.
  assert.equal(snapClipStart(7.4, 6, candidates, 25), 7.4);
  // Now the END is what lines up: clip of length 6 ending near 8 starts at 2.
  assert.equal(snapClipStart(2.15, 6, candidates, 25), 2);
  // Both edges in range: the smaller correction wins (start is 0.1 off, end 0.3).
  assert.equal(snapClipStart(0.1, 7.7, [0, 8], 25), 0);
  // Never negative.
  assert.equal(snapClipStart(0.05, 6, [0], 25), 0);
});

test("solo: one soloed clip silences the others, live and on export alike", () => {
  const a = clip({ id: "a", timelineStart: 0, soloed: true });
  const b = clip({ id: "b", timelineStart: 10 });
  const c = clip({ id: "c", timelineStart: 20 });
  const scheduled = computeClipSchedule([a, b, c], 0, 1);
  assert.deepEqual(scheduled.map((s) => s.clipId), ["a"]);
  assert.equal(isSoloing([a, b, c]), true);
  // The SAME call drives the offline render, so a bounce cannot disagree.
  assert.equal(computeClipSchedule([a, b, c], 0, 1).length, 1);
});

test("solo: a muted clip cannot solo — that would silence everything", () => {
  const a = clip({ id: "a", soloed: true, muted: true });
  const b = clip({ id: "b", timelineStart: 10 });
  assert.equal(isSoloing([a, b]), false);
  assert.deepEqual(computeClipSchedule([a, b], 0, 1).map((s) => s.clipId), ["b"]);
});

test("solo + mute: mute still wins over solo on the same clip", () => {
  const a = clip({ id: "a", soloed: true });
  const b = clip({ id: "b", timelineStart: 10, soloed: true, muted: true });
  assert.deepEqual(computeClipSchedule([a, b], 0, 1).map((s) => s.clipId), ["a"]);
});

test("loop: a pass inside the region ends at the loop end and wraps", () => {
  const r = loopPassEnd(300, 8, { start: 6, end: 10 });
  assert.deepEqual(r, { at: 10, wrap: true });
});

test("loop: playing from past the region runs to the end, never backwards", () => {
  // Jumping back into a region the playhead already left would be a trap.
  assert.deepEqual(loopPassEnd(300, 40, { start: 6, end: 10 }), { at: 300, wrap: false });
});

test("loop: no region means the pass ends at the timeline end", () => {
  assert.deepEqual(loopPassEnd(300, 8, null), { at: 300, wrap: false });
});

test("loop: a region past the timeline end clamps to real material", () => {
  assert.deepEqual(loopPassEnd(30, 5, { start: 2, end: 90 }), { at: 30, wrap: true });
});

test("lock pitch: scaling by 1/speed reproduces the unlocked wall-clock timing", () => {
  // Two clips, B starting over A's tail — the beat-switch shape.
  const a = clip({ id: "a", timelineStart: 0, clipStart: 0, clipEnd: 12, fadeOutSec: 2 });
  const b = clip({ id: "b", timelineStart: 8, clipStart: 0, clipEnd: 10 });
  const speed = 0.8;

  const unlocked = computeClipSchedule([a, b], 0, speed);
  // Locked: pre-stretched clips, every time field / speed, scheduled at 1.
  const locked = computeClipSchedule(scaleClipsForLock([a, b], speed), 0, 1);

  assert.equal(locked.length, unlocked.length);
  for (let i = 0; i < locked.length; i++) {
    // Same wall-clock entry AND same audible length: only the pitch differs.
    assert.ok(Math.abs(locked[i].when - unlocked[i].when) < 1e-9, `when[${i}]`);
    assert.ok(
      Math.abs(locked[i].sourceDuration - unlocked[i].sourceDuration / speed) < 1e-9,
      `duration[${i}]`,
    );
    const uf = unlocked[i].fadePoints;
    const lf = locked[i].fadePoints;
    assert.equal(lf.length, uf.length, `fade count[${i}]`);
    for (let k = 0; k < lf.length; k++) {
      assert.ok(Math.abs(lf[k].at - uf[k].at) < 1e-9, `fade at[${i}][${k}]`);
    }
  }
});

test("lock pitch: clips point at the stretched buffer for that exact speed", () => {
  const a = clip({ id: "a", bufferId: "song" });
  const scaled = scaleClipsForLock([a], 0.8);
  assert.equal(scaled[0].bufferId, stretchedIdFor("song", 0.8));
  assert.notEqual(scaled[0].bufferId, stretchedIdFor("song", 0.9));
});

test("lock pitch: speed 1 is a no-op — nothing to stretch", () => {
  const clips = [clip({ id: "a" }), clip({ id: "b", timelineStart: 5 })];
  assert.equal(scaleClipsForLock(clips, 1), clips);
});

test("export the loop: the window is rebased to zero and clips are trimmed", () => {
  const a = clip({ id: "a", timelineStart: 0, clipStart: 0, clipEnd: 20 });
  const b = clip({ id: "b", timelineStart: 15, clipStart: 5, clipEnd: 25 });
  const sliced = sliceClipsToWindow([a, b], 10, 18);

  const outA = sliced.find((c) => c.id === "a")!;
  assert.equal(outA.timelineStart, 0);      // window start becomes zero
  assert.equal(outA.clipStart, 10);         // head cut moves INTO the source
  assert.equal(outA.clipEnd, 18);           // tail cut trims the source end
  const outB = sliced.find((c) => c.id === "b")!;
  assert.equal(outB.timelineStart, 5);      // 15 - 10
  assert.equal(outB.clipStart, 5);          // starts inside the window: untouched
  assert.equal(outB.clipEnd, 8);            // 20 - 15 = 3s of it survives
  assert.equal(timelineDuration(sliced), 8);
});

test("export the loop: clips entirely outside the window are dropped", () => {
  const before = clip({ id: "before", timelineStart: 0, clipStart: 0, clipEnd: 5 });
  const after = clip({ id: "after", timelineStart: 40, clipStart: 0, clipEnd: 5 });
  const inside = clip({ id: "inside", timelineStart: 12, clipStart: 0, clipEnd: 4 });
  const sliced = sliceClipsToWindow([before, after, inside], 10, 20);
  assert.deepEqual(sliced.map((c) => c.id), ["inside"]);
});

test("export the loop: a sliver thinner than the minimum clip is dropped", () => {
  const sliver = clip({ id: "sliver", timelineStart: 9.95, clipStart: 0, clipEnd: 5 });
  assert.deepEqual(sliceClipsToWindow([sliver], 10, 20).map((c) => c.id), ["sliver"]);
  // Only 0.05s pokes into the window — below MIN_CLIP_SECONDS, so nothing.
  assert.deepEqual(sliceClipsToWindow([sliver], 14.9, 20), []);
});
