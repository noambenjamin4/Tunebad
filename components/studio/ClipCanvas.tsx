"use client";

// One clip's waveform on the DAW timeline. The canvas IS the cache: it
// re-renders only when the trim window, width, theme, fades, or DPR change —
// dragging a clip around the timeline just moves the element. Bars are exact
// min/max columns from the buffer's peak pyramid (retina-crisp, a
// single-sample spike survives every zoom), scaled by the clip's fade
// envelope so the taper is visible on the wave itself, matching the cutter.

import { useEffect, useRef } from "react";
import type { PeakPyramid } from "@/lib/studio/waveform-pyramid";
import { windowMinMax } from "@/lib/studio/waveform-pyramid";

const COLUMN_PX = 3;
const BAR_PX = 2;

export function ClipCanvas({
  buffer,
  pyramid,
  clipStart,
  clipEnd,
  fadeInSec,
  fadeOutSec,
  widthPx,
  heightPx,
  themeSignal = 0,
}: {
  buffer: AudioBuffer;
  pyramid: PeakPyramid;
  clipStart: number;
  clipEnd: number;
  fadeInSec: number;
  fadeOutSec: number;
  widthPx: number;
  heightPx: number;
  /** Bump to force a repaint after a theme flip. */
  themeSignal?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || widthPx <= 0 || heightPx <= 0) return;
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.width = Math.max(1, Math.round(widthPx * dpr));
    canvas.height = Math.max(1, Math.round(heightPx * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, widthPx, heightPx);

    const styles = getComputedStyle(canvas);
    const ink = styles.getPropertyValue("--ink").trim() || "#111111";
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.85;

    const data = buffer.getChannelData(0);
    const rate = buffer.sampleRate;
    const duration = clipEnd - clipStart;
    if (duration <= 0) return;
    const secondsPerPx = duration / widthPx;
    const mid = heightPx / 2;
    const half = heightPx / 2 - 2;
    const fadeIn = Math.min(fadeInSec, duration / 2);
    const fadeOut = Math.min(fadeOutSec, duration / 2);

    for (let x = 0; x < widthPx; x += COLUMN_PX) {
      const t0 = clipStart + x * secondsPerPx;
      const t1 = clipStart + Math.min(widthPx, x + COLUMN_PX) * secondsPerPx;
      const { min, max } = windowMinMax(data, pyramid, t0 * rate, t1 * rate);

      // Fade envelope at the column's center, clip-local time.
      const local = (t0 + t1) / 2 - clipStart;
      let gain = 1;
      if (fadeIn > 0 && local < fadeIn) gain = Math.min(gain, local / fadeIn);
      if (fadeOut > 0 && local > duration - fadeOut) {
        gain = Math.min(gain, (duration - local) / fadeOut);
      }
      gain = Math.max(0, Math.min(1, gain));

      // Canvas y grows downward: max (positive) is the TOP of the column.
      const yTop = mid - Math.max(0, max) * half * gain;
      const yBottom = mid - Math.min(0, min) * half * gain;
      // One vertical min/max bar per column; floor 1px so silence stays visible.
      ctx.fillRect(x, yTop, BAR_PX, Math.max(1, yBottom - yTop));
    }
  }, [buffer, pyramid, clipStart, clipEnd, fadeInSec, fadeOutSec, widthPx, heightPx, themeSignal]);

  return (
    <canvas
      ref={canvasRef}
      className="studio-clip-canvas"
      style={{ width: `${widthPx}px`, height: `${heightPx}px` }}
      aria-hidden="true"
    />
  );
}
