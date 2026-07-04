"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { YtJobPublic } from "@/types/analysis";
import { useI18n } from "@/lib/i18n";

const POLL_MS = 1500;
const MAX_CONCURRENT = 2;

export interface PlaylistItem {
  id: string;
  title: string | null;
}

export type PlaylistRowPhase = "queued" | "working" | "done" | "error";

export interface PlaylistRowState {
  id: string;
  title: string | null;
  phase: PlaylistRowPhase;
  progress: number;
  jobId: string | null;
  error: string | null;
}

interface BatchOptions {
  format: string;
  quality: string;
}

// Client-orchestrated playlist batch: each row is a normal single-video job
// against the EXISTING POST /api/youtube pipeline (same as useYouTubeJob),
// just run through a small worker pool instead of one at a time. No
// server-side multi-file job exists or is needed.
export function usePlaylistBatch(items: PlaylistItem[], { format, quality }: BatchOptions) {
  const { t } = useI18n();
  const [rows, setRows] = useState<PlaylistRowState[]>(() =>
    items.map((item) => ({ id: item.id, title: item.title, phase: "queued", progress: 0, jobId: null, error: null })),
  );
  const cancelledRef = useRef(false);

  useEffect(() => {
    setRows(items.map((item) => ({ id: item.id, title: item.title, phase: "queued", progress: 0, jobId: null, error: null })));
    cancelledRef.current = false;
    // Only reset when the underlying item set changes — format/quality
    // changes are captured by the runBatch closure below, not here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const updateRow = useCallback((id: string, patch: Partial<PlaylistRowState>) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, []);

  const pollJob = useCallback(
    (id: string, jobId: string) =>
      new Promise<void>((resolve) => {
        const tick = async () => {
          if (cancelledRef.current) {
            resolve();
            return;
          }
          let job: YtJobPublic;
          try {
            const response = await fetch(`/api/youtube/${jobId}`);
            if (!response.ok) throw new Error();
            job = await response.json();
          } catch {
            updateRow(id, { phase: "error", error: t("ytDownloader.lostTrack") });
            resolve();
            return;
          }
          if (cancelledRef.current) {
            resolve();
            return;
          }
          if (job.status === "done") {
            updateRow(id, { phase: "done", progress: 100 });
            resolve();
          } else if (job.status === "error") {
            updateRow(id, { phase: "error", error: job.error || t("ytDownloader.downloadFailedFallback") });
            resolve();
          } else {
            updateRow(id, { phase: "working", progress: job.progress });
            setTimeout(tick, POLL_MS);
          }
        };
        void tick();
      }),
    [t, updateRow],
  );

  const runOne = useCallback(
    async (item: PlaylistItem) => {
      if (cancelledRef.current) return;
      updateRow(item.id, { phase: "working", progress: 0, error: null });

      let response: Response;
      try {
        response = await fetch("/api/youtube", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: `https://www.youtube.com/watch?v=${item.id}`,
            quality,
            format,
            trimSilence: false,
          }),
        });
      } catch {
        updateRow(item.id, { phase: "error", error: t("ytDownloader.couldNotReachServer") });
        return;
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.jobId) {
        updateRow(item.id, { phase: "error", error: payload.error || t("ytDownloader.couldNotStart") });
        return;
      }

      updateRow(item.id, { jobId: payload.jobId });
      await pollJob(item.id, payload.jobId);
    },
    [format, quality, pollJob, t, updateRow],
  );

  const runBatch = useCallback(async () => {
    cancelledRef.current = false;
    const queue = [...items];
    const workers = Array.from({ length: Math.min(MAX_CONCURRENT, queue.length) }, async () => {
      while (queue.length > 0 && !cancelledRef.current) {
        const next = queue.shift();
        if (!next) break;
        await runOne(next);
      }
    });
    await Promise.all(workers);
  }, [items, runOne]);

  useEffect(() => {
    void runBatch();
    return () => {
      cancelledRef.current = true;
    };
    // Only re-run the batch when the item set changes; format/quality are
    // fixed for the lifetime of a given PlaylistBatch mount (chosen once at
    // submit time), matching the "respect format+quality for the whole
    // batch" requirement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const doneCount = rows.filter((row) => row.phase === "done" || row.phase === "error").length;

  return { rows, doneCount, total: items.length };
}
