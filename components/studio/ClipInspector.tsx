"use client";

// Everything that acts on ONE clip. Presentational: it reports intent and the
// panel decides what that costs (whether the edit is undoable, whether the
// graph has to be rescheduled now or after the gesture settles).

import { useI18n } from "@/lib/i18n";
import type { BeatGrid } from "@/lib/studio/beat-grid";
import { needsTempoMatch, tempoMatchRatio } from "@/lib/studio/beat-grid";
import type { StudioClip } from "@/lib/studio/timeline";

export function ClipInspector({
  clip,
  working,
  grid,
  clipBpms,
  onGainPointerDown,
  onGain,
  onFadeIn,
  onFadeOut,
  onToggleMute,
  onToggleSolo,
  onMatchTempo,
  onSplit,
  onDuplicate,
  onDelete,
}: {
  clip: StudioClip;
  working: boolean;
  grid: BeatGrid | null;
  clipBpms: Map<string, number>;
  /** Fires before the drag starts, so one undo step covers the whole slide. */
  onGainPointerDown: () => void;
  onGain: (gain: number) => void;
  onFadeIn: (seconds: number) => void;
  onFadeOut: (seconds: number) => void;
  onToggleMute: () => void;
  onToggleSolo: () => void;
  onMatchTempo: () => void;
  onSplit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const bpm = clipBpms.get(clip.bufferId);
  const offGrid = bpm !== undefined && grid !== null && needsTempoMatch(tempoMatchRatio(bpm, grid.bpm));

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
