// Canonical origin for absolute URLs (metadata, JSON-LD, sitemaps). Kept
// dependency-free so both client and server modules can import it.
//
// The production primary domain (Vercel serves www; bare tunebad.com 308s to
// it). Must match the Google Search Console property. Keep robots.txt in sync.
export const SITE_URL = "https://www.tunebad.com";
