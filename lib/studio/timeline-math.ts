// Layout constants and the non-obvious geometry for the DAW timeline.
//
// pxPerSecond is the primary unit — the cutter's percent-of-duration model
// doesn't survive a multi-clip timeline whose length changes as clips move.
// The conversion itself is `seconds * pxPerSecond`, written inline at each
// call site ON PURPOSE: there is no window offset to get wrong here (the
// DOM owns the scroll), so wrapping a multiply in a function bought
// indirection and prevented nothing. What DOES live here is the geometry
// that is easy to get wrong — cursor-anchored zoom, snapping, tick spacing.

/** Continuous, not a preset ladder: pinch/ctrl-wheel zooms smoothly. */
export const MIN_PX_PER_SECOND = 2;
export const MAX_PX_PER_SECOND = 400;
export const DEFAULT_PX_PER_SECOND = 25;
/** One button press / wheel notch. */
export const ZOOM_STEP = 1.25;

export const ROW_HEIGHT = 84;
/** Strip above the ruler where a loop region is dragged. */
export const LOOP_LANE_HEIGHT = 14;
export const RULER_HEIGHT = 24;
/** Extra scrollable room past the last clip, in seconds. */
export const TAIL_HEADROOM_SECONDS = 10;

export const NUDGE_SECONDS = 0.1;
export const NUDGE_SECONDS_LARGE = 1;
/** Pointer distance (px) within which a clip edge counts as a trim grip. */
export const TRIM_GRIP_PX = 12;
/** Drag lands on a neighbouring edge / the playhead inside this many px. */
const SNAP_PX = 8;

export function clampZoom(pxPerSecond: number): number {
  return Math.min(MAX_PX_PER_SECOND, Math.max(MIN_PX_PER_SECOND, pxPerSecond));
}

/**
 * Zoom keeping one point pinned: whatever time sits under the cursor stays
 * under the cursor. `cursorX` is px from the scroller's left edge; returns
 * the new zoom AND the scrollLeft that preserves the anchor.
 */
export function zoomAtCursor(
  pxPerSecond: number,
  factor: number,
  scrollLeft: number,
  cursorX: number,
): { pxPerSecond: number; scrollLeft: number } {
  const next = clampZoom(pxPerSecond * factor);
  const anchorTime = (scrollLeft + cursorX) / pxPerSecond;
  return { pxPerSecond: next, scrollLeft: Math.max(0, anchorTime * next - cursorX) };
}

/** Zoom that fits `seconds` into `viewportPx`, with a little air. */
export function zoomToFit(seconds: number, viewportPx: number): number {
  if (seconds <= 0 || viewportPx <= 0) return DEFAULT_PX_PER_SECOND;
  return clampZoom((viewportPx * 0.96) / seconds);
}

/**
 * Pull `time` onto the nearest candidate within SNAP_PX (converted to
 * seconds at the current zoom). Candidates are neighbouring clip edges, the
 * playhead, and 0. Returns the input unchanged when nothing is close —
 * snapping must never move a clip the user didn't aim at.
 */
export function snapTime(time: number, candidates: number[], pxPerSecond: number): number {
  const tolerance = SNAP_PX / pxPerSecond;
  let best = time;
  let bestDistance = tolerance;
  for (const candidate of candidates) {
    const distance = Math.abs(candidate - time);
    if (distance <= bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

/**
 * Where a dragged clip of `length` should land: BOTH its start and its end
 * look for a candidate, and the edge that actually found one wins (when both
 * do, the smaller correction). Comparing raw distances instead would always
 * pick the edge that did NOT snap — its distance is zero — which silently
 * disables snapping. Returns `rawStart` when neither edge is close.
 */
export function snapClipStart(
  rawStart: number,
  length: number,
  candidates: number[],
  pxPerSecond: number,
): number {
  const byStart = snapTime(rawStart, candidates, pxPerSecond);
  // The +length/-length round trip is not exact in floating point, so "did
  // this edge snap?" must be a tolerance test — a 1e-16 residue would
  // otherwise read as a snap of its own and always win the comparison below.
  const byEnd = snapTime(rawStart + length, candidates, pxPerSecond) - length;
  const startMoved = Math.abs(byStart - rawStart) > 1e-9;
  const endMoved = Math.abs(byEnd - rawStart) > 1e-9;
  let start = rawStart;
  if (startMoved && endMoved) {
    start = Math.abs(byStart - rawStart) <= Math.abs(byEnd - rawStart) ? byStart : byEnd;
  } else if (startMoved) {
    start = byStart;
  } else if (endMoved) {
    start = byEnd;
  }
  return Math.max(0, start);
}

/** Ruler tick spacing that keeps labels readable at every zoom. */
export function rulerStepSeconds(pxPerSecond: number): number {
  const steps = [1, 2, 5, 10, 15, 30, 60, 120];
  for (const s of steps) if (s * pxPerSecond >= 60) return s;
  return 300;
}
