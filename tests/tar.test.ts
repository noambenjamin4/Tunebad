import test from "node:test";
import assert from "node:assert/strict";
import { isGzip, isTarFileName, createTarGz, extractTarArchive } from "../lib/files/tar";

test("gzip magic detection", () => {
  assert.equal(isGzip(new Uint8Array([0x1f, 0x8b, 0x08])), true);
  assert.equal(isGzip(new Uint8Array([0x50, 0x4b, 0x03])), false);
  assert.equal(isGzip(new Uint8Array([0x1f])), false);
});

test("tar filename detection", () => {
  assert.equal(isTarFileName("a.tar"), true);
  assert.equal(isTarFileName("a.tar.gz"), true);
  assert.equal(isTarFileName("a.TGZ"), true);
  assert.equal(isTarFileName("a.zip"), false);
  assert.equal(isTarFileName("tar.txt"), false);
});

test("create -> extract round-trips names and bytes exactly", async () => {
  const payloads: [string, Uint8Array][] = [
    ["hello.txt", new TextEncoder().encode("hello tar")],
    // 600 bytes crosses a 512 block boundary — exercises padding math.
    ["big/nested-name.bin", new Uint8Array(600).map((_, i) => i % 251)],
    ["empty.txt", new Uint8Array(0)],
  ];
  const files = payloads.map(([name, data]) => new File([data as BlobPart], name));
  const gz = await createTarGz(files);
  const archive = new File([gz], "round.tar.gz");

  const entries = await extractTarArchive(archive);
  assert.equal(entries.length, payloads.length);
  for (const [name, data] of payloads) {
    const entry = entries.find((e) => e.name.endsWith(name.split("/").pop()!));
    assert.ok(entry, `missing entry for ${name}`);
    assert.equal(entry.data.length, data.length, `size mismatch for ${name}`);
    assert.deepEqual(Array.from(entry.data), Array.from(data), `bytes mismatch for ${name}`);
  }
});

test("garbage input is rejected, not parsed into phantom entries", async () => {
  const junk = new File([new Uint8Array(2048).fill(7) as BlobPart], "junk.tar");
  await assert.rejects(extractTarArchive(junk));
});
