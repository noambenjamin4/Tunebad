"use client";

// The master bus: what every clip is heard through. Presentational — it owns
// no state, because these controls are performable (their moves get recorded
// into a take) and the panel is what holds the recorder's clock.

import { useI18n } from "@/lib/i18n";
import {
  type EffectId,
  type RemixParams,
  type ReverbType,
  coupledSemitones,
} from "@/lib/audio/remix";

const REVERB_TYPE_OPTIONS: {
  type: ReverbType;
  labelKey:
    | "remix.typeRoom"
    | "remix.typePlate"
    | "remix.typeHall"
    | "remix.typeCathedral"
    | "remix.typeSaturated";
}[] = [
  { type: "room", labelKey: "remix.typeRoom" },
  { type: "plate", labelKey: "remix.typePlate" },
  { type: "hall", labelKey: "remix.typeHall" },
  { type: "cathedral", labelKey: "remix.typeCathedral" },
  { type: "saturated", labelKey: "remix.typeSaturated" },
];

const EFFECT_OPTIONS: {
  id: EffectId;
  labelKey:
    | "remix.effectNone"
    | "remix.effectUnderwater"
    | "remix.effectPhone"
    | "remix.effectLofi";
}[] = [
  { id: "none", labelKey: "remix.effectNone" },
  { id: "underwater", labelKey: "remix.effectUnderwater" },
  { id: "phone", labelKey: "remix.effectPhone" },
  { id: "lofi", labelKey: "remix.effectLofi" },
];

export function MasterControls({
  params,
  working,
  recording,
  onLockPitch,
  onSpeed,
  onReverb,
  onBass,
  onReverbType,
  onEffect,
}: {
  params: RemixParams;
  working: boolean;
  recording: boolean;
  onLockPitch: (lock: boolean) => void;
  onSpeed: (speed: number) => void;
  onReverb: (reverb: number) => void;
  onBass: (bassBoostDb: number) => void;
  onReverbType: (type: ReverbType) => void;
  onEffect: (effect: EffectId) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="studio-master">
      <label className="studio-field studio-lock" title={t("studio.lockPitchHint")}>
        <input
          type="checkbox"
          checked={params.lockPitch}
          disabled={working || recording}
          onChange={(e) => onLockPitch(e.target.checked)}
        />
        {t("studio.lockPitch")}
      </label>
      {params.lockPitch && <p className="studio-notice">{t("studio.lockVsRecord")}</p>}
      <label className="studio-field studio-field-wide">
        {t("studio.speed")}
        <input
          type="range"
          min={0.5}
          max={1.5}
          step={0.01}
          value={params.speed}
          onChange={(e) => onSpeed(Number(e.target.value))}
        />
        <span className="num">
          {params.speed.toFixed(2)}x · {coupledSemitones(params.speed) >= 0 ? "+" : ""}
          {coupledSemitones(params.speed).toFixed(1)} st
        </span>
      </label>
      <label className="studio-field studio-field-wide">
        {t("studio.reverb")}
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={params.reverb}
          onChange={(e) => onReverb(Number(e.target.value))}
        />
        <span className="num">{params.reverb}</span>
      </label>
      <label className="studio-field studio-field-wide">
        {t("studio.bass")}
        <input
          type="range"
          min={-6}
          max={9}
          step={0.5}
          value={params.bassBoostDb}
          onChange={(e) => onBass(Number(e.target.value))}
        />
        <span className="num">{params.bassBoostDb} dB</span>
      </label>

      <div className="studio-pills" role="group" aria-label={t("studio.reverbType")}>
        {REVERB_TYPE_OPTIONS.map((option) => (
          <button
            key={option.type}
            className={`cutter-format-pill${params.reverbType === option.type ? " active" : ""}`}
            type="button"
            aria-pressed={params.reverbType === option.type}
            onClick={() => onReverbType(option.type)}
          >
            {t(option.labelKey)}
          </button>
        ))}
      </div>
      <div className="studio-pills" role="group" aria-label={t("studio.effect")}>
        {EFFECT_OPTIONS.map((option) => (
          <button
            key={option.id}
            className={`cutter-format-pill${params.effect === option.id ? " active" : ""}`}
            type="button"
            aria-pressed={params.effect === option.id}
            onClick={() => onEffect(option.id)}
          >
            {t(option.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
