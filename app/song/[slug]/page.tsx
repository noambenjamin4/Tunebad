import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readAnalysisBySlug, readAllSongs, type CachedAnalysis } from "@/lib/server/link-analysis";

// Programmatic per-song pages, one for every track in the shared link-analysis
// cache. Statically generated for the songs known at build time and filled in
// on demand (ISR) as the cache grows from live "analyze from link" usage.
export const revalidate = 3600;
export const dynamicParams = true;

const SITE_URL = "https://www.tunebad.com";

export async function generateStaticParams() {
  const songs = await readAllSongs(2000);
  return songs.map((s) => ({ slug: s.slug }));
}

function displayTitle(song: CachedAnalysis): string {
  return song.artist ? `${song.title} by ${song.artist}` : song.title;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const song = await readAnalysisBySlug(slug);
  if (!song) return { title: "Song not found | TuneBad", robots: { index: false, follow: true } };
  const name = displayTitle(song);
  const alt = song.bpm_alt ? ` (or ${Math.round(song.bpm_alt)})` : "";
  return {
    title: `${name} — Key, BPM & Camelot`,
    description: `${name} is in the key of ${song.key} at ${Math.round(song.bpm)} BPM${alt}, Camelot ${song.camelot ?? "N/A"}. See its energy, danceability, and loudness, or analyze your own track free on TuneBad.`,
    alternates: { canonical: `/song/${song.slug}` },
    openGraph: {
      title: `${name} — Key & BPM`,
      description: `Key ${song.key}, ${Math.round(song.bpm)} BPM, Camelot ${song.camelot ?? "N/A"}.`,
      url: `${SITE_URL}/song/${song.slug}`,
    },
  };
}

function pct(v: number | null): string {
  return v == null ? "N/A" : `${Math.round(v * 100)}`;
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="metric-card">
      <small>{label}</small>
      <strong className="analysis-value">{value}</strong>
      <em>{note}</em>
    </div>
  );
}

export default async function SongPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const song = await readAnalysisBySlug(slug);
  if (!song) notFound();

  const name = displayTitle(song);
  const bpm = Math.round(song.bpm);
  const bpmAlt = song.bpm_alt ? Math.round(song.bpm_alt) : null;

  // A few other cached songs to cross-link (internal links = crawlability).
  const others = (await readAllSongs(60))
    .filter((s) => s.slug !== song.slug)
    .slice(0, 8);

  const musicJsonLd = {
    "@context": "https://schema.org",
    "@type": "MusicRecording",
    name: song.title,
    ...(song.artist ? { byArtist: { "@type": "MusicGroup", name: song.artist } } : {}),
    url: `${SITE_URL}/song/${song.slug}`,
    ...(song.duration_s ? { duration: `PT${Math.round(song.duration_s)}S` } : {}),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Songs", item: `${SITE_URL}/songs` },
      { "@type": "ListItem", position: 2, name, item: `${SITE_URL}/song/${song.slug}` },
    ],
  };

  return (
    <div className="app-shell">
      <header className="legal-topbar">
        <Link href="/" className="brand" aria-label="TuneBad, back to home">
          <span className="brand-logo-wrap">
            <picture>
              <source media="(prefers-color-scheme: dark)" srcSet="/logo-dark.png" />
              <img src="/logo-light.png" alt="" width={34} height={34} className="brand-logo" />
            </picture>
          </span>
          <span className="brand-wordmark">TUNEBAD</span>
        </Link>
      </header>

      <main>
        <article className="song-page">
          <p className="song-crumb">
            <Link href="/songs">Songs</Link> / {song.key} · {bpm} BPM
          </p>
          <h1 className="song-title">
            {song.title}
            {song.artist ? <span className="song-artist"> by {song.artist}</span> : null}
          </h1>
          <p className="song-lede">
            Key, BPM, and Camelot for {name}, plus its energy, danceability, and loudness.
          </p>

          <div className="summary-grid song-stats">
            <Stat label="BPM" value={bpmAlt ? `${bpm} or ${bpmAlt}` : String(bpm)} note="Tempo" />
            <Stat label="Key" value={song.key} note="Musical key" />
            <Stat label="Camelot" value={song.camelot ?? "N/A"} note="For harmonic mixing" />
            <Stat label="Energy" value={pct(song.energy)} note="Out of 100" />
            <Stat label="Danceability" value={pct(song.danceability)} note="Out of 100" />
            <Stat label="Loudness" value={song.loudness_db != null ? `${song.loudness_db}` : "N/A"} note="dBFS" />
          </div>

          <p className="song-note">
            These figures come from analyzing an official 30-second preview of the track with
            TuneBad&rsquo;s in-browser engine. Tempo and key are reliable, but a preview is a sample of
            the full song, so treat them as a strong estimate. Want an exact read on your own file?
          </p>

          <p className="song-cta">
            <Link href="/key-bpm-finder" className="song-cta-button">
              Analyze a song yourself
            </Link>
          </p>

          {others.length > 0 && (
            <section className="song-related">
              <h2>Other songs</h2>
              <ul>
                {others.map((s) => (
                  <li key={s.slug}>
                    <Link href={`/song/${s.slug}`}>
                      {s.title}
                      {s.artist ? ` — ${s.artist}` : ""}
                    </Link>
                    <span className="song-related-meta">
                      {" "}
                      {s.key} · {Math.round(s.bpm)} BPM
                    </span>
                  </li>
                ))}
              </ul>
              <p className="song-related-all">
                <Link href="/songs">Browse all songs →</Link>
              </p>
            </section>
          )}
        </article>
      </main>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="site-footer-brand">
            <picture>
              <source media="(prefers-color-scheme: dark)" srcSet="/logo-dark.png" />
              <img src="/logo-light.png" alt="" width={24} height={24} className="site-footer-logo" loading="lazy" />
            </picture>
            <span className="site-footer-wordmark">TUNEBAD</span>
          </div>
          <p className="site-footer-copyright">© 2026 TuneBad</p>
        </div>
      </footer>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(musicJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
    </div>
  );
}
