"use client";

// Interactive parametric EQ for the reverb's wet path. Renders the combined
// magnitude response of the 5-filter chain (highpass -> low shelf -> peak ->
// high shelf -> lowpass) as a curve over a log-frequency axis, with a
// draggable handle per filter. The curve is the real thing: it's computed
// with BiquadFilterNode.getFrequencyResponse on a throwaway offline context
// whose filters mirror the live chain built in lib/audio/remix.ts.

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useI18n } from "@/lib/i18n";
import { applyReverbEqParams, NEUTRAL_REVERB_EQ, type ReverbEqNodes, type ReverbEqParams } from "@/lib/audio/remix";

const VB_H = 190;
const PAD_L = 10;
const PAD_R = 10;
const PAD_T = 12;
const PAD_B = 22;
const PLOT_H = VB_H - PAD_T - PAD_B;
const MID_Y = PAD_T + PLOT_H / 2;

const F_MIN = 20;
const F_MAX = 20000;
const DB_RANGE = 18; // y axis is ±18dB
const GAIN_LIMIT = 15; // draggable gain range is ±15dB
const CURVE_POINTS = 120;
const HIT_RADIUS_PX = 22;

type EqNodeId = "highpass" | "lowShelf" | "peak" | "highShelf" | "lowpass";

interface EqNodeDef {
  id: EqNodeId;
  minHz: number;
  maxHz: number;
  hasGain: boolean;
  labelKey: "remix.eqHighpass" | "remix.eqLowShelf" | "remix.eqPeak" | "remix.eqHighShelf" | "remix.eqLowpass";
}

const NODE_DEFS: EqNodeDef[] = [
  { id: "highpass", minHz: 20, maxHz: 2000, hasGain: false, labelKey: "remix.eqHighpass" },
  { id: "lowShelf", minHz: 40, maxHz: 1000, hasGain: true, labelKey: "remix.eqLowShelf" },
  { id: "peak", minHz: 200, maxHz: 8000, hasGain: true, labelKey: "remix.eqPeak" },
  { id: "highShelf", minHz: 1000, maxHz: 16000, hasGain: true, labelKey: "remix.eqHighShelf" },
  { id: "lowpass", minHz: 1000, maxHz: 20000, hasGain: false, labelKey: "remix.eqLowpass" },
];

// The x axis depends on the measured width, so geometry is a small object
// derived from it rather than module constants.
interface Geometry {
  width: number;
  plotW: number;
}

function xOf(geo: Geometry, hz: number): number {
  return PAD_L + (Math.log(hz / F_MIN) / Math.log(F_MAX / F_MIN)) * geo.plotW;
}

function hzOf(geo: Geometry, x: number): number {
  const t = Math.min(1, Math.max(0, (x - PAD_L) / geo.plotW));
  return F_MIN * Math.pow(F_MAX / F_MIN, t);
}

function yOf(db: number): number {
  return MID_Y - (db / DB_RANGE) * (PLOT_H / 2);
}

function dbOf(y: number): number {
  return ((MID_Y - y) / (PLOT_H / 2)) * DB_RANGE;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function nodeValue(eq: ReverbEqParams, id: EqNodeId): { hz: number; db: number } {
  switch (id) {
    case "highpass":
      return { hz: eq.highpassHz, db: 0 };
    case "lowShelf":
      return { hz: eq.lowShelf.hz, db: eq.lowShelf.db };
    case "peak":
      return { hz: eq.peak.hz, db: eq.peak.db };
    case "highShelf":
      return { hz: eq.highShelf.hz, db: eq.highShelf.db };
    case "lowpass":
      return { hz: eq.lowpassHz, db: 0 };
  }
}

function withNode(eq: ReverbEqParams, id: EqNodeId, hz: number, db: number): ReverbEqParams {
  switch (id) {
    case "highpass":
      return { ...eq, highpassHz: hz };
    case "lowShelf":
      return { ...eq, lowShelf: { hz, db } };
    case "peak":
      return { ...eq, peak: { hz, db } };
    case "highShelf":
      return { ...eq, highShelf: { hz, db } };
    case "lowpass":
      return { ...eq, lowpassHz: hz };
  }
}

// A single throwaway offline context hosts 5 filters that mirror the live
// wet-path chain (same types and Q values as buildReverbEqChain). It exists
// only so getFrequencyResponse can report the real combined curve.
interface ResponseKit {
  nodes: ReverbEqNodes;
  freqs: Float32Array<ArrayBuffer>;
  mag: Float32Array<ArrayBuffer>;
  phase: Float32Array<ArrayBuffer>;
  // 1-point buffers for probing a single frequency during drags.
  probeFreq: Float32Array<ArrayBuffer>;
  probeMag: Float32Array<ArrayBuffer>;
  probePhase: Float32Array<ArrayBuffer>;
}

let responseKit: ResponseKit | null = null;

function getResponseKit(): ResponseKit | null {
  if (typeof OfflineAudioContext === "undefined") return null;
  if (!responseKit) {
    const ctx = new OfflineAudioContext(1, 1, 44100);
    const make = (type: BiquadFilterType, q?: number) => {
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      if (q !== undefined) filter.Q.value = q;
      return filter;
    };
    const nodes: ReverbEqNodes = {
      highpass: make("highpass", 0.7),
      lowShelf: make("lowshelf"),
      peak: make("peaking", 1),
      highShelf: make("highshelf"),
      lowpass: make("lowpass", 0.7),
    };
    const freqs = new Float32Array(CURVE_POINTS);
    for (let i = 0; i < CURVE_POINTS; i += 1) {
      freqs[i] = F_MIN * Math.pow(F_MAX / F_MIN, i / (CURVE_POINTS - 1));
    }
    responseKit = {
      nodes,
      freqs,
      mag: new Float32Array(CURVE_POINTS),
      phase: new Float32Array(CURVE_POINTS),
      probeFreq: new Float32Array(1),
      probeMag: new Float32Array(1),
      probePhase: new Float32Array(1),
    };
  }
  return responseKit;
}

// Combined magnitude of the 5-filter chain in dB, one value per curve point.
function computeResponseDb(eq: ReverbEqParams): number[] | null {
  const kit = getResponseKit();
  if (!kit) return null;
  applyReverbEqParams(kit.nodes, eq);
  const combined = new Array<number>(CURVE_POINTS).fill(1);
  const filters = [kit.nodes.highpass, kit.nodes.lowShelf, kit.nodes.peak, kit.nodes.highShelf, kit.nodes.lowpass];
  for (const filter of filters) {
    filter.getFrequencyResponse(kit.freqs, kit.mag, kit.phase);
    for (let i = 0; i < CURVE_POINTS; i += 1) combined[i] *= kit.mag[i];
  }
  return combined.map((magnitude) => 20 * Math.log10(Math.max(magnitude, 1e-6)));
}

// Exact combined dB of the chain at ONE frequency with the given node's gain
// zeroed out — i.e. everything EXCEPT that node's contribution. Used while
// dragging to solve "what gain puts the curve under the pointer" from the
// CURRENT params. (Reading the neighbors off the last rendered curve instead
// fed each move a stale value, which oscillated — the twitch.)
function neighborsDbAt(eq: ReverbEqParams, id: EqNodeId, hz: number): number {
  const kit = getResponseKit();
  if (!kit) return 0;
  const { hz: ownHz } = nodeValue(eq, id);
  applyReverbEqParams(kit.nodes, withNode(eq, id, ownHz, 0));
  kit.probeFreq[0] = hz;
  let magnitude = 1;
  const filters = [kit.nodes.highpass, kit.nodes.lowShelf, kit.nodes.peak, kit.nodes.highShelf, kit.nodes.lowpass];
  for (const filter of filters) {
    filter.getFrequencyResponse(kit.probeFreq, kit.probeMag, kit.probePhase);
    magnitude *= kit.probeMag[0];
  }
  return 20 * Math.log10(Math.max(magnitude, 1e-6));
}

// Combined-curve dB at an arbitrary frequency, interpolated between the
// log-spaced curve points. The dots render on THIS value (not the filter's
// own gain) so they always sit on the drawn line.
function curveDbAt(dbValues: number[], hz: number): number {
  const t = clamp(Math.log(hz / F_MIN) / Math.log(F_MAX / F_MIN), 0, 1) * (dbValues.length - 1);
  const i = Math.floor(t);
  const frac = t - i;
  const a = dbValues[i];
  const b = dbValues[Math.min(i + 1, dbValues.length - 1)];
  return a + (b - a) * frac;
}

function curvePath(geo: Geometry, dbValues: number[]): { line: string; fill: string } {
  const parts: string[] = [];
  for (let i = 0; i < dbValues.length; i += 1) {
    const x = PAD_L + (i / (dbValues.length - 1)) * geo.plotW;
    const y = yOf(clamp(dbValues[i], -DB_RANGE, DB_RANGE));
    parts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  const line = parts.join(" ");
  const bottom = PAD_T + PLOT_H;
  const fill = `${line} L${(PAD_L + geo.plotW).toFixed(1)} ${bottom} L${PAD_L} ${bottom} Z`;
  return { line, fill };
}

const GRID_FREQS: { hz: number; label: string }[] = [
  { hz: 100, label: "100" },
  { hz: 1000, label: "1k" },
  { hz: 10000, label: "10k" },
];

export interface ReverbEqProps {
  eq: ReverbEqParams;
  onChange: (eq: ReverbEqParams) => void;
  disabled?: boolean;
}

export function ReverbEq({ eq, onChange, disabled = false }: ReverbEqProps) {
  const { t } = useI18n();
  const svgRef = useRef<SVGSVGElement>(null);
  const activeRef = useRef<EqNodeId | null>(null);
  const curveDbRef = useRef<number[] | null>(null);

  // The viewBox width tracks the rendered width so SVG units stay 1:1 with
  // CSS pixels (round nodes, undistorted hit radii at any card width).
  const [width, setWidth] = useState(640);
  const geo = useMemo<Geometry>(() => ({ width, plotW: width - PAD_L - PAD_R }), [width]);
  const geoRef = useRef(geo);
  geoRef.current = geo;

  // Measure synchronously on mount (ResizeObserver alone can lag a frame,
  // and doesn't fire at all while the tab is hidden), then track resizes.
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const measured = svg.getBoundingClientRect().width;
    if (measured > 40) setWidth(Math.round(measured));
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next && next > 40) setWidth(Math.round(next));
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  // Latest eq in a ref so pointer-move handlers never work from a stale prop.
  const eqRef = useRef(eq);
  eqRef.current = eq;

  // The response curve is computed synchronously in render (5 filters x 120
  // points is well under a millisecond), so the curve and the dots riding it
  // always reflect THIS render's params. The old effect + rAF coalescing put
  // the curve one frame behind the pointer, which read as twitching — and
  // pointer events are already frame-aligned, so it never saved any work.
  const curve = useMemo(() => {
    const db = computeResponseDb(eq);
    return db ? { ...curvePath(geo, db), db } : null;
  }, [eq, geo]);
  curveDbRef.current = curve ? curve.db : null;

  // Maps a pointer event to SVG coordinates (1:1 with CSS pixels).
  const toLocal = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  // Nearest node in pixels; `within` limits the search to the ~22px hit
  // radius (else falls back to the overall nearest node).
  const pickNode = useCallback(
    (clientX: number, clientY: number, within: number | null): EqNodeId | null => {
      const local = toLocal(clientX, clientY);
      if (!local) return null;
      let best: EqNodeId | null = null;
      let bestDist = Infinity;
      for (const def of NODE_DEFS) {
        const { hz, db } = nodeValue(eqRef.current, def.id);
        const dx = xOf(geoRef.current, hz) - local.x;
        const onCurve = curveDbRef.current ? curveDbAt(curveDbRef.current, hz) : db;
        const dy = yOf(clamp(onCurve, -DB_RANGE, DB_RANGE)) - local.y;
        const dist = Math.hypot(dx, dy);
        if (dist < bestDist) {
          bestDist = dist;
          best = def.id;
        }
      }
      if (within !== null && bestDist > within) return null;
      return best;
    },
    [toLocal],
  );

  const moveActiveTo = useCallback(
    (clientX: number, clientY: number) => {
      const id = activeRef.current;
      if (!id) return;
      const def = NODE_DEFS.find((node) => node.id === id);
      const local = toLocal(clientX, clientY);
      if (!def || !local) return;
      const hz = clamp(hzOf(geoRef.current, local.x), def.minHz, def.maxHz);
      // The dot renders on the COMBINED curve, so dragging targets the curve
      // height at the pointer: subtract everything-but-this-node's exact
      // contribution (probed from the CURRENT params, never the rendered
      // curve) to get the gain that puts the curve under the pointer.
      let db = 0;
      if (def.hasGain) {
        const neighbors = neighborsDbAt(eqRef.current, def.id, hz);
        db = clamp(dbOf(local.y) - neighbors, -GAIN_LIMIT, GAIN_LIMIT);
      }
      onChange(withNode(eqRef.current, id, Math.round(hz), Math.round(db * 10) / 10));
    },
    [onChange, toLocal],
  );

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (disabled) return;
    event.preventDefault();
    activeRef.current = pickNode(event.clientX, event.clientY, HIT_RADIUS_PX) ?? pickNode(event.clientX, event.clientY, null);
    try {
      svgRef.current?.setPointerCapture(event.pointerId);
    } catch {
      // Pointer already gone (or synthetic) — dragging still works while the
      // pointer stays over the SVG.
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (disabled || !activeRef.current) return;
    if (event.buttons === 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    moveActiveTo(event.clientX, event.clientY);
  };

  const endDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    activeRef.current = null;
    if (svgRef.current?.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const handleDoubleClick = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (disabled) return;
    const id = pickNode(event.clientX, event.clientY, HIT_RADIUS_PX);
    if (!id) return;
    const neutral = nodeValue(NEUTRAL_REVERB_EQ, id);
    onChange(withNode(eqRef.current, id, neutral.hz, neutral.db));
  };

  const handleKeyDown = (event: KeyboardEvent<SVGCircleElement>, def: EqNodeDef) => {
    if (disabled) return;
    const { hz, db } = nodeValue(eqRef.current, def.id);
    let nextHz = hz;
    let nextDb = db;
    switch (event.key) {
      case "ArrowRight":
        nextHz = clamp(hz * 1.06, def.minHz, def.maxHz);
        break;
      case "ArrowLeft":
        nextHz = clamp(hz / 1.06, def.minHz, def.maxHz);
        break;
      case "ArrowUp":
        if (!def.hasGain) return;
        nextDb = clamp(db + 1, -GAIN_LIMIT, GAIN_LIMIT);
        break;
      case "ArrowDown":
        if (!def.hasGain) return;
        nextDb = clamp(db - 1, -GAIN_LIMIT, GAIN_LIMIT);
        break;
      default:
        return;
    }
    event.preventDefault();
    onChange(withNode(eqRef.current, def.id, Math.round(nextHz), Math.round(nextDb * 10) / 10));
  };

  return (
    <div className="reverb-eq-container">
      <svg
        ref={svgRef}
        className="reverb-eq-svg"
        viewBox={`0 0 ${width} ${VB_H}`}
        data-disabled={disabled || undefined}
        role="group"
        aria-label={t("remix.reverbEqTitle")}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={handleDoubleClick}
      >
        {/* Grid */}
        {GRID_FREQS.map(({ hz, label }) => (
          <g key={hz}>
            <line x1={xOf(geo, hz)} y1={PAD_T} x2={xOf(geo, hz)} y2={PAD_T + PLOT_H} stroke="var(--line)" strokeWidth={1} />
            <text className="reverb-eq-label" x={xOf(geo, hz) + 4} y={VB_H - 6}>
              {label}
            </text>
          </g>
        ))}
        {[9, -9].map((db) => (
          <line
            key={db}
            x1={PAD_L}
            y1={yOf(db)}
            x2={PAD_L + geo.plotW}
            y2={yOf(db)}
            stroke="var(--line)"
            strokeWidth={1}
            opacity={0.5}
          />
        ))}
        <line x1={PAD_L} y1={MID_Y} x2={PAD_L + geo.plotW} y2={MID_Y} stroke="var(--line)" strokeWidth={1} />

        {/* Response curve */}
        {curve && (
          <>
            <path className="reverb-eq-fill" d={curve.fill} fill="var(--ink)" opacity={0.06} stroke="none" />
            <path className="reverb-eq-curve" d={curve.line} fill="none" stroke="var(--ink)" strokeWidth={2} />
          </>
        )}

        {/* Draggable filter nodes — pinned to the combined curve so the dot
            always sits ON the line, like a real DAW EQ. */}
        {NODE_DEFS.map((def) => {
          const { hz, db } = nodeValue(eq, def.id);
          const cx = xOf(geo, hz);
          const onCurve = curve ? curveDbAt(curve.db, hz) : db;
          const cy = yOf(clamp(onCurve, -DB_RANGE, DB_RANGE));
          const valueText = def.hasGain ? `${Math.round(hz)} Hz, ${db > 0 ? "+" : ""}${db} dB` : `${Math.round(hz)} Hz`;
          return (
            <g key={def.id}>
              <circle cx={cx} cy={cy} r={7} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} pointerEvents="none" />
              <circle
                className="reverb-eq-node"
                data-node={def.id}
                cx={cx}
                cy={cy}
                r={13}
                fill="transparent"
                role="slider"
                tabIndex={disabled ? -1 : 0}
                aria-label={t(def.labelKey)}
                aria-valuemin={def.minHz}
                aria-valuemax={def.maxHz}
                aria-valuenow={Math.round(hz)}
                aria-valuetext={valueText}
                aria-disabled={disabled || undefined}
                onKeyDown={(event) => handleKeyDown(event, def)}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
