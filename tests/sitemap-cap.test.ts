import assert from "node:assert/strict";
import test from "node:test";
import { SONGS_CAP, SONGS_PER_SHARD } from "../lib/server/sitemap";

// SONGS_CAP is a free-tier safety limit, not a preference. Every song URL we
// advertise beyond the 2,000 prerendered at build is an on-demand ISR write on
// first crawl, and Vercel Hobby pauses the whole account past ~200k writes/mo
// — which is what took every site down on 2026-07-15. These tests exist so a
// future "let's index more songs" change has to consciously break them.

const HOBBY_ISR_WRITES_PER_MONTH = 200_000;
const DEPLOYS_PER_MONTH_ASSUMED = 4; // each deploy drops the ISR cache

test("a full crawl of the sitemap stays well inside the Hobby ISR budget", () => {
  const writesPerFullCrawl = SONGS_CAP;
  const worstCase = writesPerFullCrawl * DEPLOYS_PER_MONTH_ASSUMED;
  assert.ok(
    worstCase <= HOBBY_ISR_WRITES_PER_MONTH / 2,
    `advertising ${SONGS_CAP} songs costs ~${worstCase} ISR writes/month across ` +
      `${DEPLOYS_PER_MONTH_ASSUMED} deploys, over half the ~${HOBBY_ISR_WRITES_PER_MONTH} Hobby budget`,
  );
});

// The shard index must count shards off the CAP, not the raw catalog size.
// Counting off the catalog advertised 11 shards for a 217k-song catalog while
// the shard route served an empty urlset for everything past the cap — nine
// empty sitemaps handed to Google.
function shardCount(total: number): number {
  return Math.max(1, Math.ceil(Math.min(total, SONGS_CAP) / SONGS_PER_SHARD));
}

test("shard count is clamped by the cap, so no empty shards are advertised", () => {
  const huge = shardCount(217_634);
  assert.equal(huge, Math.ceil(SONGS_CAP / SONGS_PER_SHARD));

  // Every advertised shard must have at least one URL in it: a shard's slice
  // starts at index * SONGS_PER_SHARD, and the route returns [] once that
  // start reaches the cap.
  for (let i = 0; i < huge; i++) {
    assert.ok(i * SONGS_PER_SHARD < SONGS_CAP, `shard songs-${i} would be empty`);
  }
});

test("a catalog smaller than one shard still advertises exactly one shard", () => {
  assert.equal(shardCount(0), 1);
  assert.equal(shardCount(19_999), 1);
});
