"use client";

import { useEffect, useRef } from "react";
import { formatTimeTenths } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const MIN_SELECTION_SECONDS = 0.1;
const KEY_STEP_SECONDS = 1;

/**
 * The cutter's waveform IS the trim control: the regions outside the
 * start/end selection are shaded dark, so the light middle band reads as
 * "this is the part you keep". Press or drag anywhere on the wave and the
 * NEAREST bound snaps to the pointer — tap at 0:40 near the left and the
 * start becomes 0:40; drag near the right edge and you're moving the end.
 * The selection edges render as chunky grip bars; the fade in/out toggles
 * sit ON the wave at the selection's top corners (like the reference
 * cutter), and the playhead is a thin line driven by a CSS var (no
 * re-renders). Under the wave: absolute start/end times pinned under the
 * selection edges plus the selection length centered beneath.
 * `headSignal` forces a playhead reposition after a programmatic seek while
 * paused (e.g. the back-to-start button).
 */
export function TrimWaveform({
  bars,
  duration,
  start,
  end,
  playing,
  getCurrentTime,
  onChangeStart,
  onChangeEnd,
  fadeIn,
  fadeOut,
  onToggleFadeIn,
  onToggleFadeOut,
  headSignal = 0,
  disabled,
}: {
  bars: number[];
  duration: number;
  start: number;
  end: number;
  playing: boolean;
  getCurrentTime: () => number;
  onChangeStart: (seconds: number) => void;
  onChangeEnd: (seconds: number) => void;
  fadeIn: boolean;
  fadeOut: boolean;
  onToggleFadeIn: () => void;
  onToggleFadeOut: () => void;
  headSignal?: number;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<"start" | "end" | null>(null);
  const rafRef = useRef<number | null>(null);
  const getCurrentTimeRef = useRef(getCurrentTime);
  getCurrentTimeRef.current = getCurrentTime;

  const applyHead = (seconds: number) => {
    const track = trackRef.current;
    if (!track) return;
    const pct = duration > 0 ? clamp((seconds / duration) * 100, 0, 100) : 0;
    track.style.setProperty("--trim-head-pct", `${pct}%`);
  };

  useEffect(() => {
    const tick = () => {
      applyHead(getCurrentTimeRef.current());
      rafRef.current = requestAnimationFrame(tick);
    };
    if (playing) rafRef.current = requestAnimationFrame(tick);
    else applyHead(getCurrentTimeRef.current());
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, duration, headSignal]);

  const secondsFromClientX = (clientX: number): number => {
    const track = trackRef.current;
    if (!track || duration <= 0) return 0;
    const rect = track.getBoundingClientRect();
    return clamp((clientX - rect.left) / rect.width, 0, 1) * duration;
  };

  const moveBound = (bound: "start" | "end", seconds: number) => {
    if (bound === "start") onChangeStart(clamp(seconds, 0, end - MIN_SELECTION_SECONDS));
    else onChangeEnd(clamp(seconds, start + MIN_SELECTION_SECONDS, duration));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || duration <= 0) return;
    const seconds = secondsFromClientX(event.clientX);
    // Nearest bound wins; ties go to the start handle.
    const bound: "start" | "end" =
      Math.abs(seconds - start) <= Math.abs(seconds - end) ? "start" : "end";
    draggingRef.current = bound;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointers can't always be captured; drag still works.
    }
    moveBound(bound, seconds);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    moveBound(draggingRef.current, secondsFromClientX(event.clientX));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKey = (bound: "start" | "end") => (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || duration <= 0) return;
    const current = bound === "start" ? start : end;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      moveBound(bound, current - KEY_STEP_SECONDS);
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      moveBound(bound, current + KEY_STEP_SECONDS);
    }
  };

  // Fade buttons sit on the trim track, which owns every pointerdown for
  // drag-to-trim — stop the event there so pressing a toggle never moves a
  // bound underneath it.
  const stopTrackDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  const startPct = duration > 0 ? (start / duration) * 100 : 0;
  const endPct = duration > 0 ? (end / duration) * 100 : 100;
  const max = bars.length ? Math.max(...bars) : 1;

  return (
    <div className="trim-wave">
      <div
        ref={trackRef}
        className="seek-wave-track trim-wave-track"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="seek-wave-bars" aria-hidden="true">
          {bars.map((bar, index) => (
            <i key={index} style={{ height: `${Math.max(8, (bar / max) * 100)}%` }} />
          ))}
        </div>

        {/* Shaded = discarded; the light middle band is what gets kept. */}
        <div className="trim-shade" style={{ left: 0, width: `${startPct}%` }} aria-hidden="true" />
        <div
          className="trim-shade trim-shade-right"
          style={{ left: `${endPct}%`, width: `${100 - endPct}%` }}
          aria-hidden="true"
        />

        {/* Fade toggles pinned to the selection's top corners. */}
        <button
          className="trim-fade-btn"
          type="button"
          style={{ left: `clamp(4px, calc(${startPct}% + 8px), calc(${endPct}% - 46px))` }}
          aria-pressed={fadeIn}
          aria-label={t("cutter.fadeIn")}
          title={t("cutter.fadeIn")}
          disabled={disabled}
          onPointerDown={stopTrackDrag}
          onClick={onToggleFadeIn}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 13.5 C 8 13.5, 8 2.5, 14 2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <button
          className="trim-fade-btn trim-fade-btn-out"
          type="button"
          style={{ left: `min(clamp(calc(${startPct}% + 46px), calc(${endPct}% - 8px), calc(100% - 4px)), calc(100% - 4px))` }}
          aria-pressed={fadeOut}
          aria-label={t("cutter.fadeOut")}
          title={t("cutter.fadeOut")}
          disabled={disabled}
          onPointerDown={stopTrackDrag}
          onClick={onToggleFadeOut}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 2.5 C 8 2.5, 8 13.5, 14 13.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <div
          className="trim-handle"
          style={{ left: `${startPct}%` }}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={t("cutter.start")}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(start)}
          aria-valuetext={formatTimeTenths(start)}
          onKeyDown={handleKey("start")}
        />
        <div
          className="trim-handle trim-handle-end"
          style={{ left: `${endPct}%` }}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={t("cutter.end")}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(end)}
          aria-valuetext={formatTimeTenths(end)}
          onKeyDown={handleKey("end")}
        />

        <div className="trim-head" aria-hidden="true" />
      </div>

      {/* Absolute times pinned under the selection edges... */}
      <div className="trim-times">
        <span style={{ left: `clamp(24px, ${startPct}%, calc(100% - 24px))` }}>{formatTimeTenths(start)}</span>
        <span style={{ left: `clamp(24px, ${endPct}%, calc(100% - 24px))` }}>{formatTimeTenths(end)}</span>
      </div>
      {/* ...and the selection length centered beneath the wave. */}
      <p className="trim-duration" aria-label={t("cutter.selection")}>
        {formatTimeTenths(Math.max(0, end - start))}
      </p>
    </div>
  );
}
