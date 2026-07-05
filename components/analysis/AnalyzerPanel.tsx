"use client";

import { useCallback, useEffect } from "react";
import { useTunebad } from "../TunebadApp";
import { useAnalyzer } from "@/hooks/useAnalyzer";
import { exportResultsCsv } from "@/lib/csv";
import { useI18n } from "@/lib/i18n";
import { DropZone } from "./DropZone";
import { WaveformPreview } from "./WaveformPreview";
import { FileMetaPill } from "./FileMetaPill";
import { AnalysisSummary } from "./AnalysisSummary";
import { ResultsTable } from "./ResultsTable";
import type { AnalysisResult } from "@/types/analysis";
import { WaveformIcon } from "@/components/ui/icons";

export function AnalyzerPanel() {
  const { showView, setMainBpm, setLastAnalyzedBpm, setLastAnalysis, rememberResult, pendingFiles, clearPendingFiles } =
    useTunebad();
  const { t } = useI18n();

  const onResult = useCallback(
    (result: AnalysisResult) => {
      setLastAnalyzedBpm(result.bpm);
      if (result.bpm) setMainBpm(result.bpm);
      setLastAnalysis(result);
      rememberResult(result);
    },
    [setLastAnalyzedBpm, setMainBpm, setLastAnalysis, rememberResult],
  );

  const {
    results,
    analyzingNames,
    failedNames,
    oversizedNames,
    current,
    waveformBars,
    previewUrl,
    previewDuration,
    analyzeFiles,
    clearResults,
  } = useAnalyzer(onResult);

  // Files handed off from the converter ("Analyze this track")
  useEffect(() => {
    if (!pendingFiles?.length) return;
    void analyzeFiles(pendingFiles);
    clearPendingFiles();
  }, [pendingFiles, clearPendingFiles, analyzeFiles]);

  return (
    <article className="panel hero-tool analyzer-panel" id="file-analyzer">
      <div className="panel-heading hero-heading">
        <div>
          <h1>
            <WaveformIcon className="panel-title-icon" />
            {t("analysis.title")}
          </h1>
          <p>{t("analysis.subtitle")}</p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" type="button" onClick={() => showView("history")}>
            {t("analysis.history")}
          </button>
          <button className="text-button danger-pill" type="button" onClick={clearResults}>
            {t("analysis.clear")}
          </button>
        </div>
      </div>

      <DropZone onFiles={(files) => void analyzeFiles(files)} />

      {current !== null ? (
        <>
          <WaveformPreview bars={waveformBars} previewUrl={previewUrl} duration={previewDuration} />
          <FileMetaPill result={current} onRemove={clearResults} />
          <AnalysisSummary result={current} />
        </>
      ) : null}

      <div className="results-heading">
        <h2>{t("analysis.resultsHeading")}</h2>
        <div className="inline-actions">
          <button
            className="text-button"
            type="button"
            onClick={() => {
              if (results.length) exportResultsCsv(results);
            }}
          >
            {t("analysis.exportCsv")}
          </button>
          <button className="text-button" type="button" onClick={clearResults}>
            {t("analysis.clearResults")}
          </button>
        </div>
      </div>

      <ResultsTable
        results={results}
        analyzingNames={analyzingNames}
        failedNames={failedNames}
        oversizedNames={oversizedNames}
      />
    </article>
  );
}
