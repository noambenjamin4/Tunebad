"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { decodeAudioFile } from "@/lib/audio/decode";
import type { RemixParams } from "@/lib/audio/remix";
import type { BeatGrid } from "@/lib/studio/beat-grid";
import { bufferMap } from "@/lib/studio/buffer-store";
import { getStretchedBuffer } from "@/lib/studio/lock-pitch";
import {
  clearSession,
  loadArrangement,
  loadSessionFiles,
  saveArrangement,
} from "@/lib/studio/session";
import type { StudioClip } from "@/lib/studio/timeline";
import { takeStudioFiles } from "@/lib/files/tool-handoff";

/** What a restore hands back once its audio is decoded and usable. */
export interface RestoredArrangement {
  clips: StudioClip[];
  params: RemixParams | null;
  grid: BeatGrid | null;
  gridOn: boolean;
  loop: { start: number; end: number } | null;
  pxPerSecond: number | null;
}

interface SessionOptions {
  /** Live arrangement — autosaved, debounced, once restore has settled. */
  clips: StudioClip[];
  params: RemixParams;
  grid: BeatGrid | null;
  loop: { start: number; end: number } | null;
  gridOn: boolean;
  pxPerSecond: number;
  /** Files arriving from another tool's "Open in DAW" button. */
  onHandoffFiles: (files: File[]) => void;
  /** Apply a recovered arrangement to component state. */
  onRestored: (arrangement: RestoredArrangement) => void;
  setStatus: (status: string) => void;
}

/**
 * Restore-on-mount and autosave for the DAW.
 *
 * Restoring is more than reading JSON: the audio lives in IndexedDB as the
 * original compressed Files, so each one is decoded again, and any clip that
 * was beatmatched has to have its stretched buffer rebuilt from the origin
 * and the ratio it recorded (session.ts stores the provenance rather than
 * ~40 MB of derivable PCM). Clips whose audio can't be rebuilt are dropped —
 * a silent clip that looks fine is worse than a missing one.
 *
 * Autosave is parked until restore has settled, or the empty state that
 * exists while the decode runs would be saved over the real session.
 */
export function useStudioSession(options: SessionOptions): void {
  const { t } = useI18n();
  const [restoring, setRestoring] = useState(false);
  const restoredRef = useRef(false);

  // The restore effect runs exactly once, so it reads its callbacks through a
  // ref instead of listing them as deps — an identity change mid-decode must
  // not restart a restore that is already half-applied.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const { onHandoffFiles, onRestored, setStatus } = optionsRef.current;

    // Files handed off from the joiner / cutter / slowed-reverb pages take
    // precedence over a saved session — arriving with a file is an explicit
    // "work on this", not "carry on where I left off".
    const handoff = takeStudioFiles();
    if (handoff && handoff.length > 0) {
      restoredRef.current = true;
      onHandoffFiles(handoff);
      return;
    }

    const saved = loadArrangement();
    if (!saved) {
      restoredRef.current = true;
      return;
    }
    let cancelled = false;
    setRestoring(true);
    setStatus(t("studio.restoring"));
    void (async () => {
      try {
        const files = await loadSessionFiles();
        for (const [id, file] of files) {
          if (cancelled) return;
          if (bufferMap.has(id)) continue;
          try {
            const { buffer } = await decodeAudioFile(file);
            bufferMap.set(id, buffer);
          } catch {
            // A source that no longer decodes drops its clips below.
          }
        }
        for (const clip of saved.clips) {
          if (cancelled) return;
          if (!clip.sourceBufferId || !clip.tempoRatio || bufferMap.has(clip.bufferId)) continue;
          const origin = bufferMap.get(clip.sourceBufferId);
          if (!origin) continue;
          const stretched = await getStretchedBuffer(
            clip.sourceBufferId,
            origin,
            clip.tempoRatio,
          );
          bufferMap.set(clip.bufferId, stretched);
        }
        if (cancelled) return;
        const usable = saved.clips.filter((c) => bufferMap.has(c.bufferId));
        if (usable.length === 0) {
          void clearSession();
          setStatus("");
          return;
        }
        optionsRef.current.onRestored({
          clips: usable,
          params: (saved.params as RemixParams | null) ?? null,
          grid: (saved.grid as BeatGrid | null) ?? null,
          gridOn: saved.gridOn !== false,
          loop: saved.loop ?? null,
          pxPerSecond: saved.pxPerSecond ?? null,
        });
        setStatus(t("studio.restored"));
      } catch {
        setStatus("");
      } finally {
        if (!cancelled) {
          setRestoring(false);
          restoredRef.current = true;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { clips, params, grid, loop, gridOn, pxPerSecond } = options;

  // Debounced: dragging a clip fires this on every pointer move.
  useEffect(() => {
    if (!restoredRef.current || restoring) return;
    const timer = window.setTimeout(() => {
      if (clips.length === 0) {
        void clearSession();
        return;
      }
      saveArrangement({ clips, params, grid, loop, gridOn, pxPerSecond });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [clips, params, grid, loop, gridOn, pxPerSecond, restoring]);
}
