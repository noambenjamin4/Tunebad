"use client";

import { useTunebad } from "../TunebadApp";
import { useI18n } from "@/lib/i18n";
import { HistoryIcon } from "@/components/ui/icons";

export function HistoryPanel() {
  const { history, clearHistory, setMainBpm, showView } = useTunebad();
  const { t } = useI18n();

  return (
    <article className="panel hero-tool history-panel" id="history">
      <div className="panel-heading hero-heading">
        <div>
          <h1>
            <HistoryIcon className="panel-title-icon" />
            {t("history.title")}
          </h1>
          <p>{t("history.subtitle")}</p>
        </div>
        <button className="text-button" type="button" onClick={clearHistory}>
          {t("history.clearHistory")}
        </button>
      </div>
      <div className="history-list" id="historyList">
        {!history.length ? (
          <svg className="empty-vinyl-motif" viewBox="0 0 160 160" aria-hidden="true">
            <circle cx="80" cy="80" r="78" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="80" cy="80" r="58" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="80" cy="80" r="38" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="80" cy="80" r="18" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="80" cy="80" r="4" fill="currentColor" />
          </svg>
        ) : null}
        {history.length ? (
          history.map((item, index) => (
            <div className="history-item" key={`${item.name}-${index}`}>
              <div>
                <strong>{item.name}</strong>
                <div className="history-meta">
                  <span>{item.duration}</span>
                  <span>{item.key}</span>
                  <span>{item.analyzedAt}</span>
                </div>
              </div>
              <button
                className="history-pill"
                type="button"
                onClick={() => {
                  setMainBpm(Number(item.bpm) || 120);
                  showView("delay");
                }}
              >
                {Math.round(Number(item.bpm))} BPM
              </button>
            </div>
          ))
        ) : (
          <div className="history-empty">{t("history.noSavedYet")}</div>
        )}
      </div>
    </article>
  );
}
