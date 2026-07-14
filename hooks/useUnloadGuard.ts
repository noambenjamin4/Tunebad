"use client";

import { useEffect } from "react";

// Arms a beforeunload confirmation while `active` is true, so closing or
// reloading the tab mid-job (download, render, export, batch analysis) asks
// before silently losing the work. Browsers show their own generic prompt;
// the returnValue text is ignored but required to trigger it.
export function useUnloadGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);
}
