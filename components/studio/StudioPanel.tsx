"use client";

// TuneBad DAW: multi-song timeline (joiner) + trims/splits (cutter) + live
// master-bus slowed/reverb/effects with take recording (remix studio), one
// tool. Clips schedule through lib/studio/timeline.ts, play through
// StudioEngine, and export through exportStudioMix — live and export share
// computeClipSchedule, so the bounce matches the preview by construction.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { decodeAudioFile } from "@/lib/audio/decode";
import { downloadBlob } from "@/lib/files/download";
import { FileDrop } from "@/components/files/FileDrop";
import { useNowPlaying } from "@/hooks/useNowPlaying";
import { useUnloadGuard } from "@/hooks/useUnloadGuard";
import { formatTimeTenths } from "@/lib/format";
import type { AudioStage } from "@/lib/audio/stages";
import { STAGE_LABELS } from "@/lib/audio/stages";
import {
  type AutomationEvent,
  type EffectId,
  type RemixParams,
  type ReverbType,
  NEUTRAL_REVERB_EQ,
  automatedOutputDuration,
  coupledSemitones,
} from "@/lib/audio/remix";
import {
  type StudioClip,
  MAX_CLIPS,
  MAX_DECODED_BYTES,
  MAX_TIMELINE_SECONDS,
  MAX_TOTAL_CLIPS,
  isSoloing,
  sliceClipsToWindow,
  moveClip,
  splitClip,
  timelineDuration,
  trimClipEnd,
  trimClipStart,
} from "@/lib/studio/timeline";
import { DEFAULT_PX_PER_SECOND, clampZoom } from "@/lib/studio/timeline-math";
import {
  type DisplaySignal,
  forgetDisplaySignals,
  getDisplaySignal,
  peekDisplaySignal,
} from "@/lib/studio/display-signal";
import { StudioEngine } from "@/lib/studio/engine";
import {
  type BeatGrid,
  DEFAULT_BEATS_PER_BAR,
  MAX_BPM,
  MIN_BPM,
  detectTempo,
  estimateBeatPhase,
  nearestGridTime,
  needsTempoMatch,
  tempoMatchRatio,
} from "@/lib/studio/beat-grid";
import {
  forgetStretched,
  getStretchedBuffer,
  quantiseSpeed,
  scaleClipsForLock,
  stretchedIdFor,
} from "@/lib/studio/lock-pitch";
import { exportStudioMix } from "@/lib/studio/render-timeline";
import { takeStudioFiles } from "@/lib/files/tool-handoff";
import { Timeline } from "./Timeline";

const NOW_PLAYING_SOURCE = "studio-preview";

const DEFAULT_PARAMS: RemixParams = {
  speed: 1,
  reverb: 0,
  bassBoostDb: 0,
  lockPitch: false,
  pitchSemitones: 0,
  reverbType: "hall",
  reverbEq: NEUTRAL_REVERB_EQ,
  effect: "none",
};

const REVERB_TYPE_OPTIONS: { type: ReverbType; labelKey: "remix.typeRoom" | "remix.typePlate" | "remix.typeHall" | "remix.typeCathedral" | "remix.typeSaturated" }[] = [
  { type: "room", labelKey: "remix.typeRoom" },
  { type: "plate", labelKey: "remix.typePlate" },
  { type: "hall", labelKey: "remix.typeHall" },
  { type: "cathedral", labelKey: "remix.typeCathedral" },
  { type: "saturated", labelKey: "remix.typeSaturated" },
];

const EFFECT_OPTIONS: { id: EffectId; labelKey: "remix.effectNone" | "remix.effectUnderwater" | "remix.effectPhone" | "remix.effectLofi" }[] = [
  { id: "none", labelKey: "remix.effectNone" },
  { id: "underwater", labelKey: "remix.effectUnderwater" },
  { id: "phone", labelKey: "remix.effectPhone" },
  { id: "lofi", labelKey: "remix.effectLofi" },
];

interface StudioTake {
  id: string;
  label: string;
  base: RemixParams;
  events: AutomationEvent[];
  startOffset: number;
  outDuration: number;
}

let nextClipId = 1;
const makeClipId = () => `clip-${nextClipId++}`;
let nextTakeId = 1;
const makeTakeId = () => `take-${nextTakeId++}`;

// Decoded buffers live OUTSIDE React state: they're large, never re-render
// on their own, and the single-entry site decode-cache would thrash with N
// clips. Their DRAWN counterparts (decimated, optionally effect-filtered)
// live in lib/studio/display-signal.ts.
const bufferMap = new Map<string, AudioBuffer>();

// How long a continuous gesture (slider drag, trim, fade field) must be
// quiet before the graph is rescheduled. Long enough to swallow a drag,
// short enough that a release feels immediate.
const RESCHEDULE_SETTLE_MS = 160;

function bufferKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function decodedBytes(): number {
  let total = 0;
  for (const b of bufferMap.values()) total += b.length * b.numberOfChannels * 4;
  return total;
}

/**
 * Position / total readout. Owns its own rAF and writes textContent
 * directly: a transport clock in React state would re-render the whole
 * panel (and every clip canvas) 60 times a second.
 */
function TransportClock({
  getPosition,
  playing,
  total,
}: {
  getPosition: () => number;
  playing: boolean;
  total: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const getRef = useRef(getPosition);
  getRef.current = getPosition;

  useEffect(() => {
    let raf = 0;
    const paint = () => {
      if (ref.current) {
        ref.current.textContent = `${formatTimeTenths(getRef.current())} / ${formatTimeTenths(total)}`;
      }
      if (playing) raf = requestAnimationFrame(paint);
    };
    paint();
    return () => cancelAnimationFrame(raf);
  }, [playing, total]);

  return <span ref={ref} className="studio-clock num" aria-live="off" />;
}

export function StudioPanel() {
  const { t } = useI18n();
  const [clips, setClips] = useState<StudioClip[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [params, setParams] = useState<RemixParams>(DEFAULT_PARAMS);
  const [pxPerSecond, setPxPerSecond] = useState<number>(DEFAULT_PX_PER_SECOND);
  const [status, setStatus] = useState<string>("");
  const [statusIsError, setStatusIsError] = useState(false);
  const [stage, setStage] = useState<AudioStage | null>(null);
  const [working, setWorking] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [format, setFormat] = useState<"wav" | "mp3">("mp3");
  const [headSignal, setHeadSignal] = useState(0);
  const [recording, setRecording] = useState(false);
  const [takes, setTakes] = useState<StudioTake[]>([]);
  const [selectedTakeId, setSelectedTakeId] = useState<string | null>(null);
  // Waveforms actually drawn: keyed by bufferId, re-resolved whenever the
  // master character effect changes so the wave matches the filter.
  const [signals, setSignals] = useState<Map<string, DisplaySignal>>(new Map());
  // Clip-state history for Cmd/Ctrl+Z. Buffers live outside state, so a
  // snapshot is just an array of small plain objects.
  const [undoDepth, setUndoDepth] = useState(0);
  const [loop, setLoopState] = useState<{ start: number; end: number } | null>(null);
  const [follow, setFollow] = useState(true);
  const [exportLoopOnly, setExportLoopOnly] = useState(false);
  // Beat grid: derived from the FIRST clip's tempo, anchored to where that
  // clip's beats actually fall. Null until a tempo is known.
  const [grid, setGrid] = useState<BeatGrid | null>(null);
  const [gridOn, setGridOn] = useState(true);
  const [detectingTempo, setDetectingTempo] = useState(false);
  const [tempoFailed, setTempoFailed] = useState(false);
  const gridSourceRef = useRef<string | null>(null);
  // Detected tempo per BUFFER (not per clip): splits and duplicates of the
  // same song share one answer and one analysis.
  const [clipBpms, setClipBpms] = useState<Map<string, number>>(new Map());
  const bpmRequestedRef = useRef<Set<string>>(new Set());

  const clipsRef = useRef(clips);
  clipsRef.current = clips;
  const undoStackRef = useRef<StudioClip[][]>([]);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  // Take recording refs (RemixStudio's model: events timestamped in OUTPUT
  // seconds; `recordBase` banks output time already elapsed across engine
  // rebuilds, since each start gets a fresh AudioContext clock).
  const recordingRef = useRef(false);
  const recordBaseRef = useRef(0);
  const eventsRef = useRef<AutomationEvent[]>([]);
  const takeBaseRef = useRef<RemixParams>(DEFAULT_PARAMS);
  const takeStartRef = useRef(0);

  const engineRef = useRef<StudioEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = new StudioEngine(DEFAULT_PARAMS, () => {
      setPlaying(false);
      if (recordingRef.current) finishTake();
      setHeadSignal((n) => n + 1);
    });
  }
  const engine = engineRef.current;

  useEffect(() => () => engine.dispose(), [engine]);

  // Dev-only verification hook (same pattern as the extension's
  // __tbSamplerState): lets the scripted harness read the transport clock,
  // which it can't otherwise observe when the pane isn't painting rAF frames.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as Record<string, unknown>).__tbDaw = {
      getPosition: () => engine.getPosition(),
      isPlaying: () => engine.playing,
      clips: () => clipsRef.current,
      pxPerSecond: () => pxPerSecond,
      undoDepth: () => undoStackRef.current.length,
    };
  }, [engine, pxPerSecond]);

  const bankRecordTime = useCallback(() => {
    recordBaseRef.current += engine.getOutputTime();
  }, [engine]);

  /* ------------------------------ undo ------------------------------ */

  const pushUndo = useCallback(() => {
    undoStackRef.current = [...undoStackRef.current.slice(-29), clipsRef.current];
    setUndoDepth(undoStackRef.current.length);
  }, []);

  const undo = useCallback(() => {
    const previous = undoStackRef.current.pop();
    setUndoDepth(undoStackRef.current.length);
    if (!previous) return;
    setClips(previous);
    setSelectedId((current) => (previous.some((c) => c.id === current) ? current : null));
  }, []);

  // Cmd/Ctrl+Z anywhere on the page except while typing in a field.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      event.preventDefault();
      undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  const stopPreview = useCallback(() => {
    if (recordingRef.current) bankRecordTime();
    engine.stop();
    setPlaying(false);
  }, [engine, bankRecordTime]);

  useNowPlaying(NOW_PLAYING_SOURCE, playing, stopPreview);
  useUnloadGuard(clips.length > 0 || working);

  /* ------------------------------ recording clock ------------------------------ */

  function outputNow(): number {
    return recordBaseRef.current + engine.getOutputTime();
  }

  function recordMove(event: AutomationEvent) {
    if (!recordingRef.current) return;
    eventsRef.current.push(event);
  }

  function finishTake() {
    recordingRef.current = false;
    setRecording(false);
    const events = eventsRef.current;
    eventsRef.current = [];
    if (events.length === 0) return;
    const mixSeconds = timelineDuration(clipsRef.current);
    const base = takeBaseRef.current;
    const outDuration = automatedOutputDuration(
      Math.max(0, mixSeconds - takeStartRef.current),
      Math.max(0.01, base.lockPitch ? 1 : base.speed),
      events,
    );
    const take: StudioTake = {
      id: makeTakeId(),
      label: `${t("studio.takeLabel")} ${takes.length + 1}`,
      base,
      events,
      startOffset: takeStartRef.current,
      outDuration,
    };
    setTakes((prev) => [...prev, take]);
    setSelectedTakeId(take.id);
  }

  /* ------------------------------ files in ------------------------------ */

  const addFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setDecoding(true);
      setStatus("");
      setStatusIsError(false);
      let added = 0;
      let cursor = timelineDuration(clipsRef.current);
      let full = false;
      // Snapshot the count ONCE: clipsRef re-points on every render, and this
      // loop awaits a decode per file, so re-reading it mid-loop would count
      // each new clip twice (once in the ref, once in `added`) and stop
      // roughly half-way to the real limit.
      const startingCount = clipsRef.current.length;

      // Decode ALL of them at once. decodeAudioData is off-thread, so a
      // serial loop just idles between files; four songs used to cost the
      // sum of their decodes instead of the slowest one. Failures are kept
      // per-file so one bad drop can't sink the batch.
      const accepted = files.slice(0, Math.max(0, MAX_CLIPS - startingCount));
      if (accepted.length < files.length) full = true;
      const decoded = await Promise.all(
        accepted.map(async (file) => {
          const key = bufferKey(file);
          if (bufferMap.has(key)) return { file, key, ok: true as const };
          try {
            const { buffer } = await decodeAudioFile(file);
            return { file, key, ok: true as const, buffer };
          } catch {
            return { file, key, ok: false as const };
          }
        }),
      );

      for (const entry of decoded) {
        const { file, key } = entry;
        try {
          if (!entry.ok) throw new Error("decode failed");
          if (!bufferMap.has(key)) {
            const fresh = entry.buffer!;
            const bytes = fresh.length * fresh.numberOfChannels * 4;
            // Budget is checked as each buffer is ADMITTED, so a batch that
            // overshoots keeps the files that fit instead of all-or-nothing.
            if (decodedBytes() + bytes > MAX_DECODED_BYTES) {
              setStatus(t("studio.memoryFull"));
              setStatusIsError(true);
              break;
            }
            bufferMap.set(key, fresh);
          }
          const buffer = bufferMap.get(key)!;
          const start = Math.min(cursor, MAX_TIMELINE_SECONDS - buffer.duration);
          const clip: StudioClip = {
            id: makeClipId(),
            name: file.name.replace(/\.[^.]+$/, ""),
            bufferId: key,
            timelineStart: Math.max(0, start),
            clipStart: 0,
            clipEnd: buffer.duration,
            gain: 1,
            fadeInSec: 0,
            fadeOutSec: 0,
            muted: false,
            soloed: false,
            colorIndex: (startingCount + added) % 3,
          };
          cursor = clip.timelineStart + buffer.duration;
          pushUndo();
          setClips((prev) => [...prev, clip]);
          setSelectedId(clip.id);
          added += 1;
        } catch {
          setStatus(t("studio.decodeFailed", { name: file.name }));
          setStatusIsError(true);
        }
      }
      if (full) {
        setStatus(t("studio.slotsFull", { count: MAX_CLIPS }));
        setStatusIsError(true);
      }
      setDecoding(false);
    },
    [t, pushUndo],
  );

  /* --------------------------- drawn waveforms --------------------------- */

  // The wave must show what you HEAR: a phone/underwater/lo-fi master
  // re-renders every clip's display signal through those same filters, so
  // the shape thins out exactly where the audio does. Cached per
  // (buffer, effect), so flipping back is instant.
  useEffect(() => {
    const effect = params.effect;
    let cancelled = false;
    const ids = [...new Set(clips.map((c) => c.bufferId))];

    const immediate = new Map<string, DisplaySignal>();
    const missing: string[] = [];
    for (const id of ids) {
      const hit = peekDisplaySignal(id, effect);
      if (hit) immediate.set(id, hit);
      else missing.push(id);
    }
    setSignals(immediate);

    for (const id of missing) {
      const buffer = bufferMap.get(id);
      if (!buffer) continue;
      void getDisplaySignal(id, buffer, effect).then((signal) => {
        if (cancelled) return;
        setSignals((prev) => new Map(prev).set(id, signal));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [clips, params.effect]);

  // Files handed off from the joiner / cutter / slowed-reverb pages.
  useEffect(() => {
    const files = takeStudioFiles();
    if (files && files.length > 0) void addFiles(files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------- beat grid ------------------------------- */

  // Tempo comes from the first clip on the timeline — in a beat switch that
  // is the track everything else has to line up with. Detection runs once
  // per source clip; the phase pass needs its display signal, so this waits
  // for both rather than guessing a downbeat at zero.
  useEffect(() => {
    const first = [...clips].sort((a, b) => a.timelineStart - b.timelineStart)[0];
    if (!first) {
      gridSourceRef.current = null;
      setGrid(null);
      setTempoFailed(false);
      return;
    }
    if (gridSourceRef.current === first.bufferId) return;
    const buffer = bufferMap.get(first.bufferId);
    const signal = signals.get(first.bufferId);
    if (!buffer || !signal) return;

    gridSourceRef.current = first.bufferId;
    setDetectingTempo(true);
    setTempoFailed(false);
    let cancelled = false;
    void detectTempo(buffer).then((tempo) => {
      if (cancelled) return;
      setDetectingTempo(false);
      if (!tempo) {
        setTempoFailed(true);
        setGrid(null);
        return;
      }
      // Phase is measured in SOURCE seconds; map it onto the timeline through
      // the clip's own trim and position.
      const phase = estimateBeatPhase(signal, tempo.bpm);
      setGrid({
        bpm: tempo.bpm,
        anchorSec: first.timelineStart + (phase - first.clipStart),
        beatsPerBar: DEFAULT_BEATS_PER_BAR,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [clips, signals]);

  // Every clip gets a tempo, so the inspector can say "this one is 140
  // against a 128 project" and offer to fix it. One analysis per buffer,
  // never repeated, and a failure just means no number.
  useEffect(() => {
    for (const id of new Set(clips.map((c) => c.bufferId))) {
      if (bpmRequestedRef.current.has(id)) continue;
      const buffer = bufferMap.get(id);
      if (!buffer) continue;
      bpmRequestedRef.current.add(id);
      void detectTempo(buffer).then((tempo) => {
        if (!tempo) return;
        setClipBpms((prev) => new Map(prev).set(id, tempo.bpm));
      });
    }
  }, [clips]);


  const setGridBpm = useCallback((bpm: number) => {
    if (!Number.isFinite(bpm) || bpm < MIN_BPM || bpm > MAX_BPM) return;
    setGrid((prev) =>
      prev
        ? { ...prev, bpm: Math.round(bpm) }
        : { bpm: Math.round(bpm), anchorSec: 0, beatsPerBar: DEFAULT_BEATS_PER_BAR },
    );
    setTempoFailed(false);
  }, []);

  /* ------------------------------ transport ------------------------------ */

  /**
   * The clips and buffers that actually play, plus the clock scale they run
   * on. Unlocked this is the timeline as-is at the master speed. Locked, it
   * is the pre-stretched twin scheduled at speed 1 — see lib/studio/
   * lock-pitch.ts. Both live playback and the bounce call this, so they
   * still cannot disagree.
   */
  const buildPlaybackSet = useCallback(
    async (): Promise<{ clips: StudioClip[]; buffers: Map<string, AudioBuffer>; scale: number }> => {
      const p = paramsRef.current;
      const speed = quantiseSpeed(p.speed);
      const clips = clipsRef.current;
      if (!p.lockPitch || speed === 1 || clips.length === 0) {
        return { clips, buffers: bufferMap, scale: 1 };
      }
      // Stretching is real CPU on the main thread, so it is cached per
      // (buffer, speed) and only ever runs for buffers actually in use.
      const stretched = new Map<string, AudioBuffer>();
      const ids = [...new Set(clips.map((c) => c.bufferId))];
      for (const id of ids) {
        const source = bufferMap.get(id);
        if (!source) continue;
        stretched.set(stretchedIdFor(id, speed), await getStretchedBuffer(id, source, speed));
      }
      return { clips: scaleClipsForLock(clips, speed), buffers: stretched, scale: speed };
    },
    [],
  );

  // Guards the async gap: a stretch that finishes after the user has already
  // changed their mind must not start playback with stale material.
  const playTokenRef = useRef(0);

  const startPlayback = useCallback(
    async (timelinePosition: number) => {
      const token = ++playTokenRef.current;
      const p = paramsRef.current;
      const needsStretch = p.lockPitch && quantiseSpeed(p.speed) !== 1;
      if (needsStretch) {
        setStage("rendering");
        setWorking(true);
      }
      try {
        const set = await buildPlaybackSet();
        if (token !== playTokenRef.current) return;
        engine.setPlaybackScale(set.scale);
        engine.start(set.clips, set.buffers, timelinePosition);
        setPlaying(engine.playing);
      } catch {
        setStatus(t("studio.lockPitchFailed"));
        setStatusIsError(true);
      } finally {
        if (needsStretch) {
          setStage(null);
          setWorking(false);
        }
      }
    },
    [engine, buildPlaybackSet, t],
  );

  const restartAt = useCallback(
    (position: number) => {
      engine.stop();
      engine.seek(position);
      void startPlayback(position);
    },
    [engine, startPlayback],
  );

  const togglePlay = useCallback(() => {
    if (engine.playing) {
      stopPreview();
    } else {
      if (clipsRef.current.length === 0) return;
      void startPlayback(engine.getPosition());
    }
  }, [engine, stopPreview, startPlayback]);

  const handleSeek = useCallback(
    (seconds: number) => {
      if (recordingRef.current) return; // seeks would corrupt the take's clock
      const max = Math.max(0, timelineDuration(clipsRef.current) - 0.05);
      const clamped = Math.min(seconds, max);
      if (engine.playing) restartAt(clamped);
      else {
        engine.seek(clamped);
        setHeadSignal((n) => n + 1);
      }
    },
    [engine, restartAt],
  );

  /* ------------------------------ clip edits ------------------------------ */

  /**
   * Rescheduling is what makes the graph match the timeline again — and it
   * is the one expensive thing here, so WHEN it happens matters:
   *   "now"   discrete action (mute, split, a drag that already ended)
   *   "defer" continuous gesture (trim handle, fade field, speed knob) —
   *           coalesced to one reschedule after the gesture settles, so a
   *           slider dragged at pointer-move rate rebuilds once, not 60x
   *   "never" already applied live to the running graph (clip gain)
   */
  const rescheduleTimerRef = useRef(0);
  const requestReschedule = useCallback(
    (mode: "now" | "defer" | "never") => {
      if (mode === "never" || !engine.playing) return;
      window.clearTimeout(rescheduleTimerRef.current);
      if (mode === "now") {
        if (recordingRef.current) bankRecordTime();
        queueMicrotask(() => restartAt(engine.getPosition()));
        return;
      }
      rescheduleTimerRef.current = window.setTimeout(() => {
        if (!engine.playing) return;
        if (recordingRef.current) bankRecordTime();
        restartAt(engine.getPosition());
      }, RESCHEDULE_SETTLE_MS);
    },
    [engine, restartAt, bankRecordTime],
  );

  useEffect(() => () => window.clearTimeout(rescheduleTimerRef.current), []);

  const editClip = useCallback(
    (
      id: string,
      edit: (clip: StudioClip) => StudioClip | null,
      options: { undoable?: boolean; reschedule?: "now" | "defer" | "never" } = {},
    ) => {
      const { undoable = true, reschedule = "now" } = options;
      if (undoable) pushUndo();
      setClips((prev) => {
        const next: StudioClip[] = [];
        for (const clip of prev) {
          if (clip.id !== id) {
            next.push(clip);
            continue;
          }
          const edited = edit(clip);
          if (edited) next.push(edited);
        }
        return next;
      });
      requestReschedule(reschedule);
    },
    [pushUndo, requestReschedule],
  );

  const bufferDurationOf = (clip: StudioClip): number =>
    bufferMap.get(clip.bufferId)?.duration ?? clip.clipEnd;

  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return;
    const gone = clipsRef.current.find((c) => c.id === selectedId);
    editClip(selectedId, () => null);
    setSelectedId(null);
    // Last clip using that buffer? Its drawn copies are dead weight.
    if (gone && !clipsRef.current.some((c) => c.id !== selectedId && c.bufferId === gone.bufferId)) {
      forgetDisplaySignals(gone.bufferId);
      forgetStretched(gone.bufferId);
      bufferMap.delete(gone.bufferId);
    }
  }, [selectedId, editClip]);

  const handleSplitSelected = useCallback(() => {
    if (!selectedId) return;
    const clip = clipsRef.current.find((c) => c.id === selectedId);
    if (!clip) return;
    if (clipsRef.current.length >= MAX_TOTAL_CLIPS) {
      setStatus(t("studio.clipsFull", { count: MAX_TOTAL_CLIPS }));
      setStatusIsError(true);
      return;
    }
    const halves = splitClip(clip, engine.getPosition(), makeClipId);
    if (!halves) return;
    pushUndo();
    setClips((prev) => prev.flatMap((c) => (c.id === clip.id ? halves : [c])));
    setSelectedId(halves[1].id);
  }, [selectedId, engine, pushUndo, t]);

  /**
   * Beatmatch: stretch the selected clip so its tempo equals the project's,
   * pitch untouched. The stretched audio is registered as a NEW buffer and
   * the clip is repointed at it, so from here on it is simply a normal clip
   * that happens to already be in time — playback, export, lock pitch and
   * the waveform all work unchanged, with no special case anywhere.
   */
  const handleMatchTempo = useCallback(async () => {
    const clip = clipsRef.current.find((c) => c.id === selectedId);
    if (!clip || !grid) return;
    const sourceBpm = clipBpms.get(clip.bufferId);
    const source = bufferMap.get(clip.bufferId);
    if (!sourceBpm || !source) return;
    const ratio = tempoMatchRatio(sourceBpm, grid.bpm);
    if (!needsTempoMatch(ratio)) return;

    setWorking(true);
    setStage("rendering");
    try {
      const stretched = await getStretchedBuffer(clip.bufferId, source, ratio);
      const id = stretchedIdFor(clip.bufferId, ratio);
      bufferMap.set(id, stretched);
      setClipBpms((prev) => new Map(prev).set(id, Math.round(sourceBpm * ratio)));

      // The stretched buffer is 1/ratio as long, so every source-time field
      // scales with it.
      const nextClipStart = clip.clipStart / ratio;
      const nextClipEnd = clip.clipEnd / ratio;

      // TEMPO ALONE IS HALF A BEATMATCH. The clip now runs at the project's
      // tempo, but its downbeat can still sit anywhere between two grid
      // lines — right speed, wrong place, which is exactly the mistake a
      // human makes by ear. So find where this clip's beats actually fall
      // and slide it (by less than half a beat) until they land on the grid.
      let nextStart = clip.timelineStart;
      const signal = await getDisplaySignal(id, stretched, paramsRef.current.effect);
      const phase = estimateBeatPhase(signal, grid.bpm);
      const beatOnTimeline = clip.timelineStart + (phase - nextClipStart);
      const correction = nearestGridTime(beatOnTimeline, grid) - beatOnTimeline;
      if (Number.isFinite(correction)) nextStart = Math.max(0, clip.timelineStart + correction);

      pushUndo();
      setClips((prev) =>
        prev.map((c) =>
          c.id === clip.id
            ? {
                ...c,
                bufferId: id,
                clipStart: nextClipStart,
                clipEnd: nextClipEnd,
                timelineStart: nextStart,
              }
            : c,
        ),
      );
      setStatus(t("studio.matched", { bpm: grid.bpm }));
      setStatusIsError(false);
      requestReschedule("now");
    } catch {
      setStatus(t("studio.matchFailed"));
      setStatusIsError(true);
    } finally {
      setStage(null);
      setWorking(false);
    }
  }, [selectedId, grid, clipBpms, pushUndo, requestReschedule, t]);

  const handleToggleSolo = useCallback(() => {
    if (!selectedId) return;
    editClip(selectedId, (c) => ({ ...c, soloed: !c.soloed }));
  }, [selectedId, editClip]);

  /** Copy the selected clip and drop it straight after itself. */
  const handleDuplicate = useCallback(() => {
    const clip = clipsRef.current.find((c) => c.id === selectedId);
    if (!clip) return;
    if (clipsRef.current.length >= MAX_TOTAL_CLIPS) {
      setStatus(t("studio.clipsFull", { count: MAX_TOTAL_CLIPS }));
      setStatusIsError(true);
      return;
    }
    const copy: StudioClip = {
      ...clip,
      id: makeClipId(),
      timelineStart: clip.timelineStart + (clip.clipEnd - clip.clipStart),
    };
    pushUndo();
    setClips((prev) => [...prev, copy]);
    setSelectedId(copy.id);
    requestReschedule("now");
  }, [selectedId, pushUndo, requestReschedule, t]);

  const applyLoop = useCallback(
    (region: { start: number; end: number } | null) => {
      setLoopState(region);
      engine.setLoop(region);
    },
    [engine],
  );

  const handleLoopSelection = useCallback(() => {
    if (loop) {
      applyLoop(null);
      return;
    }
    const clip = clipsRef.current.find((c) => c.id === selectedId);
    if (clip) {
      applyLoop({ start: clip.timelineStart, end: clip.timelineStart + (clip.clipEnd - clip.clipStart) });
    }
  }, [loop, selectedId, applyLoop]);

  const handleToggleMute = useCallback(() => {
    if (!selectedId) return;
    editClip(selectedId, (c) => ({ ...c, muted: !c.muted }));
  }, [selectedId, editClip]);

  // Timeline owns the scroller and re-anchors itself; this only holds the
  // zoom level so it survives re-renders.
  const handleChangeZoom = useCallback((next: number) => {
    setPxPerSecond(clampZoom(next));
  }, []);

  const soloing = useMemo(() => isSoloing(clips), [clips]);

  const selectedClip = useMemo(
    () => clips.find((c) => c.id === selectedId) ?? null,
    [clips, selectedId],
  );

  /* ------------------------------ master params ------------------------------ */

  const applyParams = useCallback(
    (next: RemixParams, moves: AutomationEvent[], settle: "now" | "defer" = "now") => {
      setParams(next);
      for (const move of moves) recordMove(move);
      // setParams applies everything it can in place and reports whether a
      // reschedule is still owed. Speed is the interesting case: it is
      // ALREADY audible (playbackRate on the live sources), and the
      // reschedule only fixes the start times of clips that haven't begun —
      // so it can wait for the knob to settle instead of fighting the drag.
      if (engine.setParams(next)) requestReschedule(settle);
    },
    [engine, requestReschedule],
  );

  /**
   * Lock pitch is a whole different playback material (pre-stretched clips),
   * so toggling it re-prepares and restarts at the same musical position.
   * It is mutually exclusive with take recording: renderRemixAutomated
   * cannot pitch-lock a recorded speed sweep, and an export that silently
   * disagreed with what you performed would be worse than not offering it.
   */
  const setLockPitch = (lockPitch: boolean) => {
    const next = { ...paramsRef.current, lockPitch };
    setParams(next);
    engine.setParams(next);
    const at = engine.getPosition();
    if (engine.playing) {
      engine.stop();
      void startPlayback(at);
    } else {
      engine.setPlaybackScale(lockPitch ? quantiseSpeed(next.speed) : 1);
      engine.seek(at);
    }
  };

  const setSpeed = (speed: number) =>
    applyParams(
      { ...paramsRef.current, speed },
      [{ t: outputNow(), kind: "speed", value: speed }],
      "defer",
    );
  const setReverb = (reverb: number) =>
    applyParams({ ...paramsRef.current, reverb }, [{ t: outputNow(), kind: "reverb", value: reverb }]);
  const setBass = (bassBoostDb: number) =>
    applyParams({ ...paramsRef.current, bassBoostDb }, [{ t: outputNow(), kind: "bassBoostDb", value: bassBoostDb }]);
  const setReverbType = (reverbType: ReverbType) =>
    applyParams({ ...paramsRef.current, reverbType }, [{ t: outputNow(), kind: "reverbType", value: reverbType }]);
  const setEffect = (effect: EffectId) =>
    applyParams({ ...paramsRef.current, effect }, [{ t: outputNow(), kind: "effect", value: effect }]);

  /* ------------------------------ record ------------------------------ */

  const toggleRecording = useCallback(() => {
    if (recordingRef.current) {
      finishTake();
      return;
    }
    if (clipsRef.current.length === 0) return;
    takeBaseRef.current = paramsRef.current;
    takeStartRef.current = engine.getPosition();
    recordBaseRef.current = 0;
    eventsRef.current = [];
    recordingRef.current = true;
    setRecording(true);
    if (!engine.playing) {
      void startPlayback(engine.getPosition());
      setPlaying(engine.playing);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  /* ------------------------------ export ------------------------------ */

  const handleExport = useCallback(async () => {
    if (working || clipsRef.current.length === 0) return;
    stopPreview();
    setWorking(true);
    setStatus("");
    setStatusIsError(false);
    try {
      const take = takes.find((tk) => tk.id === selectedTakeId) ?? null;
      // Same material as the preview: locked exports bounce the stretched
      // clips at speed 1, so the file matches what was heard.
      const set = await buildPlaybackSet();
      const exportParams =
        set.scale === 1 ? paramsRef.current : { ...paramsRef.current, speed: 1, lockPitch: false };
      // The loop is authored in timeline seconds; the playback set may be on
      // a stretched clock, so the window converts with it.
      const clipsToBounce =
        exportLoopOnly && loop
          ? sliceClipsToWindow(set.clips, loop.start / set.scale, loop.end / set.scale)
          : set.clips;
      const blob = await exportStudioMix(clipsToBounce, set.buffers, {
        format,
        params: exportParams,
        take,
        onStage: setStage,
      });
      const base = clipsRef.current[0]?.name || "tunebad-mix";
      downloadBlob(blob, `${base}-daw.${format}`);
      setStatus(t("studio.exportDone"));
    } catch {
      setStatus(t("studio.exportFailed"));
      setStatusIsError(true);
    } finally {
      setStage(null);
      setWorking(false);
    }
  }, [working, format, takes, selectedTakeId, stopPreview, buildPlaybackSet, exportLoopOnly, loop, t]);

  /* ------------------------------ render ------------------------------ */

  const duration = timelineDuration(clips);

  return (
    <div className="studio-panel">
      <FileDrop
        accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac,.opus"
        multiple
        disabled={decoding || working || clips.length >= MAX_CLIPS}
        onFiles={(files) => void addFiles(files)}
        hint={
          clips.length === 0
            ? t("studio.dropTitle")
            : t("studio.dropMore", { count: MAX_CLIPS - clips.length })
        }
      />

      {clips.length > 0 && (
        <>
          <Timeline
            clips={clips}
            signals={signals}
            selectedId={selectedId}
            playing={playing}
            pxPerSecond={pxPerSecond}
            getPosition={() => engine.getPosition()}
            onSelect={setSelectedId}
            onMoveClip={(id, start) => editClip(id, (c) => moveClip(c, start))}
            onTrimStart={(id, v) =>
              editClip(id, (c) => trimClipStart(c, v, bufferDurationOf(c)), { reschedule: "defer" })
            }
            onTrimEnd={(id, v) =>
              editClip(id, (c) => trimClipEnd(c, v, bufferDurationOf(c)), { reschedule: "defer" })
            }
            onSeek={handleSeek}
            onTogglePlay={togglePlay}
            onDeleteSelected={handleDeleteSelected}
            onSplitSelected={handleSplitSelected}
            onDuplicateSelected={handleDuplicate}
            onToggleLoop={handleLoopSelection}
            onChangeZoom={handleChangeZoom}
            loop={loop}
            onSetLoop={applyLoop}
            grid={gridOn ? grid : null}
            follow={follow}
            headSignal={headSignal}
            disabled={working}
          />

          <div className="studio-transport">
            <button className="primary-button" type="button" onClick={togglePlay} disabled={working}>
              {playing ? t("studio.pause") : t("studio.play")}
            </button>
            <button
              className={`secondary-button studio-record${recording ? " recording" : ""}`}
              type="button"
              onClick={toggleRecording}
              disabled={working || params.lockPitch}
              title={params.lockPitch ? t("studio.lockVsRecord") : undefined}
              aria-pressed={recording}
            >
              {recording ? t("studio.recordStop") : t("studio.record")}
            </button>
            <TransportClock getPosition={() => engine.getPosition()} playing={playing} total={duration} />
            <button
              className={`text-button${loop ? " active" : ""}`}
              type="button"
              onClick={handleLoopSelection}
              disabled={working || (!loop && !selectedClip)}
              aria-pressed={Boolean(loop)}
              title={t("studio.loopHint")}
            >
              {t("studio.loop")}
            </button>
            <button
              className={`text-button${gridOn && grid ? " active" : ""}`}
              type="button"
              onClick={() => setGridOn((g) => !g)}
              disabled={working || (!grid && !tempoFailed)}
              aria-pressed={gridOn && Boolean(grid)}
              title={t("studio.gridHint")}
            >
              {t("studio.grid")}
            </button>
            <button
              className={`text-button${follow ? " active" : ""}`}
              type="button"
              onClick={() => setFollow((f) => !f)}
              disabled={working}
              aria-pressed={follow}
              title={t("studio.followHint")}
            >
              {t("studio.follow")}
            </button>
            <button
              className="text-button"
              type="button"
              onClick={undo}
              disabled={working || undoDepth === 0}
            >
              {t("studio.undo")}
            </button>
            <span className="studio-hint">{t("studio.keysHint")}</span>
          </div>

          {selectedClip && (
            <div className="studio-inspector">
              <span className="studio-inspector-name">{selectedClip.name}</span>
              <label className="studio-field">
                {t("studio.clipGain")}
                <input
                  type="range"
                  min={0}
                  max={1.5}
                  step={0.05}
                  value={selectedClip.gain}
                  onPointerDown={pushUndo}
                  onChange={(e) => {
                    const gain = Number(e.target.value);
                    editClip(selectedClip.id, (c) => ({ ...c, gain }), { undoable: false, reschedule: "never" });
                    engine.setClipGain(selectedClip.id, gain);
                  }}
                />
              </label>
              <label className="studio-field">
                {t("studio.fadeIn")}
                <input
                  type="number"
                  className="num"
                  min={0}
                  max={30}
                  step={0.5}
                  value={selectedClip.fadeInSec}
                  onChange={(e) =>
                    editClip(selectedClip.id, (c) => ({ ...c, fadeInSec: Math.max(0, Number(e.target.value) || 0) }), {
                      reschedule: "defer",
                    })
                  }
                />
              </label>
              <label className="studio-field">
                {t("studio.fadeOut")}
                <input
                  type="number"
                  className="num"
                  min={0}
                  max={30}
                  step={0.5}
                  value={selectedClip.fadeOutSec}
                  onChange={(e) =>
                    editClip(selectedClip.id, (c) => ({ ...c, fadeOutSec: Math.max(0, Number(e.target.value) || 0) }), {
                      reschedule: "defer",
                    })
                  }
                />
              </label>
              <button
                className={`text-button${selectedClip.muted ? " active" : ""}`}
                type="button"
                aria-pressed={selectedClip.muted}
                onClick={handleToggleMute}
              >
                {selectedClip.muted ? t("studio.unmute") : t("studio.mute")}
              </button>
              {clipBpms.has(selectedClip.bufferId) && (
                <span className="studio-hint num">
                  {t("studio.clipBpm", { bpm: clipBpms.get(selectedClip.bufferId) as number })}
                </span>
              )}
              {grid &&
                clipBpms.has(selectedClip.bufferId) &&
                needsTempoMatch(
                  tempoMatchRatio(clipBpms.get(selectedClip.bufferId) as number, grid.bpm),
                ) && (
                  <button
                    className="text-button"
                    type="button"
                    disabled={working}
                    onClick={() => void handleMatchTempo()}
                    title={t("studio.matchHint")}
                  >
                    {t("studio.match")}
                  </button>
                )}
              <button
                className={`text-button${selectedClip.soloed ? " active" : ""}`}
                type="button"
                aria-pressed={selectedClip.soloed}
                onClick={handleToggleSolo}
              >
                {t("studio.solo")}
              </button>
              <button className="text-button" type="button" onClick={handleSplitSelected}>
                {t("studio.split")}
              </button>
              <button className="text-button" type="button" onClick={handleDuplicate}>
                {t("studio.duplicate")}
              </button>
              <button className="text-button" type="button" onClick={handleDeleteSelected}>
                {t("studio.remove")}
              </button>
            </div>
          )}

          {(detectingTempo || grid || tempoFailed) && (
            <div className="studio-tempo">
              {detectingTempo && <span className="studio-hint">{t("studio.gridDetecting")}</span>}
              {!detectingTempo && (
                <>
                  <label className="studio-field">
                    {t("studio.bpm")}
                    <input
                      className="num"
                      type="number"
                      min={MIN_BPM}
                      max={MAX_BPM}
                      step={1}
                      value={grid ? grid.bpm : ""}
                      placeholder="—"
                      disabled={working}
                      onChange={(e) => setGridBpm(Number(e.target.value))}
                    />
                  </label>
                  {/* The tempo estimator is known to report the wrong octave
                      on fast tracks; halving/doubling is one click, not a
                      re-analysis. */}
                  <button
                    className="text-button"
                    type="button"
                    disabled={working || !grid}
                    onClick={() => grid && setGridBpm(grid.bpm / 2)}
                  >
                    {t("studio.gridHalf")}
                  </button>
                  <button
                    className="text-button"
                    type="button"
                    disabled={working || !grid}
                    onClick={() => grid && setGridBpm(grid.bpm * 2)}
                  >
                    {t("studio.gridDouble")}
                  </button>
                  {tempoFailed && !grid && (
                    <span className="studio-hint">{t("studio.gridNone")}</span>
                  )}
                </>
              )}
            </div>
          )}

          {soloing && <p className="studio-notice">{t("studio.soloNotice")}</p>}
          {loop && (
            <label className="studio-field studio-lock">
              <input
                type="checkbox"
                checked={exportLoopOnly}
                disabled={working}
                onChange={(e) => setExportLoopOnly(e.target.checked)}
              />
              {t("studio.exportLoopOnly")}
            </label>
          )}

          <div className="studio-master">
            <label className="studio-field studio-lock" title={t("studio.lockPitchHint")}>
              <input
                type="checkbox"
                checked={params.lockPitch}
                disabled={working || recording}
                onChange={(e) => setLockPitch(e.target.checked)}
              />
              {t("studio.lockPitch")}
            </label>
            {params.lockPitch && <p className="studio-notice">{t("studio.lockVsRecord")}</p>}
            <label className="studio-field studio-field-wide">
              {t("studio.speed")}
              <input
                type="range"
                min={0.5}
                max={1.5}
                step={0.01}
                value={params.speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              />
              <span className="num">
                {params.speed.toFixed(2)}x · {coupledSemitones(params.speed) >= 0 ? "+" : ""}
                {coupledSemitones(params.speed).toFixed(1)} st
              </span>
            </label>
            <label className="studio-field studio-field-wide">
              {t("studio.reverb")}
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={params.reverb}
                onChange={(e) => setReverb(Number(e.target.value))}
              />
              <span className="num">{params.reverb}</span>
            </label>
            <label className="studio-field studio-field-wide">
              {t("studio.bass")}
              <input
                type="range"
                min={-6}
                max={9}
                step={0.5}
                value={params.bassBoostDb}
                onChange={(e) => setBass(Number(e.target.value))}
              />
              <span className="num">{params.bassBoostDb} dB</span>
            </label>

            <div className="studio-pills" role="group" aria-label={t("studio.reverbType")}>
              {REVERB_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.type}
                  className={`cutter-format-pill${params.reverbType === option.type ? " active" : ""}`}
                  type="button"
                  aria-pressed={params.reverbType === option.type}
                  onClick={() => setReverbType(option.type)}
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </div>
            <div className="studio-pills" role="group" aria-label={t("studio.effect")}>
              {EFFECT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  className={`cutter-format-pill${params.effect === option.id ? " active" : ""}`}
                  type="button"
                  aria-pressed={params.effect === option.id}
                  onClick={() => setEffect(option.id)}
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {takes.length > 0 && (
            <div className="studio-takes" role="radiogroup" aria-label={t("studio.takes")}>
              <button
                className={`cutter-format-pill${selectedTakeId === null ? " active" : ""}`}
                type="button"
                onClick={() => setSelectedTakeId(null)}
              >
                {t("studio.takeNone")}
              </button>
              {takes.map((take) => (
                <button
                  key={take.id}
                  className={`cutter-format-pill${selectedTakeId === take.id ? " active" : ""}`}
                  type="button"
                  onClick={() => setSelectedTakeId(take.id)}
                >
                  {take.label} · {formatTimeTenths(take.outDuration)}
                </button>
              ))}
            </div>
          )}

          <div className="studio-export">
            <div className="cutter-format-pills" role="group" aria-label={t("studio.format")}>
              {(["mp3", "wav"] as const).map((f) => (
                <button
                  key={f}
                  className={`cutter-format-pill${format === f ? " active" : ""}`}
                  type="button"
                  aria-pressed={format === f}
                  onClick={() => setFormat(f)}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
            <button className="primary-button" type="button" onClick={() => void handleExport()} disabled={working || clips.length === 0}>
              {working && stage ? t(STAGE_LABELS[stage]) : t("studio.export")}
            </button>
          </div>
        </>
      )}

      {(status || decoding) && (
        <p className={`studio-status${statusIsError ? " error" : ""}`} role="status">
          {decoding ? t("studio.decoding") : status}
        </p>
      )}
    </div>
  );
}
