import { NextResponse } from "next/server";
import { jobs, publicJob } from "@/lib/server/jobs";
import { UUID_PATTERN } from "@/lib/server/validate";
import { isDownloaderEnabled } from "@/lib/runtime";

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
  return NextResponse.json(publicJob(job));
}
