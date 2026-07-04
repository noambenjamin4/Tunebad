"use client";

import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n/locales/en";

const QUALITIES = ["320", "256", "192", "128"] as const;
export type Quality = (typeof QUALITIES)[number];

const FORMATS: { value: "mp3" | "wav"; label: string; hintKey: DictKey }[] = [
  { value: "mp3", label: "MP3", hintKey: "converter.formatHintSmallFile" },
  { value: "wav", label: "WAV", hintKey: "converter.formatHintSampleExact" },
];
export type OutputFormat = (typeof FORMATS)[number]["value"];

export function FormatPicker({ value, onChange }: { value: OutputFormat; onChange: (format: OutputFormat) => void }) {
  const { t } = useI18n();
  return (
    <fieldset className="quality-field">
      <legend>{t("converter.formatLegend")}</legend>
      <div className="quality-options format-options">
        {FORMATS.map((format) => (
          <button
            key={format.value}
            className={`quality-button${value === format.value ? " active" : ""}`}
            type="button"
            onClick={() => onChange(format.value)}
          >
            <strong>{format.label}</strong>
            <span>{t(format.hintKey)}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function QualityPicker({ value, onChange }: { value: Quality; onChange: (quality: Quality) => void }) {
  const { t } = useI18n();
  return (
    <fieldset className="quality-field">
      <legend>{t("converter.qualityLegend")}</legend>
      <div className="quality-options">
        {QUALITIES.map((quality) => (
          <button
            key={quality}
            className={`quality-button${value === quality ? " active" : ""}`}
            type="button"
            onClick={() => onChange(quality)}
          >
            <strong>{quality}</strong>
            <span>kbps</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
