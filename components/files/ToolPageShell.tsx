import type { ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n";
import { Footer } from "@/components/layout/Footer";
import { ToolPageNav } from "@/components/layout/ToolPageNav";

const SITE_URL = "https://www.tunebad.com";

// Standalone page shell for the file tools (image/video/pdf/zip). These pages
// live OUTSIDE the TunebadApp SPA (the top nav is over budget), so each wraps
// its client tool in its own I18nProvider — SSR renders English for crawlers,
// the visitor's saved locale applies after hydration. Same pattern as
// app/copyright/page.tsx.
//
// Every shell page emits BreadcrumbList JSON-LD (Home → More tools → <tool>);
// the /tools hub itself passes no `tool` and gets the two-level trail. Names
// stay canonical English, same policy as the song pages' breadcrumbs.
export function ToolPageShell({
  children,
  tool,
}: {
  children: ReactNode;
  tool?: { name: string; path: string };
}) {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "More tools", item: `${SITE_URL}/tools` },
      ...(tool
        ? [{ "@type": "ListItem", position: 3, name: tool.name, item: `${SITE_URL}${tool.path}` }]
        : []),
    ],
  };
  return (
    <div className="app-shell">
      <I18nProvider>
        <ToolPageNav />
        <main>
          <div className="tool-page">{children}</div>
          <Footer />
        </main>
      </I18nProvider>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
    </div>
  );
}
