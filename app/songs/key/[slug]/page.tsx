import type { Metadata } from "next";
import { ALL_KEYS, keyToSlug } from "@/lib/audio/harmonic";
import { KeyHubPage, keyHubMeta } from "@/components/songs/KeyHubPage";

// Key hub pages: /songs/key/g-sharp-minor etc. One per canonical key, listing
// songs in that key — the "songs in G# minor" search intent. Page 2+ lives at
// /songs/key/<slug>/page/<n> and shares the same renderer, which is what makes
// the whole catalog internally reachable (see components/songs/KeyHubPage.tsx).
// 1 day (REVALIDATE_HUB in lib/cache-policy.ts — must be a literal here;
// Next.js statically analyses route segment config). Grows with the catalog,
// but a few thousand new rows a day does not make a day-old listing wrong.
export const revalidate = 86400;

export function generateStaticParams() {
  return ALL_KEYS.map((k) => ({ slug: keyToSlug(k) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = keyHubMeta(slug, 1);
  if (!meta) return { title: "Not found | TuneBad", robots: { index: false, follow: true } };
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: meta.canonical },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <KeyHubPage slug={slug} page={1} />;
}
