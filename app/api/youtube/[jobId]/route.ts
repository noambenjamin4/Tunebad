import { NextResponse } from "next/server";
import { jobs, publicJob } from "@/lib/server/jobs";
import { UUID_PATTERN } from "@/lib/server/validate";
import { isDownloaderEnabled } from "@/lib/runtime";
import { backendForJob } from "@/lib/server/backends";

// Fast once the remote instance is awake, but harmless to allow more headroom.
export const maxDuration = 30;

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  if (!isDownloaderEnabled) return new NextResponse("Not found", { status: 404 });

  const { jobId } = await params;

  const proxy = await backendForJob(jobId);
  if (proxy) {
    try {
      const upstream = await fetch(`${proxy.backend.base}/job/${proxy.upstreamId}`, {
        headers: { "x-api-key": proxy.backend.key },
      });
      const payload = await upstream.json().catch(() => ({}));
      return NextResponse.json(payload, { status: upstream.status });
    } catch (error) {
      console.error(`Failed to reach ${proxy.backend.tag} downloader`, error);
      return NextResponse.json({ error: "Could not reach the download server." }, { status: 502 });
    }
  }

  // No prefixed backend matched. Only fall back to the in-process local path
  // for a bare (unprefixed) uuid — anything else (bad prefix, bad uuid,
  // referencing an unconfigured backend) is invalid.
  if (!UUID_PATTERN.test(jobId)) {
    return NextResponse.json({ error: "Invalid job id." }, { status: 400 });
  }

  const job = jobs.get(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found. It may have expired." }, { status: 404 });
  }
  return NextResponse.json(publicJob(job));
}
