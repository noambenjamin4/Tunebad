"use client";

// The DAW's timeline: a horizontally scrollable strip where clips sit at
// absolute times (pxPerSecond is the primary unit — the cutter's
// percent-of-duration model can't survive a timeline whose length changes as
// clips move). Interaction model:
//   - press within TRIM_GRIP_PX of a clip edge -> drag trims that edge
//   - press a clip body -> drag moves the clip, snapping to neighbouring
//     edges / the playhead (hold Alt to place freely); live preview writes
//     style.left directly, state commits on release
//   - press the ruler or empty track -> seek (drag keeps scrubbing)
//   - pinch (or ctrl/cmd + wheel) -> zoom continuously about the cursor;
//     plain wheel scrolls. macOS trackpad pinch arrives as ctrl+wheel, so
//     two fingers Just Work.
//   - keyboard: Space play/pause, Delete removes, arrows nudge, S splits
// The playhead is one absolutely positioned line driven by a CSS var from a
// single rAF loop reading getPosition() — zero re-renders while playing.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatTime, formatTimeTenths } from "@/lib/format";
import {
  type StudioClip,
  assignDisplayRows,
  clipDuration,
  snapCandidates,
  timelineDuration,
  MIN_CLIP_SECONDS,
} from "@/lib/studio/timeline";
import {
  ROW_HEIGHT,
  RULER_HEIGHT,
  TAIL_HEADROOM_SECONDS,
  TRIM_GRIP_PX,
  NUDGE_SECONDS,
  NUDGE_SECONDS_LARGE,
  ZOOM_STEP,
  clampZoom,
  rulerStepSeconds,
  snapClipStart,
  zoomAtCursor,
  zoomToFit,
} from "@/lib/studio/timeline-math";
import type { DisplaySignal } from "@/lib/studio/display-signal";
import { ClipCanvas } from "./ClipCanvas";

const CLIP_PAD = 6;
const WAVE_HEIGHT = ROW_HEIGHT - 26;

type DragState =
  | { kind: "move"; clipId: string; grabOffsetSec: number; latestStart: number }
  | { kind: "trim-start" | "trim-end"; clipId: string }
  | { kind: "seek" };

export function Timeline({
  clips,
  signals,
  selectedId,
  playing,
  pxPerSecond,
  getPosition,
  onSelect,
  onMoveClip,
  onTrimStart,
  onTrimEnd,
  onSeek,
  onTogglePlay,
  onDeleteSelected,
  onSplitSelected,
  onChangeZoom,
  headSignal = 0,
  disabled,
}: {
  clips: StudioClip[];
  signals: Map<string, DisplaySignal>;
  selectedId: string | null;
  playing: boolean;
  pxPerSecond: number;
  getPosition: () => number;
  onSelect: (id: string | null) => void;
  onMoveClip: (id: string, timelineStart: number) => void;
  onTrimStart: (id: string, newClipStart: number) => void;
  onTrimEnd: (id: string, newClipEnd: number) => void;
  onSeek: (seconds: number) => void;
  onTogglePlay: () => void;
  onDeleteSelected: () => void;
  onSplitSelected: () => void;
  onChangeZoom: (pxPerSecond: number) => void;
  headSignal?: number;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const rafRef = useRef<number | null>(null);
  const getPositionRef = useRef(getPosition);
  getPositionRef.current = getPosition;
  const clipsRef = useRef(clips);
  clipsRef.current = clips;
  const zoomRef = useRef(pxPerSecond);
  zoomRef.current = pxPerSecond;
  // Time badge shown beside a clip while it is being dragged or trimmed.
  const [dragLabel, setDragLabel] = useState<string | null>(null);

  const rows = useMemo(() => assignDisplayRows(clips), [clips]);
  const rowCount = Math.max(1, rows.size ? Math.max(...rows.values()) + 1 : 1);
  const duration = timelineDuration(clips);
  const innerSeconds = duration + TAIL_HEADROOM_SECONDS;
  const innerWidth = Math.max(1, Math.ceil(innerSeconds * pxPerSecond));

  /* ------------------------------ playhead ------------------------------ */

  const applyHead = useCallback(
    (seconds: number) => {
      trackRef.current?.style.setProperty("--studio-head-px", `${seconds * pxPerSecond}px`);
    },
    [pxPerSecond],
  );

  useEffect(() => {
    const tick = () => {
      applyHead(getPositionRef.current());
      rafRef.current = requestAnimationFrame(tick);
    };
    if (playing) rafRef.current = requestAnimationFrame(tick);
    else applyHead(getPositionRef.current());
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing, headSignal, clips, applyHead]);

  /* -------------------------------- zoom -------------------------------- */

  // scrollLeft to restore once the track has been re-laid-out at the new
  // zoom. Assigning it before the width changes would clamp it, so it waits
  // for the layout effect below.
  const pendingScrollRef = useRef<number | null>(null);

  const applyZoom = useCallback(
    (factor: number, cursorX?: number) => {
      const scroller = scrollRef.current;
      if (!scroller) return;
      const anchorX = cursorX ?? scroller.clientWidth / 2;
      const next = zoomAtCursor(zoomRef.current, factor, scroller.scrollLeft, anchorX);
      if (next.pxPerSecond === zoomRef.current) return;
      pendingScrollRef.current = next.scrollLeft;
      onChangeZoom(next.pxPerSecond);
    },
    [onChangeZoom],
  );

  // Native listener because React's onWheel is passive — it cannot
  // preventDefault, and without that a pinch zooms the whole page instead.
  // macOS trackpad pinch arrives as ctrl+wheel, so two fingers just work.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const rect = scroller.getBoundingClientRect();
        // exp() keeps the feel even across trackpad's fine deltas and a
        // mouse wheel's coarse notches.
        applyZoom(Math.exp(-event.deltaY * 0.01), event.clientX - rect.left);
      } else if (Math.abs(event.deltaX) < Math.abs(event.deltaY)) {
        // Vertical wheel on a horizontal strip: pan instead of doing nothing.
        event.preventDefault();
        scroller.scrollLeft += event.deltaY;
      }
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, [applyZoom]);

  const lastZoomRef = useRef(pxPerSecond);
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || lastZoomRef.current === pxPerSecond) return;
    lastZoomRef.current = pxPerSecond;
    const overflow = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    // Zoomed about a point (cursor, centre, fit): restore that exact offset.
    if (pendingScrollRef.current !== null) {
      scroller.scrollLeft = Math.max(0, Math.min(pendingScrollRef.current, overflow));
      pendingScrollRef.current = null;
      return;
    }
    // Anything else (e.g. a zoom set elsewhere): keep the work in view.
    const selected = clipsRef.current.find((c) => c.id === selectedId);
    const anchorSec = selected
      ? selected.timelineStart + clipDuration(selected) / 2
      : getPositionRef.current();
    const target = anchorSec * pxPerSecond - scroller.clientWidth / 2;
    scroller.scrollLeft = Math.max(0, Math.min(target, overflow));
  }, [pxPerSecond, selectedId]);

  const fitZoom = () => {
    const scroller = scrollRef.current;
    if (!scroller || duration <= 0) return;
    pendingScrollRef.current = 0;
    onChangeZoom(zoomToFit(duration, scroller.clientWidth));
  };

  /* ------------------------------ pointers ------------------------------ */

  const secondsFromClientX = (clientX: number): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    return Math.max(0, (clientX - rect.left) / pxPerSecond);
  };

  const clipElOf = (clipId: string): HTMLElement | null =>
    trackRef.current?.querySelector(`[data-clip-id="${CSS.escape(clipId)}"]`) ?? null;

  const handleTrackPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const target = event.target as HTMLElement;
    const clipEl = target.closest<HTMLElement>("[data-clip-id]");
    if (!trackRef.current) return;

    if (clipEl) {
      const clipId = clipEl.dataset.clipId as string;
      const clip = clips.find((c) => c.id === clipId);
      if (!clip) return;
      onSelect(clipId);
      const rect = clipEl.getBoundingClientRect();
      const fromLeft = event.clientX - rect.left;
      const fromRight = rect.right - event.clientX;
      if (fromLeft <= TRIM_GRIP_PX) {
        dragRef.current = { kind: "trim-start", clipId };
      } else if (fromRight <= TRIM_GRIP_PX) {
        dragRef.current = { kind: "trim-end", clipId };
      } else {
        dragRef.current = {
          kind: "move",
          clipId,
          grabOffsetSec: secondsFromClientX(event.clientX) - clip.timelineStart,
          latestStart: clip.timelineStart,
        };
        setDragLabel(formatTimeTenths(clip.timelineStart));
      }
    } else {
      onSelect(null);
      dragRef.current = { kind: "seek" };
      const seconds = secondsFromClientX(event.clientX);
      applyHead(seconds);
      onSeek(seconds);
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // synthetic pointers can't always be captured; drag still works
    }
  };

  const handleTrackPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "seek") {
      const seconds = secondsFromClientX(event.clientX);
      applyHead(seconds);
      onSeek(seconds);
      return;
    }
    const clip = clips.find((c) => c.id === drag.clipId);
    if (!clip) return;
    if (drag.kind === "move") {
      const raw = Math.max(0, secondsFromClientX(event.clientX) - drag.grabOffsetSec);
      // Alt = place freely. Otherwise the clip's START and its END both look
      // for a neighbour to line up with, so a beat switch lands exactly on
      // the outgoing song's edge instead of a pixel away from it.
      const start = event.altKey
        ? raw
        : snapClipStart(
            raw,
            clipDuration(clip),
            snapCandidates(clipsRef.current, drag.clipId, getPositionRef.current()),
            pxPerSecond,
          );
      drag.latestStart = start;
      // Live preview via style only — state commits on release, so React
      // isn't asked to re-render the timeline at pointer-move rate.
      const el = clipElOf(drag.clipId);
      if (el) el.style.left = `${start * pxPerSecond}px`;
      setDragLabel(formatTimeTenths(start));
    } else if (drag.kind === "trim-start") {
      const pointerSec = secondsFromClientX(event.clientX);
      // Timeline delta maps 1:1 onto buffer trim (content stays put).
      const newClipStart = clip.clipStart + (pointerSec - clip.timelineStart);
      onTrimStart(clip.id, Math.min(newClipStart, clip.clipEnd - MIN_CLIP_SECONDS));
    } else {
      const pointerSec = secondsFromClientX(event.clientX);
      const newClipEnd = clip.clipStart + Math.max(MIN_CLIP_SECONDS, pointerSec - clip.timelineStart);
      onTrimEnd(clip.id, newClipEnd);
    }
  };

  const handleTrackPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragLabel(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (drag?.kind === "move") onMoveClip(drag.clipId, drag.latestStart);
  };

  /* ------------------------------ keyboard ------------------------------ */

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key === " ") {
      event.preventDefault();
      onTogglePlay();
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onDeleteSelected();
      return;
    }
    if (event.key === "s" || event.key === "S") {
      event.preventDefault();
      onSplitSelected();
      return;
    }
    if (event.key === "+" || event.key === "=" || event.key === "-") {
      event.preventDefault();
      applyZoom(event.key === "-" ? 1 / ZOOM_STEP : ZOOM_STEP);
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const clip = clips.find((c) => c.id === selectedId);
      if (!clip) return;
      event.preventDefault();
      const step = (event.shiftKey ? NUDGE_SECONDS_LARGE : NUDGE_SECONDS) * (event.key === "ArrowLeft" ? -1 : 1);
      onMoveClip(clip.id, Math.max(0, clip.timelineStart + step));
    }
  };

  /* ------------------------------- ruler ------------------------------- */

  const step = rulerStepSeconds(pxPerSecond);
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let s = 0; s <= innerSeconds; s += step) out.push(s);
    return out;
  }, [innerSeconds, step]);

  return (
    <div className="studio-timeline">
      <div className="studio-scroll" ref={scrollRef}>
        <div
          ref={trackRef}
          className="studio-track"
          style={{ width: `${innerWidth}px`, height: `${RULER_HEIGHT + rowCount * ROW_HEIGHT}px` }}
          role="application"
          aria-label={t("studio.timelineLabel")}
          tabIndex={0}
          onPointerDown={handleTrackPointerDown}
          onPointerMove={handleTrackPointerMove}
          onPointerUp={handleTrackPointerUp}
          onPointerCancel={handleTrackPointerUp}
          onKeyDown={handleKeyDown}
        >
          <div className="studio-ruler" aria-hidden="true">
            {ticks.map((s) => (
              <span key={s} className="studio-tick" style={{ left: `${s * pxPerSecond}px` }}>
                {formatTime(s)}
              </span>
            ))}
          </div>

          {clips.map((clip) => {
            const signal = signals.get(clip.bufferId);
            const row = rows.get(clip.id) ?? 0;
            const widthPx = Math.max(8, clipDuration(clip) * pxPerSecond);
            return (
              <div
                key={clip.id}
                data-clip-id={clip.id}
                className={[
                  "studio-clip",
                  clip.id === selectedId ? "selected" : "",
                  clip.muted ? "muted" : "",
                  `studio-clip-shade-${clip.colorIndex % 3}`,
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{
                  left: `${clip.timelineStart * pxPerSecond}px`,
                  top: `${RULER_HEIGHT + row * ROW_HEIGHT + CLIP_PAD / 2}px`,
                  width: `${widthPx}px`,
                  height: `${ROW_HEIGHT - CLIP_PAD}px`,
                }}
              >
                <span className="studio-clip-name">{clip.name}</span>
                {signal ? (
                  <ClipCanvas
                    signal={signal}
                    clipStart={clip.clipStart}
                    clipEnd={clip.clipEnd}
                    fadeInSec={clip.fadeInSec}
                    fadeOutSec={clip.fadeOutSec}
                    gain={clip.gain}
                    muted={clip.muted}
                    widthPx={widthPx}
                    heightPx={WAVE_HEIGHT}
                  />
                ) : (
                  <span className="studio-clip-pending" aria-hidden="true" />
                )}
                {dragLabel !== null && dragRef.current?.kind === "move" && clip.id === dragRef.current.clipId && (
                  <span className="studio-clip-time num">{dragLabel}</span>
                )}
                <span className="studio-clip-grip studio-clip-grip-l" aria-hidden="true" />
                <span className="studio-clip-grip studio-clip-grip-r" aria-hidden="true" />
              </div>
            );
          })}

          <div className="studio-head" aria-hidden="true" />
        </div>
      </div>

      <div className="studio-zoom">
        <button
          className="round-button"
          type="button"
          aria-label={t("studio.zoomOut")}
          title={t("studio.zoomOut")}
          disabled={disabled}
          onClick={() => applyZoom(1 / ZOOM_STEP)}
        >
          &minus;
        </button>
        <button
          className="round-button"
          type="button"
          aria-label={t("studio.zoomIn")}
          title={t("studio.zoomIn")}
          disabled={disabled}
          onClick={() => applyZoom(ZOOM_STEP)}
        >
          +
        </button>
        <button className="text-button" type="button" disabled={disabled || duration <= 0} onClick={fitZoom}>
          {t("studio.fit")}
        </button>
        <span className="studio-hint">{t("studio.zoomHint")}</span>
        <span className="studio-zoom-value num">{Math.round(clampZoom(pxPerSecond))} px/s</span>
      </div>
    </div>
  );
}
