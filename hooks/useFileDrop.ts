"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

// Shared drag/drop + hidden-file-input interaction used by every drop zone
// (FileDrop, DropZone, FilePicker and the tool panels): a `dragging` flag that
// drives the highlighted/pulsing CSS class, drag handlers that gate on
// `disabled`, and an input whose value is cleared after every change so
// re-picking the same file fires onChange again.
export function useFileDrop({
  disabled = false,
  onFiles,
}: {
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrag = (event: DragEvent, active: boolean) => {
    event.preventDefault();
    if (!disabled) setDragging(active);
  };

  const dropZoneProps = {
    onDragEnter: (event: DragEvent) => handleDrag(event, true),
    onDragOver: (event: DragEvent) => handleDrag(event, true),
    onDragLeave: (event: DragEvent) => handleDrag(event, false),
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      setDragging(false);
      if (!disabled) onFiles([...event.dataTransfer.files]);
    },
  };

  const inputProps = {
    ref: inputRef,
    type: "file" as const,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      onFiles([...(event.target.files || [])]);
      event.target.value = "";
    },
  };

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  return { dragging, dropZoneProps, inputProps, openPicker };
}
