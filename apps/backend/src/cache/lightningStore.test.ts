import { test } from "node:test";
import assert from "node:assert/strict";
import { createLightningStore } from "./lightningStore.js";

function strike(timeMs: number) {
  return { lat: 52, lon: 5, timeMs, polarity: null as number | null };
}

test("createLightningStore: prunes strikes older than retentionMs on add", () => {
  let now = 100_000;
  const store = createLightningStore(10_000, 100, () => now);

  store.add(strike(now));
  assert.equal(store.size(), 1);

  now += 15_000; // advance the clock past retentionMs
  store.add(strike(now)); // triggers a prune pass against the new "now"

  assert.equal(store.size(), 1); // the first strike is now older than retentionMs
});

test("createLightningStore: caps total size at maxStrikes, dropping oldest first", () => {
  const now = 100_000;
  const store = createLightningStore(1_000_000, 3, () => now);

  store.add(strike(now - 30));
  store.add(strike(now - 20));
  store.add(strike(now - 10));
  store.add(strike(now)); // pushes size to 4, oldest (-30) should be dropped

  assert.equal(store.size(), 3);
  const kept = store.inWindow(now, 1_000_000);
  assert.deepEqual(
    kept.map((s) => s.timeMs),
    [now - 20, now - 10, now],
  );
});

test("createLightningStore: inWindow is inclusive of endMs, exclusive of the start boundary", () => {
  const now = 100_000;
  const store = createLightningStore(1_000_000, 100, () => now);

  store.add(strike(now - 300_000)); // exactly at the start boundary -> excluded
  store.add(strike(now - 299_999)); // just inside -> included
  store.add(strike(now)); // exactly at endMs -> included
  store.add(strike(now + 1)); // after endMs -> excluded

  const result = store.inWindow(now, 300_000);
  assert.deepEqual(
    result.map((s) => s.timeMs),
    [now - 299_999, now],
  );
});
