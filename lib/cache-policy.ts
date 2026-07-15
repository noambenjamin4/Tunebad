// ISR revalidate windows, in seconds.
//
// WHY THIS FILE EXISTS. Every page shipped with `revalidate = 3600` — a
// one-hour window applied uniformly, whether the page's content changed hourly
// or never. On 2026-07-15 that uniformity paused the whole Vercel account:
//
//     ISR Writes   1,389,440 / 200,000   (695% of the Hobby limit)
//
// The arithmetic is the whole story. An ISR write happens when a request
// arrives for a page whose window has expired — the page regenerates and is
// re-stored. With ~130k `/song/[slug]` pages on `dynamicParams = true` and a
// 1-hour window, EVERY crawler visit lands on an expired page, so crawl volume
// converts 1:1 into writes. Googlebot working through the catalog ~11x in a
// month is ~1.4M writes. That is exactly what was billed. The same
// regeneration is also why Fluid Active CPU hit 300% of its limit — an ISR
// write is compute, not just storage.
//
// THE RULE: a page's window should match how often its content ACTUALLY
// changes, not how fresh we would like it to feel. A song's BPM and key are
// fixed the moment it is analysed; re-deriving them every hour buys nothing and
// costs a write each time. Freshness that no one can observe is not freshness.
//
// A deploy invalidates the entire ISR cache regardless of these windows, so a
// long window never means stale-forever — it means "until the next deploy, or
// this long, whichever comes first". Since this project deploys often, these
// windows are effectively an upper bound that rarely binds.
//
// DO NOT lower these back toward an hour to make a page "feel live". If a page
// genuinely needs sub-hour freshness, give it an on-demand revalidation trigger
// (revalidatePath/revalidateTag from the writer) instead of making every
// crawler pay for a poll.
//
// WHY THE PAGES USE LITERALS AND NOT THESE CONSTANTS. Next.js route segment
// config (`export const revalidate`) must be STATICALLY ANALYSABLE — the build
// reads the value out of the module without executing it, so a literal is
// required and an imported constant or an expression (`60 * 60`) is rejected.
// Each page therefore repeats its number and cites this file by name. The
// duplication is forced by the framework, not a choice. REVALIDATE_DATA below
// is a plain runtime fetch option with no such constraint, so it is imported
// for real. If you change a window here, grep for the literal and change it at
// the page too — `grep -rn "export const revalidate" app/`.

/**
 * Per-song and per-artist facts: BPM, key, camelot, duration.
 *
 * These are immutable properties of the recording — once analysed, a track's
 * tempo does not change. 30 days is a formality; in practice a deploy refreshes
 * these long before the window expires. This is the setting that matters: these
 * two routes are ~130k of the site's ~130k ISR pages.
 */
export const REVALIDATE_SONG = 2_592_000; // 30 days

/**
 * Artist pages: the facts are static, but an artist gains songs as the seeder
 * runs, so the song LIST can grow. A week keeps additions visible without
 * paying per crawl.
 */
export const REVALIDATE_ARTIST = 604_800; // 7 days

/**
 * Hub, listing, and browse pages (/songs, /songs/key/*, /songs/bpm/*,
 * /songs/camelot/*, /songs/bpm-for/*, home).
 *
 * These genuinely change as the catalog grows, but there are only a few hundred
 * of them, and the catalog grows by a few thousand rows a day — a day-old
 * listing is not meaningfully wrong. Cheap to refresh daily, pointless hourly.
 */
export const REVALIDATE_HUB = 86_400; // 1 day

/**
 * Sitemaps. Crawlers re-fetch these constantly, which is exactly why they must
 * not regenerate on each fetch. Daily matches how fast the catalog grows and
 * how often search engines act on a sitemap anyway.
 */
export const REVALIDATE_SITEMAP = 86_400; // 1 day

/**
 * Upstream Supabase reads (`next: { revalidate }` on fetch).
 *
 * This is the Data Cache, NOT the ISR page cache — it dedupes the REST calls
 * behind a render. Keeping it a day means a page regeneration that DOES fire
 * usually costs zero Supabase round-trips.
 */
export const REVALIDATE_DATA = 86_400; // 1 day
