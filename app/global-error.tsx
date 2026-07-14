"use client";

import { useEffect } from "react";

// Root error boundary: catches render/runtime crashes that escape everything
// else (Next.js requires this file to render its own <html>/<body> because
// the root layout itself may have crashed). Styled inline to match the
// monochrome system without depending on globals.css having loaded.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
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
      // Never let reporting break the recovery page.
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#f2f2f2",
          fontFamily: "system-ui, -apple-system, sans-serif",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#9a9a9a", marginBottom: 24, maxWidth: 420 }}>
            The page hit an unexpected error. Your files never leave your device, so nothing was
            uploaded or lost server-side.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              border: 0,
              borderRadius: 9999,
              padding: "12px 28px",
              background: "#f2f2f2",
              color: "#0a0a0a",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
