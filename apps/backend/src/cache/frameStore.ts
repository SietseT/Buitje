import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import type { Bounds } from "../knmi/reproject.js";
import type { RadarCalibration, RadarGeometry } from "../knmi/parseRadar.js";

const BOUNDS_FILE = path.join(config.paths.dataDir, "bounds.json");
const GRID_INFO_FILE = path.join(config.paths.dataDir, "grid.json");

export interface StoredFrame {
  timestamp: string;
  pngSmooth: Buffer;
  pngHard: Buffer;
}

export interface FrameStore {
  put(frame: StoredFrame): void;
  get(timestamp: string): StoredFrame | undefined;
  has(timestamp: string): boolean;
  list(): { timestamp: string }[];
  latest(): StoredFrame | undefined;
}

/**
 * In-memory ring buffer, capped at maxFrames. Swappable later for a
 * disk-backed implementation (same interface) to retain more than a
 * couple of hours of history without touching callers.
 */
export function createInMemoryFrameStore(maxFrames: number): FrameStore {
  const frames = new Map<string, StoredFrame>();

  return {
    put(frame) {
      frames.set(frame.timestamp, frame);
      if (frames.size > maxFrames) {
        const oldestKey = frames.keys().next().value;
        if (oldestKey !== undefined) frames.delete(oldestKey);
      }
    },
    get(timestamp) {
      return frames.get(timestamp);
    },
    has(timestamp) {
      return frames.has(timestamp);
    },
    list() {
      return Array.from(frames.keys())
        .sort()
        .map((timestamp) => ({ timestamp }));
    },
    latest() {
      const keys = Array.from(frames.keys()).sort();
      const lastKey = keys[keys.length - 1];
      return lastKey ? frames.get(lastKey) : undefined;
    },
  };
}

export let gridBounds: Bounds | null = null;

export function setGridBounds(bounds: Bounds): void {
  gridBounds = bounds;
  mkdirSync(config.paths.dataDir, { recursive: true });
  writeFileSync(BOUNDS_FILE, JSON.stringify(bounds));
}

/**
 * Restores gridBounds persisted by a previous run, so the map overlay can
 * position itself immediately on restart instead of waiting for the next
 * newly-downloaded frame (which the poller may skip via backfill's
 * already-cached check, delaying it by up to a full poll interval).
 */
export function loadGridBounds(): void {
  try {
    gridBounds = JSON.parse(readFileSync(BOUNDS_FILE, "utf-8"));
  } catch {
    // no persisted bounds yet
  }
}

/**
 * The projection + calibration needed to read a dBZ value back out of a
 * cached PV grid at an arbitrary lon/lat (see knmi/samplePoint.ts). Held
 * separately from the frames themselves because it is the same for every
 * frame - KNMI's composite grid is fixed.
 */
export interface GridInfo {
  geometry: RadarGeometry;
  calibration: RadarCalibration;
}

export let gridInfo: GridInfo | null = null;

export function setGridInfo(geometry: RadarGeometry, calibration: RadarCalibration): void {
  const next: GridInfo = { geometry, calibration };
  const serialized = JSON.stringify(next);
  // Backfill can process a couple of dozen files in a burst, all carrying
  // identical geometry - skip the rewrite when nothing actually changed.
  if (gridInfo && JSON.stringify(gridInfo) === serialized) return;
  gridInfo = next;
  mkdirSync(config.paths.dataDir, { recursive: true });
  writeFileSync(GRID_INFO_FILE, serialized);
}

/**
 * Restores the grid info persisted by a previous run. Load-bearing for the
 * same reason as loadGridBounds: the poller's backfill skips frames that are
 * already cached (poller.ts), so after a restart with a full cache nothing
 * would re-parse an HDF5 file, and /api/point would 503 indefinitely.
 */
export function loadGridInfo(): void {
  try {
    gridInfo = JSON.parse(readFileSync(GRID_INFO_FILE, "utf-8"));
  } catch {
    // no persisted grid info yet
  }
}
