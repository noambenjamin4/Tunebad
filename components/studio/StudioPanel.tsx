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
  type ReverbEqParams,
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
  scaleClipTiming,
  splitClip,
  timelineDuration,
  trimClipEnd,
  trimClipStart,
  withFadeIn,
  withFadeOut,
} from "@/lib/studio/timeline";
import { DEFAULT_PX_PER_SECOND, clampZoom } from "@/lib/studio/timeline-math";
import {
  bufferKey,
  bufferMap,
  decodedBytes,
  reachableBufferIds,
  releaseUnreachable,
} from "@/lib/studio/buffer-store";
import { makeClipId, reserveClipIds } from "@/lib/studio/clip-ids";
import { DEMO_OVERLAP_SECONDS, makeDemoFiles } from "@/lib/studio/demo";
import { transposeCode, transposeKey } from "@/lib/audio/harmonic";
import { displayKey, getDisplaySignal } from "@/lib/studio/display-signal";
import { StudioEngine } from "@/lib/studio/engine";
import {
  MAX_SESSION_BYTES,
  clearSession,
  loadSessionFiles,
  pruneSessionFiles,
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
import { useExtensionHandoff } from "./useExtensionHandoff";
import { LevelMeter } from "./LevelMeter";
import { MasterControls, type StudioPreset } from "./MasterControls";
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
  const [mp3Kbps, setMp3Kbps] = useState<128 | 192 | 320>(320);
  const [exportName, setExportName] = useState("");
  const [editingTakeId, setEditingTakeId] = useState<string | null>(null);
  const [headSignal, setHeadSignal] = useState(0);
  // Clip-state history for Cmd/Ctrl+Z. Buffers live outside state, so a
  // snapshot is just an array of small plain objects.
  const [history, setHistory] = useState({ undo: 0, redo: 0 });
  const [loop, setLoopState] = useState<{ start: number; end: number } | null>(null);
  const [follow, setFollow] = useState(true);
  const [exportLoopOnly, setExportLoopOnly] = useState(false);
  // First click arms the session wipe, second click performs it.
  const [clearArmed, setClearArmed] = useState(false);

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
    recordMove,
    outputNow,
    recording,
    begin: beginTake,
    finish: finishTake,
    clear: clearTakes,
    adopt: adoptTakes,
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

  const stopPreview = useCallback(() => {
    engine.stop();
    setPlaying(false);
  }, [engine]);

  useNowPlaying(NOW_PLAYING_SOURCE, playing, stopPreview);
  useUnloadGuard(clips.length > 0 || working);

  /* ------------------------------ files in ------------------------------ */


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
   *
   * There is no "never": clip gain looked like it qualified, since the engine
   * can move that node live — but the same node carries the clip's fade
   * envelope, so a live poke gets undone by the next scheduled fade point.
   * Everything that changes a clip has to rebuild the schedule eventually.
   */
  const clearArmTimerRef = useRef(0);
  const rescheduleTimerRef = useRef(0);
  const requestReschedule = useCallback(
    (mode: "now" | "defer") => {
      if (!engine.playing) return;
      window.clearTimeout(rescheduleTimerRef.current);
      if (mode === "now") {
        queueMicrotask(() => restartAt(engine.getPosition()));
        return;
      }
      rescheduleTimerRef.current = window.setTimeout(() => {
        if (!engine.playing) return;
        restartAt(engine.getPosition());
      }, RESCHEDULE_SETTLE_MS);
    },
    [engine, restartAt],
  );

  useEffect(() => () => window.clearTimeout(rescheduleTimerRef.current), []);
  useEffect(() => () => window.clearTimeout(clearArmTimerRef.current), []);

  const step = useCallback((from: StudioClip[][], to: StudioClip[][]) => {
    const previous = from.pop();
    if (!previous) return;
    to.push(clipsRef.current);
    setClips(previous);
    setSelectedId((current) => (previous.some((c) => c.id === current) ? current : null));
    // The engine is still playing the arrangement we just replaced. Without
    // this, undo moves the picture and leaves the sound alone — a muted clip
    // stays silent while the inspector says it is not.
    requestReschedule("now");
    syncHistory();
  }, [requestReschedule]);

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

  const editClip = useCallback(
    (
      id: string,
      edit: (clip: StudioClip) => StudioClip | null,
      options: { undoable?: boolean; reschedule?: "now" | "defer" } = {},
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
      // Once, after the whole batch. A clip the engine has never been told
      // about is not merely inaudible: the end timer is still armed for the
      // OLD timeline length, so the transport stops where the timeline used
      // to finish and the song you just dropped never plays at all.
      //
      // "defer", not "now", and the distinction is not cosmetic. addFiles is
      // async, so its setClips calls are still pending when this line runs —
      // "now" reschedules on a microtask, before React commits, and rebuilds
      // the graph from the clip list as it was BEFORE the drop. Deferring
      // lets the commit land first. (Synchronous handlers like split are fine
      // with "now" because React flushes them before microtasks run.)
      if (added > 0) requestReschedule("defer");
    },
    [t, pushUndo, requestReschedule],
  );

  const bufferDurationOf = (clip: StudioClip): number =>
    bufferMap.get(clip.bufferId)?.duration ?? clip.clipEnd;

  /**
   * One-click demo: two synthesized loops at different tempos, the second
   * overlapping the first with a crossfade — a beat switch, assembled through
   * the SAME ingest path a dropped file takes. The arrangement runs in a
   * functional setClips because addFiles' own setClips calls are still
   * pending when it resolves (see its closing comment) — `prev` is the only
   * view guaranteed to contain the new clips.
   */
  const handleDemo = useCallback(async () => {
    const files = await makeDemoFiles();
    await addFiles(files);
    setClips((prev) => {
      if (prev.length < 2) return prev;
      const a = prev[prev.length - 2];
      const b = prev[prev.length - 1];
      const overlapStart = Math.max(0, a.timelineStart + (a.clipEnd - a.clipStart) - DEMO_OVERLAP_SECONDS);
      const moved = prev.map((c) => (c.id === b.id ? moveClip(c, overlapStart) : c));
      return crossfadeOverlap(moved, b.id) ?? moved;
    });
    requestReschedule("defer");
  }, [addFiles, requestReschedule]);

  /**
   * Free whatever the session can no longer reach — decoded audio in memory,
   * source files in storage.
   *
   * Reachability is computed from the timeline AND both history stacks, which
   * is the whole point: this used to free the deleted clip's buffer on the
   * spot, so undoing the delete brought back a clip with no audio behind it
   * (silent, no waveform, unrecoverable without a page reload). A clip sitting
   * in the undo stack is still reachable, so its audio stays.
   */
  const collectGarbage = useCallback(() => {
    const reachable = reachableBufferIds(
      clipsRef.current,
      ...undoStackRef.current,
      ...redoStackRef.current,
    );
    releaseUnreachable(reachable);
    void pruneSessionFiles(reachable);
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return;
    editClip(selectedId, () => null);
    setSelectedId(null);
    collectGarbage();
  }, [selectedId, editClip, collectGarbage]);

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
    // Duplicate and crossfade already did this; split did not. The cut zeroes
    // the fades either side of it, and the halves are new clips with new ids,
    // so the running graph knows neither the new envelope nor which gain node
    // belongs to what.
    requestReschedule("now");
  }, [selectedId, engine, pushUndo, requestReschedule, t]);

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

      // The stretched buffer is 1/ratio as long, so its own time fields --
      // clipStart/clipEnd AND the fades measured against them -- scale with
      // it; scaleClipTiming is the same math scaleClipsForLock uses for a
      // whole-timeline speed lock, applied here to just this one clip.
      const { clipStart: nextClipStart, clipEnd: nextClipEnd, fadeInSec: nextFadeInSec, fadeOutSec: nextFadeOutSec } =
        scaleClipTiming(clip, ratio);

      // TEMPO ALONE IS HALF A BEATMATCH. The clip now runs at the project's
      // tempo, but its downbeat can still sit anywhere between two grid
      // lines — right speed, wrong place, which is exactly the mistake a
      // human makes by ear. So find where this clip's beats actually fall
      // and slide it (by less than half a beat) until they land on the grid.
      let nextStart = clip.timelineStart;
      // Phase comes off the CLEAN signal, never the effect-filtered one the
      // timeline draws. Where the beat sits is a property of the music; a
      // character effect is a lens over it. Measured: a 400 Hz highpass
      // (Phone) removes the kick, so the onset envelope locks onto the hat
      // sitting 25 ms behind it and the clip lands 23 ms late -- a different
      // placement for the same clip on the same grid purely because an effect
      // was on. Costs nothing extra: render() skips "none", so this is plain
      // decimation, and it's the same key the timeline uses whenever no
      // effect is active (the common case), so it usually hits cache.
      const signal = await getDisplaySignal(displayKey(id, "none", "none"), stretched, ["none", "none"]);
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
                fadeInSec: nextFadeInSec,
                fadeOutSec: nextFadeOutSec,
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

  /**
   * Per-clip pitch shift — the harmonic half of Match to grid. Same
   * mechanics: stretch the clip's CURRENT buffer (tempo 1, delta semitones),
   * register the result under a nested id, repoint the clip, accumulate the
   * total in provenance. Duration is untouched (tempo ratio 1), so no timing
   * field moves — the round-54 scaling law only applies to rate changes.
   * Restore rebuilds with ONE timeStretch(source, tempoRatio, pitchSemitones),
   * landing the buffer under clip.bufferId, so the nested live id never needs
   * to match the one-pass spelling (same convention repeated Match uses).
   */
  const handleShiftPitch = useCallback(
    async (delta: number) => {
      const clip = clipsRef.current.find((c) => c.id === selectedId);
      if (!clip || delta === 0) return;
      const current = clip.pitchSemitones ?? 0;
      const next = Math.max(-12, Math.min(12, current + delta));
      if (next === current) return;
      const applied = next - current;
      const source = bufferMap.get(clip.bufferId);
      if (!source) return;

      setWorking(true);
      setStage("rendering");
      try {
        const shifted = await getStretchedBuffer(clip.bufferId, source, 1, applied);
        const id = stretchedIdFor(clip.bufferId, 1, applied);
        bufferMap.set(id, shifted);
        // The key moves WITH the audio: transpose the readout by the applied
        // delta so the harmony hint keeps telling the truth. BPM untouched —
        // pitch at tempo 1 does not move the beat.
        const info = clipInfo.get(clip.bufferId);
        if (info) {
          noteClipInfo(id, {
            ...info,
            key: transposeKey(info.key, applied) ?? info.key,
            camelot: transposeCode(info.camelot, applied) ?? info.camelot,
          });
        }
        pushUndo();
        setClips((prev) =>
          prev.map((c) =>
            c.id === clip.id
              ? {
                  ...c,
                  bufferId: id,
                  sourceBufferId: c.sourceBufferId ?? c.bufferId,
                  pitchSemitones: next,
                }
              : c,
          ),
        );
        setStatus(t("studio.pitched", { delta: `${next >= 0 ? "+" : ""}${next}` }));
        setStatusIsError(false);
        requestReschedule("now");
      } catch {
        setStatus(t("studio.matchFailed"));
        setStatusIsError(true);
      } finally {
        setStage(null);
        setWorking(false);
      }
    },
    [selectedId, clipInfo, noteClipInfo, pushUndo, requestReschedule, t],
  );

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
    // Through moveClip, so the copy obeys the same end-of-timeline clamp as a
    // drag and a drop do. Setting timelineStart directly was the one placement
    // path that could put a clip past MAX_TIMELINE_SECONDS.
    const copy: StudioClip = moveClip(
      { ...clip, id: makeClipId() },
      clip.timelineStart + (clip.clipEnd - clip.clipStart),
    );
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
    // Bar alignment stops at the end of the audio: looping past the last clip
    // would play silence on every pass.
    const limit = timelineDuration(clipsRef.current);
    applyLoop(grid ? expandToBars(region, grid, limit) : region);
  }, [loop, selectedId, applyLoop, grid]);

  /* ----------------------- global transport keys ----------------------- */

  const [keysOpen, setKeysOpen] = useState(false);

  // Space/S/D/L/Delete work anywhere in the studio, not only while the
  // timeline div holds focus. This is the fix for the single most common
  // DAW-feel complaint: touch any slider or pill and Space went dead,
  // because the only Space handler lived on the focused track element.
  // The timeline's own handler still runs first for keys that need its
  // selection context (arrows, Home/End) — anything it preventDefaults is
  // skipped here via event.defaultPrevented.
  useEffect(() => {
    const isTyping = (el: HTMLElement | null): boolean =>
      Boolean(
        el &&
          (el.isContentEditable ||
            el.tagName === "TEXTAREA" ||
            el.tagName === "SELECT" ||
            (el.tagName === "INPUT" &&
              !/^(range|checkbox|radio|button)$/.test((el as HTMLInputElement).type))),
      );
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (isTyping(target)) return;
      if (event.key === "?") {
        event.preventDefault();
        setKeysOpen((open) => !open);
        return;
      }
      if (event.key === "Escape") {
        setKeysOpen(false);
        return; // no preventDefault — Escape keeps its other jobs
      }
      if (clipsRef.current.length === 0) return;
      if (event.key === " ") {
        // A focused button keeps its native Space activation — after
        // clicking Play, focus IS Play, so Space still toggles transport.
        if (target && (target.tagName === "BUTTON" || target.closest("button"))) return;
        event.preventDefault();
        togglePlay();
        return;
      }
      const key = event.key.toLowerCase();
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        handleDeleteSelected();
      } else if (key === "s") {
        event.preventDefault();
        handleSplitSelected();
      } else if (key === "d") {
        event.preventDefault();
        handleDuplicate();
      } else if (key === "l") {
        event.preventDefault();
        handleLoopSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, handleDeleteSelected, handleSplitSelected, handleDuplicate, handleLoopSelection]);

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

  /**
   * Start over: empty the timeline AND forget the saved copy.
   *
   * It used to do only the second half, which made it a button that
   * appeared to do nothing — the clips stayed on screen, and the very next
   * edit autosaved them straight back into the storage it had just emptied.
   *
   * Destructive, so the first click only arms it, the same way the history
   * panel guards its own wipe. The arm lapses after a few seconds so a
   * stray click cannot lie in wait.
   */
  const handleClearSession = useCallback(() => {
    if (!clearArmed) {
      setClearArmed(true);
      window.clearTimeout(clearArmTimerRef.current);
      clearArmTimerRef.current = window.setTimeout(() => setClearArmed(false), 4000);
      return;
    }
    window.clearTimeout(clearArmTimerRef.current);
    setClearArmed(false);

    stopPreview();
    releaseUnreachable(new Set());
    setClips([]);
    setSelectedId(null);
    applyLoop(null);
    // Takes are automation over an arrangement that no longer exists; leaving
    // them would apply the old performance to whatever is loaded next.
    clearTakes();
    undoStackRef.current = [];
    redoStackRef.current = [];
    syncHistory();
    void clearSession();
    setStatus(t("studio.cleared"));
    setStatusIsError(false);
  }, [clearArmed, stopPreview, applyLoop, clearTakes, t]);

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
    // Read off `recorder` rather than the destructured `takes`, which is a
    // render-time value pulled out further down next to the export code. The
    // array identity only changes when a take does, so the autosave effect
    // still fires exactly when it should.
    takes: recorder.takes,
    onHandoffFiles: (files) => void addFiles(files),
    onRestored: (saved) => {
      // Before anything else: ids minted from here on must not collide with
      // the ones coming back from disk.
      reserveClipIds(saved.clips);
      setClips(saved.clips);
      if (saved.params) setParams(saved.params);
      // The grid belongs to the earliest clip — the one the detector would
      // otherwise re-measure on mount and overwrite it with.
      const gridSource = [...saved.clips].sort(
        (a, b) => a.timelineStart - b.timelineStart,
      )[0]?.bufferId;
      if (saved.grid && gridSource) beatGrid.adoptGrid(saved.grid, gridSource);
      beatGrid.setGridOn(saved.gridOn);
      if (saved.loop) applyLoop(saved.loop);
      if (saved.pxPerSecond) setPxPerSecond(clampZoom(saved.pxPerSecond));
      // The performances belong to this arrangement; without them the mix
      // came back and the thing recorded over it did not.
      adoptTakes(saved.takes);
    },
    setStatus,
  });

  // A clip handed over by the browser extension lands the same way a dropped
  // file does — same caps, same decode, same undo entry.
  useExtensionHandoff(useCallback((files: File[]) => void addFiles(files), [addFiles]));

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
  const setReverbEq = (reverbEq: ReverbEqParams) =>
    applyParams({ ...paramsRef.current, reverbEq }, [{ t: now(), kind: "reverbEq", value: reverbEq }]);

  // A preset is just the sliders moved together: one param update, but one
  // recorded move PER CHANGED KNOB, so replaying a take reproduces the press
  // exactly and an unchanged knob records nothing.
  const applyPreset = (preset: StudioPreset) => {
    const prev = paramsRef.current;
    const next = {
      ...prev,
      speed: preset.speed,
      reverb: preset.reverb,
      bassBoostDb: preset.bassBoostDb,
      reverbType: preset.reverbType,
      effect: preset.effect,
    };
    const at = now();
    const moves: AutomationEvent[] = [];
    if (Math.abs(next.speed - prev.speed) > 1e-9) moves.push({ t: at, kind: "speed", value: next.speed });
    if (next.reverb !== prev.reverb) moves.push({ t: at, kind: "reverb", value: next.reverb });
    if (next.bassBoostDb !== prev.bassBoostDb) moves.push({ t: at, kind: "bassBoostDb", value: next.bassBoostDb });
    if (next.reverbType !== prev.reverbType) moves.push({ t: at, kind: "reverbType", value: next.reverbType });
    if (next.effect !== prev.effect) moves.push({ t: at, kind: "effect", value: next.effect });
    applyParams(next, moves);
  };

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
      // A take's startOffset is the song position it began at, on the SAME
      // plain timeline the loop region is drawn on — renderRemixAutomated
      // divides it by base speed internally (see takeOutputStart), which is
      // exactly the stretched-clock conversion clipsToBounce already went
      // through, so no extra scaling belongs here.
      //
      // Un-rebased, this used to be measured against the FULL mixdown's
      // length and handed unchanged to the LOOP-sliced one instead: any
      // event timed past the loop's own (much shorter) duration schedules
      // past the end of that render and never fires at all. A take recorded
      // once, early in the song, then bounced by looping a later section
      // came back with NONE of its automation -- the loop-only export
      // sounded exactly like no take was selected.
      //
      // Negative offsets (the take began before the window) clamp to 0
      // inside takeOutputStart, so the automation applies from the start of
      // the bounce rather than being dropped -- correct to within the take's
      // own recording latency (typically under the 120ms effect glide), not
      // exact to the sample: a fully exact version would need to collapse
      // whatever was active AT the window's start into the take's base
      // params, which is a bigger change than this bug warranted.
      const takeToBounce =
        exportLoopOnly && loop && take ? { ...take, startOffset: take.startOffset - loop.start } : take;
      const blob = await exportStudioMix(clipsToBounce, set.buffers, {
        format,
        mp3Kbps,
        params: exportParams,
        take: takeToBounce,
        onStage: setStage,
      });
      // User-typed name wins; strip filesystem-hostile characters rather than
      // rejecting (a title with a colon should still export). Empty -> the
      // same default the placeholder shows.
      const typed = exportName.trim().replace(/[\\/:*?"<>|]/g, "").slice(0, 80);
      const base = typed || `${clipsRef.current[0]?.name || "tunebad-mix"}-daw`;
      downloadBlob(blob, `${base}.${format}`);
      setStatus(t("studio.exportDone"));
    } catch {
      setStatus(t("studio.exportFailed"));
      setStatusIsError(true);
    } finally {
      setStage(null);
      setWorking(false);
    }
  }, [working, format, mp3Kbps, exportName, takes, selectedTakeId, stopPreview, buildPlaybackSet, exportLoopOnly, loop, t]);

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
          moves, and one click builds a real beat switch out of synthesized
          loops (nothing bundled, nothing licensed — see lib/studio/demo.ts). */}
      {clips.length === 0 && (
        <>
          <ul className="studio-intro">
            <li>{t("studio.introA")}</li>
            <li>{t("studio.introB")}</li>
            <li>{t("studio.introC")}</li>
          </ul>
          <button
            className="secondary-button studio-demo-button"
            type="button"
            disabled={decoding || working}
            onClick={() => void handleDemo()}
          >
            {t("studio.demoButton")}
          </button>
        </>
      )}

      {clips.length > 0 && (
        <>
          <Timeline
            clips={clips}
            signals={signals}
            masterEffect={params.effect}
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
            <button
              className="primary-button"
              type="button"
              onClick={togglePlay}
              disabled={working}
              title={`${playing ? t("studio.pause") : t("studio.play")} (Space)`}
            >
              {playing ? t("studio.pause") : t("studio.play")}
            </button>
            <button
              className={`secondary-button studio-record${recording ? " recording" : ""}`}
              type="button"
              onClick={toggleRecording}
              disabled={working || params.lockPitch}
              title={params.lockPitch ? t("studio.lockVsRecord") : t("studio.record")}
              aria-pressed={recording}
            >
              {recording ? t("studio.recordStop") : t("studio.record")}
            </button>
            {recording && (
              <span className="studio-hint" role="status">
                {t("remix.recordingReadout", {
                  time: formatTimeTenths(recorder.recordElapsed),
                  count: recorder.moveCount,
                })}
              </span>
            )}
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
              disabled={working || (!grid && !beatGrid.failure)}
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
              className={`text-button${clearArmed ? " active" : ""}`}
              type="button"
              onClick={handleClearSession}
              disabled={working || clips.length === 0}
              title={t("studio.clearSessionHint")}
            >
              {clearArmed ? t("studio.clearConfirm") : t("studio.clearSession")}
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
            <button
              className="text-button"
              type="button"
              onClick={() => setKeysOpen(true)}
              title={t("studio.keysSheetTitle")}
            >
              {t("studio.keysButton")}
            </button>
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
                // "defer", not "never": the live poke below only holds until
                // the clip's next fade point, so the schedule has to be
                // rebuilt once the drag settles.
                editClip(selectedClip.id, (c) => ({ ...c, gain }), {
                  undoable: false,
                  reschedule: "defer",
                });
                engine.setClipGain(selectedClip.id, gain);
              }}
              onFadeIn={(fadeInSec) =>
                editClip(selectedClip.id, (c) => withFadeIn(c, fadeInSec), { reschedule: "defer" })
              }
              onFadeOut={(fadeOutSec) =>
                editClip(selectedClip.id, (c) => withFadeOut(c, fadeOutSec), { reschedule: "defer" })
              }
              onFadeCurve={(fadeCurve) =>
                editClip(selectedClip.id, (c) => ({ ...c, fadeCurve }))
              }
              onEffect={(effect) =>
                // A clip effect changes the graph rather than a parameter on
                // it, so the schedule has to be rebuilt — same as any other
                // clip edit, and undoable like one.
                editClip(selectedClip.id, (c) => ({
                  ...c,
                  effect: effect === "none" ? undefined : effect,
                }))
              }
              onToggleMute={handleToggleMute}
              onToggleSolo={handleToggleSolo}
              onMatchTempo={() => void handleMatchTempo()}
              onShiftPitch={(delta) => void handleShiftPitch(delta)}
              onCrossfade={handleCrossfade}
              canCrossfade={crossfadeOverlap(clips, selectedClip.id) !== null}
              onSplit={handleSplitSelected}
              onDuplicate={handleDuplicate}
              onDelete={handleDeleteSelected}
            />
          )}

          {(beatGrid.detecting || grid || beatGrid.failure) && (
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
                  {beatGrid.failure && !grid && (
                    <span className="studio-hint">
                      {/* "No beat here" and "the detector never ran" are
                          different problems and want different next steps. */}
                      {t(beatGrid.failure === "no-beat" ? "studio.gridNone" : "studio.gridUnavailable")}
                    </span>
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
            onReverbEq={setReverbEq}
            onPreset={applyPreset}
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
              {takes.map((take) =>
                editingTakeId === take.id ? (
                  <input
                    key={take.id}
                    className="num studio-take-rename"
                    type="text"
                    defaultValue={take.label}
                    autoFocus
                    maxLength={40}
                    aria-label={t("studio.renameTake")}
                    onBlur={(e) => {
                      recorder.renameTake(take.id, e.target.value);
                      setEditingTakeId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setEditingTakeId(null);
                    }}
                  />
                ) : (
                  <span key={take.id} className="studio-take-row">
                    <button
                      className={`cutter-format-pill${selectedTakeId === take.id ? " active" : ""}`}
                      type="button"
                      title={t("studio.renameTakeHint")}
                      onClick={() => recorder.setSelectedTakeId(take.id)}
                      onDoubleClick={() => setEditingTakeId(take.id)}
                    >
                      {take.label} · {formatTimeTenths(take.outDuration)}
                    </button>
                    <button
                      className="text-button danger-pill"
                      type="button"
                      aria-label={`${t("remix.deleteTake")} ${take.label}`}
                      disabled={recording || working}
                      onClick={() => recorder.deleteTake(take.id)}
                    >
                      {t("remix.deleteTake")}
                    </button>
                  </span>
                ),
              )}
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
            {format === "mp3" && (
              <div className="cutter-format-pills" role="group" aria-label={t("mediatool.bitrate")}>
                {([128, 192, 320] as const).map((k) => (
                  <button
                    key={k}
                    className={`cutter-format-pill${mp3Kbps === k ? " active" : ""}`}
                    type="button"
                    aria-pressed={mp3Kbps === k}
                    onClick={() => setMp3Kbps(k)}
                  >
                    {k}
                  </button>
                ))}
              </div>
            )}
            <input
              className="num studio-export-name"
              type="text"
              value={exportName}
              maxLength={80}
              placeholder={`${clips[0]?.name || "tunebad-mix"}-daw`}
              aria-label={t("studio.exportName")}
              onChange={(e) => setExportName(e.target.value)}
            />
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

      {/* Shortcut sheet: one data structure, so this and the one-line hint
          cannot drift apart. Opens on "?" or the Keys button; closes on
          Escape, backdrop, or the button. */}
      {keysOpen && (
        <div className="studio-keys-backdrop" onClick={() => setKeysOpen(false)}>
          <div
            className="studio-keys-card"
            role="dialog"
            aria-modal="true"
            aria-label={t("studio.keysSheetTitle")}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{t("studio.keysSheetTitle")}</h3>
            <dl className="studio-keys-list">
              {(
                [
                  ["Space", `${t("studio.play")} / ${t("studio.pause")}`],
                  ["S", t("studio.split")],
                  ["D", t("studio.duplicate")],
                  ["L", t("studio.loop")],
                  ["⌫", t("studio.remove")],
                  ["↑ ↓", t("studio.keysSelect")],
                  ["← →", t("studio.keysNudge")],
                  ["Home / End", t("studio.keysSeek")],
                  ["+ / −", t("studio.keysZoom")],
                  ["⌘Z / ⇧⌘Z", `${t("studio.undo")} / ${t("studio.redo")}`],
                ] as const
              ).map(([combo, label]) => (
                <div className="studio-keys-row" key={combo}>
                  <dt>
                    <kbd>{combo}</kbd>
                  </dt>
                  <dd>{label}</dd>
                </div>
              ))}
            </dl>
            <button className="secondary-button" type="button" onClick={() => setKeysOpen(false)}>
              {t("studio.close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
