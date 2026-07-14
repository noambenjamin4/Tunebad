import test from "node:test";
import assert from "node:assert/strict";
import { camelotNeighbors, compatibleCodes, keyToSlug, slugToKey, ALL_KEYS } from "../lib/audio/harmonic";

test("camelot neighbors = self + wheel neighbors + relative, wrapping 12->1", () => {
  assert.deepEqual(new Set(camelotNeighbors("1A")), new Set(["1A", "2A", "12A", "1B"]));
  assert.deepEqual(new Set(camelotNeighbors("12B")), new Set(["12B", "1B", "11B", "12A"]));
  assert.deepEqual(camelotNeighbors("nope"), []);
});

test("compatible codes exclude the track's own key", () => {
  const codes = compatibleCodes("8A");
  assert.deepEqual(new Set(codes), new Set(["7A", "9A", "8B"]));
  assert.ok(!codes.includes("8A"));
});

test("every key round-trips through its slug (hub URLs depend on this)", () => {
  for (const key of ALL_KEYS) {
    const slug = keyToSlug(key);
    assert.ok(/^[a-z0-9-]+$/.test(slug), `slug not URL-safe: ${slug}`);
    assert.equal(slugToKey(slug), key, `round-trip failed for ${key} -> ${slug}`);
  }
});

test("unknown slug resolves to null, not a crash", () => {
  assert.equal(slugToKey("not-a-key"), null);
});
