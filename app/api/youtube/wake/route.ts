import { NextResponse } from "next/server";
import { remoteDownloaderUrl } from "@/lib/runtime";

// Fires a fire-and-forget health ping at the remote downloader to wake it
// from Render's free-tier idle spin-down, without waiting for the full
// spin-up. Leaks nothing (just a health check), so no auth is required.
export async function GET() {
  if (remoteDownloaderUrl) {
    void fetch(`${remoteDownloaderUrl}/health`, { signal: AbortSignal.timeout(3000) }).catch(() => {});
  }
  return new NextResponse(null, { status: 204 });
}
