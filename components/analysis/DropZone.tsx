"use client";

import { useRef, useState, type DragEvent } from "react";
import { useI18n } from "@/lib/i18n";

export function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { t } = useI18n();

  const handleDrag = (event: DragEvent, active: boolean) => {
    event.preventDefault();
    setDragging(active);
  };

  return (
    <div
      className={`drop-zone${dragging ? " dragging" : ""}`}
      id="dropZone"
      onDragEnter={(event) => handleDrag(event, true)}
      onDragOver={(event) => handleDrag(event, true)}
      onDragLeave={(event) => handleDrag(event, false)}
      onDrop={(event) => {
        handleDrag(event, false);
        onFiles([...event.dataTransfer.files]);
      }}
    >
      <input
        ref={inputRef}
        id="fileInput"
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac"
        multiple
        aria-label={t("common.browseFiles")}
        onChange={(event) => {
          onFiles([...(event.target.files || [])]);
          event.target.value = "";
        }}
      />
      <div className="upload-copy">
        <small>{t("common.dropAudioFile")}</small>
        <span>{t("analysis.dropHint")}</span>
        <button className="secondary-button" type="button" onClick={() => inputRef.current?.click()}>
          {t("common.browseFiles")}
        </button>
      </div>
    </div>
  );
}
