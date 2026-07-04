"use client";

import { useTuner } from "../TunerApp";
import { useTapTempo } from "@/hooks/useTapTempo";
import { useI18n } from "@/lib/i18n";

export function TapTempoCard() {
  const { setMainBpm } = useTuner();
  const { bpm, count, tap, reset } = useTapTempo(5000);
  const { t } = useI18n();

  return (
    <article className="utility-card tapper-card">
      <div className="tool-heading">
        <div>
          <h3>{t("bpm.tapperTitle")}</h3>
          <p>{t("bpm.tapperSubtitle")}</p>
        </div>
      </div>
      <button className="tap-pad" id="dedicatedTapper" type="button" onClick={tap}>
        <strong id="tapperBpm">{bpm ? bpm.toFixed(2) : t("bpm.tap")}</strong>
        <span id="tapperCount">{t("bpm.tapsCount", { count })}</span>
      </button>
      <div className="tool-actions">
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            if (bpm) setMainBpm(bpm);
          }}
        >
          {t("bpm.useBpm")}
        </button>
        <button className="secondary-button" type="button" onClick={reset}>
          {t("common.reset")}
        </button>
      </div>
    </article>
  );
}
