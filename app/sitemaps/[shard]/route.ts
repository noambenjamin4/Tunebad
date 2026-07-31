import { groupSongsByArtist } from "@/lib/server/artists";
import { ALL_KEYS, keyToSlug } from "@/lib/audio/harmonic";
import { ACTIVITIES } from "@/lib/server/activities";
import { HUB_PAGE_SIZE } from "@/components/songs/HubPagination";
import { LOCALE_CODES } from "@/lib/i18n/codes";
import { isLocalizedPath } from "@/lib/seo/hreflang";
import { SITE_URL, SONGS_CAP, SONGS_PER_SHARD, urlsetXml, xmlResponse } from "@/lib/server/sitemap";
import { readSongFacets, readSongSlugRange } from "@/lib/server/link-analysis";

// Individual sitemap shards, listed by app/sitemap.xml/route.ts's index:
//   - "static": tools/guides/landing/static pages (ported 1:1 from the old
//     single-file app/sitemap.ts, minus the hub and song routes below, which
//     now live in their own shards so this one never grows). Also carries
//     the /songs/bpm-for/<activity> pages — a fixed, hardcoded set (not
//     derived from the catalog), so they belong here rather than in "hubs".
//   - "songs-0", "songs-1", ...: 20,000 song URLs each (SONGS_PER_SHARD),
//     sliced from the same readAllSongs(SONGS_CAP) call the index uses to
//     compute the shard count, so the two stay in sync.
//   - "hubs": key hubs, Camelot hubs, BPM hubs, and artist pages — same
//     emptiness rules as the pages themselves (key/Camelot hubs need >0
//     songs, BPM hubs need >=3 in the ±2 window, artist pages need >=2
//     songs) so this never links to a 404.
// 1 day (REVALIDATE_SITEMAP in lib/cache-policy.ts — must be a literal here;
// Next.js statically analyses route segment config). Crawlers re-fetch sitemaps
// constantly, which is exactly why they must not regenerate on every fetch.
export const revalidate = 86400;

type ToolEntry = { path: string; changefreq: string; priority: number };

// Exact list from the old app/sitemap.ts's tool()/guide() calls and inline
// entries, minus `...hubRoutes` and `...songRoutes` (now their own shards).
const STATIC_ENTRIES: ToolEntry[] = [
  { path: "/", changefreq: "weekly", priority: 1 },
  { path: "/playlist-analyzer", changefreq: "weekly", priority: 0.8 },
  { path: "/key-bpm-finder", changefreq: "weekly", priority: 0.9 },
  { path: "/converter", changefreq: "weekly", priority: 0.9 },
  { path: "/loudness", changefreq: "weekly", priority: 0.9 },
  { path: "/slowed-reverb", changefreq: "weekly", priority: 0.9 },
  { path: "/mp3-cutter", changefreq: "weekly", priority: 0.9 },
  { path: "/pitch-shifter", changefreq: "weekly", priority: 0.9 },
  { path: "/delay-reverb-calculator", changefreq: "weekly", priority: 0.9 },
  { path: "/bpm-tap", changefreq: "weekly", priority: 0.9 },
  { path: "/camelot-wheel", changefreq: "weekly", priority: 0.9 },
  { path: "/guides/find-key-and-bpm-of-any-song", changefreq: "monthly", priority: 0.6 },
  { path: "/guides/camelot-wheel-harmonic-mixing", changefreq: "monthly", priority: 0.6 },
  { path: "/guides/what-is-lufs-streaming-loudness", changefreq: "monthly", priority: 0.6 },
  { path: "/guides/how-to-make-slowed-and-reverb", changefreq: "monthly", priority: 0.6 },
  { path: "/guides/how-to-make-a-ringtone", changefreq: "monthly", priority: 0.6 },
  { path: "/guides/how-to-make-a-beat-switch", changefreq: "monthly", priority: 0.6 },
  { path: "/guides/how-to-compress-a-video-for-discord", changefreq: "monthly", priority: 0.6 },
  { path: "/guides/how-to-convert-a-youtube-link-to-mp3", changefreq: "monthly", priority: 0.6 },
  { path: "/tunebad-vs-tunebat", changefreq: "monthly", priority: 0.6 },
  { path: "/tools", changefreq: "weekly", priority: 0.8 },
  { path: "/guides", changefreq: "monthly", priority: 0.7 },
  { path: "/extension", changefreq: "monthly", priority: 0.7 },
  { path: "/image-converter", changefreq: "weekly", priority: 0.9 },
  { path: "/compress-image", changefreq: "weekly", priority: 0.9 },
  { path: "/resize-image", changefreq: "weekly", priority: 0.9 },
  { path: "/resize-image-for-instagram", changefreq: "weekly", priority: 0.9 },
  { path: "/compress-image-to-100kb", changefreq: "weekly", priority: 0.9 },
  { path: "/heic-to-jpg", changefreq: "weekly", priority: 0.9 },
  { path: "/compress-video", changefreq: "weekly", priority: 0.9 },
  { path: "/compress-video-for-discord", changefreq: "weekly", priority: 0.9 },
  { path: "/compress-video-for-whatsapp", changefreq: "weekly", priority: 0.9 },
  { path: "/video-converter", changefreq: "weekly", priority: 0.9 },
  { path: "/audio-converter", changefreq: "weekly", priority: 0.9 },
  { path: "/mkv-to-mp4", changefreq: "weekly", priority: 0.9 },
  { path: "/mov-to-mp4", changefreq: "weekly", priority: 0.9 },
  { path: "/flac-to-mp3", changefreq: "weekly", priority: 0.9 },
  { path: "/wav-to-mp3", changefreq: "weekly", priority: 0.9 },
  { path: "/merge-pdf", changefreq: "weekly", priority: 0.9 },
  { path: "/split-pdf", changefreq: "weekly", priority: 0.9 },
  { path: "/jpg-to-pdf", changefreq: "weekly", priority: 0.9 },
  { path: "/unzip-files", changefreq: "weekly", priority: 0.9 },
  { path: "/audio-mastering", changefreq: "weekly", priority: 0.9 },
  { path: "/nightcore-maker", changefreq: "weekly", priority: 0.9 },
  { path: "/bass-booster", changefreq: "weekly", priority: 0.9 },
  { path: "/8d-audio", changefreq: "weekly", priority: 0.9 },
  { path: "/audio-joiner", changefreq: "weekly", priority: 0.9 },
  { path: "/daw", changefreq: "weekly", priority: 0.9 },
  { path: "/songs", changefreq: "daily", priority: 0.7 },
  { path: "/history", changefreq: "weekly", priority: 0.3 },
  { path: "/privacy", changefreq: "yearly", priority: 0.3 },
  { path: "/copyright", changefreq: "yearly", priority: 0.3 },
];

export async function GET(_req: Request, { params }: { params: Promise<{ shard: string }> }) {
  const { shard } = await params;
  const now = new Date().toISOString();

  if (shard === "static") {
    // No lastmod on purpose: these pages have no tracked modification date,
    // and a lastmod that is always the render time is worse than none (the
    // same rule the song shard documents below) — Google learns the signal
    // lies and discounts it for the whole site.
    // Routes with localized variants also list /<locale><path> for the 7
    // non-EN locales — discovery only; the hreflang cluster itself is
    // page-level <link> tags (a valid standalone mechanism per Google).
    const expanded = STATIC_ENTRIES.flatMap((e) =>
      isLocalizedPath(e.path)
        ? [
            e,
            ...LOCALE_CODES.filter((c) => c !== "en").map((c) => ({
              ...e,
              path: `/${c}${e.path}`,
              priority: 0.7,
            })),
          ]
        : [e],
    );
    const xml = urlsetXml(
      expanded.map((e) => ({
        loc: `${SITE_URL}${e.path}`,
        changefreq: e.changefreq,
        priority: e.priority,
      })),
    );
    return xmlResponse(xml);
  }

  const songShardMatch = /^songs-(\d+)$/.exec(shard);
  if (songShardMatch) {
    const shardIndex = Number(songShardMatch[1]);
    // Read ONLY this shard's window, slug column only. Previously every shard
    // read the whole catalog (select=*, up to SONGS_CAP rows) and sliced 20k
    // out of it — 10x the rows and ~10x the bytes per shard, and it got worse
    // with every song added.
    const start = shardIndex * SONGS_PER_SHARD;
    // Clamp the LAST shard to whatever budget is left, not a full page. Gating
    // only on `start < SONGS_CAP` let the final shard return a whole
    // SONGS_PER_SHARD window past the cap — with a 25k cap and 20k shards that
    // published 40k URLs, 60% over budget. SONGS_CAP is an ISR-write and
    // egress limit (see lib/server/sitemap.ts), so overshooting it is the
    // thing that takes the site down.
    const remaining = Math.min(SONGS_PER_SHARD, SONGS_CAP - start);
    const slice = remaining <= 0 ? [] : await readSongSlugRange(start, remaining);
    // Shard 0 always resolves (even to an empty urlset pre-launch); any
    // higher shard index that's out of range is a stale/guessed URL, 404 it.
    // (notFound() from next/navigation only works inside the React render
    // tree — this is a plain Route Handler, so a real 404 Response is used.)
    if (slice.length === 0 && shardIndex > 0) {
      return new Response("Not found", { status: 404 });
    }
    // Per-song lastmod from the row's own created_at, NOT the shard's render
    // time. A lastmod that is always "now" is worse than none: Google learns
    // the signal is untrustworthy and ignores it. Song pages are
    // revalidate=false — their content is fixed at analysis time — so
    // created_at IS the true last-modified date, and it never churns. This is
    // one of the few honest levers for moving pages from "discovered" to
    // "indexed". created_at is already selected by readSongSlugRange, so this
    // costs zero extra query. Date.parse guards a malformed value (never
    // observed — 0 nulls — but one bad row must not 500 the whole shard).
    const songLastmod = (raw: string | undefined): string => {
      const t = raw ? Date.parse(raw) : NaN;
      return Number.isNaN(t) ? now : new Date(t).toISOString();
    };
    const xml = urlsetXml(
      slice.map((s) => ({
        loc: `${SITE_URL}/song/${s.slug}`,
        lastmod: songLastmod(s.created_at),
        changefreq: "monthly",
        priority: 0.5,
      })),
    );
    return xmlResponse(xml);
  }

  if (shard === "hubs") {
    // Facet columns only — the counts never touch title/artist/energy/etc.
    const songs = await readSongFacets(SONGS_CAP);

    const keyCounts = new Map<string, number>();
    const bpmCounts = new Map<number, number>();
    const camelotCounts = new Map<string, number>();
    for (const s of songs) {
      keyCounts.set(s.key, (keyCounts.get(s.key) ?? 0) + 1);
      const b = Math.round(s.bpm);
      for (let n = b - 2; n <= b + 2; n += 1) bpmCounts.set(n, (bpmCounts.get(n) ?? 0) + 1);
      if (s.camelot) {
        const c = s.camelot.toUpperCase();
        camelotCounts.set(c, (camelotCounts.get(c) ?? 0) + 1);
      }
    }

    // Hub URLs carry no lastmod — same honesty rule as the static shard: an
    // always-"now" lastmod teaches Google to ignore the field site-wide.
    // Paginated pages (/page/2..N) are emitted alongside page 1: they were in
    // NO shard at all before, so the crawl surface they exist to provide
    // (numbered access deep into the catalog) was invisible to the crawler.
    const hubPages = (count: number, base: string, priority: number) => {
      const totalPages = Math.max(1, Math.ceil(count / HUB_PAGE_SIZE));
      return Array.from({ length: totalPages - 1 }, (_, i) => ({
        loc: `${base}/page/${i + 2}`,
        changefreq: "weekly",
        priority,
      }));
    };

    const keyUrls = ALL_KEYS.filter((k) => (keyCounts.get(k) ?? 0) > 0).flatMap((k) => [
      {
        loc: `${SITE_URL}/songs/key/${keyToSlug(k)}`,
        changefreq: "weekly",
        priority: 0.6,
      },
      ...hubPages(keyCounts.get(k) ?? 0, `${SITE_URL}/songs/key/${keyToSlug(k)}`, 0.4),
    ]);

    // 1A..12A, 1B..12B — same code list the /camelot-wheel table and the
    // /songs/camelot/[code] page's generateStaticParams use.
    const allCamelotCodes = [
      ...Array.from({ length: 12 }, (_, i) => `${i + 1}A`),
      ...Array.from({ length: 12 }, (_, i) => `${i + 1}B`),
    ];
    const camelotUrls = allCamelotCodes
      .filter((c) => (camelotCounts.get(c) ?? 0) > 0)
      .flatMap((c) => [
        {
          loc: `${SITE_URL}/songs/camelot/${c.toLowerCase()}`,
          changefreq: "weekly",
          priority: 0.6,
        },
        ...hubPages(camelotCounts.get(c) ?? 0, `${SITE_URL}/songs/camelot/${c.toLowerCase()}`, 0.4),
      ]);

    const bpmUrls = [...bpmCounts.entries()]
      .filter(([bpm, count]) => bpm >= 40 && bpm <= 220 && count >= 3)
      .map(([bpm]) => ({
        loc: `${SITE_URL}/songs/bpm/${bpm}`,
        changefreq: "weekly",
        priority: 0.55,
      }));

    // Same >=3-songs gate as app/songs/bpm-for/[activity]/page.tsx, so an
    // activity whose BPM window is still thin (e.g. sleep at 50-70 in a
    // chart-heavy catalog) stays out of the sitemap until it resolves.
    const activityUrls = ACTIVITIES.filter(
      (a) => songs.filter((s) => s.bpm != null && s.bpm >= a.min && s.bpm <= a.max).length >= 3,
    ).map((a) => ({
      loc: `${SITE_URL}/songs/bpm-for/${a.slug}`,
      changefreq: "monthly",
      priority: 0.5,
    }));

    // Same >=2-songs rule as app/artist/[slug]/page.tsx, so every URL here
    // resolves to a real page (no dynamicParams surprises for the crawler).
    const artistUrls = [...groupSongsByArtist(songs).values()]
      .filter((a) => a.songs.length >= 2)
      .map((a) => ({
        loc: `${SITE_URL}/artist/${a.slug}`,
        changefreq: "weekly",
        priority: 0.5,
      }));

    const xml = urlsetXml([...keyUrls, ...camelotUrls, ...bpmUrls, ...activityUrls, ...artistUrls]);
    return xmlResponse(xml);
  }

  return new Response("Not found", { status: 404 });
}
