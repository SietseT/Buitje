import { gunzipSync, gzipSync } from "node:zlib";
import { mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const FILENAME_RE = /^(\d{12})\.pv\.gz$/;

export interface PvStore {
  put(timestamp: string, pixels: Uint8Array): void;
  get(timestamp: string): Uint8Array | undefined;
  has(timestamp: string): boolean;
}

/**
 * Keeps the raw PV (pixel value) grid of each cached frame, so a lon/lat can
 * be sampled after the fact - the PNGs the frontend receives are already
 * colorized and reprojected, so a dBZ reading can't be recovered from them.
 *
 * Deliberately NOT folded into FrameStore: that interface is documented as
 * swappable, and a grid is ~535 KB (700x765) against a PNG's tens of KB, so
 * loading one on every FrameStore.get() would slow down the hot
 * /api/frames/<timestamp>.png path for a value that route never uses.
 *
 * Grids are gzipped on disk (they are mostly zero, so they compress hard) and
 * cached decompressed in memory, because /api/point needs every frame at once
 * and gunzipping the whole timeline per request would be wasteful. The memory
 * cache is bounded by the same maxFrames as the on-disk index.
 */
export function createDiskPvStore(maxFrames: number, pvDir: string): PvStore {
  mkdirSync(pvDir, { recursive: true });

  const index = new Set<string>();
  for (const name of readdirSync(pvDir)) {
    const match = FILENAME_RE.exec(name);
    if (match) index.add(match[1]);
  }

  const memory = new Map<string, Uint8Array>();

  function pathFor(timestamp: string): string {
    return path.join(pvDir, `${timestamp}.pv.gz`);
  }

  function evictExcess(): void {
    const sorted = Array.from(index).sort();
    while (sorted.length > maxFrames) {
      const oldest = sorted.shift();
      if (oldest === undefined) break;
      index.delete(oldest);
      memory.delete(oldest);
      try {
        unlinkSync(pathFor(oldest));
      } catch {
        // already gone; nothing to clean up
      }
    }
  }

  evictExcess();

  return {
    put(timestamp, pixels) {
      writeFileSync(pathFor(timestamp), gzipSync(pixels));
      memory.set(timestamp, pixels);
      index.add(timestamp);
      evictExcess();
    },

    get(timestamp) {
      const cached = memory.get(timestamp);
      if (cached) return cached;
      if (!index.has(timestamp)) return undefined;
      try {
        const pixels = new Uint8Array(gunzipSync(readFileSync(pathFor(timestamp))));
        memory.set(timestamp, pixels);
        return pixels;
      } catch {
        // Truncated or corrupt (e.g. an interrupted write) - drop it from the
        // index so the poller's backfill regenerates it on the next tick,
        // rather than throwing on every subsequent request.
        index.delete(timestamp);
        return undefined;
      }
    },

    has(timestamp) {
      return index.has(timestamp);
    },
  };
}
