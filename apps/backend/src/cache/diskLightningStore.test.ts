import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDiskLightningStore } from "./diskLightningStore.js";

function strike(timeMs: number, lat = 52, lon = 5) {
  return { lat, lon, timeMs, polarity: null as number | null };
}

function tmpFile(): string {
  return path.join(mkdtempSync(path.join(tmpdir(), "buitje-lightning-")), "lightning.json");
}

// Long retention + a big cap unless a test is specifically exercising them.
const RETENTION = 2 * 60 * 60 * 1000;

test("createDiskLightningStore: strikes survive a restart", () => {
  const file = tmpFile();
  const now = 1_700_000_000_000;

  const first = createDiskLightningStore(RETENTION, 100, file, 60_000, () => now);
  first.add(strike(now - 1000, 53.05, 8.45));
  first.add(strike(now - 500));
  first.flush();

  const second = createDiskLightningStore(RETENTION, 100, file, 60_000, () => now);
  assert.equal(second.size(), 2);
  assert.deepEqual(
    second.all().map((s) => s.timeMs),
    [now - 1000, now - 500],
  );
  // The full strike survives the round trip, not just its timestamp.
  assert.deepEqual(second.all()[0], { lat: 53.05, lon: 8.45, timeMs: now - 1000, polarity: null });
});

test("createDiskLightningStore: reloaded strikes are queryable by window", () => {
  const file = tmpFile();
  const now = 1_700_000_000_000;

  const first = createDiskLightningStore(RETENTION, 100, file, 60_000, () => now);
  first.add(strike(now - 60_000));
  first.flush();

  // The whole point of persisting: the frame bucket that predates the restart
  // still resolves after it.
  const second = createDiskLightningStore(RETENTION, 100, file, 60_000, () => now);
  assert.equal(second.inWindow(now, 5 * 60 * 1000).length, 1);
});

test("createDiskLightningStore: prunes strikes that expired while the process was down", () => {
  const file = tmpFile();
  const start = 1_700_000_000_000;

  const first = createDiskLightningStore(RETENTION, 100, file, 60_000, () => start);
  first.add(strike(start - 1000));
  first.flush();

  // Restart three hours later - past the two-hour retention.
  const later = start + 3 * 60 * 60 * 1000;
  const second = createDiskLightningStore(RETENTION, 100, file, 60_000, () => later);
  assert.equal(second.size(), 0);
});

test("createDiskLightningStore: honors maxStrikes when loading a snapshot", () => {
  const file = tmpFile();
  const now = 1_700_000_000_000;

  const first = createDiskLightningStore(RETENTION, 100, file, 60_000, () => now);
  for (let i = 0; i < 10; i++) first.add(strike(now - (10 - i)));
  first.flush();

  const second = createDiskLightningStore(RETENTION, 3, file, 60_000, () => now);
  assert.equal(second.size(), 3);
  assert.deepEqual(
    second.all().map((s) => s.timeMs),
    [now - 3, now - 2, now - 1],
  );
});

test("createDiskLightningStore: flush is a no-op when nothing changed", () => {
  const file = tmpFile();
  const now = 1_700_000_000_000;

  const store = createDiskLightningStore(RETENTION, 100, file, 60_000, () => now);
  store.add(strike(now));
  store.flush();
  const first = readFileSync(file, "utf8");

  store.flush(); // not dirty - must not rewrite
  assert.equal(readFileSync(file, "utf8"), first);
});

test("createDiskLightningStore: starts empty when there is no snapshot", () => {
  const store = createDiskLightningStore(RETENTION, 100, tmpFile(), 60_000);
  assert.equal(store.size(), 0);
});

test("createDiskLightningStore: tolerates a corrupt snapshot", () => {
  const file = tmpFile();
  writeFileSync(file, "{not json at all");

  const store = createDiskLightningStore(RETENTION, 100, file, 60_000);
  assert.equal(store.size(), 0);

  // And recovers - the next flush replaces the bad file.
  store.add(strike(Date.now()));
  store.flush();
  assert.equal(createDiskLightningStore(RETENTION, 100, file, 60_000).size(), 1);
});

test("createDiskLightningStore: skips malformed entries in an otherwise valid snapshot", () => {
  const file = tmpFile();
  const now = 1_700_000_000_000;
  writeFileSync(
    file,
    JSON.stringify([
      { lat: 52, lon: 5, timeMs: now, polarity: null },
      { lat: "nope", lon: 5, timeMs: now, polarity: null },
      { lon: 5, timeMs: now },
      null,
      { lat: 53, lon: 6, timeMs: now, polarity: -1 },
    ]),
  );

  const store = createDiskLightningStore(RETENTION, 100, file, 60_000, () => now);
  assert.equal(store.size(), 2);
  assert.deepEqual(
    store.all().map((s) => s.lat),
    [52, 53],
  );
});
