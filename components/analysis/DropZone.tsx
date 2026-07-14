"use client";

import { useI18n } from "@/lib/i18n";
import { useFileDrop } from "@/hooks/useFileDrop";

export function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const { t } = useI18n();
  const { dragging, dropZoneProps, inputProps, openPicker } = useFileDrop({ onFiles });

  return (
    <div className={`drop-zone${dragging ? " dragging" : ""}`} id="dropZone" {...dropZoneProps}>
      <input
        {...inputProps}
        id="fileInput"
        accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac"
        multiple
        aria-label={t("common.browseFiles")}
      />
      <div className="upload-copy">
        <small>{t("common.dropAudioFile")}</small>
        <span>{t("analysis.dropHint")}</span>
        <button className="secondary-button" type="button" onClick={openPicker}>
          {t("common.browseFiles")}
        </button>
      </div>
    </div>
  );
}
