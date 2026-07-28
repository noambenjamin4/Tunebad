// Shared JSON-LD builders for the schema.org blocks that used to be built
// inline on every page. Pure functions returning plain objects — callers
// serialize them into a <script type="application/ld+json"> tag with
// jsonLdString below, never with bare JSON.stringify.

/**
 * Serialize an object for a <script type="application/ld+json"> block.
 *
 * JSON.stringify alone is NOT safe here. Some of what goes into these blocks
 * is third-party text — song titles arrive from platform oEmbed endpoints,
 * i.e. whatever someone named their video — and the HTML parser ends a
 * <script> element at the first "</script" it sees, ignoring string context.
 * JSON.stringify escapes quotes but not "<", so a title containing
 * "</script><script>…" broke out of the block, and the CSP's 'unsafe-inline'
 * (required by Next's own bootstrap) would have run it: stored XSS on
 * permanently-cached pages.
 *
 * Escaping <, >, and & as \u003c-style sequences is still valid JSON — the
 * data parses identically — while making the markup structurally inert. This
 * is the same approach Next/React use for their own inline JSON payloads.
 */
export function jsonLdString(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export function faqPageJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export function breadcrumbJsonLd(trail: { name: string; item: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.item,
    })),
  };
}

/**
 * HowTo for a tool page. `steps` are plain sentences in canonical English —
 * the same policy as faqPageJsonLd, so the schema doesn't change with the
 * visitor's UI language.
 */
export function howToJsonLd(input: { name: string; description: string; steps: string[]; url: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: input.name,
    description: input.description,
    totalTime: "PT3M",
    tool: [{ "@type": "HowToTool", name: "TuneBad DAW" }],
    step: input.steps.map((text, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      text,
      url: `${input.url}#step-${index + 1}`,
    })),
  };
}

/** A single tool described as free software, for the tool pages. */
export function softwareAppJsonLd(input: {
  name: string;
  description: string;
  url: string;
  features: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": ["WebApplication", "SoftwareApplication"],
    name: input.name,
    description: input.description,
    url: input.url,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any (web browser)",
    browserRequirements: "Requires JavaScript and the Web Audio API",
    isAccessibleForFree: true,
    featureList: input.features,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
}
