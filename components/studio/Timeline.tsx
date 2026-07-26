"use client";

// The DAW's timeline: a horizontally scrollable strip where clips sit at
// absolute times (pxPerSecond is the primary unit — the cutter's
// percent-of-duration model can't survive a timeline whose length changes as
// clips move). Interaction model, lifted from TrimWaveform and adapted:
//   - press within TRIM_GRIP_PX of a clip edge -> drag trims that edge
//   - press a clip body -> drag moves the clip (live via style.left, state
//     committed on release so React isn't re-rendered 60x/s)
//   - press the ruler or empty track -> seek (drag keeps scrubbing)
//   - keyboard on the focused timeline: Space play/pause, Delete removes the
//     selected clip, arrows nudge it (Shift = coarse), S splits at playhead
// The playhead is one absolutely positioned line driven by a CSS var from a
// single rAF loop reading getPosition() — zero re-renders while playing.

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { formatTime } from "@/lib/format";
import {
  type StudioClip,
  assignDisplayRows,
  clipDuration,
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
  ZOOM_PX_PER_SECOND,
  rulerStepSeconds,
} from "@/lib/studio/timeline-math";
import type { PeakPyramid } from "@/lib/studio/waveform-pyramid";
import { ClipCanvas } from "./ClipCanvas";

const CLIP_PAD = 6;
const WAVE_HEIGHT = ROW_HEIGHT - 26;

type DragState =
  | { kind: "move"; clipId: string; grabOffsetSec: number; latestStart: number }
  | { kind: "trim-start" | "trim-end"; clipId: string }
  | { kind: "seek" };

export function Timeline({
  clips,
  buffers,
  pyramids,
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
  buffers: Map<string, AudioBuffer>;
  pyramids: Map<string, PeakPyramid>;
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

  const rows = useMemo(() => assignDisplayRows(clips), [clips]);
  const rowCount = Math.max(1, rows.size ? Math.max(...rows.values()) + 1 : 1);
  const duration = timelineDuration(clips);
  const innerSeconds = duration + TAIL_HEADROOM_SECONDS;
  const innerWidth = Math.max(1, Math.ceil(innerSeconds * pxPerSecond));

  /* ------------------------------ playhead ------------------------------ */

  const applyHead = (seconds: number) => {
    trackRef.current?.style.setProperty("--studio-head-px", `${seconds * pxPerSecond}px`);
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, pxPerSecond, headSignal, clips]);

  // Zoom keeps the playhead (or selected clip) centered, never dumps to 0.
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const selected = clips.find((c) => c.id === selectedId);
    const anchorSec = selected
      ? selected.timelineStart + clipDuration(selected) / 2
      : getPositionRef.current();
    const overflow = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const target = anchorSec * pxPerSecond - scroller.clientWidth / 2;
    scroller.scrollLeft = Math.max(0, Math.min(target, overflow));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pxPerSecond]);

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
    const track = trackRef.current;
    if (!track) return;

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
      // Live preview via style only — state commits on release, so React
      // isn't asked to re-render the timeline at pointer-move rate.
      const start = Math.max(0, secondsFromClientX(event.clientX) - drag.grabOffsetSec);
      drag.latestStart = start;
      const el = clipElOf(drag.clipId);
      if (el) el.style.left = `${start * pxPerSecond}px`;
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
            const buffer = buffers.get(clip.bufferId);
            const pyramid = pyramids.get(clip.bufferId);
            if (!buffer || !pyramid) return null;
            const row = rows.get(clip.id) ?? 0;
            const widthPx = Math.max(8, clipDuration(clip) * pxPerSecond);
            return (
              <div
                key={clip.id}
                data-clip-id={clip.id}
                className={`studio-clip${clip.id === selectedId ? " selected" : ""} studio-clip-shade-${clip.colorIndex % 3}`}
                style={{
                  left: `${clip.timelineStart * pxPerSecond}px`,
                  top: `${RULER_HEIGHT + row * ROW_HEIGHT + CLIP_PAD / 2}px`,
                  width: `${widthPx}px`,
                  height: `${ROW_HEIGHT - CLIP_PAD}px`,
                }}
              >
                <span className="studio-clip-name">{clip.name}</span>
                <ClipCanvas
                  buffer={buffer}
                  pyramid={pyramid}
                  clipStart={clip.clipStart}
                  clipEnd={clip.clipEnd}
                  fadeInSec={clip.fadeInSec}
                  fadeOutSec={clip.fadeOutSec}
                  widthPx={widthPx}
                  heightPx={WAVE_HEIGHT}
                />
                <span className="studio-clip-grip studio-clip-grip-l" aria-hidden="true" />
                <span className="studio-clip-grip studio-clip-grip-r" aria-hidden="true" />
              </div>
            );
          })}

          <div className="studio-head" aria-hidden="true" />
        </div>
      </div>

      <div className="studio-zoom">
        <span className="cutter-stepper-label">{t("studio.zoom")}:</span>
        <div className="cutter-format-pills" role="group" aria-label={t("studio.zoom")}>
          {ZOOM_PX_PER_SECOND.map((level) => (
            <button
              key={level}
              className={`cutter-format-pill${pxPerSecond === level ? " active" : ""}`}
              type="button"
              aria-pressed={pxPerSecond === level}
              disabled={disabled}
              onClick={() => onChangeZoom(level)}
            >
              {level}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
