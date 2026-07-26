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
  /** 0..5, assigned round-robin at add time; drives the clip tint. */
  colorIndex: number;
}

export const MIN_CLIP_SECONDS = 0.1;
export const MAX_CLIPS = 6;
export const MAX_TIMELINE_SECONDS = 30 * 60;
/** ~500 MB of decoded Float32 audio across all clips. */
export const MAX_DECODED_BYTES = 500 * 1024 * 1024;

export function clipDuration(clip: StudioClip): number {
  return clip.clipEnd - clip.clipStart;
}

export function clipTimelineEnd(clip: StudioClip): number {
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
  for (const clip of clips) {
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
