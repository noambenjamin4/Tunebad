"use client";

import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { formatFileSize } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  };

  const handleDrag = (event: DragEvent, active: boolean) => {
    event.preventDefault();
    if (disabled) return;
    setDragging(active);
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) onFile(dropped);
  };

  return (
    <div
      className={`file-picker${dragging ? " dragging" : ""}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={openPicker}
      onKeyDown={handleKeyDown}
      onDragEnter={(event) => handleDrag(event, true)}
      onDragOver={(event) => handleDrag(event, true)}
      onDragLeave={(event) => handleDrag(event, false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept={accept}
        disabled={disabled}
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
