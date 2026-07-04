"use client";

import { useEffect } from "react";
import { useTuner } from "../TunerApp";
import { useMetronome } from "@/hooks/useMetronome";
import { clampBpm } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { setNowPlaying } from "@/lib/audio/now-playing";

const NOW_PLAYING_SOURCE = "metronome";

export function MetronomeCard() {
  const { metronomeBpm, setMetronomeBpm, delayBpm } = useTuner();
  const { running, beat, lightOn, toggle } = useMetronome(metronomeBpm);
  const { t } = useI18n();

  useEffect(() => {
    setNowPlaying(NOW_PLAYING_SOURCE, running);
  }, [running]);

  useEffect(() => () => setNowPlaying(NOW_PLAYING_SOURCE, false), []);

  return (
    <article className="utility-card metronome-card">
      <div className="tool-heading">
        <div>
          <h3>{t("bpm.metronomeTitle")}</h3>
          <p>{t("bpm.metronomeSubtitle")}</p>
        </div>
        <span className={`beat-light${lightOn ? " active" : ""}`} id="beatLight" aria-hidden="true"></span>
      </div>
      <label className="field-label" htmlFor="metronomeBpm">
        {t("bpm.tempo")}
      </label>
      <div className="bpm-control compact-control">
        <button type="button" aria-label={t("bpm.decreaseTempo")} onClick={() => setMetronomeBpm(metronomeBpm - 1)}>
          −
        </button>
        <input
          id="metronomeBpm"
          type="number"
          min={30}
          max={300}
          step={1}
          value={metronomeBpm}
          onChange={(event) => setMetronomeBpm(Number.parseFloat(event.target.value) || 120)}
        />
        <button type="button" aria-label={t("bpm.increaseTempo")} onClick={() => setMetronomeBpm(metronomeBpm + 1)}>
          +
        </button>
      </div>
      <div className="metronome-display">
        <strong id="metronomeBeat">{beat}</strong>
        <span id="metronomeLabel">{t("bpm.timeSignature")}</span>
      </div>
      <div className="tool-actions">
        <button className="primary-button small-primary" type="button" onClick={toggle}>
          {running ? t("common.stop") : t("common.start")}
        </button>
        <button className="secondary-button" type="button" onClick={() => setMetronomeBpm(clampBpm(delayBpm))}>
          {t("bpm.syncBpm")}
        </button>
      </div>
    </article>
  );
}
