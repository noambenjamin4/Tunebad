import { NextRequest, NextResponse } from "next/server";
import { startJobSchema, validateMediaUrl } from "@/lib/server/validate";
import { allowJobStart } from "@/lib/server/rate-limit";
import { runningJobCount } from "@/lib/server/jobs";
import { SetupError, startYouTubeJob } from "@/lib/server/ytdlp";
import { isDownloaderEnabled, remoteDownloaderUrl, remoteDownloaderKey } from "@/lib/runtime";

const MAX_CONCURRENT_JOBS = 2;

// Render's free instances spin down when idle and cold-start in ~50s; Fluid
// Compute is enabled on the Vercel project so 60s is allowed on Hobby.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!isDownloaderEnabled) return new NextResponse("Not found", { status: 404 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowJobStart(ip)) {
    return NextResponse.json({ error: "Too many downloads started. Wait a few minutes and try again." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = startJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide a YouTube URL and a quality of 320, 256, 192, or 128." }, { status: 400 });
  }

  const canonical = validateMediaUrl(parsed.data.url);
  if (!canonical) {
    return NextResponse.json(
      { error: "Paste a YouTube, SoundCloud, Bandcamp, Vimeo, Mixcloud, or Audiomack link." },
      { status: 400 },
    );
  }

  // Never forward unvalidated input — the body reaching the remote server is
  // the zod-parsed and canonicalized data, not the raw request body.
  if (remoteDownloaderUrl && remoteDownloaderKey) {
    try {
      const upstream = await fetch(`${remoteDownloaderUrl}/job`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": remoteDownloaderKey },
        body: JSON.stringify({
          url: canonical.url,
          quality: parsed.data.quality,
          format: parsed.data.format,
          trimSilence: parsed.data.trimSilence,
        }),
      });
      const payload = await upstream.json().catch(() => ({}));
      return NextResponse.json(payload, { status: upstream.status });
    } catch (error) {
      console.error("Failed to reach remote downloader", error);
      return NextResponse.json({ error: "Could not start the download." }, { status: 502 });
    }
  }

  if (runningJobCount() >= MAX_CONCURRENT_JOBS) {
    return NextResponse.json({ error: "Two downloads are already running. Let one finish first." }, { status: 429 });
  }

  try {
    const job = await startYouTubeJob(
      canonical.url,
      canonical.platform,
      parsed.data.quality,
      parsed.data.format,
      parsed.data.trimSilence,
    );
    return NextResponse.json({ jobId: job.id }, { status: 202 });
  } catch (error) {
    if (error instanceof SetupError) {
      return NextResponse.json({ code: error.code }, { status: 503 });
    }
    console.error("Failed to start YouTube job", error);
    return NextResponse.json({ error: "Could not start the download." }, { status: 500 });
  }
}
