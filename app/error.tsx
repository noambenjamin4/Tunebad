"use client";

import { useEffect } from "react";

// Route-level error boundary. Before this file existed, ANY render error
// escalated straight to app/global-error.tsx, which replaces the entire
// document — one crashing panel took down the header, footer and every other
// tool on the page. This boundary recovers in place: the layout survives,
// only the failed segment is swapped for the retry card.
//
// Reporting mirrors global-error.tsx exactly (same endpoint, same shape, same
// never-throw guarantee); the shared /api/client-error route rate-limits and
// validates on its side.
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      void fetch("/api/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          source: "boundary",
          message: (error.message || "render crash").slice(0, 500),
          url: typeof window !== "undefined" ? window.location.pathname.slice(0, 300) : undefined,
          stack: error.stack ? error.stack.slice(0, 4000) : undefined,
        }),
      });
    } catch {
      // Never let reporting break the recovery card.
    }
  }, [error]);

  return (
    <main style={{ padding: "64px 24px", textAlign: "center" }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Something went wrong</h1>
      <p style={{ color: "var(--muted, #666)", marginBottom: 24 }}>
        This part of the page hit an unexpected error. Your files never leave your device, so
        nothing was uploaded or lost.
      </p>
      <button type="button" className="primary-button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
