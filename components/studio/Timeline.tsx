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
  type GainPoint,
  type StudioClip,
  adjacentClipId,
  assignDisplayRows,
  clipDuration,
  snapCandidates,
  timelineDuration,
  MIN_CLIP_SECONDS,
} from "@/lib/studio/timeline";
import {
  LOOP_LANE_HEIGHT,
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
  snapTime,
  zoomAtCursor,
  zoomToFit,
} from "@/lib/studio/timeline-math";
import type { EffectId } from "@/lib/audio/remix";
import { type DisplaySignal, displayKey } from "@/lib/studio/display-signal";
import { type BeatGrid, beatTimesInRange, nearestGridTime } from "@/lib/studio/beat-grid";
import { ClipCanvas } from "./ClipCanvas";
import { GainEnvelopeOverlay } from "./GainEnvelopeOverlay";
import { useThemeSignal } from "./useThemeSignal";

const CLIP_PAD = 6;
const WAVE_HEIGHT = ROW_HEIGHT - 26;

type DragState =
  | { kind: "move"; clipId: string; grabOffsetSec: number; latestStart: number }
  | { kind: "trim-start" | "trim-end"; clipId: string }
  | { kind: "loop"; anchorSec: number }
  // `touch` seeks on RELEASE, and only if the finger stayed put: on a
  // touchscreen a drag across empty track means "pan the timeline", and
  // seeking on touchdown would yank the playhead every time you scrolled.
  | { kind: "seek"; touch: boolean; startX: number; moved: boolean };

export function Timeline({
  clips,
  signals,
  masterEffect,
  selectedId,
  playing,
  pxPerSecond,
  getPosition,
  onSelect,
  onMoveClip,
  onTrimStart,
  onTrimEnd,
  onGainEnvelopeBeginEdit,
  onGainEnvelopeChange,
  onSeek,
  onTogglePlay,
  onDeleteSelected,
  onSplitSelected,
  onDuplicateSelected,
  onToggleMute,
  onToggleLoop,
  onChangeZoom,
  loop,
  onSetLoop,
  grid,
  follow,
  headSignal = 0,
  disabled,
}: {
  clips: StudioClip[];
  signals: Map<string, DisplaySignal>;
  /** Needed only to look a clip's signal up by the same key the hook used. */
  masterEffect: EffectId;
  selectedId: string | null;
  playing: boolean;
  pxPerSecond: number;
  getPosition: () => number;
  onSelect: (id: string | null) => void;
  onMoveClip: (id: string, timelineStart: number) => void;
  onTrimStart: (id: string, newClipStart: number) => void;
  onTrimEnd: (id: string, newClipEnd: number) => void;
  /** Push one undo entry before a gain-envelope add/drag/delete starts. */
  onGainEnvelopeBeginEdit: () => void;
  /** Full replacement gain-point list for one clip (empty clears it). */
  onGainEnvelopeChange: (id: string, points: GainPoint[]) => void;
  onSeek: (seconds: number) => void;
  onTogglePlay: () => void;
  onDeleteSelected: () => void;
  onSplitSelected: () => void;
  onDuplicateSelected: () => void;
  onToggleMute: () => void;
  onToggleLoop: () => void;
  onChangeZoom: (pxPerSecond: number) => void;
  loop: { start: number; end: number } | null;
  onSetLoop: (region: { start: number; end: number } | null) => void;
  /** Beat grid to draw and snap to, or null when off / no tempo. */
  grid: BeatGrid | null;
  /** Keep the playhead on screen while playing. */
  follow: boolean;
  headSignal?: number;
  disabled?: boolean;
}) {
  // Repaints every waveform when the OS theme flips — see useThemeSignal.
  const themeSignal = useThemeSignal();
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
  // Touch-only quick actions: press and hold a clip to get Split/Duplicate/
  // Mute/Remove at the touch point, without needing to scroll down to the
  // inspector panel first.
  const [clipPopover, setClipPopover] = useState<{ clipId: string; x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
    longPressStartRef.current = null;
  };
  useEffect(() => clearLongPress, []);
  // The slice of timeline the clip canvases cover. Rendering the whole song
  // blows past the browser's max canvas width and its memory (see
  // ClipCanvas), so canvases are viewport-sized and follow the scroll.
  const [band, setBand] = useState<{ from: number; to: number }>({ from: 0, to: 60 });
  const bandRef = useRef(band);
  bandRef.current = band;

  const rows = useMemo(() => assignDisplayRows(clips), [clips]);
  const rowCount = Math.max(1, rows.size ? Math.max(...rows.values()) + 1 : 1);
  const duration = timelineDuration(clips);
  const innerSeconds = duration + TAIL_HEADROOM_SECONDS;
  const innerWidth = Math.max(1, Math.ceil(innerSeconds * pxPerSecond));

  /* ------------------------------ playhead ------------------------------ */

  // Set by our own scrollLeft writes so the scroll listener can tell them
  // apart from the user grabbing the bar (which suspends follow).
  const selfScrollRef = useRef(false);
  const followRef = useRef(follow);
  followRef.current = follow;
  const followSuspendedRef = useRef(false);

  const applyHead = useCallback(
    (seconds: number) => {
      const track = trackRef.current;
      const scroller = scrollRef.current;
      if (!track) return;
      const px = seconds * pxPerSecond;
      track.style.setProperty("--studio-head-px", `${px}px`);
      // Follow: at any real zoom the playhead leaves the viewport in seconds,
      // and a timeline you have to chase by hand is unusable. Scroll only
      // when it approaches the edges, so the view isn't constantly twitching.
      if (!scroller || !followRef.current || followSuspendedRef.current) return;
      const w = scroller.clientWidth;
      const left = scroller.scrollLeft;
      if (px < left + w * 0.08 || px > left + w * 0.78) {
        selfScrollRef.current = true;
        scroller.scrollLeft = Math.max(0, px - w * 0.35);
      }
    },
    [pxPerSecond],
  );

  /**
   * Recompute the drawn band when the view nears its edge. One viewport of
   * margin each side means scrolling only repaints every half-screen or so,
   * instead of on every scroll frame.
   */
  const syncBand = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const viewSec = scroller.clientWidth / pxPerSecond;
    const from = scroller.scrollLeft / pxPerSecond;
    const to = from + viewSec;
    const current = bandRef.current;
    const covered = current.from <= from - viewSec * 0.25 && current.to >= to + viewSec * 0.25;
    if (covered) return;
    setBand({ from: Math.max(0, from - viewSec), to: to + viewSec });
  }, [pxPerSecond]);

  // Zoom changes the seconds-per-pixel, so the band must be rebuilt too.
  useEffect(() => {
    syncBand();
  }, [syncBand, clips]);

  // Manual scrolling suspends follow until the next play/seek — otherwise
  // the view fights the user for control of the scrollbar.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    let queued = false;
    const onScroll = () => {
      if (selfScrollRef.current) selfScrollRef.current = false;
      else followSuspendedRef.current = true;
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        syncBand();
      });
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [syncBand]);

  // A fresh play or seek re-arms following.
  useEffect(() => {
    followSuspendedRef.current = false;
  }, [playing, headSignal]);

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

  // Pinch. A touchscreen pinch fires touch events, never wheel, so the
  // ctrl+wheel path above (trackpads) does nothing here and zoom would be
  // button-only on a phone. Tracked on the scroller with passive:false so
  // the gesture zooms the timeline instead of the whole page.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    let startDistance = 0;
    let startZoom = 0;
    const spread = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      startDistance = spread(event.touches);
      startZoom = zoomRef.current;
    };
    // A pinch fires touchmove far faster than the screen refreshes, and each
    // zoom commit re-renders every visible clip canvas — the one gesture that
    // bypassed the "style-only while the finger is down" discipline clip
    // drags follow. Coalesce to one commit per frame: the ratio below is
    // relative to the CURRENT zoom, so dropping intermediate events changes
    // nothing about where the gesture lands.
    let frame = 0;
    let pending: { factor: number; midX: number } | null = null;
    const onMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || startDistance <= 0) return;
      event.preventDefault();
      const rect = scroller.getBoundingClientRect();
      const midX = (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left;
      // Relative to the zoom the pinch STARTED at, so the gesture is
      // absolute rather than accumulating drift over many move events.
      pending = { factor: (spread(event.touches) / startDistance) * (startZoom / zoomRef.current), midX };
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (pending) applyZoom(pending.factor, pending.midX);
        pending = null;
      });
    };
    const onEnd = () => {
      startDistance = 0;
      // Commit whatever the last frame did not get to, so the gesture never
      // ends a few pixels short of where the fingers left it.
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      if (pending) {
        applyZoom(pending.factor, pending.midX);
        pending = null;
      }
    };
    scroller.addEventListener("touchstart", onStart, { passive: true });
    scroller.addEventListener("touchmove", onMove, { passive: false });
    scroller.addEventListener("touchend", onEnd, { passive: true });
    scroller.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      scroller.removeEventListener("touchstart", onStart);
      scroller.removeEventListener("touchmove", onMove);
      scroller.removeEventListener("touchend", onEnd);
      scroller.removeEventListener("touchcancel", onEnd);
    };
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

  /**
   * Snap a bare timeline TIME (a trim edge, the playhead) to the same
   * landmarks a dragged clip uses. Moving a clip needs snapClipStart instead,
   * because there two edges compete; here there is only one.
   *
   * Holding Alt turns it off, matching the drag.
   */
  const snapEdge = (
    raw: number,
    options: { excludeClipId?: string | null; withPlayhead?: boolean; free?: boolean },
  ): number => {
    if (options.free) return raw;
    const candidates = snapCandidates(
      clipsRef.current,
      options.excludeClipId ?? null,
      options.withPlayhead === false ? null : getPositionRef.current(),
    );
    if (grid) candidates.push(nearestGridTime(raw, grid));
    return snapTime(raw, candidates, pxPerSecond);
  };

  const handleTrackPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const target = event.target as HTMLElement;
    const clipEl = target.closest<HTMLElement>("[data-clip-id]");
    if (!trackRef.current) return;

    if (target.closest(".studio-loop-lane")) {
      // Drag the lane to set a loop; a plain click clears it.
      const anchorSec = snapEdge(secondsFromClientX(event.clientX), {
        withPlayhead: false,
        free: event.altKey,
      });
      dragRef.current = { kind: "loop", anchorSec };
      onSetLoop(null);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // synthetic pointers may refuse capture; the drag still tracks
      }
      return;
    }

    if (clipEl) {
      const clipId = clipEl.dataset.clipId as string;
      const clip = clips.find((c) => c.id === clipId);
      if (!clip) return;
      onSelect(clipId);
      const rect = clipEl.getBoundingClientRect();
      const fromLeft = event.clientX - rect.left;
      const fromRight = rect.right - event.clientX;
      // A fingertip is ~10mm; a 12px grip is unhittable. Widen for touch,
      // but never past a third of the clip or short clips become un-movable.
      const grip =
        event.pointerType === "touch"
          ? Math.min(TRIM_GRIP_PX * 2, rect.width / 3)
          : TRIM_GRIP_PX;
      if (fromLeft <= grip) {
        dragRef.current = { kind: "trim-start", clipId };
      } else if (fromRight <= grip) {
        dragRef.current = { kind: "trim-end", clipId };
      } else {
        dragRef.current = {
          kind: "move",
          clipId,
          grabOffsetSec: secondsFromClientX(event.clientX) - clip.timelineStart,
          latestStart: clip.timelineStart,
        };
        setDragLabel(formatTimeTenths(clip.timelineStart));
        // A body press on touch might turn into a long-press for the quick-
        // actions popover instead of a drag; the move above still starts
        // immediately so a genuine drag has zero latency, and gets cancelled
        // below if the press turns out to be a hold instead.
        if (event.pointerType === "touch") {
          const { clientX, clientY } = event;
          longPressStartRef.current = { x: clientX, y: clientY };
          longPressTimerRef.current = window.setTimeout(() => {
            longPressTimerRef.current = null;
            if (dragRef.current?.kind !== "move" || dragRef.current.clipId !== clipId) return;
            dragRef.current = null;
            setDragLabel(null);
            const el = clipElOf(clipId);
            if (el) el.style.left = `${clip.timelineStart * pxPerSecond}px`;
            onSelect(clipId);
            setClipPopover({ clipId, x: clientX, y: clientY });
          }, 500);
        }
      }
    } else {
      onSelect(null);
      const isTouch = event.pointerType === "touch";
      dragRef.current = { kind: "seek", touch: isTouch, startX: event.clientX, moved: false };
      if (!isTouch) {
        const seconds = secondsFromClientX(event.clientX);
        applyHead(seconds);
        onSeek(seconds);
      }
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // synthetic pointers can't always be captured; drag still works
    }
  };

  const handleTrackPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    // Past a few px this is a drag, not a hold -- the popover must not pop up
    // out from under a finger that is actively moving the clip.
    if (longPressStartRef.current) {
      const dx = event.clientX - longPressStartRef.current.x;
      const dy = event.clientY - longPressStartRef.current.y;
      if (Math.hypot(dx, dy) > 10) clearLongPress();
    }
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "loop") {
      // The loop lane snaps like everything else. This is the surface where
      // it matters MOST: a loop is how you work a transition, and one that
      // starts off the beat is unusable for that.
      const here = snapEdge(secondsFromClientX(event.clientX), {
        withPlayhead: false,
        free: event.altKey,
      });
      onSetLoop({ start: Math.min(drag.anchorSec, here), end: Math.max(drag.anchorSec, here) });
      return;
    }
    if (drag.kind === "seek") {
      if (drag.touch) {
        // Past a few px this is a pan, not a tap — let the scroller have it.
        if (Math.abs(event.clientX - drag.startX) > 8) drag.moved = true;
        return;
      }
      const seconds = snapEdge(secondsFromClientX(event.clientX), {
        withPlayhead: false,
        free: event.altKey,
      });
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
      const candidates = snapCandidates(clipsRef.current, drag.clipId, getPositionRef.current());
      if (grid) {
        // The nearest beat to each edge, so a clip can land on the one
        // whether the user is aiming with its head or its tail.
        candidates.push(nearestGridTime(raw, grid));
        candidates.push(nearestGridTime(raw + clipDuration(clip), grid) - clipDuration(clip));
      }
      const start = event.altKey
        ? raw
        : snapClipStart(raw, clipDuration(clip), candidates, pxPerSecond);
      drag.latestStart = start;
      // Show WHERE it landed: mark whichever edge actually snapped, so the
      // alignment is visible rather than merely felt.
      const snapEl = trackRef.current?.querySelector<HTMLElement>(".studio-snapline");
      if (snapEl) {
        const snapped = Math.abs(start - raw) > 1e-9;
        snapEl.style.display = snapped ? "block" : "none";
        if (snapped) {
          const length = clipDuration(clip);
          const candidates = snapCandidates(clipsRef.current, drag.clipId, getPositionRef.current());
          const startHit = candidates.some((c) => Math.abs(c - start) < 1e-6);
          const at = startHit ? start : start + length;
          snapEl.style.left = `${at * pxPerSecond}px`;
        }
      }
      // Live preview via style only — state commits on release, so React
      // isn't asked to re-render the timeline at pointer-move rate.
      const el = clipElOf(drag.clipId);
      if (el) el.style.left = `${start * pxPerSecond}px`;
      setDragLabel(formatTimeTenths(start));
    } else if (drag.kind === "trim-start") {
      // Trims snap too. Cutting a song at the drop is a beat-accurate edit
      // exactly like placing one is, and a tool that lets you position a
      // clip on the grid but not CUT on it is only half a grid.
      const pointerSec = snapEdge(secondsFromClientX(event.clientX), {
        excludeClipId: clip.id,
        free: event.altKey,
      });
      // Timeline delta maps 1:1 onto buffer trim (content stays put).
      const newClipStart = clip.clipStart + (pointerSec - clip.timelineStart);
      onTrimStart(clip.id, Math.min(newClipStart, clip.clipEnd - MIN_CLIP_SECONDS));
    } else {
      const pointerSec = snapEdge(secondsFromClientX(event.clientX), {
        excludeClipId: clip.id,
        free: event.altKey,
      });
      const newClipEnd = clip.clipStart + Math.max(MIN_CLIP_SECONDS, pointerSec - clip.timelineStart);
      onTrimEnd(clip.id, newClipEnd);
    }
  };

  const handleTrackPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    clearLongPress();
    const drag = dragRef.current;
    dragRef.current = null;
    setDragLabel(null);
    const snapEl = trackRef.current?.querySelector<HTMLElement>(".studio-snapline");
    if (snapEl) snapEl.style.display = "none";
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (drag?.kind === "move") onMoveClip(drag.clipId, drag.latestStart);
    if (drag?.kind === "seek" && drag.touch && !drag.moved) {
      const seconds = snapEdge(secondsFromClientX(event.clientX), { withPlayhead: false });
      applyHead(seconds);
      onSeek(seconds);
    }
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
    if (event.key === "d" || event.key === "D") {
      event.preventDefault();
      onDuplicateSelected();
      return;
    }
    if (event.key === "l" || event.key === "L") {
      event.preventDefault();
      onToggleLoop();
      return;
    }
    if (event.key === "+" || event.key === "=" || event.key === "-") {
      event.preventDefault();
      applyZoom(event.key === "-" ? 1 / ZOOM_STEP : ZOOM_STEP);
      return;
    }
    // Vertical arrows pick a clip — without this every other shortcut is
    // unreachable from the keyboard, because they all act on the SELECTION
    // and nothing but a pointer could create one.
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = adjacentClipId(clipsRef.current, selectedId, event.key === "ArrowDown" ? 1 : -1);
      if (next) {
        onSelect(next);
        const el = clipElOf(next);
        el?.scrollIntoView({ inline: "nearest", block: "nearest" });
      }
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const to = event.key === "Home" ? 0 : timelineDuration(clipsRef.current);
      applyHead(to);
      onSeek(to);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onSelect(null);
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

  /* -------------------------------- grid -------------------------------- */

  // Only the visible band, and never denser than 7px apart — beat lines
  // closer than that stop being a grid and become grey fill.
  const gridLines = useMemo(() => {
    if (!grid) return [];
    return beatTimesInRange(grid, Math.max(0, band.from), band.to, 7 / pxPerSecond);
  }, [grid, band.from, band.to, pxPerSecond]);

  /* ------------------------------- ruler ------------------------------- */

  const step = rulerStepSeconds(pxPerSecond);
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let s = 0; s <= innerSeconds; s += step) out.push(s);
    return out;
  }, [innerSeconds, step]);

  const selected = clips.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="studio-timeline">
      {/* The track is role="application", so the browser hands every keypress
          straight to us and announces nothing by itself. Up/Down picking a
          clip is therefore silent unless the result is said out loud. */}
      <p className="sr-only" role="status" aria-live="polite">
        {selected
          ? t("studio.clipLabel", {
              name: selected.name,
              from: formatTime(selected.timelineStart),
              to: formatTime(selected.timelineStart + clipDuration(selected)),
              row: (rows.get(selected.id) ?? 0) + 1,
            })
          : ""}
      </p>
      <div className="studio-scroll" ref={scrollRef}>
        <div
          ref={trackRef}
          className="studio-track"
          style={{
            width: `${innerWidth}px`,
            height: `${LOOP_LANE_HEIGHT + RULER_HEIGHT + rowCount * ROW_HEIGHT}px`,
          }}
          role="application"
          aria-label={t("studio.timelineLabel")}
          tabIndex={0}
          onPointerDown={handleTrackPointerDown}
          onPointerMove={handleTrackPointerMove}
          onPointerUp={handleTrackPointerUp}
          onPointerCancel={handleTrackPointerUp}
          onKeyDown={handleKeyDown}
        >
          <div className="studio-grid" aria-hidden="true">
            {gridLines.map((line) => (
              <span
                key={line.t}
                className={`studio-grid-line${line.downbeat ? " downbeat" : ""}`}
                style={{ left: `${line.t * pxPerSecond}px` }}
              />
            ))}
          </div>

          <div className="studio-loop-lane" aria-hidden="true">
            {loop && (
              <div
                className="studio-loop-region"
                style={{
                  left: `${loop.start * pxPerSecond}px`,
                  width: `${Math.max(2, (loop.end - loop.start) * pxPerSecond)}px`,
                }}
              />
            )}
          </div>

          <div className="studio-ruler" aria-hidden="true">
            {ticks.map((s) => (
              <span key={s} className="studio-tick" style={{ left: `${s * pxPerSecond}px` }}>
                {formatTime(s)}
              </span>
            ))}
          </div>

          {clips.map((clip) => {
            // Same key the hook wrote, so the wave drawn on a clip is the
            // one rendered for THAT clip's effect chain.
            const signal = signals.get(displayKey(clip.bufferId, clip.effect, masterEffect));
            const row = rows.get(clip.id) ?? 0;
            const length = clipDuration(clip);
            const widthPx = Math.max(8, length * pxPerSecond);
            // Intersect the clip with the drawn band, in clip-local seconds.
            const localFrom = Math.max(0, band.from - clip.timelineStart);
            const localTo = Math.min(length, band.to - clip.timelineStart);
            const visible =
              localTo > localFrom
                ? {
                    fromSec: clip.clipStart + localFrom,
                    toSec: clip.clipStart + localTo,
                    offsetPx: localFrom * pxPerSecond,
                    widthPx: Math.max(1, (localTo - localFrom) * pxPerSecond),
                  }
                : null;
            return (
              <div
                key={clip.id}
                data-clip-id={clip.id}
                aria-label={t("studio.clipLabel", {
                  name: clip.name,
                  from: formatTime(clip.timelineStart),
                  to: formatTime(clip.timelineStart + length),
                  row: row + 1,
                })}
                className={[
                  "studio-clip",
                  clip.id === selectedId ? "selected" : "",
                  clip.muted ? "muted" : "",
                  clip.soloed ? "soloed" : "",
                  `studio-clip-shade-${clip.colorIndex % 3}`,
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{
                  left: `${clip.timelineStart * pxPerSecond}px`,
                  top: `${LOOP_LANE_HEIGHT + RULER_HEIGHT + row * ROW_HEIGHT + CLIP_PAD / 2}px`,
                  width: `${widthPx}px`,
                  height: `${ROW_HEIGHT - CLIP_PAD}px`,
                }}
              >
                <span className="studio-clip-name">{clip.name}</span>
                {signal && visible ? (
                  <ClipCanvas
                    themeSignal={themeSignal}
                    signal={signal}
                    clipStart={clip.clipStart}
                    clipEnd={clip.clipEnd}
                    fromSec={visible.fromSec}
                    toSec={visible.toSec}
                    fadeInSec={clip.fadeInSec}
                    fadeOutSec={clip.fadeOutSec}
                    fadeCurve={clip.fadeCurve}
                    fadeInFrom={clip.fadeInFrom}
                    fadeInTo={clip.fadeInTo}
                    fadeOutFrom={clip.fadeOutFrom}
                    fadeOutTo={clip.fadeOutTo}
                    gain={clip.gain}
                    muted={clip.muted}
                    widthPx={visible.widthPx}
                    heightPx={WAVE_HEIGHT}
                    offsetPx={visible.offsetPx}
                  />
                ) : (
                  <span className="studio-clip-pending" aria-hidden="true" />
                )}
                {visible && (
                  <GainEnvelopeOverlay
                    label={t("studio.gainEnvelope")}
                    clipStart={clip.clipStart}
                    clipEnd={clip.clipEnd}
                    fromSec={visible.fromSec}
                    toSec={visible.toSec}
                    gain={clip.gain}
                    points={clip.gainPoints}
                    widthPx={visible.widthPx}
                    heightPx={WAVE_HEIGHT}
                    offsetPx={visible.offsetPx}
                    disabled={disabled}
                    onBeginEdit={onGainEnvelopeBeginEdit}
                    onChange={(points) => onGainEnvelopeChange(clip.id, points)}
                  />
                )}
                {dragLabel !== null && dragRef.current?.kind === "move" && clip.id === dragRef.current.clipId && (
                  <span className="studio-clip-time num">{dragLabel}</span>
                )}
                <span className="studio-clip-grip studio-clip-grip-l" aria-hidden="true" />
                <span className="studio-clip-grip studio-clip-grip-r" aria-hidden="true" />
              </div>
            );
          })}

          <div className="studio-snapline" aria-hidden="true" style={{ display: "none" }} />
          <div className="studio-head" aria-hidden="true" />
        </div>
      </div>

      {clipPopover &&
        (() => {
          // A quick-actions menu for touch: press and hold a clip instead of
          // scrolling down to the inspector for Split/Duplicate/Mute/Remove.
          // Reuses the SAME selected-clip handlers the inspector already
          // calls -- onSelect(clipId) already ran when the press landed, so
          // by the time the hold fires, selectedId matches this clip.
          const popClip = clips.find((c) => c.id === clipPopover.clipId);
          if (!popClip) return null;
          return (
            <>
              <div className="studio-clip-popover-backdrop" onPointerDown={() => setClipPopover(null)} />
              <div
                className="studio-clip-popover"
                role="menu"
                aria-label={t("studio.clipActions")}
                style={{ left: `${clipPopover.x}px`, top: `${clipPopover.y}px` }}
              >
                <button
                  className="text-button"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onToggleMute();
                    setClipPopover(null);
                  }}
                >
                  {popClip.muted ? t("studio.unmute") : t("studio.mute")}
                </button>
                <button
                  className="text-button"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSplitSelected();
                    setClipPopover(null);
                  }}
                >
                  {t("studio.split")}
                </button>
                <button
                  className="text-button"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onDuplicateSelected();
                    setClipPopover(null);
                  }}
                >
                  {t("studio.duplicate")}
                </button>
                <button
                  className="text-button"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onDeleteSelected();
                    setClipPopover(null);
                  }}
                >
                  {t("studio.remove")}
                </button>
              </div>
            </>
          );
        })()}

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
        <span className="studio-hint studio-keys-hint">{t("studio.zoomHint")}</span>
        <span className="studio-zoom-value num">{Math.round(clampZoom(pxPerSecond))} px/s</span>
      </div>
    </div>
  );
}
