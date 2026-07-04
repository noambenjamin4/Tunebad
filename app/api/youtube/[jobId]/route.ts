import { NextResponse } from "next/server";
import { jobs, publicJob } from "@/lib/server/jobs";
import { UUID_PATTERN } from "@/lib/server/validate";
import { isDownloaderEnabled, remoteDownloaderUrl, remoteDownloaderKey } from "@/lib/runtime";

// Fast once the remote instance is awake, but harmless to allow more headroom.
export const maxDuration = 30;

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  if (!isDownloaderEnabled) return new NextResponse("Not found", { status: 404 });

  const { jobId } = await params;
  if (!UUID_PATTERN.test(jobId)) {
    return NextResponse.json({ error: "Invalid job id." }, { status: 400 });
  }

  if (remoteDownloaderUrl && remoteDownloaderKey) {
    try {
      const upstream = await fetch(`${remoteDownloaderUrl}/job/${jobId}`, {
        headers: { "x-api-key": remoteDownloaderKey },
      });
      const payload = await upstream.json().catch(() => ({}));
      return NextResponse.json(payload, { status: upstream.status });
    } catch (error) {
      console.error("Failed to reach remote downloader", error);
      return NextResponse.json({ error: "Could not reach the download server." }, { status: 502 });
    }
  }

  const job = jobs.get(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found. It may have expired." }, { status: 404 });
  }
  return NextResponse.json(publicJob(job));
}
