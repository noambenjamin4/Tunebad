import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validatePlaylistUrl } from "@/lib/media-url";
import { isDownloaderEnabled, remoteDownloaderUrl, remoteDownloaderKey, homeDownloaderUrl, homeDownloaderKey } from "@/lib/runtime";
import { pickBackend } from "@/lib/server/backends";
import { enumeratePlaylist } from "@/lib/server/ytdlp";

// Enumerating a playlist is a metadata-only fetch (no ffmpeg, no job/workdir),
// so this route deliberately does not run it through allowJobStart / the
// job-start rate limiter — see server/server.js's /playlist handler.
export const maxDuration = 60;

const playlistRequestSchema = z.object({
  url: z.string().max(2048),
});

export async function POST(request: NextRequest) {
  if (!isDownloaderEnabled) return new NextResponse("Not found", { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = playlistRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide a YouTube playlist URL." }, { status: 400 });
  }

  const canonicalPlaylistUrl = validatePlaylistUrl(parsed.data.url);
  if (!canonicalPlaylistUrl) {
    return NextResponse.json({ error: "Paste a YouTube playlist link." }, { status: 400 });
  }

  const homeConfigured = Boolean(homeDownloaderUrl && homeDownloaderKey);
  const remoteConfigured = Boolean(remoteDownloaderUrl && remoteDownloaderKey);

  if (homeConfigured || remoteConfigured) {
    const backend = await pickBackend();
    if (!backend) {
      return NextResponse.json({ error: "Could not read that playlist." }, { status: 502 });
    }

    try {
      const upstream = await fetch(`${backend.base}/playlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": backend.key },
        body: JSON.stringify({ url: canonicalPlaylistUrl }),
      });
      const payload = await upstream.json().catch(() => ({}));
      return NextResponse.json(payload, { status: upstream.status });
    } catch (error) {
      console.error(`Failed to reach ${backend.tag} downloader`, error);
      return NextResponse.json({ error: "Could not read that playlist." }, { status: 502 });
    }
  }

  try {
    const items = await enumeratePlaylist(canonicalPlaylistUrl);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("Failed to enumerate playlist", error);
    return NextResponse.json({ error: "Could not read that playlist." }, { status: 502 });
  }
}
