import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { allowLookup } from "@/lib/server/rate-limit";
import { readSongsByCamelot } from "@/lib/server/link-analysis";
import { camelotNeighbors } from "@/lib/audio/harmonic";

// "Mixes well with this" suggestions for a freshly analyzed track: songs from
// the community catalog whose Camelot code is harmonically compatible and
// whose tempo is beatmatchable (within a pitch-fader nudge, or half/double
// time). Pure catalog reads, so responses can be stale by an hour.
export const maxDuration = 15;

const querySchema = z.object({
  camelot: z.string().regex(/^(1[0-2]|[1-9])[AB]$/i),
  bpm: z.coerce.number().min(30).max(300),
});

// A ±6% window is what a DJ can comfortably ride on a pitch fader.
const BPM_TOLERANCE = 0.06;

function bpmDistance(candidate: number, target: number): number {
  // Relative distance to the target, its half-time, or its double-time —
  // whichever framing the candidate sits closest to.
  let best = Infinity;
  for (const anchor of [target, target / 2, target * 2]) {
    best = Math.min(best, Math.abs(candidate - anchor) / anchor);
  }
  return best;
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowLookup(ip)) {
    return NextResponse.json({ error: "rateLimited" }, { status: 429 });
  }

  const parsed = querySchema.safeParse({
    camelot: request.nextUrl.searchParams.get("camelot") ?? "",
    bpm: request.nextUrl.searchParams.get("bpm") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const code = parsed.data.camelot.toUpperCase();
  const targetBpm = parsed.data.bpm;

  // Same key + one step either way on the wheel + relative major/minor.
  const codes = camelotNeighbors(code);
  // Over-fetch so the BPM filter still has enough candidates to pick from.
  const rows = await readSongsByCamelot(codes, "", 60);

  const similar = rows
    .filter((r) => typeof r.bpm === "number" && bpmDistance(r.bpm, targetBpm) <= BPM_TOLERANCE)
    .sort((a, b) => {
      // Same-key matches first (the safest blend), then by tempo closeness.
      const sameA = a.camelot === code ? 0 : 1;
      const sameB = b.camelot === code ? 0 : 1;
      if (sameA !== sameB) return sameA - sameB;
      return bpmDistance(a.bpm, targetBpm) - bpmDistance(b.bpm, targetBpm);
    })
    .slice(0, 6)
    .map((r) => ({
      slug: r.slug,
      title: r.title,
      artist: r.artist,
      key: r.key,
      bpm: r.bpm,
      camelot: r.camelot,
    }));

  return NextResponse.json(
    { similar },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
