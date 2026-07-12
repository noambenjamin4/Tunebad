"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";

// Shared drop-zone + hidden file input for the file tools. Same interaction
// pattern as the cutter/analyzer dropzones (drag classes, cleared input value
// so re-picking the same file fires change again).
export function FileDrop({
  accept,
  multiple = false,
  disabled = false,
  onFiles,
  hint,
}: {
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  hint: ReactNode;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrag = (event: DragEvent, active: boolean) => {
    event.preventDefault();
    if (!disabled) setDragging(active);
  };

  return (
    <div
      className={`drop-zone${dragging ? " dragging" : ""}`}
      onDragEnter={(event) => handleDrag(event, true)}
      onDragOver={(event) => handleDrag(event, true)}
      onDragLeave={(event) => handleDrag(event, false)}
      onDrop={(event) => {
        handleDrag(event, false);
        if (!disabled) onFiles([...event.dataTransfer.files]);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        aria-label={t("files.browse")}
        onChange={(event) => {
          onFiles([...(event.target.files || [])]);
          event.target.value = "";
        }}
      />
      <div className="upload-copy">
        <small>{hint}</small>
        <button
          className="secondary-button"
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {t("files.browse")}
        </button>
      </div>
    </div>
  );
}
