import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { jobs } from "@/lib/server/jobs";
import { mediaPathForJob } from "@/lib/server/ytdlp";
import { UUID_PATTERN } from "@/lib/server/validate";
import { isDownloaderEnabled } from "@/lib/runtime";

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
      "Content-Type": job.format === "wav" ? "audio/wav" : "audio/mpeg",
      "Content-Length": String(size),
      "Content-Disposition": contentDisposition(job.title, job.videoId, job.format),
      "Cache-Control": "no-store",
    },
  });
}
