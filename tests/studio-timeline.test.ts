import test from "node:test";
import assert from "node:assert/strict";
import {
  type StudioClip,
  MIN_CLIP_SECONDS,
  clipDuration,
  timelineDuration,
  assignDisplayRows,
  computeClipSchedule,
  crossfadeOverlap,
  fadeGain,
  fitFades,
  moveClip,
  trimClipStart,
  trimClipEnd,
  splitClip,
  adjacentClipId,
  audibleDuration,
  isSoloing,
  loopPassEnd,
  loopRegionFor,
  overlapPartner,
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
import { keysMix } from "../lib/audio/harmonic";
import {
  type BeatGrid,
  barsIn,
  beatTimesInRange,
  expandToBars,
  estimateBeatPhase,
  nearestGridTime,
  needsTempoMatch,
  tempoMatchRatio,
} from "../lib/studio/beat-grid";
import { buildPeakPyramid } from "../lib/studio/waveform-pyramid";
import { scaleClipsForLock, stretchedIdFor } from "../lib/studio/lock-pitch";
import { makeClipId, reserveClipIds, resetClipIds } from "../lib/studio/clip-ids";

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

/* ------------------------------ beat grid ------------------------------ */

const grid120: BeatGrid = { bpm: 120, anchorSec: 0, beatsPerBar: 4 };

test("beat grid: snaps to the nearest beat, both directions", () => {
  // 120 BPM = a beat every 0.5s.
  assert.equal(nearestGridTime(0.24, grid120), 0);
  assert.equal(nearestGridTime(0.26, grid120), 0.5);
  assert.equal(nearestGridTime(3.9, grid120), 4);
  // Anchored grids stay aligned to their anchor, not to zero.
  const offset: BeatGrid = { bpm: 120, anchorSec: 0.2, beatsPerBar: 4 };
  assert.equal(+nearestGridTime(1.1, offset).toFixed(6), 1.2);
});

test("beat grid: downbeats land every beatsPerBar", () => {
  const beats = beatTimesInRange(grid120, 0, 4);
  assert.deepEqual(beats.map((b) => b.t), [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
  // 4/4 at 120 BPM: a downbeat every 2s.
  assert.deepEqual(beats.filter((b) => b.downbeat).map((b) => b.t), [0, 2]);
});

test("beat grid: too dense to read falls back to bar lines, then to nothing", () => {
  // Beats 0.5s apart, but we need 1s of space: bars (2s) are drawn instead.
  const bars = beatTimesInRange(grid120, 0, 8, 1);
  assert.deepEqual(bars.map((b) => b.t), [0, 2, 4, 6]);
  assert.ok(bars.every((b) => b.downbeat));
  // Even bars are too dense here — draw nothing rather than a grey smear.
  assert.deepEqual(beatTimesInRange(grid120, 0, 8, 5), []);
});

test("beat grid: phase finds where the beats actually are", () => {
  // A click track at 120 BPM whose first beat is deliberately at 0.25s.
  const rate = 11025;
  const seconds = 8;
  const data = new Float32Array(rate * seconds);
  const period = 0.5;
  for (let beat = 0; ; beat++) {
    const at = 0.25 + beat * period;
    if (at >= seconds) break;
    const start = Math.round(at * rate);
    for (let i = 0; i < 400; i++) data[start + i] = 1 - i / 400; // a percussive hit
  }
  const signal = { data, pyramid: buildPeakPyramid(data), sampleRate: rate };
  const phase = estimateBeatPhase(signal, 120);
  // Within one onset frame (64 samples ~ 5.8ms) of the truth. The looser
  // 30ms this asserted at ONSET_HOP=256 measured as 16ms of real downbeat
  // slop after a beatmatch, so the tolerance is the feature here.
  assert.ok(Math.abs(phase - 0.25) < 0.008, `phase ${phase} should be ~0.25`);
});

test("beat grid: phase on silence is harmless, not NaN", () => {
  const data = new Float32Array(11025 * 2);
  const signal = { data, pyramid: buildPeakPyramid(data), sampleRate: 11025 };
  const phase = estimateBeatPhase(signal, 120);
  assert.ok(Number.isFinite(phase));
  assert.ok(phase >= 0);
});

test("beatmatch: a slower song is stretched up to the project tempo", () => {
  // 120 BPM clip into a 128 BPM project: play it 128/120 = 1.0667x.
  assert.equal(+tempoMatchRatio(120, 128).toFixed(4), 1.0667);
  assert.equal(+tempoMatchRatio(140, 128).toFixed(4), 0.9143);
  assert.ok(needsTempoMatch(tempoMatchRatio(140, 128)));
});

test("beatmatch: half-time is already in time and must not be doubled", () => {
  // 70 against 140 is one beat per two — the ratio is 1, not 2.
  assert.equal(tempoMatchRatio(70, 140), 1);
  assert.equal(tempoMatchRatio(140, 70), 1);
  // 65 vs 128 folds to 130 vs 128 — a small correction, not a huge one.
  assert.ok(Math.abs(tempoMatchRatio(65, 128) - 0.9846) < 0.001);
});

test("beatmatch: an already-matched clip is left alone", () => {
  assert.equal(needsTempoMatch(tempoMatchRatio(128, 128)), false);
  assert.equal(needsTempoMatch(tempoMatchRatio(128.2, 128)), false);
  assert.equal(tempoMatchRatio(0, 128), 1);
});

test("bounce length follows what is audible, not what exists", () => {
  const a = clip({ id: "a", timelineStart: 0, clipStart: 0, clipEnd: 10 });
  const b = clip({ id: "b", timelineStart: 10, clipStart: 0, clipEnd: 10 });
  assert.equal(timelineDuration([a, b]), 20);
  assert.equal(audibleDuration([a, b]), 20);

  // Solo the first clip: the bounce should stop at 10s, not carry 10s of
  // silence where the other clip used to be.
  const soloA = { ...a, soloed: true };
  assert.equal(audibleDuration([soloA, b]), 10);
  assert.equal(timelineDuration([soloA, b]), 20, "the timeline itself is unchanged");

  // Muting the LAST clip shortens the bounce the same way.
  assert.equal(audibleDuration([a, { ...b, muted: true }]), 10);
  // Muting a middle clip must NOT shorten anything.
  assert.equal(audibleDuration([{ ...a, muted: true }, b]), 20);
  // Everything silent is a zero-length bounce, not a crash.
  assert.equal(audibleDuration([{ ...a, muted: true }, { ...b, muted: true }]), 0);
});

test("keyboard selection walks clips in TIME order, not insertion order", () => {
  // Added late but positioned first — insertion order would get this wrong.
  const late = clip({ id: "late", timelineStart: 0 });
  const mid = clip({ id: "mid", timelineStart: 20 });
  const early = clip({ id: "early", timelineStart: 10 });
  const clips = [mid, early, late];   // deliberately unsorted

  assert.equal(adjacentClipId(clips, "late", 1), "early");
  assert.equal(adjacentClipId(clips, "early", 1), "mid");
  assert.equal(adjacentClipId(clips, "mid", -1), "early");
});

test("keyboard selection wraps, and reaches the timeline from nothing", () => {
  const a = clip({ id: "a", timelineStart: 0 });
  const b = clip({ id: "b", timelineStart: 10 });
  // Wrap at both ends.
  assert.equal(adjacentClipId([a, b], "b", 1), "a");
  assert.equal(adjacentClipId([a, b], "a", -1), "b");
  // Nothing selected: forward takes the first, back takes the last, so one
  // keypress always gets you onto the timeline.
  assert.equal(adjacentClipId([a, b], null, 1), "a");
  assert.equal(adjacentClipId([a, b], null, -1), "b");
  // A selection that no longer exists behaves like no selection.
  assert.equal(adjacentClipId([a, b], "deleted", 1), "a");
  assert.equal(adjacentClipId([], null, 1), null);
});

/* ------------------------------ crossfade ------------------------------ */

test("equal power holds level where two linear fades would dip", () => {
  // A matched crossfade: A fades out over the same span B fades in.
  const SPAN = 4;
  let worstLinear = 1;
  let worstEqual = 1;
  for (let i = 0; i <= 20; i++) {
    const u = i / 20;
    // u walks the overlap: the outgoing clip enters its fade-out at
    // (length - SPAN) and reaches its end, while the incoming clip walks
    // its fade-in from zero.
    const outAt = 10 - SPAN + u * SPAN;
    const inAt = u * SPAN;
    const outLin = fadeGain(outAt, 10, 0, SPAN, "linear");
    const inLin = fadeGain(inAt, 10, SPAN, 0, "linear");
    const outEq = fadeGain(outAt, 10, 0, SPAN, "equalPower");
    const inEq = fadeGain(inAt, 10, SPAN, 0, "equalPower");
    worstLinear = Math.min(worstLinear, Math.hypot(outLin, inLin));
    worstEqual = Math.min(worstEqual, Math.hypot(outEq, inEq));
  }
  // Two linear fades meeting at half amplitude leave a 3 dB hole…
  assert.ok(worstLinear < 0.72, `linear dipped to ${worstLinear}`);
  // …equal power keeps the summed power flat across the whole overlap.
  assert.ok(worstEqual > 0.999, `equal power dipped to ${worstEqual}`);
});

test("fadeGain is unchanged for clips with no curve recorded", () => {
  // Sessions saved before curves existed must sound exactly as authored.
  assert.equal(fadeGain(1, 10, 2, 0), 0.5);
  assert.equal(fadeGain(9.5, 10, 0, 1), 0.5);
  assert.equal(fadeGain(5, 10, 2, 2), 1);
  // A fade longer than the clip stretches across ALL of it rather than
  // being capped at half — with no fade at the other end there is nothing
  // for it to collide with.
  assert.equal(fadeGain(5, 10, 40, 0), 0.5);
  // Two fades that would collide are scaled down together, keeping their
  // ratio, so the clip still reaches full level at exactly one instant.
  const fitted = fitFades(30, 10, 10);
  assert.equal(fitted.fadeIn + fitted.fadeOut, 10);
  assert.equal(fitted.fadeIn / fitted.fadeOut, 3);
});

test("crossfade sets both fades to the length of the overlap", () => {
  const a = clip({ id: "a", timelineStart: 0, clipStart: 0, clipEnd: 10 }); // 0..10
  const b = clip({ id: "b", timelineStart: 7, clipStart: 0, clipEnd: 10 }); // 7..17
  const next = crossfadeOverlap([a, b], "b");
  assert.ok(next);
  const [outgoing, incoming] = [next.find((c) => c.id === "a")!, next.find((c) => c.id === "b")!];
  assert.equal(outgoing.fadeOutSec, 3);
  assert.equal(incoming.fadeInSec, 3);
  assert.equal(outgoing.fadeCurve, "equalPower");
  assert.equal(incoming.fadeCurve, "equalPower");
  // The clip that starts FIRST is the one going out, whichever was selected.
  assert.equal(outgoing.fadeInSec, 0);
  assert.equal(incoming.fadeOutSec, 0);
});

test("crossfade picks the biggest overlap, and refuses when there is none", () => {
  const a = clip({ id: "a", timelineStart: 0, clipStart: 0, clipEnd: 10 });
  const b = clip({ id: "b", timelineStart: 9, clipStart: 0, clipEnd: 10 }); // overlaps a by 1
  const c = clip({ id: "c", timelineStart: 5, clipStart: 0, clipEnd: 10 }); // overlaps a by 5
  const next = crossfadeOverlap([a, b, c], "a");
  assert.ok(next);
  assert.equal(next.find((x) => x.id === "c")!.fadeInSec, 5);
  assert.equal(next.find((x) => x.id === "b")!.fadeInSec, 0);

  const far = clip({ id: "far", timelineStart: 100, clipStart: 0, clipEnd: 10 });
  assert.equal(crossfadeOverlap([a, far], "far"), null);
  assert.equal(crossfadeOverlap([a], "a"), null);
});

test("a long overlap crossfades over ALL of it, so the two fades coincide", () => {
  // This is the case a half-clip cap got wrong: b overlaps a by 6s, so both
  // fades must span that same 6s or the transition has a gap in the middle.
  const a = clip({ id: "a", timelineStart: 0, clipStart: 0, clipEnd: 8 });
  const b = clip({ id: "b", timelineStart: 2, clipStart: 0, clipEnd: 6 }); // 2..8
  const next = crossfadeOverlap([a, b], "b")!;
  const outgoing = next.find((c) => c.id === "a")!;
  const incoming = next.find((c) => c.id === "b")!;
  assert.equal(outgoing.fadeOutSec, 6);
  assert.equal(incoming.fadeInSec, 6);
  // a fades out over timeline 2..8; b fades in over timeline 2..8 — same span.
  const outStart = outgoing.timelineStart + clipDuration(outgoing) - outgoing.fadeOutSec;
  const inStart = incoming.timelineStart;
  assert.equal(outStart, inStart);

  // And the level holds all the way across it.
  for (let u = 0; u <= 1.0001; u += 0.1) {
    const gOut = fadeGain(clipDuration(outgoing) - 6 + u * 6, clipDuration(outgoing), 0, 6, "equalPower");
    const gIn = fadeGain(u * 6, clipDuration(incoming), 6, 0, "equalPower");
    assert.ok(Math.abs(Math.hypot(gOut, gIn) - 1) < 1e-9, `power dipped at u=${u}`);
  }
});

test("a crossfade leaves room for a fade the clip already has", () => {
  const a = clip({ id: "a", timelineStart: 0, clipStart: 0, clipEnd: 30 });
  // b already fades OUT for 3s of its 4s length, so its fade-in can take 1s.
  const b = clip({ id: "b", timelineStart: 5, clipStart: 0, clipEnd: 4, fadeOutSec: 3 });
  const next = crossfadeOverlap([a, b], "b")!;
  assert.equal(next.find((c) => c.id === "b")!.fadeInSec, 1);
});

test("an equal-power fade is scheduled as a curve, a linear one as a line", () => {
  const linear = computeClipSchedule(
    [clip({ timelineStart: 0, clipStart: 0, clipEnd: 10, fadeInSec: 4 })],
    0,
    1,
  );
  // Start, top of the ramp, end.
  assert.equal(linear[0].fadePoints.length, 3);

  const curved = computeClipSchedule(
    [clip({ timelineStart: 0, clipStart: 0, clipEnd: 10, fadeInSec: 4, fadeCurve: "equalPower" })],
    0,
    1,
  );
  assert.ok(curved[0].fadePoints.length > 10, "curve needs intermediate points to interpolate");
  // Points rise monotonically and land exactly on full gain.
  const gains = curved[0].fadePoints.map((p) => p.gain);
  for (let i = 1; i < gains.length; i++) assert.ok(gains[i] >= gains[i - 1] - 1e-9);
  assert.equal(gains[0], 0);
  assert.equal(gains[gains.length - 1], 1);
  // Halfway through an equal-power fade-in is sin(45 deg), not 0.5.
  const mid = curved[0].fadePoints.find((p) => Math.abs(p.at - 2) < 1e-9);
  assert.ok(mid && Math.abs(mid.gain - Math.SQRT1_2) < 1e-9);
});

/* ------------------------------ clip ids ------------------------------ */

test("restored ids are reserved, so a later clip cannot collide with them", () => {
  resetClipIds();
  // A fresh session hands out clip-1, clip-2.
  assert.equal(makeClipId(), "clip-1");
  assert.equal(makeClipId(), "clip-2");

  // Reload: the counter is back at 1 and a saved arrangement comes back
  // holding those same ids. Without reserving, the next clip added would be
  // handed "clip-1" again — and every id-keyed edit would hit BOTH clips.
  resetClipIds();
  reserveClipIds([{ id: "clip-1" }, { id: "clip-2" }]);
  assert.equal(makeClipId(), "clip-3");

  // Reserving is a high-water mark, not a sequence: gaps and out-of-order
  // input still push the counter past everything seen.
  reserveClipIds([{ id: "clip-9" }, { id: "clip-4" }]);
  assert.equal(makeClipId(), "clip-10");

  // Ids that aren't ours can't collide with a generated one, so they're
  // ignored rather than parsed into a nonsense counter.
  reserveClipIds([{ id: "imported-track" }, { id: "clip-x" }]);
  assert.equal(makeClipId(), "clip-11");
});

test("a duplicated clip gets an id of its own", () => {
  resetClipIds();
  const original = clip({ id: makeClipId(), timelineStart: 0 });
  const copy = { ...original, id: makeClipId() };
  assert.notEqual(original.id, copy.id);
  // The edit path matches on id, so a collision here would move both.
  assert.equal([original, copy].filter((c) => c.id === original.id).length, 1);
});

/* ------------------------------ loop region ------------------------------ */

test("Loop targets the transition, not the whole song", () => {
  // A 180s track with a 12s beat switch at its tail. Looping all 180s is
  // useless for judging the switch — the overlap is the part worth repeating.
  const a = clip({ id: "a", timelineStart: 0, clipStart: 0, clipEnd: 180 });
  const b = clip({ id: "b", timelineStart: 168, clipStart: 0, clipEnd: 180 });
  assert.deepEqual(loopRegionFor([a, b], "a"), { start: 168, end: 180 });
  // Either clip of the pair gives the same transition.
  assert.deepEqual(loopRegionFor([a, b], "b"), { start: 168, end: 180 });
});

test("with nothing to transition into, Loop covers the clip itself", () => {
  const only = clip({ id: "only", timelineStart: 4, clipStart: 0, clipEnd: 10 });
  assert.deepEqual(loopRegionFor([only], "only"), { start: 4, end: 14 });
  assert.equal(loopRegionFor([only], "missing"), null);
});

test("Loop picks the biggest overlap when a clip touches several", () => {
  const a = clip({ id: "a", timelineStart: 0, clipStart: 0, clipEnd: 30 });
  const grazes = clip({ id: "grazes", timelineStart: 29, clipStart: 0, clipEnd: 10 });
  const real = clip({ id: "real", timelineStart: 22, clipStart: 0, clipEnd: 10 });
  assert.deepEqual(loopRegionFor([a, grazes, real], "a"), { start: 22, end: 30 });
});

test("a loop widens to whole bars, never narrower than asked", () => {
  // 120 BPM, 4/4 -> a bar is 2s, and the grid is anchored at 0.5s.
  const grid: BeatGrid = { bpm: 120, anchorSec: 0.5, beatsPerBar: 4 };
  const widened = expandToBars({ start: 3.1, end: 6.4 }, grid);
  // Bar lines sit at 0.5, 2.5, 4.5, 6.5 ... so 3.1 falls back to 2.5 and
  // 6.4 reaches forward to 6.5.
  assert.deepEqual(widened, { start: 2.5, end: 6.5 });
  assert.ok(widened.start <= 3.1 && widened.end >= 6.4, "must contain the request");
  assert.equal(barsIn(widened, grid), 2);

  // A region already on the lines is left exactly alone — widening a loop
  // that is already right would make it wrong.
  assert.deepEqual(expandToBars({ start: 2.5, end: 6.5 }, grid), { start: 2.5, end: 6.5 });
});

test("a bar-aligned loop never starts before the timeline does", () => {
  // Anchor after zero: the bar line below the region is at a negative time,
  // where there is no material to play.
  const grid: BeatGrid = { bpm: 120, anchorSec: 1.5, beatsPerBar: 4 };
  const widened = expandToBars({ start: 0.2, end: 1.0 }, grid);
  assert.ok(widened.start >= 0, `loop started at ${widened.start}`);
  assert.ok(widened.end > widened.start, "a loop must have length");
});

/* --------------------------- harmonic mixing --------------------------- */

test("keysMix accepts the DJ neighbour set and nothing else", () => {
  // Same key, one step either way round the wheel, and the relative
  // major/minor. 8A is A Minor.
  assert.ok(keysMix("8A", "8A"), "same key");
  assert.ok(keysMix("8A", "9A"), "energy up");
  assert.ok(keysMix("8A", "7A"), "energy down");
  assert.ok(keysMix("8A", "8B"), "relative major");
  // Two steps is the classic clash.
  assert.ok(!keysMix("8A", "10A"));
  assert.ok(!keysMix("8A", "2B"));
  // The wheel wraps: 12 and 1 are neighbours, not ten steps apart.
  assert.ok(keysMix("12A", "1A"));
  assert.ok(keysMix("1A", "12A"));
  // Compatibility is symmetric — an asymmetric verdict would let the
  // inspector say different things about the same pair of clips.
  for (const [a, b] of [["8A", "9A"], ["8A", "2B"], ["12B", "1B"], ["3A", "6B"]]) {
    assert.equal(keysMix(a, b), keysMix(b, a), `${a}/${b} disagreed on order`);
  }
});

test("an unknown key is never reported as a fit", () => {
  // Saying two songs are in key when nobody knows is worse than saying
  // nothing — the inspector hides the verdict on a falsy result.
  assert.equal(keysMix("", "8A"), false);
  assert.equal(keysMix("8A", ""), false);
  assert.equal(keysMix("banana", "8A"), false);
  assert.equal(keysMix("13A", "8A"), false);
  assert.equal(keysMix("0A", "8A"), false);
  // Lower case and stray spacing still resolve.
  assert.ok(keysMix("8a", " 9a "));
});

test("overlapPartner is the one scan behind loop, crossfade and the key check", () => {
  const a = clip({ id: "a", timelineStart: 0, clipStart: 0, clipEnd: 30 });
  const graze = clip({ id: "graze", timelineStart: 29.99, clipStart: 0, clipEnd: 10 });
  const real = clip({ id: "real", timelineStart: 22, clipStart: 0, clipEnd: 10 });
  const hit = overlapPartner([a, graze, real], "a");
  assert.equal(hit?.partner.id, "real");
  assert.deepEqual({ start: hit?.start, end: hit?.end }, { start: 22, end: 30 });
  // The same answer the loop and the crossfade act on.
  assert.deepEqual(loopRegionFor([a, graze, real], "a"), { start: 22, end: 30 });
  assert.equal(overlapPartner([a], "a"), null);
});
