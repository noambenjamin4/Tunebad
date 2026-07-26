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
    const fadeIn = Math.min(clip.fadeInSec, duration / 2);
    const fadeOut = Math.min(clip.fadeOutSec, duration / 2);
    const points: FadePoint[] = [];
    const toWall = (t: number) => (t - position) / speed;
    if (fadeIn > 0 || fadeOut > 0) {
      const fadeInEnd = clip.timelineStart + fadeIn;
      const fadeOutStart = end - fadeOut;
      const startT = clip.timelineStart + intoClip;
      const gainAt = (t: number) => {
        let g = 1;
        if (fadeIn > 0 && t < fadeInEnd) g = Math.min(g, (t - clip.timelineStart) / fadeIn);
        if (fadeOut > 0 && t > fadeOutStart) g = Math.min(g, (end - t) / fadeOut);
        return Math.max(0, Math.min(1, g)) * clip.gain;
      };
      points.push({ at: toWall(startT), gain: gainAt(startT) });
      if (fadeIn > 0 && fadeInEnd > startT && fadeInEnd < end) {
        points.push({ at: toWall(fadeInEnd), gain: gainAt(fadeInEnd) });
      }
      if (fadeOut > 0 && fadeOutStart > startT && fadeOutStart < end) {
        // Hold at full gain until the fade-out begins…
        points.push({ at: toWall(fadeOutStart), gain: gainAt(fadeOutStart) });
      }
      points.push({ at: toWall(end), gain: gainAt(end) });
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
export function snapCandidates(
  clips: StudioClip[],
  draggedId: string | null,
  playhead: number,
): number[] {
  const out = [0, playhead];
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

/**
 * Split at a timeline position. Returns the two halves (abutting, no gap) or
 * null when the cut lands outside the clip or a half would be too short.
 */
export function splitClip(
  clip: StudioClip,
  timelinePosition: number,
  makeId: () => string,
): [StudioClip, StudioClip] | null {
  const into = timelinePosition - clip.timelineStart;
  if (into < MIN_CLIP_SECONDS || clipDuration(clip) - into < MIN_CLIP_SECONDS) return null;
  const cutInBuffer = clip.clipStart + into;
  const left: StudioClip = { ...clip, clipEnd: cutInBuffer, fadeOutSec: 0 };
  const right: StudioClip = {
    ...clip,
    id: makeId(),
    clipStart: cutInBuffer,
    timelineStart: timelinePosition,
    fadeInSec: 0,
  };
  return [left, right];
}
