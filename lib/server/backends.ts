// Picks and validates which downloader backend (home Mac vs Render remote)
// a job talks to. See lib/runtime.ts for why home is preferred: YouTube
// bot-walls the Render datacenter IP but not a home IP.
import { homeDownloaderUrl, homeDownloaderKey, remoteDownloaderUrl, remoteDownloaderKey } from "@/lib/runtime";
import { UUID_PATTERN } from "@/lib/server/validate";

export type BackendTag = "home" | "remote";
export type Backend = { base: string; key: string; tag: BackendTag };

function homeBackend(): Backend | null {
  if (!homeDownloaderUrl || !homeDownloaderKey) return null;
  return { base: homeDownloaderUrl, key: homeDownloaderKey, tag: "home" };
}

function remoteBackend(): Backend | null {
  if (!remoteDownloaderUrl || !remoteDownloaderKey) return null;
  return { base: remoteDownloaderUrl, key: remoteDownloaderKey, tag: "remote" };
}

// Picks the backend a new job should start on: home if it's reachable right
// now, else remote. A 2s health-check timeout keeps this from stalling the
// POST /api/youtube request when the Mac is off or the tunnel is down.
export async function pickBackend(): Promise<Backend | null> {
  const home = homeBackend();
  if (home) {
    try {
      const res = await fetch(`${home.base}/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return home;
    } catch {
      // Unreachable or timed out — fall through to remote.
    }
  }
  return remoteBackend();
}

// Parses a prefixed job id (e.g. "home_<uuid>" / "remote_<uuid>") back into
// the backend it was created on plus the bare upstream uuid. This is the
// path-traversal / injection guard for the two proxy GET routes, so it's
// intentionally strict: bad prefix, malformed uuid, or a backend that isn't
// currently configured all return null.
export function backendForJob(jobId: string): { backend: Backend; upstreamId: string } | null {
  const separatorIndex = jobId.indexOf("_");
  if (separatorIndex === -1) return null;

  const prefix = jobId.slice(0, separatorIndex);
  const upstreamId = jobId.slice(separatorIndex + 1);
  if (!UUID_PATTERN.test(upstreamId)) return null;

  if (prefix === "home") {
    const backend = homeBackend();
    return backend ? { backend, upstreamId } : null;
  }
  if (prefix === "remote") {
    const backend = remoteBackend();
    return backend ? { backend, upstreamId } : null;
  }
  return null;
}
