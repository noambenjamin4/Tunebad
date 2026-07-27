"use client";

// Everything that acts on ONE clip. Presentational: it reports intent and the
// panel decides what that costs (whether the edit is undoable, whether the
// graph has to be rescheduled now or after the gesture settles).

import { useI18n } from "@/lib/i18n";
import type { BeatGrid, ClipAnalysis } from "@/lib/studio/beat-grid";
import { needsTempoMatch, tempoMatchRatio } from "@/lib/studio/beat-grid";
import { keysMix } from "@/lib/audio/harmonic";
import type { StudioClip } from "@/lib/studio/timeline";

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
      {offGrid && (
        <button
          className="text-button"
          type="button"
          disabled={working}
          onClick={onMatchTempo}
          title={t("studio.matchHint")}
        >
          {t("studio.match")}
        </button>
      )}
      {canCrossfade && (
        <button
          className="text-button"
          type="button"
          disabled={working}
          onClick={onCrossfade}
          title={t("studio.crossfadeHint")}
        >
          {t("studio.crossfade")}
        </button>
      )}
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
