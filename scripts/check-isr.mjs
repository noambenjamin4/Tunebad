// Build gate: the ISR windows the pages DECLARE must be the ones the build
// actually produced.
//
// Why this exists: in the App Router, the minimum fetch-level revalidate used
// during a render silently becomes the route's ISR window. That mechanism
// re-broke the July 15 billing fix once already — /song/[slug] declared
// `revalidate = false` while its Supabase reads carried `revalidate: 86_400`,
// so every one of ~163k song pages went back to regenerating per crawl
// (1.4M ISR writes/month was what originally paused the Vercel account).
// The declaration and the manifest agreed-looking code CAN disagree; only
// .next/prerender-manifest.json tells the truth, so assert on it after every
// build.
//
// Run after `next build`: node scripts/check-isr.mjs

import { readFileSync } from "node:fs";

const MANIFEST = ".next/prerender-manifest.json";

let manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
} catch {
  console.error(`check-isr: cannot read ${MANIFEST} — run next build first`);
  process.exit(1);
}

const routes = manifest.routes ?? {};
const songRoutes = Object.keys(routes).filter((r) => r.startsWith("/song/"));
const artistRoutes = Object.keys(routes).filter((r) => r.startsWith("/artist/"));

// CI builds without Supabase env prerender zero song pages — the check is
// then vacuous, which is fine: the real assertion runs on any full build
// (local or Vercel, where the env exists).
if (songRoutes.length === 0) {
  console.log("check-isr: no /song/* routes in manifest (no-DB build) — nothing to assert");
  process.exit(0);
}

const badSongs = songRoutes.filter((r) => routes[r].initialRevalidateSeconds !== false);
const badArtists = artistRoutes.filter(
  (r) => routes[r].initialRevalidateSeconds !== 604_800 && routes[r].initialRevalidateSeconds !== false,
);

if (badSongs.length > 0) {
  const sample = badSongs[0];
  console.error(
    `check-isr: FAIL — ${badSongs.length}/${songRoutes.length} /song/* routes have a numeric ` +
      `initialRevalidateSeconds (e.g. ${sample}: ${routes[sample].initialRevalidateSeconds}). ` +
      `A fetch in the song-page render is carrying a revalidate window; it must use READ_IMMUTABLE ` +
      `(see lib/server/link-analysis.ts) or the page regenerates per crawl and ISR writes explode.`,
  );
  process.exit(1);
}

if (badArtists.length > 0) {
  const sample = badArtists[0];
  console.error(
    `check-isr: FAIL — ${badArtists.length}/${artistRoutes.length} /artist/* routes deviate from ` +
      `their declared weekly window (e.g. ${sample}: ${routes[sample].initialRevalidateSeconds}). ` +
      `A fetch in the artist-page render is clamping it; pass READ_WEEKLY (lib/server/link-analysis.ts).`,
  );
  process.exit(1);
}

console.log(
  `check-isr: OK — ${songRoutes.length} /song/* routes at false, ` +
    `${artistRoutes.length} /artist/* routes at their declared window`,
);
