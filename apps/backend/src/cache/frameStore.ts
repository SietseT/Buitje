import type { Bounds } from "../knmi/reproject.js";

export interface StoredFrame {
  timestamp: string;
  png: Buffer;
}

export interface FrameStore {
  put(frame: StoredFrame): void;
  get(timestamp: string): StoredFrame | undefined;
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
}
