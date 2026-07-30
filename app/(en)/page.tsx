import { TunebadApp } from "@/components/TunebadApp";
import { LandingSeo } from "@/components/layout/LandingSeo";
import { countSongs } from "@/lib/server/link-analysis";

// The song count refreshes hourly with the catalog (countSongs caches for 3600s).
// 1 day (REVALIDATE_HUB in lib/cache-policy.ts — must be a literal here;
// Next.js statically analyses route segment config). Grows with the catalog,
// but a few thousand new rows a day does not make a day-old listing wrong.
export const revalidate = 86400;

export default async function Home() {
  // Homepage-only slot. LandingSeo is a client component that localizes after
  // hydration, but its SSR output is English (the i18n provider's default), so
  // the content + FAQPage JSON-LD still land in the crawlable initial HTML.
  const songCount = await countSongs();
  return <TunebadApp landingSlot={<LandingSeo songCount={songCount ?? undefined} />} />;
}
