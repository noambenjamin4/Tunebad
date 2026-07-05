import type { MetadataRoute } from "next";

// Real crawlable routes. The tool sections (analysis, converter, etc.) are
// in-page hash views on "/", not separate URLs, so they aren't listed here.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://tunebad.com";
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/copyright`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
