// Shared building blocks for the hand-rolled sitemap shards (replaces the old
// single-file app/sitemap.ts, which caps out at 50k URLs — this catalog is
// headed well past that once songs + artist pages are both counted).
//
// Route handlers can't use next-sitemap's MetadataRoute typed helpers, so
// these emit raw XML strings directly per the sitemaps.org schema.

import { SITE_URL } from "@/lib/site";

// Re-exported so the sitemap route handlers keep their existing import.
export { SITE_URL };

// Song URLs per shard. 20,000 keeps each shard file comfortably under the
// sitemap protocol's 50k-URL / 50MB-uncompressed caps with headroom.
export const SONGS_PER_SHARD = 20000;

// How many song URLs we ADVERTISE to search engines. This is a free-tier
// safety limit, not a technical one — deliberately far below the 217k songs
// actually in the catalog.
//
// Two costs scale directly with it, both of which have already taken the site
// down or come close:
//
//  1. Vercel ISR writes. Only 2,000 song pages are prerendered at build; the
//     rest are `dynamicParams` pages generated on first request, and each
//     generation is one ISR write. Hobby allows ~200k writes/month (the
//     2026-07-15 pause logged 1.4M as 695% of the limit). Advertising the
//     whole catalog meant a single thorough Google crawl — ~160k crawl
//     requests/month observed in Search Console — could exceed the cap by
//     itself, and EVERY DEPLOY drops the ISR cache so the next crawl pays it
//     again. At 25k the same crawl costs ~25k writes, leaving room for several
//     deploys a month.
//
//  2. Supabase egress. The sitemap index calls readAllSongs(SONGS_CAP), which
//     reads every column of every song — ~49 MB uncapped, once per day at
//     REVALIDATE_SITEMAP. That alone was ~1.5 GB/month against Supabase Free's
//     5 GB. At 25k it's ~6 MB/day.
//
// Pages outside this cap still render fine when visited or linked; they just
// aren't pushed to Google for crawling. Raising it trades uptime for reach —
// re-check both budgets above before you do.
export const SONGS_CAP = 25000;

type UrlEntry = {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
};

type SitemapEntry = {
  loc: string;
  lastmod?: string;
};

// Slugs are already URL-safe (alnum + hyphens), but escape XML entities
// anyway — the artist column is free text and a stray "&" would produce
// invalid XML if it ever leaked into a URL.
export function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function urlsetXml(urls: UrlEntry[]): string {
  const body = urls
    .map((u) => {
      const parts = [`    <loc>${escapeXml(u.loc)}</loc>`];
      if (u.lastmod) parts.push(`    <lastmod>${u.lastmod}</lastmod>`);
      if (u.changefreq) parts.push(`    <changefreq>${u.changefreq}</changefreq>`);
      if (u.priority != null) parts.push(`    <priority>${u.priority}</priority>`);
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function sitemapIndexXml(sitemaps: SitemapEntry[]): string {
  const body = sitemaps
    .map((s) => {
      const parts = [`    <loc>${escapeXml(s.loc)}</loc>`];
      if (s.lastmod) parts.push(`    <lastmod>${s.lastmod}</lastmod>`);
      return `  <sitemap>\n${parts.join("\n")}\n  </sitemap>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

export function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Belt-and-suspenders: `export const revalidate = 3600` on the route
      // handlers gives Next's Data Cache / ISR the same interval, but pin it
      // in the response header too in case a route handler's ISR behavior
      // ever changes under a Next upgrade.
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
