"use client";

import { useMemo, useState } from "react";
import { useTunebad } from "../TunebadApp";
import { useTapTempo } from "@/hooks/useTapTempo";
import { delayDivisions } from "@/lib/audio/delay";
import { clampBpm } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n/locales/en";
import { EchoIcon } from "@/components/ui/icons";

function formatMs(ms: number): string {
  return `${ms.toFixed(2)} ms`;
}

function formatHz(hz: number): string {
  return `${hz.toFixed(2)} Hz`;
}

const PRESET_NAME_KEYS: Record<string, DictKey> = {
  Hall: "delay.presetHall",
  "Large Room": "delay.presetLargeRoom",
  "Small Room": "delay.presetSmallRoom",
  "Tight Ambience": "delay.presetTightAmbience",
};

export function DelayCalculator() {
  const { delayBpm, setDelayBpmInput, setMainBpm, lastAnalyzedBpm } = useTunebad();
  const { tap } = useTapTempo(4500);
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const { divisions, reverbPresets } = useMemo(() => delayDivisions(delayBpm), [delayBpm]);

  const copyAll = async () => {
    const tableLines = [
      `${t("delay.division")}\t${t("delay.normal")}\t${t("delay.dotted")}\t${t("delay.triplet")}`,
      ...divisions.map(
        (division) =>
          `${division.label}\t${formatMs(division.normal.ms)} (${formatHz(division.normal.hz)})\t${formatMs(
            division.dotted.ms,
          )} (${formatHz(division.dotted.hz)})\t${formatMs(division.triplet.ms)} (${formatHz(division.triplet.hz)})`,
      ),
    ];
    const reverbLines = reverbPresets.map(
      (preset) =>
        `${t(PRESET_NAME_KEYS[preset.name] ?? "delay.presetHall")} (${preset.noteLabel}) — ${t("delay.preDelay")} ${formatMs(
          preset.preDelayMs,
        )}, ${t("delay.decay")} ${formatMs(preset.decayMs)}`,
    );
    const text = [...tableLines, "", t("delay.reverbSuggestions"), ...reverbLines].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard blocked (permissions/insecure context) — just don't flip
      // the label to "Copied" when nothing was copied.
    }
  };

  return (
    <aside className="panel hero-tool calculator-panel">
      <div className="panel-heading hero-heading">
        <div>
          <h1>
            <EchoIcon className="panel-title-icon" />
            {t("delay.title")}
          </h1>
          <p>{t("delay.subtitle")}</p>
        </div>
      </div>

      <label className="field-label" htmlFor="bpmInput">
        {t("delay.bpmLabel")}
      </label>
      <div className="bpm-control">
        <button type="button" aria-label={t("delay.decreaseBpm")} onClick={() => setMainBpm(clampBpm(delayBpm) - 1)}>
          −
        </button>
        <input
          id="bpmInput"
          type="number"
          min={30}
          max={300}
          step={0.01}
          value={delayBpm}
          onChange={(event) => setDelayBpmInput(event.target.value)}
        />
        <button type="button" aria-label={t("delay.increaseBpm")} onClick={() => setMainBpm(clampBpm(delayBpm) + 1)}>
          +
        </button>
      </div>
      <div className="calc-actions">
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            const tapped = tap();
            if (tapped) setMainBpm(tapped);
          }}
        >
          {t("delay.tapTempo")}
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            if (lastAnalyzedBpm) setMainBpm(lastAnalyzedBpm);
          }}
        >
          {t("delay.syncToAnalyzer")}
        </button>
      </div>

      <div className="delay-layout">
        <div>
          <h3>{t("delay.delayTimes")}</h3>
          <div className="delay-grid" id="delayTable">
            <div className="delay-grid-header">
              <span>{t("delay.division")}</span>
              <span>{t("delay.normal")}</span>
              <span>{t("delay.dotted")}</span>
              <span>{t("delay.triplet")}</span>
            </div>
            {divisions.map((division) => (
              <div key={division.label} className={`delay-grid-row${division.highlight ? " highlight" : ""}`}>
                <span className="delay-cell delay-cell-label">{division.label}</span>
                <span className="delay-cell">
                  {formatMs(division.normal.ms)}
                  <small>{formatHz(division.normal.hz)}</small>
                </span>
                <span className="delay-cell">
                  {formatMs(division.dotted.ms)}
                  <small>{formatHz(division.dotted.hz)}</small>
                </span>
                <span className="delay-cell">
                  {formatMs(division.triplet.ms)}
                  <small>{formatHz(division.triplet.hz)}</small>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3>{t("delay.reverbSuggestions")}</h3>
          <div className="reverb-preset-list">
            {reverbPresets.map((preset) => (
              <div className="reverb-preset" key={preset.name}>
                <div className="reverb-preset-name">
                  {t(PRESET_NAME_KEYS[preset.name] ?? "delay.presetHall")}
                  <small>{preset.noteLabel}</small>
                </div>
                <div className="reverb-preset-values">
                  <span>
                    {t("delay.preDelay")}
                    <strong>{formatMs(preset.preDelayMs)}</strong>
                  </span>
                  <span>
                    {t("delay.decay")}
                    <strong>{formatMs(preset.decayMs)}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
          <button className="copy-button" type="button" onClick={copyAll}>
            {copied ? t("common.copied") : t("common.copyAllValues")}
          </button>
        </div>
      </div>
    </aside>
  );
}
