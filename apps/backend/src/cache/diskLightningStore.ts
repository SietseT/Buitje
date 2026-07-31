import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Strike } from "../lightning/types.js";
import { createLightningStore, type LightningStore } from "./lightningStore.js";

export interface PersistentLightningStore extends LightningStore {
  /** Writes the buffer to disk now, if it changed since the last write. */
  flush(): void;
}

function isStrike(value: unknown): value is Strike {
  if (typeof value !== "object" || value === null) return false;
  const { lat, lon, timeMs, polarity } = value as Record<string, unknown>;
  return (
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    typeof lon === "number" &&
    Number.isFinite(lon) &&
    typeof timeMs === "number" &&
    Number.isFinite(timeMs) &&
    (polarity === null || (typeof polarity === "number" && Number.isFinite(polarity)))
  );
}

/**
 * Disk-backed LightningStore: the in-memory buffer wrapped in a periodic
 * JSON snapshot at <dataDir>/lightning.json, reloaded on startup.
 *
 * Unlike radar frames, strikes can't be backfilled - Blitzortung's feed is
 * live-only, so anything missed while the process was down is gone for good.
 * Without this, every restart (including each `tsx watch` reload in dev) left
 * the timeline with no lightning until ~15 minutes of new strikes had
 * accumulated, since the newest radar frame lags real time by ~5-10 min and
 * its bucket therefore predates the restart.
 *
 * A whole-buffer snapshot rather than an append log: strikes arrive several
 * per second, but the buffer is bounded (maxStrikes) and small enough (~1 MB
 * at the 20k default) that rewriting it on a timer is cheaper than an
 * append-plus-compaction scheme, and it can't drift out of sync with the
 * retention/cap pruning that lightningStore.ts already does on every add.
 * Writes go to a temp file and are renamed into place, so a crash mid-write
 * leaves the previous snapshot intact rather than a truncated one.
 *
 * Losing up to flushIntervalMs of strikes on an unclean kill is deliberate -
 * index.ts flushes on SIGINT/SIGTERM and on the fatal-error path, so this
 * only bites on a hard SIGKILL, where a few seconds of an ancillary overlay
 * is not worth an fsync per strike.
 */
export function createDiskLightningStore(
  retentionMs: number,
  maxStrikes: number,
  filePath: string,
  flushIntervalMs: number,
  now: () => number = Date.now,
): PersistentLightningStore {
  mkdirSync(path.dirname(filePath), { recursive: true });

  const memory = createLightningStore(retentionMs, maxStrikes, now);
  let dirty = false;

  // Replaying through add() rather than assigning the array directly means
  // the snapshot goes through the same retention/cap pruning as live strikes,
  // so a stale file (e.g. after the process was down for hours) loads as
  // empty instead of resurrecting expired strikes.
  let restored = 0;
  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (!isStrike(entry)) continue;
        memory.add(entry);
        restored++;
      }
    }
  } catch {
    // No snapshot yet, or an unreadable/corrupt one - starting empty is the
    // correct recovery either way, and the next flush overwrites it.
  }
  console.log(
    `[lightning] restored ${memory.size()} strikes from disk` +
      (restored !== memory.size() ? ` (${restored - memory.size()} expired on load)` : ""),
  );

  function flush(): void {
    if (!dirty) return;
    const tmpPath = `${filePath}.tmp`;
    try {
      writeFileSync(tmpPath, JSON.stringify(memory.all()));
      renameSync(tmpPath, filePath);
      dirty = false;
    } catch (err) {
      // A failed snapshot must not take the process down - the in-memory
      // buffer is still correct, and the next flush retries.
      console.warn(`[lightning] failed to persist strikes: ${String(err)}`);
    }
  }

  const timer = setInterval(flush, flushIntervalMs);
  timer.unref();

  return {
    add(strike) {
      memory.add(strike);
      dirty = true;
    },
    inWindow: (endMs, windowMs) => memory.inWindow(endMs, windowMs),
    all: () => memory.all(),
    size: () => memory.size(),
    flush,
  };
}
