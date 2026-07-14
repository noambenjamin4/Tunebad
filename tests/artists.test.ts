import test from "node:test";
import assert from "node:assert/strict";
import { artistSlug, groupSongsByArtist } from "../lib/server/artists";
import type { CachedAnalysis } from "../lib/server/link-analysis";

function song(overrides: Partial<CachedAnalysis>): CachedAnalysis {
  return {
    id: "x",
    slug: "x",
    title: "T",
    artist: null,
    bpm: 120,
    bpm_alt: null,
    key: "A Minor",
    camelot: "8A",
    energy: null,
    danceability: null,
    loudness_db: null,
    duration_s: null,
    ...overrides,
  } as CachedAnalysis;
}

test("artistSlug strips diacritics and symbols (routing depends on it)", () => {
  assert.equal(artistSlug("Beyoncé"), "beyonce");
  assert.equal(artistSlug("AC/DC"), "ac-dc");
  assert.equal(artistSlug("  Sigur Rós  "), "sigur-ros");
  assert.equal(artistSlug("!!!"), "artist"); // never an empty slug
});

test("colliding spellings merge into one group", () => {
  const groups = groupSongsByArtist([
    song({ id: "1", artist: "Beyoncé" }),
    song({ id: "2", artist: "Beyonce" }),
    song({ id: "3", artist: "Someone Else" }),
  ]);
  assert.equal(groups.get("beyonce")?.songs.length, 2);
  assert.equal(groups.size, 2);
});

test("songs without an artist are dropped, not grouped", () => {
  const groups = groupSongsByArtist([song({ artist: null }), song({ artist: "  " })]);
  assert.equal(groups.size, 0);
});
