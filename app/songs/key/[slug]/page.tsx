import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readSongsByKey } from "@/lib/server/link-analysis";
import { ALL_KEYS, keyToSlug, slugToKey, compatibleCodes, relationLabel } from "@/lib/audio/harmonic";
import { camelot } from "@/lib/audio/constants";
import { SITE_URL } from "@/lib/site";

// Key hub pages: /songs/key/g-sharp-minor etc. One per canonical key, listing
// every analyzed song in that key — the "songs in G# minor" search intent.
export const revalidate = 3600;

export function generateStaticParams() {
  return ALL_KEYS.map((k) => ({ slug: keyToSlug(k) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const key = slugToKey(slug);
  if (!key) return { title: "Not found | TuneBad", robots: { index: false, follow: true } };
  const code = camelot[key];
  return {
    title: `Songs in ${key} (Camelot ${code}) — Key & BPM List`,
    description: `A list of songs in the key of ${key}, Camelot ${code}, with the BPM of each track. Useful for DJs building harmonic sets and producers hunting samples in ${key}.`,
    alternates: { canonical: `/songs/key/${slug}` },
  };
}

export default async function KeyHubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const key = slugToKey(slug);
  if (!key) notFound();

  const songs = await readSongsByKey(key, 300);
  if (songs.length === 0) notFound();

  const code = camelot[key];
  const compat = compatibleCodes(code);
  const compatKeys = compat
    .map((c) => {
      const k = (Object.entries(camelot).find(([, v]) => v === c) ?? [])[0];
      return k ? { key: k, code: c, rel: relationLabel(code, c) } : null;
    })
    .filter((x): x is { key: string; code: string; rel: string } => x !== null);

  const listJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Songs in ${key}`,
    numberOfItems: songs.length,
    itemListElement: songs.slice(0, 50).map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/song/${s.slug}`,
      name: s.artist ? `${s.title} by ${s.artist}` : s.title,
    })),
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
            <Link href="/songs">Songs</Link> / {key}
          </p>
          <h1 className="song-title">Songs in {key}</h1>
          <p className="song-lede">
            {songs.length} analyzed {songs.length === 1 ? "song" : "songs"} in the key of{" "}
            <strong>{key}</strong>, Camelot <strong>{code}</strong>. On the Camelot wheel, tracks in{" "}
            {code} mix cleanly with {compat.join(", ")} — so this list is a starting pool for
            harmonic sets around {key}.
          </p>

          {compatKeys.length > 0 && (
            <section className="song-section">
              <h2>Keys that mix with {key}</h2>
              <ul className="song-keychips">
                {compatKeys.map((k) => (
                  <li key={k.code}>
                    <span className="song-keychip">{k.code}</span>
                    <Link href={`/songs/key/${keyToSlug(k.key)}`} className="song-keychip-rel">
                      {k.key} ({k.rel})
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="song-section">
            <h2>The list</h2>
            <ul className="song-index">
              {songs.map((s) => (
                <li key={s.slug}>
                  <Link href={`/song/${s.slug}`}>
                    <span className="song-index-name">
                      {s.title}
                      {s.artist ? <span className="song-index-artist"> — {s.artist}</span> : null}
                    </span>
                    <span className="song-index-meta font-mono">
                      {Math.round(s.bpm)} BPM{s.camelot ? ` · ${s.camelot}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <p className="song-note">
            Keys are measured from official 30-second previews with TuneBad&rsquo;s in-browser engine.
            Have a track that is not here? <Link href="/key-bpm-finder">Analyze it yourself</Link> — free,
            no account, and your file never leaves your device. To understand the wheel, read the{" "}
            <Link href="/guides/camelot-wheel-harmonic-mixing">Camelot wheel guide</Link>.
          </p>

          <p className="song-related-all">
            <Link href="/songs">Browse all songs →</Link>
          </p>
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

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listJsonLd) }} />
    </div>
  );
}
