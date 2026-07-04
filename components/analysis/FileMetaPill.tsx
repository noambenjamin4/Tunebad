"use client";

import type { AnalysisResult } from "@/types/analysis";
import { formatSampleRate } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export function FileMetaPill({ result, onRemove }: { result: AnalysisResult; onRemove: () => void }) {
  const { t } = useI18n();
  const extension = result.name.split(".").pop()?.toUpperCase() || "AUDIO";
  return (
    <div className="file-meta-pill" id="fileMetaPill">
      <strong id="metaFileName">{result.name}</strong>
      <span>·</span>
      <span id="metaFileType">{extension}</span>
      <span>·</span>
      <span id="metaSampleRate">{formatSampleRate(result.sampleRate)}</span>
      <span>·</span>
      <span id="metaBitDepth">{result.bitDepthLabel}</span>
      <button className="text-button danger-pill" type="button" onClick={onRemove}>
        {t("common.remove")}
      </button>
    </div>
  );
}
