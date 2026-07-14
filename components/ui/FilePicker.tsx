"use client";

import type { KeyboardEvent } from "react";
import { formatFileSize } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useFileDrop } from "@/hooks/useFileDrop";

export function FilePicker({
  file,
  onFile,
  accept,
  disabled,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  accept: string;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const { dragging, dropZoneProps, inputProps, openPicker } = useFileDrop({
    disabled,
    onFiles: (files) => {
      const dropped = files[0];
      if (dropped) onFile(dropped);
    },
  });

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  };

  return (
    <div
      className={`file-picker${dragging ? " dragging" : ""}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={openPicker}
      onKeyDown={handleKeyDown}
      {...dropZoneProps}
    >
      <input
        {...inputProps}
        className="sr-only"
        accept={accept}
        disabled={disabled}
        // Unlike the drop path (first file or nothing), a change event with no
        // file selected clears the current pick, so keep the null-forwarding
        // handler instead of the hook's list-based one.
        onChange={(event) => {
          onFile(event.target.files?.[0] || null);
          event.target.value = "";
        }}
      />
      <span className="file-picker-cta">{t("common.browseFiles")}</span>
      <span className="file-picker-name">
        {file ? `${file.name} · ${formatFileSize(file.size)}` : t("filePicker.empty")}
      </span>
    </div>
  );
}
