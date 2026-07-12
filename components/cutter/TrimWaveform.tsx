"use client";

import { useEffect, useRef } from "react";
import { formatTime } from "@/lib/format";
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
 * The playhead renders as a thin line driven by a CSS var (no re-renders).
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
  onTogglePlay,
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
  onTogglePlay: () => void;
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
  }, [playing, duration]);

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

  const startPct = duration > 0 ? (start / duration) * 100 : 0;
  const endPct = duration > 0 ? (end / duration) * 100 : 100;
  const max = bars.length ? Math.max(...bars) : 1;

  return (
    <div className="seek-wave trim-wave">
      <button
        className="round-button"
        type="button"
        aria-label={playing ? t("analysis.pausePreview") : t("analysis.playPreview")}
        disabled={disabled}
        onClick={onTogglePlay}
      >
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="3" y="2.5" width="3.4" height="11" rx="1" fill="currentColor" />
            <rect x="9.6" y="2.5" width="3.4" height="11" rx="1" fill="currentColor" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4.5 2.8v10.4c0 .8.9 1.3 1.6.9l8-5.2c.6-.4.6-1.4 0-1.8l-8-5.2c-.7-.4-1.6.1-1.6.9z" fill="currentColor" />
          </svg>
        )}
      </button>

      <div className="seek-wave-main">
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

          <div
            className="trim-handle"
            style={{ left: `${startPct}%` }}
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-label={t("cutter.start")}
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(start)}
            aria-valuetext={formatTime(start)}
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
            aria-valuetext={formatTime(end)}
            onKeyDown={handleKey("end")}
          />

          <div className="trim-head" aria-hidden="true" />
        </div>

        <div className="seek-wave-times trim-wave-times">
          <span>{formatTime(start)}</span>
          <span>{formatTime(end)}</span>
        </div>
      </div>
    </div>
  );
}
