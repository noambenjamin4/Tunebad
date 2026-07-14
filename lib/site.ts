// Canonical origin for absolute URLs (metadata, JSON-LD, sitemaps). Kept
// dependency-free so both client and server modules can import it.
//
// The production primary domain (Vercel serves www; bare tunebad.com 308s to
// it). Must match the Google Search Console property. Keep robots.txt in sync.
export const SITE_URL = "https://www.tunebad.com";

// Owned brand profiles, emitted as Organization.sameAs in the homepage JSON-LD.
//
// This is the strongest signal Google reads to decide that "TuneBad" is a real,
// distinct entity rather than a misspelling of "Tunebat" — which is what it
// currently assumes, because that brand is one letter away and years older.
//
// EMPTY ON PURPOSE. Every URL here must be a profile we actually own: sameAs
// pointing at a nonexistent or someone else's account is invalid markup and a
// false claim about the entity. Add each account the day it exists (real
// handle, real URL) — sameAs is omitted entirely while this is empty.
export const SOCIAL_PROFILES: string[] = [];
