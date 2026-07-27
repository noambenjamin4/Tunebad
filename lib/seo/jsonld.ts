// Shared JSON-LD builders for the schema.org blocks that used to be built
// inline on every page. Pure functions returning plain objects — callers
// JSON.stringify them into a <script type="application/ld+json"> tag.

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
