import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { allowLookup } from "@/lib/server/rate-limit";
import { findMixMatches } from "@/lib/server/mix-matches";

// "Mixes well with this" suggestions for a freshly analyzed track: songs from
// the community catalog whose Camelot code is harmonically compatible and
// whose tempo is beatmatchable (within a pitch-fader nudge, or half/double
// time). Pure catalog reads, so responses can be stale by an hour. Scoring
// lives in lib/server/mix-matches.ts, shared with the /song/[slug] page.
export const maxDuration = 15;

const querySchema = z.object({
  camelot: z.string().regex(/^(1[0-2]|[1-9])[AB]$/i),
  bpm: z.coerce.number().min(30).max(300),
});

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

  const similar = await findMixMatches(parsed.data.camelot.toUpperCase(), parsed.data.bpm, "");

  return NextResponse.json(
    { similar },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
