"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { useFileDrop } from "@/hooks/useFileDrop";

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
  const { dragging, dropZoneProps, inputProps, openPicker } = useFileDrop({ disabled, onFiles });

  return (
    <div className={`drop-zone${dragging ? " dragging" : ""}`} {...dropZoneProps}>
      <input
        {...inputProps}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        aria-label={t("files.browse")}
      />
      <div className="upload-copy">
        <small>{hint}</small>
        <button className="secondary-button" type="button" disabled={disabled} onClick={openPicker}>
          {t("files.browse")}
        </button>
      </div>
    </div>
  );
}
