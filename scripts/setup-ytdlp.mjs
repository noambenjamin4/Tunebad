#!/usr/bin/env node
// Downloads the standalone yt-dlp binary into bin/ and verifies it against
// the official SHA2-256SUMS from the same release. No Homebrew required.
import { createHash } from "node:crypto";
import { mkdir, writeFile, chmod, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const RELEASE_BASE = "https://github.com/yt-dlp/yt-dlp/releases/latest/download";
const ASSET = "yt-dlp_macos";
const projectRoot = path.resolve(new URL("..", import.meta.url).pathname);
const binDir = path.join(projectRoot, "bin");
const target = path.join(binDir, "yt-dlp");

async function fetchBuffer(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

console.log(`Downloading ${ASSET} from the official yt-dlp release...`);
const [binary, sums] = await Promise.all([
  fetchBuffer(`${RELEASE_BASE}/${ASSET}`),
  fetchBuffer(`${RELEASE_BASE}/SHA2-256SUMS`),
]);

const line = sums
  .toString("utf8")
  .split("\n")
  .find((l) => l.trim().endsWith(ASSET));
if (!line) throw new Error(`SHA2-256SUMS has no entry for ${ASSET}`);
const expected = line.trim().split(/\s+/)[0].toLowerCase();
const actual = createHash("sha256").update(binary).digest("hex");

if (actual !== expected) {
  throw new Error(`Checksum mismatch: expected ${expected}, got ${actual}. Aborting.`);
}
console.log(`Checksum verified (${expected.slice(0, 12)}...).`);

await mkdir(binDir, { recursive: true });
await writeFile(target, binary);
await chmod(target, 0o755);

const check = spawnSync(target, ["--version"], { encoding: "utf8", timeout: 60_000 });
if (check.status !== 0) {
  await rm(target, { force: true });
  throw new Error(`Installed binary failed to run: ${check.stderr || check.error}`);
}
console.log(`yt-dlp ${check.stdout.trim()} installed at ${target}`);
