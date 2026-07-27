"use client";

// One clip's waveform — but only the part you can actually see.
//
// Sizing a canvas to the whole clip does not survive contact with real
// songs: a 4-minute track at 83 px/s is a 39,841-pixel backing store, past
// the ~32,767 limit where browsers stop rendering entirely, and 17.6 MB of
// canvas EACH. A few clips exhaust canvas memory, the browser drops backing
// stores, and waveforms blink out at random — the "sometimes blank" bug.
//
// So the canvas is viewport-sized and positioned at the visible slice; it
// re-renders as you scroll. Width is bounded by the window, not the song,
// so zoom and track length cost nothing. Bars are exact min/max columns
// from the display signal's peak pyramid, scaled by BOTH the clip's fade
// envelope and its volume, so the wave always looks like what it sounds
// like.

import { useLayoutEffect, useRef } from "react";
import type { DisplaySignal } from "@/lib/studio/display-signal";
import { type FadeCurve, fadeGain } from "@/lib/studio/timeline";
import { windowMinMax } from "@/lib/studio/waveform-pyramid";

// One column per pixel, drawn edge to edge. The old 2px-bar-every-3px grid
// left a third of the clip blank, which reads as a sparse picket fence
// rather than audio — the single biggest reason the waveform looked wrong.
const COLUMN_PX = 1;

export function ClipCanvas({
  signal,
  clipStart,
  clipEnd,
  fromSec,
  toSec,
  fadeInSec,
  fadeOutSec,
  fadeCurve,
  fadeInFrom,
  fadeInTo,
  fadeOutFrom,
  fadeOutTo,
  gain,
  muted,
  widthPx,
  heightPx,
  offsetPx,
  themeSignal = 0,
}: {
  signal: DisplaySignal;
  /** Full trimmed span of the clip, in source seconds — fades are clip-global. */
  clipStart: number;
  clipEnd: number;
  /** The visible sub-span to draw, in source seconds. */
  fromSec: number;
  toSec: number;
  fadeInSec: number;
  fadeOutSec: number;
  fadeCurve: FadeCurve | undefined;
  /** Which part of each fade curve this clip covers — see StudioClip. */
  fadeInFrom?: number;
  fadeInTo?: number;
  fadeOutFrom?: number;
  fadeOutTo?: number;
  gain: number;
  muted: boolean;
  /** Width of the visible slice in CSS px. */
  widthPx: number;
  heightPx: number;
  /** Where the slice sits inside the clip, in CSS px. */
  offsetPx: number;
  /** Bump to force a repaint after a theme flip. */
  themeSignal?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // useLayoutEffect, not useEffect: React commits the <canvas> element and
  // only THEN runs passive effects, so with useEffect there is one frame
  // where the clip box is on screen and empty — a visible flicker on load,
  // scroll and zoom. Layout effects run before the browser paints, so the
  // waveform is there the first time the element is seen.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || widthPx <= 0 || heightPx <= 0 || toSec <= fromSec) return;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.max(1, Math.round(widthPx * dpr));
    canvas.height = Math.max(1, Math.round(heightPx * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, widthPx, heightPx);

    const styles = getComputedStyle(canvas);
    const ink = styles.getPropertyValue("--ink").trim() || "#111111";
    ctx.fillStyle = ink;
    const dim = muted ? 0.33 : 1;

    const { data, pyramid, sampleRate } = signal;
    const clipLength = clipEnd - clipStart;
    if (clipLength <= 0) return;
    const secondsPerPx = (toSec - fromSec) / widthPx;
    const mid = heightPx / 2;
    const half = heightPx / 2 - 2;

    // Two passes so the whole outline sits under the whole body — drawing
    // them per column would let each body edge overlap the next outline.
    const cols = Math.ceil(widthPx / COLUMN_PX);
    const peakTop = new Float32Array(cols);
    const peakBottom = new Float32Array(cols);
    const rmsHalf = new Float32Array(cols);

    for (let c = 0; c < cols; c++) {
      const x = c * COLUMN_PX;
      const t0 = fromSec + x * secondsPerPx;
      const t1 = fromSec + Math.min(widthPx, x + COLUMN_PX) * secondsPerPx;
      const { min, max, rms } = windowMinMax(data, pyramid, t0 * sampleRate, t1 * sampleRate);

      // Fade envelope at the column's centre, measured from the clip's own
      // start (not the slice's), times volume.
      const local = (t0 + t1) / 2 - clipStart;
      const level = Math.max(
        0,
        gain *
          fadeGain(local, clipLength, {
            fadeInSec,
            fadeOutSec,
            fadeCurve,
            fadeInFrom,
            fadeInTo,
            fadeOutFrom,
            fadeOutTo,
          }),
      );

      // Canvas y grows downward: max (positive) is the TOP of the column.
      // Clamp to the box so a boosted clip can't paint outside its lane.
      const up = Math.min(1, Math.max(0, max) * level);
      const down = Math.min(1, Math.abs(Math.min(0, min)) * level);
      peakTop[c] = mid - up * half;
      peakBottom[c] = mid + down * half;
      rmsHalf[c] = Math.min(1, rms * level) * half;
    }

    // Peak outline: the transients, faint.
    ctx.globalAlpha = 0.38 * dim;
    for (let c = 0; c < cols; c++) {
      ctx.fillRect(c * COLUMN_PX, peakTop[c], COLUMN_PX, Math.max(1, peakBottom[c] - peakTop[c]));
    }
    // RMS body: how loud it actually is, solid. A quiet intro now looks
    // quiet next to a drop instead of equally tall.
    ctx.globalAlpha = 0.92 * dim;
    for (let c = 0; c < cols; c++) {
      const h = Math.max(1, rmsHalf[c] * 2);
      ctx.fillRect(c * COLUMN_PX, mid - h / 2, COLUMN_PX, h);
    }
    ctx.globalAlpha = 1;
  }, [
    signal,
    clipStart,
    clipEnd,
    fromSec,
    toSec,
    fadeInSec,
    fadeOutSec,
    fadeCurve,
    fadeInFrom,
    fadeInTo,
    fadeOutFrom,
    fadeOutTo,
    gain,
    muted,
    widthPx,
    heightPx,
    themeSignal,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="studio-clip-canvas"
      style={{ width: `${widthPx}px`, height: `${heightPx}px`, left: `${offsetPx}px` }}
      aria-hidden="true"
    />
  );
}
