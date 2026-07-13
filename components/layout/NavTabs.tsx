"use client";

import { usePathname } from "next/navigation";
import { useTunebad, VIEW_TO_PATH, type ViewName } from "../TunebadApp";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n/locales/en";

// SPA tabs, in display order. History is intentionally NOT here — it renders
// after the standalone Mastering link so the nav reads
// ...MP3 Cutter, Mastering, History, More tools.
const TABS: { page: ViewName; labelKey: DictKey }[] = [
  { page: "converter", labelKey: "nav.converter" },
  { page: "analysis", labelKey: "nav.analysis" },
  { page: "delay", labelKey: "nav.delay" },
  { page: "bpm", labelKey: "nav.bpm" },
  { page: "pitch", labelKey: "nav.pitch" },
  { page: "loudness", labelKey: "nav.loudness" },
  { page: "remix", labelKey: "nav.remix" },
  { page: "cutter", labelKey: "nav.cutter" },
];

const HISTORY_TAB: { page: ViewName; labelKey: DictKey } = { page: "history", labelKey: "nav.history" };

export function NavTabs({ onNavigate }: { onNavigate?: () => void }) {
  const { view, showView } = useTunebad();
  const { t } = useI18n();
  const pathname = usePathname();

  // One renderer for the SPA tabs (real hrefs keep them crawlable and let
  // cmd/ctrl-click open a tab; a plain left-click stays in the SPA).
  const renderTab = (tab: { page: ViewName; labelKey: DictKey }) => (
    <a
      key={tab.page}
      className={`ghost-button${view === tab.page ? " active" : ""}`}
      href={VIEW_TO_PATH[tab.page]}
      aria-current={view === tab.page ? "page" : undefined}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        showView(tab.page);
        onNavigate?.();
      }}
    >
      {t(tab.labelKey)}
    </a>
  );

  return (
    <>
      {TABS.map(renderTab)}
      {/* Real navigation out of the SPA: mastering lives on a standalone page,
          so no showView intercept — placed before History per the desired order. */}
      <a
        className={`ghost-button${pathname === "/audio-mastering" ? " active" : ""}`}
        href="/audio-mastering"
        aria-current={pathname === "/audio-mastering" ? "page" : undefined}
        onClick={() => onNavigate?.()}
      >
        {t("nav.mastering")}
      </a>
      {renderTab(HISTORY_TAB)}
      <a className="ghost-button" href="/tools" onClick={() => onNavigate?.()}>
        {t("nav.moreTools")}
      </a>
    </>
  );
}
