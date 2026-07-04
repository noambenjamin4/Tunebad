"use client";

import { useMemo, useState } from "react";
import { freqToPitch } from "@/lib/audio/pitch";
import { useI18n } from "@/lib/i18n";
import { TuningForkIcon } from "@/components/ui/icons";

const REFERENCES = [
  { label: "C4", frequency: "261.63" },
  { label: "A4", frequency: "440" },
  { label: "A5", frequency: "880" },
];

export function PitchConverter() {
  const [hz, setHz] = useState("440");
  const pitch = useMemo(() => freqToPitch(Number.parseFloat(hz)), [hz]);
  const { t } = useI18n();

  return (
    <article className="panel hero-tool">
      <div className="panel-heading hero-heading">
        <div>
          <h1>
            <TuningForkIcon className="panel-title-icon" />
            {t("pitch.title")}
          </h1>
          <p>{t("pitch.subtitle")}</p>
        </div>
      </div>

      <article className="utility-card pitch-card single-card">
        <div className="tool-heading">
          <div>
            <h3>{t("pitch.cardTitle")}</h3>
            <p>{t("pitch.cardSubtitle")}</p>
          </div>
        </div>
        <label className="field-label" htmlFor="hzInput">
          {t("pitch.frequency")}
        </label>
        <div className="frequency-input">
          <input id="hzInput" type="number" min={0} step={0.01} value={hz} onChange={(event) => setHz(event.target.value)} />
          <span>Hz</span>
        </div>
        <div className="pitch-result" id="pitchResult">
          <strong id="noteDisplay">{pitch.note}</strong>
          <span id="offsetDisplay">{t("pitch.cents", { cents: pitch.cents })}</span>
        </div>
        <div className="pitch-reference">
          {REFERENCES.map((reference) => (
            <button key={reference.label} className="secondary-button" type="button" onClick={() => setHz(reference.frequency)}>
              {reference.label}
            </button>
          ))}
        </div>
      </article>
    </article>
  );
}
