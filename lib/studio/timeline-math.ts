// px <-> seconds for the DAW timeline. pxPerSecond is the primary unit (the
// cutter's percent-of-duration model doesn't survive a multi-clip timeline
// whose length changes as clips move). One transform, every consumer — bars,
// clip positioning, pointer hit-testing, and the playhead all go through
// these two functions so rounding is identical everywhere.

export const ZOOM_PX_PER_SECOND = [6, 12, 25, 50, 100] as const;
export type ZoomPxPerSecond = (typeof ZOOM_PX_PER_SECOND)[number];
export const DEFAULT_PX_PER_SECOND: ZoomPxPerSecond = 25;

export const ROW_HEIGHT = 84;
export const RULER_HEIGHT = 24;
/** Extra scrollable room past the last clip, in seconds. */
export const TAIL_HEADROOM_SECONDS = 10;

export const NUDGE_SECONDS = 0.1;
export const NUDGE_SECONDS_LARGE = 1;
/** Pointer distance (px) within which a clip edge counts as a trim grip. */
export const TRIM_GRIP_PX = 12;

export function timeToX(t: number, pxPerSecond: number): number {
  return t * pxPerSecond;
}

export function xToTime(x: number, pxPerSecond: number): number {
  return x / pxPerSecond;
}

/** Ruler tick spacing that keeps labels readable at every zoom. */
export function rulerStepSeconds(pxPerSecond: number): number {
  const steps = [1, 2, 5, 10, 15, 30, 60, 120];
  for (const s of steps) if (s * pxPerSecond >= 60) return s;
  return 300;
}
