import Link from "next/link";
import type { ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n";
import { Footer } from "@/components/layout/Footer";

// Standalone page shell for the file tools (image/video/pdf/zip). These pages
// live OUTSIDE the TunebadApp SPA (the top nav is over budget), so each wraps
// its client tool in its own I18nProvider — SSR renders English for crawlers,
// the visitor's saved locale applies after hydration. Same pattern as
// app/copyright/page.tsx.
export function ToolPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="legal-topbar">
        <Link href="/" className="brand" aria-label="TuneBad, back to home">
          <span className="brand-logo-wrap">
            <picture>
              <source media="(prefers-color-scheme: dark)" srcSet="/logo-dark.png" />
              <img src="/logo-light.png" alt="" width={34} height={34} className="brand-logo" />
            </picture>
          </span>
          <span className="brand-wordmark">TUNEBAD</span>
        </Link>
      </header>

      <main>
        <I18nProvider>
          <div className="tool-page">{children}</div>
          <Footer />
        </I18nProvider>
      </main>
    </div>
  );
}
