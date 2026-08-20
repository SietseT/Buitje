import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDiskPvStore } from "./pvStore.js";

function tmpDir(): string {
  return mkdtempSync(path.join(tmpdir(), "buitje-pv-"));
}

function grid(fill: number, size = 32): Uint8Array {
  return new Uint8Array(size).fill(fill);
}

test("createDiskPvStore: a stored grid comes back byte-for-byte", () => {
  const store = createDiskPvStore(10, tmpDir());
  const pixels = Uint8Array.from([0, 1, 2, 250, 255, 7]);

  store.put("202608201400", pixels);

  assert.deepEqual(store.get("202608201400"), pixels);
  assert.equal(store.has("202608201400"), true);
});

test("createDiskPvStore: grids survive a restart", () => {
  const dir = tmpDir();
  const pixels = grid(120);

  createDiskPvStore(10, dir).put("202608201400", pixels);

  const reopened = createDiskPvStore(10, dir);
  assert.equal(reopened.has("202608201400"), true);
  assert.deepEqual(reopened.get("202608201400"), pixels);
});

test("createDiskPvStore: unknown timestamps are undefined, not a throw", () => {
  const store = createDiskPvStore(10, tmpDir());

  assert.equal(store.get("202608201400"), undefined);
  assert.equal(store.has("202608201400"), false);
});

// Grids are mostly zero, which is the whole reason they're gzipped on disk -
// if that ever stopped holding, the .data footprint would balloon silently.
test("createDiskPvStore: a sparse grid compresses hard on disk", () => {
  const dir = tmpDir();
  const store = createDiskPvStore(10, dir);
  const pixels = new Uint8Array(700 * 765);
  pixels[1234] = 200;

  store.put("202608201400", pixels);

  const [name] = readdirSync(dir);
  assert.equal(name, "202608201400.pv.gz");
});

test("createDiskPvStore: evicts the oldest grids past maxFrames", () => {
  const dir = tmpDir();
  const store = createDiskPvStore(2, dir);

  store.put("202608201400", grid(1));
  store.put("202608201405", grid(2));
  store.put("202608201410", grid(3));

  assert.equal(store.has("202608201400"), false, "oldest should be evicted");
  assert.equal(store.has("202608201405"), true);
  assert.equal(store.has("202608201410"), true);
  assert.equal(readdirSync(dir).length, 2, "the evicted file should be deleted too");
});

test("createDiskPvStore: eviction also applies to a cache that was over the cap on open", () => {
  const dir = tmpDir();
  const seed = createDiskPvStore(10, dir);
  seed.put("202608201400", grid(1));
  seed.put("202608201405", grid(2));
  seed.put("202608201410", grid(3));

  const reopened = createDiskPvStore(1, dir);

  assert.equal(reopened.has("202608201400"), false);
  assert.equal(reopened.has("202608201405"), false);
  assert.equal(reopened.has("202608201410"), true);
});

// An interrupted write leaves a truncated file. It must read as "missing" so
// the poller's backfill regenerates it, rather than throwing on every request.
test("createDiskPvStore: a corrupt grid reads as missing", () => {
  const dir = tmpDir();
  writeFileSync(path.join(dir, "202608201400.pv.gz"), "not actually gzip");

  const store = createDiskPvStore(10, dir);

  assert.equal(store.has("202608201400"), true, "indexed from disk before it's read");
  assert.equal(store.get("202608201400"), undefined);
  assert.equal(store.has("202608201400"), false, "dropped from the index once found corrupt");
});
