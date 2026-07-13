// Shared "mixes well with" matching: harmonic (Camelot) + tempo (±6%, or
// half/double-time) compatibility. Backs both /api/similar (client-side
// "analyze a link" results) and the /song/[slug] page's server-rendered
// "Mixes well with" section. Keep the scoring rules here, in one place.
import { readSongsByCamelot, type CachedAnalysis } from "@/lib/server/link-analysis";
import { camelotNeighbors } from "@/lib/audio/harmonic";

export type MixMatch = {
  slug: string;
  title: string;
  artist: string | null;
  key: string;
  bpm: number;
  camelot: string | null;
};

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

/** Rank already-fetched candidate rows by harmonic + tempo compatibility with
 *  `camelot`/`targetBpm`. Pure function, no fetching — lets callers that
 *  already hold a batch of same-code-family rows (the song page) reuse the
 *  scoring without an extra round trip. */
export function rankMixMatches(
  rows: CachedAnalysis[],
  camelot: string,
  targetBpm: number,
  resultLimit = 6,
): MixMatch[] {
  const code = camelot.trim().toUpperCase();
  return rows
    .filter((r) => typeof r.bpm === "number" && bpmDistance(r.bpm, targetBpm) <= BPM_TOLERANCE)
    .sort((a, b) => {
      // Same-key matches first (the safest blend), then by tempo closeness.
      const sameA = a.camelot === code ? 0 : 1;
      const sameB = b.camelot === code ? 0 : 1;
      if (sameA !== sameB) return sameA - sameB;
      return bpmDistance(a.bpm, targetBpm) - bpmDistance(b.bpm, targetBpm);
    })
    .slice(0, resultLimit)
    .map((r) => ({
      slug: r.slug,
      title: r.title,
      artist: r.artist,
      key: r.key,
      bpm: r.bpm,
      camelot: r.camelot,
    }));
}

/** Fetch + rank in one call. Used by /api/similar, where the caller has only
 *  a camelot/bpm pair (a freshly analyzed track, not yet a cached row) and
 *  needs its own over-fetch from the catalog. */
export async function findMixMatches(
  camelot: string,
  targetBpm: number,
  excludeSlug: string,
  opts: { fetchLimit?: number; resultLimit?: number } = {},
): Promise<MixMatch[]> {
  const codes = camelotNeighbors(camelot);
  if (codes.length === 0) return [];
  // Over-fetch so the BPM filter still has enough candidates to pick from.
  const rows = await readSongsByCamelot(codes, excludeSlug, opts.fetchLimit ?? 60);
  return rankMixMatches(rows, camelot, targetBpm, opts.resultLimit ?? 6);
}
