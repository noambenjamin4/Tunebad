"use client";

import { usePathname } from "next/navigation";
import { useTunebad, VIEW_TO_PATH, type ViewName } from "../TunebadApp";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n/locales/en";
import { useLocalizedPath } from "@/lib/i18n/LocaleBoundary";

// Nav items in display order. Most are SPA views; a few are standalone pages
// that live outside TunebadApp and so navigate for real.
//
// This used to be two things — a TABS array plus hand-written <a> tags after
// it — which meant an out-of-SPA link could only ever be appended at the end.
// One ordered list, so an item's position is a property of the item rather
// than of where its markup happens to sit.
type NavItem =
  | { page: ViewName; labelKey: DictKey }
  | { href: string; labelKey: DictKey };

const ITEMS: NavItem[] = [
  { page: "converter", labelKey: "nav.converter" },
  { page: "analysis", labelKey: "nav.analysis" },
  // Third on purpose. The DAW does the one thing none of the others can —
  // several songs on a single timeline — and until now the only way to reach
  // it was a card partway down the More tools page.
  { href: "/daw", labelKey: "nav.daw" },
  { page: "delay", labelKey: "nav.delay" },
  { page: "bpm", labelKey: "nav.bpm" },
  { page: "pitch", labelKey: "nav.pitch" },
  { page: "loudness", labelKey: "nav.loudness" },
  { page: "remix", labelKey: "nav.remix" },
  { page: "cutter", labelKey: "nav.cutter" },
  { href: "/audio-mastering", labelKey: "nav.mastering" },
  { page: "history", labelKey: "nav.history" },
  { href: "/tools", labelKey: "nav.moreTools" },
];

export function NavTabs({ onNavigate }: { onNavigate?: () => void }) {
  const { view, showView } = useTunebad();
  const { t } = useI18n();
  const pathname = usePathname();
  const localized = useLocalizedPath();

  return (
    <>
      {ITEMS.map((item) => {
        // A standalone page: a plain link, no SPA intercept.
        if ("href" in item) {
          const active = pathname === item.href;
          return (
            <a
              key={item.href}
              className={`ghost-button${active ? " active" : ""}`}
              href={localized(item.href)}
              aria-current={active ? "page" : undefined}
              onClick={() => onNavigate?.()}
            >
              {t(item.labelKey)}
            </a>
          );
        }
        // An SPA tab. The real href keeps it crawlable and lets cmd/ctrl-click
        // open a tab; a plain left-click stays in the SPA.
        const active = view === item.page;
        return (
          <a
            key={item.page}
            className={`ghost-button${active ? " active" : ""}`}
            href={localized(VIEW_TO_PATH[item.page])}
            aria-current={active ? "page" : undefined}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
              event.preventDefault();
              showView(item.page);
              onNavigate?.();
            }}
          >
            {t(item.labelKey)}
          </a>
        );
      })}
    </>
  );
}
