"use client";

import type { AnalysisResult } from "@/types/analysis";
import { formatTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export function ResultsTable({
  results,
  analyzingNames,
  failedNames,
}: {
  results: AnalysisResult[];
  analyzingNames: string[];
  failedNames: string[];
}) {
  const { t } = useI18n();
  const empty = !results.length && !analyzingNames.length && !failedNames.length;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t("table.fileName")}</th>
            <th>{t("table.duration")}</th>
            <th>{t("table.bpm")}</th>
            <th>{t("table.key")}</th>
            <th>{t("table.camelot")}</th>
            <th>{t("table.confidence")}</th>
            <th>{t("table.analyzed")}</th>
          </tr>
        </thead>
        <tbody id="resultsBody">
          {empty ? (
            <tr className="empty-row">
              <td colSpan={7}>{t("analysis.noTracksYet")}</td>
            </tr>
          ) : (
            <>
              {analyzingNames.map((name) => (
                <tr key={`loading-${name}`}>
                  <td colSpan={7}>{t("analysis.analyzing", { name })}</td>
                </tr>
              ))}
              {failedNames.map((name) => (
                <tr key={`failed-${name}`}>
                  <td colSpan={7}>{t("analysis.analyzeFailed", { name })}</td>
                </tr>
              ))}
              {results.map((result, index) => (
                <tr key={`${result.name}-${index}`}>
                  <td>{result.name}</td>
                  <td>{formatTime(result.duration)}</td>
                  <td className="accent">{result.bpm ? Math.round(result.bpm) : "N/A"}</td>
                  <td className="accent">{result.key}</td>
                  <td>{result.camelot || result.scale}</td>
                  <td>
                    <div className="confidence">
                      <span>{result.confidence}%</span>
                      <meter min={0} max={100} value={result.confidence}></meter>
                    </div>
                  </td>
                  <td>{result.analyzedAt}</td>
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
