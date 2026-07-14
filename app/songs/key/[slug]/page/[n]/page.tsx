import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KeyHubPage, keyHubMeta } from "@/components/songs/KeyHubPage";

// /songs/key/<slug>/page/<n> — pages 2+ of a key hub.
//
// These exist for crawl reach: the hub readers are newest-first with a 300-row
// cap, so without pagination the union of every hub reached only ~8% of the
// catalog and ~109,000 song pages had no internal inbound links at all. Not
// prerendered (there are ~400 of them and they change as the catalog grows) —
// dynamicParams + ISR resolves each on first request, same as /song/[slug].
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; n: string }>;
}): Promise<Metadata> {
  const { slug, n } = await params;
  const page = Number(n);
  const meta = Number.isInteger(page) && page > 1 ? keyHubMeta(slug, page) : null;
  if (!meta) return { title: "Not found | TuneBad", robots: { index: false, follow: true } };
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: meta.canonical },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string; n: string }> }) {
  const { slug, n } = await params;
  const page = Number(n);
  // Page 1 has its own canonical URL (/songs/key/<slug>) — don't serve it here
  // too, and don't accept junk like /page/0 or /page/abc.
  if (!Number.isInteger(page) || page < 2) notFound();
  return <KeyHubPage slug={slug} page={page} />;
}
