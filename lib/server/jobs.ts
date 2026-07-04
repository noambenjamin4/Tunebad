import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ChildProcess } from "node:child_process";
import type { YtFormat, YtJobPublic, YtJobStatus } from "@/types/analysis";

export interface YtJob {
  id: string;
  videoId: string;
  format: YtFormat;
  status: YtJobStatus;
  progress: number;
  title: string | null;
  error?: string;
  workdir: string;
  createdAt: number;
  child?: ChildProcess;
}

const JOB_TTL_MS = 30 * 60 * 1000;
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;

export const YT_BASE_DIR = path.join(os.tmpdir(), "tuner-yt");

// Stored on globalThis so dev-mode HMR re-evaluation doesn't orphan jobs.
const globalStore = globalThis as unknown as {
  __tunerJobs?: Map<string, YtJob>;
  __tunerJobsSweeper?: ReturnType<typeof setInterval>;
};

export const jobs = (globalStore.__tunerJobs ??= new Map<string, YtJob>());

// No boot-time wipe of YT_BASE_DIR: dev-mode module re-evaluation makes any
// "run once per process" cleanup racy against live jobs. Finished workdirs are
// removed by the TTL sweep below, and the OS owns os.tmpdir() leftovers.

if (!globalStore.__tunerJobsSweeper) {
  globalStore.__tunerJobsSweeper = setInterval(() => void sweepJobs(), SWEEP_INTERVAL_MS);
  globalStore.__tunerJobsSweeper.unref?.();
}

export async function sweepJobs(): Promise<void> {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL_MS) {
      try {
        job.child?.kill("SIGKILL");
      } catch {
        // already exited
      }
      jobs.delete(id);
      await new Promise((resolve) => setTimeout(resolve, 50));
      await rm(job.workdir, { recursive: true, force: true });
    }
  }
}

export function runningJobCount(): number {
  let count = 0;
  for (const job of jobs.values()) {
    if (job.status === "starting" || job.status === "downloading" || job.status === "converting") count += 1;
  }
  return count;
}

export function publicJob(job: YtJob): YtJobPublic {
  return { status: job.status, progress: job.progress, title: job.title, error: job.error };
}
