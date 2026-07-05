"use client";

import { useTunebad, type ViewName } from "../TunebadApp";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n/locales/en";

const TABS: { page: ViewName; labelKey: DictKey }[] = [
  { page: "converter", labelKey: "nav.converter" },
  { page: "analysis", labelKey: "nav.analysis" },
  { page: "delay", labelKey: "nav.delay" },
  { page: "bpm", labelKey: "nav.bpm" },
  { page: "pitch", labelKey: "nav.pitch" },
  { page: "loudness", labelKey: "nav.loudness" },
  { page: "remix", labelKey: "nav.remix" },
  { page: "history", labelKey: "nav.history" },
];

export function NavTabs({ onNavigate }: { onNavigate?: () => void }) {
  const { view, showView } = useTunebad();
  const { t } = useI18n();
  return (
    <>
      {TABS.map((tab) => (
        <button
          key={tab.page}
          className={`ghost-button${view === tab.page ? " active" : ""}`}
          type="button"
          onClick={() => {
            showView(tab.page);
            onNavigate?.();
          }}
        >
          {t(tab.labelKey)}
        </button>
      ))}
    </>
  );
}
