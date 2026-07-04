"use client";

import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n/locales/en";

const QUALITIES = ["320", "256", "192", "128"] as const;
export type Quality = (typeof QUALITIES)[number];

const RESOLUTIONS = ["1080", "720", "480"] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

// Local file converter only ever encodes audio in-browser (see
// lib/audio/mp3-encoder.ts) — mp4 is deliberately excluded from this list so
// FormatPicker's default set stays audio-only there. The link-to-audio card
// (YouTubeDownloader) opts into video via the `formats` prop below.
const FORMATS: { value: "mp3" | "wav"; label: string; hintKey: DictKey }[] = [
  { value: "mp3", label: "MP3", hintKey: "converter.formatHintSmallFile" },
  { value: "wav", label: "WAV", hintKey: "converter.formatHintSampleExact" },
];

export const VIDEO_FORMAT_OPTION = { value: "mp4", label: "MP4", hintKey: "converter.formatHintVideo" } as const;

export type OutputFormat = "mp3" | "wav" | "mp4";

export function FormatPicker({
  value,
  onChange,
  formats = FORMATS,
}: {
  value: OutputFormat;
  onChange: (format: OutputFormat) => void;
  formats?: readonly { value: OutputFormat; label: string; hintKey: DictKey }[];
}) {
  const { t } = useI18n();
  return (
    <fieldset className="quality-field">
      <legend>{t("converter.formatLegend")}</legend>
      <div className="quality-options format-options">
        {formats.map((format) => (
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

export function ResolutionPicker({ value, onChange }: { value: Resolution; onChange: (resolution: Resolution) => void }) {
  const { t } = useI18n();
  return (
    <fieldset className="quality-field">
      <legend>{t("converter.resolutionLegend")}</legend>
      <div className="quality-options resolution-options">
        {RESOLUTIONS.map((resolution) => (
          <button
            key={resolution}
            className={`quality-button${value === resolution ? " active" : ""}`}
            type="button"
            onClick={() => onChange(resolution)}
          >
            <strong>{resolution}</strong>
            <span>p</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
