"use client";

// A clip's volume automation, drawn and authored as its own thin SVG layer —
// NOT folded into ClipCanvas. ClipCanvas's paint effect deliberately keeps
// primitive-only props so a drag never repaints the waveform (see its own
// doc comment); gainPoints is an array, so it stays out of that component
// entirely and gets this separate layer instead — the "draw in an overlay
// canvas" option the plan called out explicitly.
//
// Interaction model, mirroring the reverb EQ's drag handles
// (components/remix/ReverbEq.tsx):
//   - click the line (not a point) -> add a point there
//   - press-drag a point -> move it (pointer capture, like the EQ dots)
//   - double-click a point -> delete it
// The <svg> itself is pointer-events:none (see .studio-clip-envelope in
// globals.css) so a press anywhere else on the clip still falls through to
// the clip's own move/trim handlers, exactly like ClipCanvas's canvas
// already does with pointer-events:none. Only the widened invisible hit
// stroke along the curve and the point handles opt back in.
//
// Coordinates: gainPoints are buffer-absolute seconds — the same clock
// fromSec/toSec/clipStart/clipEnd already use (see the StudioClip.gainPoints
// doc in lib/studio/timeline.ts) — so no clip-local translation happens
// here, only the viewport mapping ClipCanvas already does for the waveform.

import { useCallback, useRef } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { gainEnvelopeAt, type GainPoint } from "@/lib/studio/timeline";

const MIN_GAIN = 0;
const MAX_GAIN = 1.5;
const HIT_STROKE_PX = 16;
const POINT_R = 4.5;
const POINT_HIT_R = 11;

function clamp(value: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, value));
}

export function GainEnvelopeOverlay({
  label,
  clipStart,
  clipEnd,
  fromSec,
  toSec,
  gain,
  points,
  widthPx,
  heightPx,
  offsetPx,
  disabled,
  onBeginEdit,
  onChange,
}: {
  label: string;
  /** Full trimmed span of the clip, buffer-absolute seconds — clamps every point. */
  clipStart: number;
  clipEnd: number;
  /** Visible sub-span to draw, buffer-absolute seconds — same slice ClipCanvas gets. */
  fromSec: number;
  toSec: number;
  /** Baseline clip gain — the flat level an empty envelope reads as. */
  gain: number;
  points: GainPoint[] | undefined;
  widthPx: number;
  heightPx: number;
  offsetPx: number;
  disabled?: boolean;
  /** Push one undo entry before an add/drag/delete starts. */
  onBeginEdit: () => void;
  /** Full replacement point list — caller sorts and sends it back down. */
  onChange: (next: GainPoint[]) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragIndexRef = useRef<number | null>(null);
  const justDraggedRef = useRef(false);
  const pointsRef = useRef(points);
  pointsRef.current = points;

  const span = Math.max(0.0001, toSec - fromSec);
  const pxPerSecond = widthPx / span;

  const toX = useCallback((atSec: number) => (atSec - fromSec) * pxPerSecond, [fromSec, pxPerSecond]);
  const secAtX = useCallback((x: number) => fromSec + x / pxPerSecond, [fromSec, pxPerSecond]);
  const toY = useCallback((g: number) => heightPx - (clamp(g, MIN_GAIN, MAX_GAIN) / MAX_GAIN) * heightPx, [heightPx]);
  const gainAtY = useCallback((y: number) => clamp((1 - y / heightPx) * MAX_GAIN, MIN_GAIN, MAX_GAIN), [heightPx]);

  const localXY = useCallback((event: { clientX: number; clientY: number }) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }, []);

  const commit = useCallback(
    (next: GainPoint[]) => {
      onChange([...next].sort((a, b) => a.at - b.at));
    },
    [onChange],
  );

  // Sampled at each pixel column across the visible slice, same per-column
  // approach ClipCanvas uses for the waveform, so the drawn line can never
  // disagree with the automation the scheduler actually plays.
  let path = "";
  const cols = Math.max(1, Math.ceil(widthPx));
  for (let x = 0; x <= cols; x++) {
    const y = toY(gainEnvelopeAt(secAtX(x), points, gain));
    path += x === 0 ? `M 0 ${y}` : ` L ${x} ${y}`;
  }

  const handleLineClick = useCallback(
    (event: ReactMouseEvent<SVGPathElement>) => {
      if (disabled || justDraggedRef.current) return;
      const xy = localXY(event);
      if (!xy) return;
      const at = clamp(secAtX(xy.x), clipStart, clipEnd);
      onBeginEdit();
      commit([...(pointsRef.current ?? []), { at, gain: gainAtY(xy.y) }]);
    },
    [disabled, localXY, secAtX, gainAtY, clipStart, clipEnd, onBeginEdit, commit],
  );

  const handlePointDown = useCallback(
    (event: ReactPointerEvent<SVGCircleElement>, index: number) => {
      if (disabled) return;
      event.stopPropagation();
      onBeginEdit();
      dragIndexRef.current = index;
      justDraggedRef.current = true;
      try {
        svgRef.current?.setPointerCapture(event.pointerId);
      } catch {
        // Pointer already gone — dragging still works while it stays over the svg.
      }
    },
    [disabled, onBeginEdit],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      const index = dragIndexRef.current;
      if (index === null || disabled) return;
      const xy = localXY(event);
      if (!xy) return;
      const current = pointsRef.current ?? [];
      const at = clamp(secAtX(xy.x), clipStart, clipEnd);
      const g = gainAtY(xy.y);
      commit(current.map((p, i) => (i === index ? { at, gain: g } : p)));
    },
    [disabled, localXY, secAtX, gainAtY, clipStart, clipEnd, commit],
  );

  const endDrag = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    dragIndexRef.current = null;
    if (svgRef.current?.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId);
    }
    // Cleared on a timeout, not synchronously: the "click" that follows this
    // same pointerup (releasing a drag over the line's own hit-stroke) must
    // still see the flag, or the release would add a spurious extra point.
    setTimeout(() => {
      justDraggedRef.current = false;
    }, 0);
  }, []);

  const handlePointDoubleClick = useCallback(
    (event: ReactMouseEvent<SVGCircleElement>, index: number) => {
      if (disabled) return;
      event.stopPropagation();
      onBeginEdit();
      commit((pointsRef.current ?? []).filter((_, i) => i !== index));
    },
    [disabled, onBeginEdit, commit],
  );

  return (
    <svg
      ref={svgRef}
      className="studio-clip-envelope"
      width={widthPx}
      height={heightPx}
      style={{ left: `${offsetPx}px` }}
      role="group"
      aria-label={label}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <path d={path} className="studio-clip-envelope-line" fill="none" pointerEvents="none" />
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={HIT_STROKE_PX}
        pointerEvents={disabled ? "none" : "stroke"}
        // Stop the pointerdown here too, not just the click: the track's
        // move-drag starts on pointerdown (Timeline's handleTrackPointerDown),
        // so without this a click meant to add a point would also kick off a
        // (zero-distance, but real) clip-move drag underneath.
        onPointerDown={(event) => !disabled && event.stopPropagation()}
        onClick={handleLineClick}
      />
      {(points ?? []).map((p, i) => {
        const x = toX(p.at);
        if (x < -POINT_HIT_R || x > widthPx + POINT_HIT_R) return null;
        const y = toY(p.gain);
        return (
          <g key={`${p.at}-${i}`}>
            <circle cx={x} cy={y} r={POINT_R} className="studio-clip-envelope-dot" pointerEvents="none" />
            <circle
              cx={x}
              cy={y}
              r={POINT_HIT_R}
              fill="transparent"
              pointerEvents={disabled ? "none" : "all"}
              onPointerDown={(event) => handlePointDown(event, i)}
              onDoubleClick={(event) => handlePointDoubleClick(event, i)}
            />
          </g>
        );
      })}
    </svg>
  );
}
