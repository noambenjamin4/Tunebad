"use client";

// Everything that acts on ONE clip. Presentational: it reports intent and the
// panel decides what that costs (whether the edit is undoable, whether the
// graph has to be rescheduled now or after the gesture settles).

import { useI18n } from "@/lib/i18n";
import type { BeatGrid, ClipAnalysis } from "@/lib/studio/beat-grid";
import { needsTempoMatch, tempoMatchRatio } from "@/lib/studio/beat-grid";
import { keysMix } from "@/lib/audio/harmonic";
import type { FadeCurve, StudioClip } from "@/lib/studio/timeline";
import type { EffectId } from "@/lib/audio/remix";

// Same four the master offers, in the same order, so the two rows read as the
// same control applied at two different places.
const CLIP_EFFECTS: { id: EffectId; labelKey: "remix.effectNone" | "remix.effectUnderwater" | "remix.effectPhone" | "remix.effectLofi" }[] = [
  { id: "none", labelKey: "remix.effectNone" },
  { id: "underwater", labelKey: "remix.effectUnderwater" },
  { id: "phone", labelKey: "remix.effectPhone" },
  { id: "lofi", labelKey: "remix.effectLofi" },
];

export function ClipInspector({
  clip,
  working,
  grid,
  clipInfo,
  partner,
  onGainPointerDown,
  onGain,
  onFadeIn,
  onFadeOut,
  onFadeCurve,
  onEffect,
  onToggleMute,
  onToggleSolo,
  onMatchTempo,
  onCrossfade,
  canCrossfade,
  onSplit,
  onDuplicate,
  onDelete,
}: {
  clip: StudioClip;
  working: boolean;
  grid: BeatGrid | null;
  clipInfo: Map<string, ClipAnalysis>;
  /** The clip this one overlaps, if any — the transition to judge. */
  partner: StudioClip | null;
  /** Fires before the drag starts, so one undo step covers the whole slide. */
  onGainPointerDown: () => void;
  onGain: (gain: number) => void;
  onFadeIn: (seconds: number) => void;
  onFadeOut: (seconds: number) => void;
  onFadeCurve: (curve: FadeCurve) => void;
  onEffect: (effect: EffectId) => void;
  onToggleMute: () => void;
  onToggleSolo: () => void;
  onMatchTempo: () => void;
  onCrossfade: () => void;
  /** False when nothing overlaps — the action is hidden, not disabled. */
  canCrossfade: boolean;
  onSplit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const info = clipInfo.get(clip.bufferId);
  const bpm = info?.bpm;
  const offGrid = bpm !== undefined && grid !== null && needsTempoMatch(tempoMatchRatio(bpm, grid.bpm));

  // Tempo is only half of "will these two mix". Two songs beatmatched to the
  // same BPM in clashing keys still sound wrong together, and that is the
  // mistake this catches while the transition is still being built.
  const partnerInfo = partner ? clipInfo.get(partner.bufferId) : undefined;
  const here = info?.camelot ?? "";
  const there = partnerInfo?.camelot ?? "";
  const harmony = here && there ? { fits: keysMix(here, there), here, there } : null;

  return (
    <div className="studio-inspector">
      <span className="studio-inspector-name">{clip.name}</span>
      <label className="studio-field">
        {t("studio.clipGain")}
        <input
          type="range"
          min={0}
          max={1.5}
          step={0.05}
          value={clip.gain}
          onPointerDown={onGainPointerDown}
          onChange={(e) => onGain(Number(e.target.value))}
        />
      </label>
      <label className="studio-field">
        {t("studio.fadeIn")}
        <input
          type="number"
          className="num"
          min={0}
          max={30}
          step={0.5}
          value={clip.fadeInSec}
          onChange={(e) => onFadeIn(Math.max(0, Number(e.target.value) || 0))}
        />
      </label>
      <label className="studio-field">
        {t("studio.fadeOut")}
        <input
          type="number"
          className="num"
          min={0}
          max={30}
          step={0.5}
          value={clip.fadeOutSec}
          onChange={(e) => onFadeOut(Math.max(0, Number(e.target.value) || 0))}
        />
      </label>
      {(clip.fadeInSec > 0 || clip.fadeOutSec > 0) && (
        <div
          className="studio-pills"
          role="group"
          aria-label={t("studio.fadeShape")}
          title={t("studio.fadeShapeHint")}
        >
          {(["linear", "equalPower"] as const).map((curve) => {
            const active = (clip.fadeCurve ?? "linear") === curve;
            return (
              <button
                key={curve}
                className={`cutter-format-pill${active ? " active" : ""}`}
                type="button"
                aria-pressed={active}
                onClick={() => onFadeCurve(curve)}
              >
                {curve === "linear" ? t("studio.fadeLinear") : t("studio.fadeEqualPower")}
              </button>
            );
          })}
        </div>
      )}
      <div
        className="studio-pills"
        role="group"
        aria-label={t("studio.clipEffect")}
        title={t("studio.clipEffectHint")}
      >
        {CLIP_EFFECTS.map((option) => {
          const active = (clip.effect ?? "none") === option.id;
          return (
            <button
              key={option.id}
              className={`cutter-format-pill${active ? " active" : ""}`}
              type="button"
              aria-pressed={active}
              disabled={working}
              onClick={() => onEffect(option.id)}
            >
              {t(option.labelKey)}
            </button>
          );
        })}
      </div>
      <button
        className={`text-button${clip.muted ? " active" : ""}`}
        type="button"
        aria-pressed={clip.muted}
        onClick={onToggleMute}
      >
        {clip.muted ? t("studio.unmute") : t("studio.mute")}
      </button>
      {bpm !== undefined && (
        <span className="studio-hint num">{t("studio.clipBpm", { bpm })}</span>
      )}
      {info?.key && (
        <span className="studio-hint num">
          {info.camelot ? `${info.camelot} · ${info.key}` : info.key}
        </span>
      )}
      {harmony && (
        <span className={`studio-hint num${harmony.fits ? "" : " warn"}`}>
          {harmony.fits
            ? t("studio.keysFit", { a: harmony.here, b: harmony.there })
            : t("studio.keysClash", { a: harmony.here, b: harmony.there })}
        </span>
      )}
      {/* Disabled-with-reason instead of hidden: a control that vanishes reads
          as a bug ("where did Crossfade go?"), one that is greyed with a title
          teaches what makes it available. Match only renders once a grid
          exists at all — before that the concept has nothing to refer to. */}
      {grid && (
        <button
          className="text-button"
          type="button"
          disabled={working || !offGrid}
          onClick={onMatchTempo}
          title={offGrid ? t("studio.matchHint") : t("studio.matchOnGrid")}
        >
          {t("studio.match")}
        </button>
      )}
      <button
        className="text-button"
        type="button"
        disabled={working || !canCrossfade}
        onClick={onCrossfade}
        title={canCrossfade ? t("studio.crossfadeHint") : t("studio.crossfadeNeedsOverlap")}
      >
        {t("studio.crossfade")}
      </button>
      <button
        className={`text-button${clip.soloed ? " active" : ""}`}
        type="button"
        aria-pressed={clip.soloed}
        onClick={onToggleSolo}
      >
        {t("studio.solo")}
      </button>
      <button className="text-button" type="button" onClick={onSplit}>
        {t("studio.split")}
      </button>
      <button className="text-button" type="button" onClick={onDuplicate}>
        {t("studio.duplicate")}
      </button>
      <button className="text-button" type="button" onClick={onDelete}>
        {t("studio.remove")}
      </button>
    </div>
  );
}
