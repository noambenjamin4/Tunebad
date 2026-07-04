import { NextResponse } from "next/server";
import { remoteDownloaderUrl, homeDownloaderUrl } from "@/lib/runtime";

// Fires fire-and-forget health pings at both downloader backends to wake
// them (Render's free-tier idle spin-down; the home tunnel/server may also
// be asleep), without waiting for either to finish. Leaks nothing (just a
// health check) and takes no user input, so no auth is required.
export async function GET() {
  if (homeDownloaderUrl) {
    void fetch(`${homeDownloaderUrl}/health`, { signal: AbortSignal.timeout(2000) }).catch(() => {});
  }
  if (remoteDownloaderUrl) {
    void fetch(`${remoteDownloaderUrl}/health`, { signal: AbortSignal.timeout(3000) }).catch(() => {});
  }
  return new NextResponse(null, { status: 204 });
}
