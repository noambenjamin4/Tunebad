// Build gate: every localized route must be localized on BOTH sides.
//
// LOCALIZED_PATHS is the single source of truth, but a route can drift
// half-localized in two directions and neither breaks the build:
//   - an (intl) page exists but the (en) page has no `languages:` map, so the
//     cluster is one-way and Google discards the whole pairing; or
//   - the (en) page advertises hreflang for a /<locale><path> URL that has no
//     (intl) page — hreflang pointing at a 404.
// Both are silent SEO failures. This asserts the three artifacts agree.
//
// Run: node scripts/check-i18n-routes.mjs

import { readFileSync, existsSync } from "node:fs";

const HREFLANG_SRC = "lib/seo/hreflang.ts";

const src = readFileSync(HREFLANG_SRC, "utf8");
const block = /export const LOCALIZED_PATHS: readonly string\[\] = \[([^\]]*)\]/s.exec(src);
if (!block) {
  console.error(`check-i18n-routes: cannot find LOCALIZED_PATHS in ${HREFLANG_SRC}`);
  process.exit(1);
}
const paths = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

const problems = [];
for (const path of paths) {
  const slug = path.replace(/^\//, "");
  const intlPage = `app/(intl)/[locale]/${slug}/page.tsx`;
  const enPage = `app/(en)/${slug}/page.tsx`;

  if (!existsSync(intlPage)) {
    problems.push(`${path}: no localized page at ${intlPage}`);
  }
  if (!existsSync(enPage)) {
    // A few clusters are anchored somewhere other than a same-named page
    // (e.g. /key-bpm-finder canonicalizes to "/", so its EN `languages:` map
    // lives on the root layout). Those are listed here deliberately.
    const ANCHORED_ELSEWHERE = new Set(["/key-bpm-finder"]);
    if (!ANCHORED_ELSEWHERE.has(path)) problems.push(`${path}: no English page at ${enPage}`);
    continue;
  }
  const en = readFileSync(enPage, "utf8");
  const anchoredOnLayout = path === "/key-bpm-finder";
  if (!anchoredOnLayout && !en.includes("languageAlternates")) {
    problems.push(`${path}: English page emits no hreflang cluster (missing languageAlternates)`);
  }
}

if (problems.length > 0) {
  console.error("check-i18n-routes: FAIL");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(`check-i18n-routes: OK — ${paths.length} localized routes, both sides present`);
