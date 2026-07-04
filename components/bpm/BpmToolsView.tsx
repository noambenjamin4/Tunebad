"use client";

import { MetronomeCard } from "./MetronomeCard";
import { TapTempoCard } from "./TapTempoCard";
import { useI18n } from "@/lib/i18n";
import { MetronomeIcon } from "@/components/ui/icons";

export function BpmToolsView() {
  const { t } = useI18n();
  return (
    <article className="panel hero-tool">
      <div className="panel-heading hero-heading">
        <div>
          <h1>
            <MetronomeIcon className="panel-title-icon" />
            {t("bpm.title")}
          </h1>
          <p>{t("bpm.subtitle")}</p>
        </div>
      </div>

      <div className="split-tools">
        <MetronomeCard />
        <TapTempoCard />
      </div>
    </article>
  );
}
