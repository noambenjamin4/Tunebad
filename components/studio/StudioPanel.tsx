"use client";

// TuneBad DAW: multi-song timeline (joiner) + trims/splits (cutter) + live
// master-bus slowed/reverb/effects with take recording (remix studio), one
// tool. Clips schedule through lib/studio/timeline.ts, play through
// StudioEngine, and export through exportStudioMix — live and export share
// computeClipSchedule, so the bounce matches the preview by construction.
//
// This file is the wiring: state that several features read, the transport,
// and the edit handlers. The self-contained parts live next door —
// useDisplaySignals (what gets drawn), useBeatGrid (tempo), useStudioSession
// (restore + autosave), useTakeRecorder (performance capture), and the two
// presentational blocks ClipInspector and MasterControls.

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
} from "@/lib/audio/remix";
import {
  type StudioClip,
  MAX_CLIPS,
  MAX_DECODED_BYTES,
  MAX_TIMELINE_SECONDS,
  MAX_TOTAL_CLIPS,
  crossfadeOverlap,
  isSoloing,
  overlapPartner,
  loopRegionFor,
  sliceClipsToWindow,
  moveClip,
  splitClip,
  timelineDuration,
  trimClipEnd,
  trimClipStart,
} from "@/lib/studio/timeline";
import { DEFAULT_PX_PER_SECOND, clampZoom } from "@/lib/studio/timeline-math";
import { bufferKey, bufferMap, decodedBytes, releaseBuffer } from "@/lib/studio/buffer-store";
import { makeClipId, reserveClipIds } from "@/lib/studio/clip-ids";
import { getDisplaySignal } from "@/lib/studio/display-signal";
import { StudioEngine } from "@/lib/studio/engine";
import {
  MAX_SESSION_BYTES,
  clearSession,
  loadSessionFiles,
  saveSessionFile,
  sessionBytes,
} from "@/lib/studio/session";
import {
  MAX_BPM,
  MIN_BPM,
  barsIn,
  estimateBeatPhase,
  expandToBars,
  nearestGridTime,
  needsTempoMatch,
  tempoMatchRatio,
} from "@/lib/studio/beat-grid";
import {
  getStretchedBuffer,
  quantiseSpeed,
  scaleClipsForLock,
  stretchedIdFor,
} from "@/lib/studio/lock-pitch";
import { exportStudioMix } from "@/lib/studio/render-timeline";
import { ClipInspector } from "./ClipInspector";
import { LevelMeter } from "./LevelMeter";
import { MasterControls } from "./MasterControls";
import { Timeline } from "./Timeline";
import { useBeatGrid } from "./useBeatGrid";
import { useDisplaySignals } from "./useDisplaySignals";
import { useStudioSession } from "./useStudioSession";
import { useTakeRecorder } from "./useTakeRecorder";

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

// How long a continuous gesture (slider drag, trim, fade field) must be
// quiet before the graph is rescheduled. Long enough to swallow a drag,
// short enough that a release feels immediate.
const RESCHEDULE_SETTLE_MS = 160;

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
  // Clip-state history for Cmd/Ctrl+Z. Buffers live outside state, so a
  // snapshot is just an array of small plain objects.
  const [history, setHistory] = useState({ undo: 0, redo: 0 });
  const [loop, setLoopState] = useState<{ start: number; end: number } | null>(null);
  const [follow, setFollow] = useState(true);
  const [exportLoopOnly, setExportLoopOnly] = useState(false);

  const clipsRef = useRef(clips);
  clipsRef.current = clips;
  const undoStackRef = useRef<StudioClip[][]>([]);
  const redoStackRef = useRef<StudioClip[][]>([]);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  // The engine outlives every render, so the callback it was constructed with
  // would forever see the first render's closure. It reads this ref instead.
  const endedRef = useRef<() => void>(() => {});
  const engineRef = useRef<StudioEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = new StudioEngine(DEFAULT_PARAMS, () => endedRef.current());
  }
  const engine = engineRef.current;

  useEffect(() => () => engine.dispose(), [engine]);

  const getTimelineSeconds = useCallback(() => timelineDuration(clipsRef.current), []);
  const recorder = useTakeRecorder(engine, getTimelineSeconds);
  // Destructured on purpose: `recorder` is a fresh object every render, so a
  // callback that listed it as a dependency would be rebuilt every render and
  // drag every handler built on top of it along. Each of these is stable.
  const {
    isRecording,
    bankTime,
    recordMove,
    outputNow,
    recording,
    begin: beginTake,
    finish: finishTake,
  } = recorder;

  endedRef.current = () => {
    setPlaying(false);
    if (isRecording()) finishTake();
    setHeadSignal((n) => n + 1);
  };

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
      redoDepth: () => redoStackRef.current.length,
    };
  }, [engine, pxPerSecond]);

  /* ------------------------------ undo ------------------------------ */

  const syncHistory = () => {
    setHistory({ undo: undoStackRef.current.length, redo: redoStackRef.current.length });
  };

  const pushUndo = useCallback(() => {
    undoStackRef.current = [...undoStackRef.current.slice(-29), clipsRef.current];
    // A new edit forks the timeline: whatever was undone is no longer
    // reachable, and keeping it would let Redo paste in a state that never
    // followed from what is on screen now.
    redoStackRef.current = [];
    syncHistory();
  }, []);

  /** Move one state between the two stacks. Undo and redo are mirror images. */
  const step = useCallback((from: StudioClip[][], to: StudioClip[][]) => {
    const previous = from.pop();
    if (!previous) return;
    to.push(clipsRef.current);
    setClips(previous);
    setSelectedId((current) => (previous.some((c) => c.id === current) ? current : null));
    syncHistory();
  }, []);

  const undo = useCallback(() => {
    step(undoStackRef.current, redoStackRef.current);
  }, [step]);

  const redo = useCallback(() => {
    step(redoStackRef.current, undoStackRef.current);
  }, [step]);

  // Cmd/Ctrl+Z anywhere on the page except while typing in a field; add
  // Shift for redo (and Ctrl+Y, which is what Windows habits reach for).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      event.preventDefault();
      if (key === "y" || event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const stopPreview = useCallback(() => {
    if (isRecording()) bankTime();
    engine.stop();
    setPlaying(false);
  }, [engine, isRecording, bankTime]);

  useNowPlaying(NOW_PLAYING_SOURCE, playing, stopPreview);
  useUnloadGuard(clips.length > 0 || working);

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
            // Keep the original file so a refresh can rebuild this clip.
            // Compressed source, not decoded audio: a 4-minute MP3 is a few
            // MB where its PCM is ~40.
            void (async () => {
              const stored = await loadSessionFiles();
              if (sessionBytes(stored) + file.size > MAX_SESSION_BYTES) {
                setStatus(t("studio.sessionFull"));
                return;
              }
              await saveSessionFile(key, file);
            })();
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

  const signals = useDisplaySignals(clips, params.effect);
  const beatGrid = useBeatGrid(clips, signals);
  const { grid, gridOn, clipInfo, noteClipInfo } = beatGrid;

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
      if (isRecording()) return; // seeks would corrupt the take's clock
      const max = Math.max(0, timelineDuration(clipsRef.current) - 0.05);
      const clamped = Math.min(seconds, max);
      if (engine.playing) restartAt(clamped);
      else {
        engine.seek(clamped);
        setHeadSignal((n) => n + 1);
      }
    },
    [engine, restartAt, isRecording],
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
        if (isRecording()) bankTime();
        queueMicrotask(() => restartAt(engine.getPosition()));
        return;
      }
      rescheduleTimerRef.current = window.setTimeout(() => {
        if (!engine.playing) return;
        if (isRecording()) bankTime();
        restartAt(engine.getPosition());
      }, RESCHEDULE_SETTLE_MS);
    },
    [engine, restartAt, isRecording, bankTime],
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
    // Last clip using that buffer? Its decoded audio and every drawn or
    // stretched copy of it are dead weight.
    if (gone && !clipsRef.current.some((c) => c.id !== selectedId && c.bufferId === gone.bufferId)) {
      releaseBuffer(gone.bufferId);
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
    const info = clipInfo.get(clip.bufferId);
    const source = bufferMap.get(clip.bufferId);
    if (!info || !source) return;
    const ratio = tempoMatchRatio(info.bpm, grid.bpm);
    if (!needsTempoMatch(ratio)) return;

    setWorking(true);
    setStage("rendering");
    try {
      const stretched = await getStretchedBuffer(clip.bufferId, source, ratio);
      const id = stretchedIdFor(clip.bufferId, ratio);
      bufferMap.set(id, stretched);
      // The stretch changes tempo and leaves pitch alone, so the KEY carries
      // over untouched — dropping it here would blank the harmonic readout
      // for exactly the clips that were just matched.
      noteClipInfo(id, { ...info, bpm: Math.round(info.bpm * ratio), bpmAlternate: null });

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
                // Provenance, so a restored session can rebuild this
                // stretch instead of storing the stretched audio.
                sourceBufferId: c.sourceBufferId ?? c.bufferId,
                tempoRatio: (c.tempoRatio ?? 1) * ratio,
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
  }, [selectedId, grid, clipInfo, noteClipInfo, pushUndo, requestReschedule, t]);

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

  /**
   * Loop what is worth hearing twice. For a clip that overlaps another that
   * is the TRANSITION, not the whole song — and it is widened to the bars
   * around it, because a loop that restarts three-quarters of a beat into a
   * bar reads as a stutter rather than a repeat.
   */
  const handleLoopSelection = useCallback(() => {
    if (loop) {
      applyLoop(null);
      return;
    }
    if (!selectedId) return;
    const region = loopRegionFor(clipsRef.current, selectedId);
    if (!region) return;
    applyLoop(grid ? expandToBars(region, grid) : region);
  }, [loop, selectedId, applyLoop, grid]);

  /**
   * One click turns an overlap into a transition. Deliberately not automatic
   * on drop: overlapping clips that both play at full level is a legitimate
   * mix (a beat under a vocal), so blending them has to be asked for.
   */
  const handleCrossfade = useCallback(() => {
    if (!selectedId) return;
    const next = crossfadeOverlap(clipsRef.current, selectedId);
    if (!next) return;
    const faded = next.find((c) => c.id === selectedId);
    pushUndo();
    setClips(next);
    setStatus(
      t("studio.crossfaded", {
        seconds: Math.max(faded?.fadeInSec ?? 0, faded?.fadeOutSec ?? 0).toFixed(1),
      }),
    );
    setStatusIsError(false);
    requestReschedule("now");
  }, [selectedId, pushUndo, requestReschedule, t]);

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

  /* --------------------------- persistence --------------------------- */

  useStudioSession({
    clips,
    params,
    grid,
    loop,
    gridOn,
    pxPerSecond,
    onHandoffFiles: (files) => void addFiles(files),
    onRestored: (saved) => {
      // Before anything else: ids minted from here on must not collide with
      // the ones coming back from disk.
      reserveClipIds(saved.clips);
      setClips(saved.clips);
      if (saved.params) setParams(saved.params);
      if (saved.grid) beatGrid.setGrid(saved.grid);
      beatGrid.setGridOn(saved.gridOn);
      if (saved.loop) applyLoop(saved.loop);
      if (saved.pxPerSecond) setPxPerSecond(clampZoom(saved.pxPerSecond));
    },
    setStatus,
  });

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
    [engine, requestReschedule, recordMove],
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

  const now = outputNow;
  const setSpeed = (speed: number) =>
    applyParams({ ...paramsRef.current, speed }, [{ t: now(), kind: "speed", value: speed }], "defer");
  const setReverb = (reverb: number) =>
    applyParams({ ...paramsRef.current, reverb }, [{ t: now(), kind: "reverb", value: reverb }]);
  const setBass = (bassBoostDb: number) =>
    applyParams({ ...paramsRef.current, bassBoostDb }, [{ t: now(), kind: "bassBoostDb", value: bassBoostDb }]);
  const setReverbType = (reverbType: ReverbType) =>
    applyParams({ ...paramsRef.current, reverbType }, [{ t: now(), kind: "reverbType", value: reverbType }]);
  const setEffect = (effect: EffectId) =>
    applyParams({ ...paramsRef.current, effect }, [{ t: now(), kind: "effect", value: effect }]);

  /* ------------------------------ record ------------------------------ */

  const toggleRecording = useCallback(() => {
    if (isRecording()) {
      finishTake();
      return;
    }
    if (clipsRef.current.length === 0) return;
    beginTake(paramsRef.current, engine.getPosition());
    if (!engine.playing) {
      void startPlayback(engine.getPosition());
      setPlaying(engine.playing);
    }
  }, [engine, startPlayback, isRecording, beginTake, finishTake]);

  /* ------------------------------ export ------------------------------ */

  const { takes, selectedTakeId } = recorder;

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
            ? t("studio.dropTitle", { count: MAX_CLIPS })
            : t("studio.dropMore", { count: MAX_CLIPS - clips.length })
        }
      />

      {/* First contact. Everything this tool can do lives behind dropping a
          file, so an empty drop zone teaches nothing — three lines name the
          moves, and they disappear the moment there is a timeline. */}
      {clips.length === 0 && (
        <ul className="studio-intro">
          <li>{t("studio.introA")}</li>
          <li>{t("studio.introB")}</li>
          <li>{t("studio.introC")}</li>
        </ul>
      )}

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
            <LevelMeter getLevel={() => engine.getPeakLevel()} playing={playing} />
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
              onClick={() => beatGrid.setGridOn((g) => !g)}
              disabled={working || (!grid && !beatGrid.failed)}
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
              onClick={() => {
                void clearSession();
                setStatus("");
              }}
              disabled={working || clips.length === 0}
              title={t("studio.clearSession")}
            >
              {t("studio.clearSession")}
            </button>
            <button
              className="text-button"
              type="button"
              onClick={undo}
              disabled={working || history.undo === 0}
            >
              {t("studio.undo")}
            </button>
            <button
              className="text-button"
              type="button"
              onClick={redo}
              disabled={working || history.redo === 0}
            >
              {t("studio.redo")}
            </button>
            <span className="studio-hint">{t("studio.keysHint")}</span>
          </div>

          {selectedClip && (
            <ClipInspector
              clip={selectedClip}
              working={working}
              grid={grid}
              clipInfo={clipInfo}
              partner={overlapPartner(clips, selectedClip.id)?.partner ?? null}
              onGainPointerDown={pushUndo}
              onGain={(gain) => {
                editClip(selectedClip.id, (c) => ({ ...c, gain }), {
                  undoable: false,
                  reschedule: "never",
                });
                engine.setClipGain(selectedClip.id, gain);
              }}
              onFadeIn={(fadeInSec) =>
                editClip(selectedClip.id, (c) => ({ ...c, fadeInSec }), { reschedule: "defer" })
              }
              onFadeOut={(fadeOutSec) =>
                editClip(selectedClip.id, (c) => ({ ...c, fadeOutSec }), { reschedule: "defer" })
              }
              onFadeCurve={(fadeCurve) =>
                editClip(selectedClip.id, (c) => ({ ...c, fadeCurve }))
              }
              onToggleMute={handleToggleMute}
              onToggleSolo={handleToggleSolo}
              onMatchTempo={() => void handleMatchTempo()}
              onCrossfade={handleCrossfade}
              canCrossfade={crossfadeOverlap(clips, selectedClip.id) !== null}
              onSplit={handleSplitSelected}
              onDuplicate={handleDuplicate}
              onDelete={handleDeleteSelected}
            />
          )}

          {(beatGrid.detecting || grid || beatGrid.failed) && (
            <div className="studio-tempo">
              {beatGrid.detecting && <span className="studio-hint">{t("studio.gridDetecting")}</span>}
              {!beatGrid.detecting && (
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
                      onChange={(e) => beatGrid.setGridBpm(Number(e.target.value))}
                    />
                  </label>
                  {/* The tempo estimator is known to report the wrong octave
                      on fast tracks; halving/doubling is one click, not a
                      re-analysis. */}
                  <button
                    className="text-button"
                    type="button"
                    disabled={working || !grid}
                    onClick={() => grid && beatGrid.setGridBpm(grid.bpm / 2)}
                  >
                    {t("studio.gridHalf")}
                  </button>
                  <button
                    className="text-button"
                    type="button"
                    disabled={working || !grid}
                    onClick={() => grid && beatGrid.setGridBpm(grid.bpm * 2)}
                  >
                    {t("studio.gridDouble")}
                  </button>
                  {beatGrid.failed && !grid && (
                    <span className="studio-hint">{t("studio.gridNone")}</span>
                  )}
                </>
              )}
            </div>
          )}

          {soloing && <p className="studio-notice">{t("studio.soloNotice")}</p>}
          {loop && (
            <label className="studio-field studio-lock">
              <span className="studio-hint num">
                {grid
                  ? t("studio.loopBars", { bars: barsIn(loop, grid).toFixed(barsIn(loop, grid) % 1 ? 2 : 0) })
                  : t("studio.loopLength", { seconds: (loop.end - loop.start).toFixed(1) })}
              </span>
              <input
                type="checkbox"
                checked={exportLoopOnly}
                disabled={working}
                onChange={(e) => setExportLoopOnly(e.target.checked)}
              />
              {t("studio.exportLoopOnly")}
            </label>
          )}

          <MasterControls
            params={params}
            working={working}
            recording={recording}
            onLockPitch={setLockPitch}
            onSpeed={setSpeed}
            onReverb={setReverb}
            onBass={setBass}
            onReverbType={setReverbType}
            onEffect={setEffect}
          />

          {takes.length > 0 && (
            <div className="studio-takes" role="radiogroup" aria-label={t("studio.takes")}>
              <button
                className={`cutter-format-pill${selectedTakeId === null ? " active" : ""}`}
                type="button"
                onClick={() => recorder.setSelectedTakeId(null)}
              >
                {t("studio.takeNone")}
              </button>
              {takes.map((take) => (
                <button
                  key={take.id}
                  className={`cutter-format-pill${selectedTakeId === take.id ? " active" : ""}`}
                  type="button"
                  onClick={() => recorder.setSelectedTakeId(take.id)}
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
