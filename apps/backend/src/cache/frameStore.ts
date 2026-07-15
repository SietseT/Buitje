import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import type { Bounds } from "../knmi/reproject.js";

const BOUNDS_FILE = path.join(config.paths.dataDir, "bounds.json");

export interface StoredFrame {
  timestamp: string;
  png: Buffer;
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
