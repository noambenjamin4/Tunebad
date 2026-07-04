import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { jobs } from "@/lib/server/jobs";
import { mediaPathForJob } from "@/lib/server/ytdlp";
import { UUID_PATTERN } from "@/lib/server/validate";
import { isDownloaderEnabled } from "@/lib/runtime";
import { backendForJob } from "@/lib/server/backends";

export const maxDuration = 60;

const CONTENT_TYPE_BY_FORMAT: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  mp4: "video/mp4",
};

function contentDisposition(title: string | null, sourceLabel: string, ext: string): string {
  const fallback = sourceLabel ? `tuner-${sourceLabel}.${ext}` : `tuner-download.${ext}`;
  const base = (title || "").replace(/[^\w\s.-]/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
  const asciiName = base ? `${base}.${ext}` : fallback;
  const utf8Name = encodeURIComponent(title ? `${title.slice(0, 120)}.${ext}` : fallback);
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  if (!isDownloaderEnabled) return new NextResponse("Not found", { status: 404 });

  const { jobId } = await params;

  const proxy = await backendForJob(jobId);
  if (proxy) {
    let upstream: Response;
    try {
      upstream = await fetch(`${proxy.backend.base}/job/${proxy.upstreamId}/file`, {
        headers: { "x-api-key": proxy.backend.key },
      });
    } catch (error) {
      console.error(`Failed to reach ${proxy.backend.tag} downloader`, error);
      return NextResponse.json({ error: "Could not reach the download server." }, { status: 502 });
    }

    if (!upstream.ok || !upstream.body) {
      const payload = await upstream.json().catch(() => ({ error: "That download isn't finished." }));
      return NextResponse.json(payload, { status: upstream.status || 502 });
    }

    const headers: Record<string, string> = { "Cache-Control": "no-store" };
    const contentType = upstream.headers.get("content-type");
    const contentDispositionHeader = upstream.headers.get("content-disposition");
    const contentLength = upstream.headers.get("content-length");
    if (contentType) headers["Content-Type"] = contentType;
    if (contentDispositionHeader) headers["Content-Disposition"] = contentDispositionHeader;
    if (contentLength) headers["Content-Length"] = contentLength;

    return new Response(upstream.body, { headers });
  }

  // No prefixed backend matched. Only fall back to the in-process local path
  // for a bare (unprefixed) uuid — anything else is invalid.
  if (!UUID_PATTERN.test(jobId)) {
    return NextResponse.json({ error: "Invalid job id." }, { status: 400 });
  }

  const job = jobs.get(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found. It may have expired." }, { status: 404 });
  }
  if (job.status !== "done") {
    return NextResponse.json({ error: "That download isn't finished." }, { status: 409 });
  }

  const filePath = mediaPathForJob(job);
  let size: number;
  try {
    size = (await stat(filePath)).size;
  } catch {
    return NextResponse.json({ error: "The file has been cleaned up. Start the download again." }, { status: 410 });
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": CONTENT_TYPE_BY_FORMAT[job.format] || "application/octet-stream",
      "Content-Length": String(size),
      "Content-Disposition": contentDisposition(job.title, job.videoId, job.format),
      "Cache-Control": "no-store",
    },
  });
}
