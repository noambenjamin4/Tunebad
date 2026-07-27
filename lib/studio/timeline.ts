// TuneBad DAW timeline model: pure data + math, no Web Audio, no React.
// Everything here is unit-tested in tests/studio-timeline.test.ts — the live
// engine and the offline renderer both consume computeClipSchedule, so this
// file is the single source of truth for WHERE clips land in time.

export interface StudioClip {
  id: string;
  name: string;
  /** Key into the studio's Map<bufferId, AudioBuffer> (buffers stay out of React state). */
  bufferId: string;
  /** Where the clip begins on the timeline, in timeline (speed-1) seconds. */
  timelineStart: number;
  /** Trim-in, seconds into the source buffer. */
  clipStart: number;
  /** Trim-out, seconds into the source buffer. Always > clipStart. */
  clipEnd: number;
  /** Linear gain, default 1. */
  gain: number;
  fadeInSec: number;
  fadeOutSec: number;
  /**
   * Shape of both fades. Absent means "linear" — sessions saved before
   * curves existed must keep sounding the way they were authored.
   */
  fadeCurve?: FadeCurve;
  /**
   * Where along its own curve each fade starts and ends, 0 = silent end,
   * 1 = full. Absent means the whole curve (0 -> 1 in, 1 -> 0 out), which is
   * every fade anyone types by hand.
   *
   * They exist for SPLIT. Cutting a clip inside a fade leaves each half with
   * a piece of that fade, and a piece cannot be described by a length alone:
   * the second half has to pick up where the first left off instead of
   * restarting from silence. Positions along the curve rather than raw gains,
   * so the two pieces reproduce the original exactly for a curved fade as
   * well as a straight one.
   */
  fadeInFrom?: number;
  fadeInTo?: number;
  fadeOutFrom?: number;
  fadeOutTo?: number;
  /** Silenced without losing its gain setting; skipped by the scheduler. */
  muted: boolean;
  /** When ANY clip is soloed, only soloed clips play — live AND on export. */
  soloed: boolean;
  /** 0..5, assigned round-robin at add time; drives the clip tint. */
  colorIndex: number;
  /**
   * Set when the clip has been beatmatched. Stretched audio is huge and
   * derivable, so a saved session records the ORIGIN and the factor and
   * re-runs the stretch on restore instead of storing ~40 MB per clip.
   */
  sourceBufferId?: string;
  tempoRatio?: number;
}

/* ------------------------------ fade shape ------------------------------ */

export type FadeCurve = "linear" | "equalPower";

/**
 * Points sampled along an equal-power ramp. The consumers interpolate
 * LINEARLY between fade points, so a curve has to be approximated by a
 * polyline; 12 segments keeps the worst-case error under 0.9% of full scale
 * (~0.08 dB), which is far below audible, and costs 12 automation events.
 */
const EQUAL_POWER_STEPS = 12;

/**
 * Clamp a clip's two fades so they cannot pass through each other.
 *
 * The rule is that they must TOGETHER fit inside the clip, not that each
 * must fit in half of it. The difference matters exactly where it is most
 * useful: a clip with only a fade-out can then fade across its entire
 * length. Under a half-clip cap, dragging song B a long way over song A
 * produced a fade-out and a fade-in that were each clamped to the middle of
 * their own clip and so never met — a "crossfade" with a gap in it.
 *
 * When they do conflict both are scaled by the same factor, so the shape the
 * user asked for is preserved and only its scale changes.
 */
export function fitFades(
  fadeInSec: number,
  fadeOutSec: number,
  length: number,
): { fadeIn: number; fadeOut: number } {
  const fadeIn = Math.max(0, fadeInSec);
  const fadeOut = Math.max(0, fadeOutSec);
  const total = fadeIn + fadeOut;
  if (total <= length || total === 0) return { fadeIn, fadeOut };
  const scale = length / total;
  return { fadeIn: fadeIn * scale, fadeOut: fadeOut * scale };
}

/**
 * The clip's fade envelope at `local` seconds into it, 0..1. Excludes the
 * clip's own gain — callers multiply that in.
 *
 * ONE function because the audio and the picture must not disagree: the
 * scheduler samples it to build automation points and ClipCanvas samples it
 * to scale the waveform's bar heights. They used to hold separate copies of
 * the same arithmetic, which was fine only for as long as there was exactly
 * one shape.
 *
 * Why two shapes. A linear fade is the honest default for a clip fading to
 * silence on its own. But two linear fades crossing — which is what a beat
 * switch IS — sum to 0.5 amplitude at the midpoint, and for two unrelated
 * songs that is a 3 dB hole right in the transition. Equal power raises each
 * side to a quarter-cosine so that gainA² + gainB² stays 1 across a matched
 * overlap, and the level holds.
 */
/**
 * Set a fade to a plain one: silence to full, or full to silence.
 *
 * Any window left over from a split is dropped. Asking for "a fade over N
 * seconds" means the WHOLE curve, and a half cut out of a bigger fade carries
 * a window onto part of it — reuse that and the new fade starts partway up,
 * which at the head of a crossfade is a step in level, not a fade.
 *
 * A function rather than four spread-in `undefined`s at each call site: this
 * has to hold everywhere a fade length is written, and remembering it per
 * caller is how crossfade came to disagree with the inspector.
 */
export function withFadeIn<T extends FadeShape>(clip: T, fadeInSec: number): T {
  const next = { ...clip, fadeInSec };
  delete next.fadeInFrom;
  delete next.fadeInTo;
  return next;
}

export function withFadeOut<T extends FadeShape>(clip: T, fadeOutSec: number): T {
  const next = { ...clip, fadeOutSec };
  delete next.fadeOutFrom;
  delete next.fadeOutTo;
  return next;
}

/** The fade half of a clip. A StudioClip satisfies it as-is. */
export interface FadeShape {
  fadeInSec: number;
  fadeOutSec: number;
  fadeCurve?: FadeCurve;
  fadeInFrom?: number;
  fadeInTo?: number;
  fadeOutFrom?: number;
  fadeOutTo?: number;
}

export function fadeGain(local: number, length: number, fade: FadeShape): number {
  const { fadeIn, fadeOut } = fitFades(fade.fadeInSec, fade.fadeOutSec, length);
  const curve = fade.fadeCurve ?? "linear";
  const shape = (p: number) => {
    const clamped = Math.max(0, Math.min(1, p));
    return curve === "equalPower" ? Math.sin((Math.PI / 2) * clamped) : clamped;
  };

  // Each side contributes a position along its own curve; the quieter wins.
  // A fade that covers only part of the curve holds its end position through
  // the flat middle, which is what makes the two halves of a split clip sum
  // back to the envelope they were cut from.
  let progress = 1;
  if (fadeIn > 0) {
    const from = fade.fadeInFrom ?? 0;
    const to = fade.fadeInTo ?? 1;
    const along = local < fadeIn ? Math.max(0, local) / fadeIn : 1;
    progress = Math.min(progress, from + (to - from) * along);
  }
  if (fadeOut > 0) {
    const from = fade.fadeOutFrom ?? 1;
    const to = fade.fadeOutTo ?? 0;
    // Runs 1 at the start of the fade down to 0 at the clip's end, so the
    // curve is sampled in the same direction it is for a fade-in — a
    // quarter-cosine, not one-minus-a-quarter-sine.
    const left = local > length - fadeOut ? Math.max(0, length - local) / fadeOut : 1;
    progress = Math.min(progress, to + (from - to) * left);
  }
  return shape(progress);
}

export const MIN_CLIP_SECONDS = 0.1;
/** Songs you can ADD. Splitting is bounded separately by MAX_TOTAL_CLIPS. */
export const MAX_CLIPS = 12;
/** Hard ceiling including split halves — keeps scheduling and paint bounded. */
export const MAX_TOTAL_CLIPS = 32;
export const MAX_TIMELINE_SECONDS = 30 * 60;
/** ~500 MB of decoded Float32 audio across all clips. */
export const MAX_DECODED_BYTES = 500 * 1024 * 1024;

export function clipDuration(clip: StudioClip): number {
  return clip.clipEnd - clip.clipStart;
}

function clipTimelineEnd(clip: StudioClip): number {
  return clip.timelineStart + clipDuration(clip);
}

/** Total timeline length: end of the last clip (0 when empty). */
export function timelineDuration(clips: StudioClip[]): number {
  let end = 0;
  for (const clip of clips) end = Math.max(end, clipTimelineEnd(clip));
  return end;
}

/**
 * Greedy interval coloring: overlapping clips stack into display rows so both
 * waveforms stay visible. Sort by start; each clip takes the first row whose
 * previous occupant ends at or before this clip's start.
 */
export function assignDisplayRows(clips: StudioClip[]): Map<string, number> {
  const rows = new Map<string, number>();
  const rowEnds: number[] = [];
  const ordered = [...clips].sort(
    (a, b) => a.timelineStart - b.timelineStart || a.id.localeCompare(b.id),
  );
  for (const clip of ordered) {
    let row = rowEnds.findIndex((end) => end <= clip.timelineStart + 1e-9);
    if (row === -1) {
      row = rowEnds.length;
      rowEnds.push(0);
    }
    rowEnds[row] = clipTimelineEnd(clip);
    rows.set(clip.id, row);
  }
  return rows;
}

export interface FadePoint {
  /** Wall-clock seconds after transport start. */
  at: number;
  /** Target gain to have reached by `at`. */
  gain: number;
}

export interface ScheduledClip {
  clipId: string;
  bufferId: string;
  /** Wall-clock seconds after transport start when source.start should fire. */
  when: number;
  /** Seconds into the source buffer to start from. */
  offsetInBuffer: number;
  /** Seconds of source material to play (source-time, unaffected by rate). */
  sourceDuration: number;
  /** Base linear gain (clip.gain). */
  gain: number;
  /**
   * Gain envelope in wall-clock time: setValueAtTime at points[0], then
   * linearRamp between consecutive points. Empty when no fades apply.
   */
  fadePoints: FadePoint[];
}

/**
 * The one scheduling function. Live playback calls it with the current
 * transport position and master speed; the offline renderer calls it with
 * (clips, 0, 1). Fades are authored in timeline seconds, so their wall-clock
 * positions divide by `speed`; source offset/duration are in source seconds
 * and are NOT scaled (playbackRate consumes source material faster).
 */
export function computeClipSchedule(
  clips: StudioClip[],
  position: number,
  speed: number,
): ScheduledClip[] {
  const out: ScheduledClip[] = [];
  // Solo is resolved HERE, not by the caller, so the live engine and the
  // offline renderer can never disagree about what is audible.
  const soloing = clips.some((c) => c.soloed && !c.muted);
  for (const clip of clips) {
    if (clip.muted) continue;
    if (soloing && !clip.soloed) continue;
    const duration = clipDuration(clip);
    const end = clip.timelineStart + duration;
    if (end <= position + 1e-9) continue; // entirely behind the playhead

    const intoClip = Math.max(0, position - clip.timelineStart); // timeline secs skipped
    const when = Math.max(0, clip.timelineStart - position) / speed;
    const offsetInBuffer = clip.clipStart + intoClip;
    const sourceDuration = duration - intoClip;

    // Fade envelope, expressed at the clip's local timeline times then mapped
    // to wall clock: wall(t) = (t - position) / speed for t >= position.
    const { fadeIn, fadeOut } = fitFades(clip.fadeInSec, clip.fadeOutSec, duration);
    const curve = clip.fadeCurve ?? "linear";
    const points: FadePoint[] = [];
    const toWall = (t: number) => (t - position) / speed;
    if (fadeIn > 0 || fadeOut > 0) {
      const startT = clip.timelineStart + intoClip;
      // Sample the envelope at every corner, plus intermediate steps along a
      // curved ramp since the consumers only interpolate straight lines. A
      // linear ramp needs its two ends and nothing between them.
      const times = new Set<number>([startT, end]);
      const addRamp = (from: number, to: number) => {
        const steps = curve === "equalPower" ? EQUAL_POWER_STEPS : 1;
        for (let i = 0; i <= steps; i++) times.add(from + ((to - from) * i) / steps);
      };
      if (fadeIn > 0) addRamp(clip.timelineStart, clip.timelineStart + fadeIn);
      if (fadeOut > 0) addRamp(end - fadeOut, end);
      for (const t of [...times].sort((a, b) => a - b)) {
        // A seek can land mid-fade, so anything before the resume point is
        // not scheduled — the first point emitted carries its gain instead.
        if (t < startT || t > end) continue;
        points.push({
          at: toWall(t),
          gain:
            fadeGain(t - clip.timelineStart, duration, {
              ...clip,
              fadeInSec: fadeIn,
              fadeOutSec: fadeOut,
            }) * clip.gain,
        });
      }
    }

    out.push({
      clipId: clip.id,
      bufferId: clip.bufferId,
      when,
      offsetInBuffer,
      sourceDuration,
      gain: clip.gain,
      fadePoints: points,
    });
  }
  return out.sort((a, b) => a.when - b.when);
}

/**
 * Where the current playback pass ends, and whether reaching it should wrap
 * to the loop start instead of stopping. Pure so the boundary decision is
 * testable — the engine only owns the timer that acts on it.
 */
export function loopPassEnd(
  duration: number,
  position: number,
  loop: { start: number; end: number } | null,
): { at: number; wrap: boolean } {
  // A loop the playhead has already passed is inert: playing from beyond it
  // must run to the end, not jump backwards into a region you left.
  if (loop && position < loop.end - 0.01) return { at: Math.min(loop.end, duration), wrap: true };
  return { at: duration, wrap: false };
}

/**
 * Restrict clips to a time window and rebase it to zero — how "export just
 * the loop" works. Clips are trimmed to the window (their source offsets
 * move with the cut, so the audio inside is untouched) and anything outside
 * is dropped. Fades are left as authored; a clip clipped by the window
 * simply keeps whatever part of its envelope survives.
 */
export function sliceClipsToWindow(
  clips: StudioClip[],
  start: number,
  end: number,
): StudioClip[] {
  const out: StudioClip[] = [];
  for (const clip of clips) {
    const clipEndTime = clipTimelineEnd(clip);
    if (clipEndTime <= start + 1e-9 || clip.timelineStart >= end - 1e-9) continue;
    const headCut = Math.max(0, start - clip.timelineStart);
    const tailCut = Math.max(0, clipEndTime - end);
    const nextStart = clip.clipStart + headCut;
    const nextEnd = clip.clipEnd - tailCut;
    if (nextEnd - nextStart < MIN_CLIP_SECONDS) continue;
    out.push({
      ...clip,
      timelineStart: Math.max(0, clip.timelineStart - start),
      clipStart: nextStart,
      clipEnd: nextEnd,
    });
  }
  return out;
}

/**
 * Length of what is actually AUDIBLE: the end of the last clip that mute
 * and solo leave playing. Bouncing to timelineDuration() instead means
 * soloing an early clip hands back a file padded with the silence where
 * the muted clips used to be — a 10s solo arriving as a 20s file.
 */
export function audibleDuration(clips: StudioClip[]): number {
  const soloing = isSoloing(clips);
  let end = 0;
  for (const clip of clips) {
    if (clip.muted) continue;
    if (soloing && !clip.soloed) continue;
    end = Math.max(end, clipTimelineEnd(clip));
  }
  return end;
}

/**
 * The clip before/after `currentId` in TIME order (not insertion order —
 * the list is whatever order clips were added, which is meaningless once
 * they have been dragged around). Wraps at both ends, and with nothing
 * selected picks the first clip going forward / the last going back, so a
 * single keypress can reach the timeline from a standing start.
 */
export function adjacentClipId(
  clips: StudioClip[],
  currentId: string | null,
  direction: 1 | -1,
): string | null {
  if (clips.length === 0) return null;
  const ordered = [...clips].sort(
    (a, b) => a.timelineStart - b.timelineStart || a.id.localeCompare(b.id),
  );
  const index = ordered.findIndex((c) => c.id === currentId);
  if (index === -1) return (direction === 1 ? ordered[0] : ordered[ordered.length - 1]).id;
  const next = (index + direction + ordered.length) % ordered.length;
  return ordered[next].id;
}

/** True when at least one clip is soloed (and not also muted). */
export function isSoloing(clips: StudioClip[]): boolean {
  return clips.some((c) => c.soloed && !c.muted);
}

/**
 * Times a dragged clip should stick to: every OTHER clip's start and end,
 * the playhead, and 0. Excluding the dragged clip's own edges matters —
 * otherwise it snaps to where it already is and never moves.
 */
/**
 * Landmarks a dragged time can latch onto: the timeline origin, every other
 * clip's edges, and optionally the playhead.
 *
 * `playhead` is nullable because SCRUBBING the playhead must not offer the
 * playhead itself — its distance would be zero, it would win every
 * comparison, and snapping would silently stop working for that gesture.
 */
export function snapCandidates(
  clips: StudioClip[],
  draggedId: string | null,
  playhead: number | null,
): number[] {
  const out = playhead === null ? [0] : [0, playhead];
  for (const clip of clips) {
    if (clip.id === draggedId) continue;
    out.push(clip.timelineStart, clipTimelineEnd(clip));
  }
  return out;
}

/* ------------------------------ clip edits ------------------------------ */
/* All pure: return a NEW clip (or null when the edit is rejected). */

export function moveClip(clip: StudioClip, newTimelineStart: number): StudioClip {
  const start = Math.max(0, Math.min(newTimelineStart, MAX_TIMELINE_SECONDS - clipDuration(clip)));
  return { ...clip, timelineStart: start };
}

/** Drag the left edge: trims material AND moves the timeline start with it. */
export function trimClipStart(clip: StudioClip, newClipStart: number, bufferDuration: number): StudioClip {
  const clipStart = Math.max(0, Math.min(newClipStart, clip.clipEnd - MIN_CLIP_SECONDS));
  const delta = clipStart - clip.clipStart;
  return {
    ...clip,
    clipStart,
    timelineStart: Math.max(0, clip.timelineStart + delta),
    clipEnd: Math.min(clip.clipEnd, bufferDuration),
  };
}

export function trimClipEnd(clip: StudioClip, newClipEnd: number, bufferDuration: number): StudioClip {
  const clipEnd = Math.min(bufferDuration, Math.max(newClipEnd, clip.clipStart + MIN_CLIP_SECONDS));
  return { ...clip, clipEnd };
}

/** Shortest overlap worth crossfading — below this it is a butt join. */
const MIN_CROSSFADE_SECONDS = 0.05;

/**
 * The clip this one runs INTO: whichever overlaps it for longest.
 *
 * Three features ask the same question — what is this clip transitioning
 * with — so they ask it in one place: the crossfade needs the pair, the loop
 * needs the region, and the inspector needs to compare their keys. Returns
 * null when the clip stands alone.
 */
export function overlapPartner(
  clips: StudioClip[],
  clipId: string,
): { partner: StudioClip; start: number; end: number } | null {
  const clip = clips.find((c) => c.id === clipId);
  if (!clip) return null;
  let best: { partner: StudioClip; start: number; end: number } | null = null;
  let longest = MIN_CROSSFADE_SECONDS;
  for (const other of clips) {
    if (other.id === clip.id) continue;
    const start = Math.max(clip.timelineStart, other.timelineStart);
    const end = Math.min(clipTimelineEnd(clip), clipTimelineEnd(other));
    if (end - start > longest) {
      longest = end - start;
      best = { partner: other, start, end };
    }
  }
  return best;
}

/**
 * What "Loop" should actually cover for a clip.
 *
 * Looping a whole song is not a loop in any useful sense — a 3-minute clip
 * comes back around long after you have stopped caring. When the clip
 * overlaps another, the thing worth hearing over and over is the OVERLAP:
 * that is the transition, and working it until it sits right is the entire
 * reason the loop exists. With nothing to transition into, the clip's own
 * span is the honest answer.
 *
 * Returns null when the clip isn't there.
 */
export function loopRegionFor(
  clips: StudioClip[],
  clipId: string,
): { start: number; end: number } | null {
  const clip = clips.find((c) => c.id === clipId);
  if (!clip) return null;
  const hit = overlapPartner(clips, clipId);
  return hit
    ? { start: hit.start, end: hit.end }
    : { start: clip.timelineStart, end: clipTimelineEnd(clip) };
}

/**
 * Turn an overlap into a crossfade.
 *
 * A beat switch is already built by hand here: drag song B over song A's
 * tail, then fade A out and B in over exactly the region where they overlap.
 * The second half of that is arithmetic the user should not be doing, and
 * getting it wrong by half a second is audible. So: find the clip that
 * overlaps this one the most, and set both fades to the length of the
 * overlap, on an equal-power curve so the transition holds its level.
 *
 * Returns null when nothing overlaps — the caller hides the action rather
 * than offering something that would silently do nothing.
 */
export function crossfadeOverlap(clips: StudioClip[], clipId: string): StudioClip[] | null {
  const clip = clips.find((c) => c.id === clipId);
  if (!clip) return null;
  const hit = overlapPartner(clips, clipId);
  if (!hit) return null;
  const partner = hit.partner;
  const best = hit.end - hit.start;

  // Whichever starts first is the one going OUT. A tie would make the
  // direction arbitrary, so the shorter clip yields and fades in.
  const clipFirst =
    clip.timelineStart < partner.timelineStart ||
    (clip.timelineStart === partner.timelineStart && clipDuration(clip) >= clipDuration(partner));
  const outgoing = clipFirst ? clip : partner;
  const incoming = clipFirst ? partner : clip;

  // Use the whole overlap, so the two fades land on exactly the same span
  // and equal power actually holds. The only limit is the room each clip has
  // left after the fade it already carries at its other end.
  const seconds = Math.min(
    best,
    clipDuration(outgoing) - outgoing.fadeInSec,
    clipDuration(incoming) - incoming.fadeOutSec,
  );
  if (seconds < MIN_CROSSFADE_SECONDS) return null;

  return clips.map((c) => {
    if (c.id === outgoing.id) return { ...withFadeOut(c, seconds), fadeCurve: "equalPower" as const };
    if (c.id === incoming.id) return { ...withFadeIn(c, seconds), fadeCurve: "equalPower" as const };
    return c;
  });
}

/**
 * Split at a timeline position. Returns the two halves (abutting, no gap) or
 * null when the cut lands outside the clip or a half would be too short.
 */
export function splitClip(
  clip: StudioClip,
  timelinePosition: number,
  makeId: () => string,
): [StudioClip, StudioClip] | null {
  const duration = clipDuration(clip);
  const into = timelinePosition - clip.timelineStart;
  if (into < MIN_CLIP_SECONDS || duration - into < MIN_CLIP_SECONDS) return null;
  const cutInBuffer = clip.clipStart + into;

  // Splitting must not change what you hear — it is a structural edit, not a
  // mixing one. Measured before this: a 20 s clip with an 8 s fade-in, cut at
  // 4 s, jumped from 0.500 to 1.000 at the cut, because each half kept the
  // whole fade and fitFades then squeezed it into the half's own length. Six
  // decibels, from an operation that is supposed to be silent.
  //
  // Fades are measured against the FITTED values, since those are what is
  // actually heard when the two of them together exceed the clip.
  const { fadeIn, fadeOut } = fitFades(clip.fadeInSec, clip.fadeOutSec, duration);
  const lerp = (from: number, to: number, at: number) => from + (to - from) * at;

  const left: StudioClip = { ...clip, clipEnd: cutInBuffer, fadeOutSec: 0 };
  const right: StudioClip = {
    ...clip,
    id: makeId(),
    clipStart: cutInBuffer,
    timelineStart: timelinePosition,
    fadeInSec: 0,
  };
  delete left.fadeOutFrom;
  delete left.fadeOutTo;
  delete right.fadeInFrom;
  delete right.fadeInTo;

  if (fadeIn > 0 && into < fadeIn) {
    // The cut lands inside the fade-in, so the left half is nothing BUT fade
    // and the right half has to resume partway up the curve.
    const from = clip.fadeInFrom ?? 0;
    const to = clip.fadeInTo ?? 1;
    const atCut = lerp(from, to, into / fadeIn);
    left.fadeInSec = into;
    left.fadeInFrom = from;
    left.fadeInTo = atCut;
    right.fadeInSec = fadeIn - into;
    right.fadeInFrom = atCut;
    right.fadeInTo = to;
  } else if (fadeOut > 0 && into > duration - fadeOut) {
    // Mirror image: the cut is inside the fade-out, so the left half ends
    // partway down and the right half is all tail.
    const from = clip.fadeOutFrom ?? 1;
    const to = clip.fadeOutTo ?? 0;
    const atCut = lerp(to, from, (duration - into) / fadeOut);
    left.fadeOutSec = into - (duration - fadeOut);
    left.fadeOutFrom = from;
    left.fadeOutTo = atCut;
    right.fadeOutSec = duration - into;
    right.fadeOutFrom = atCut;
    right.fadeOutTo = to;
  }
  return [left, right];
}
