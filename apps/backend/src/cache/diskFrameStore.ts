import { mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { FrameStore } from "./frameStore.js";

const FILENAME_RE = /^(\d{12})\.png$/;

/**
 * Disk-backed FrameStore: PNGs live as <framesDir>/<timestamp>.png. An
 * in-memory Set of timestamps tracks what's on disk without re-reading
 * file bytes on every call; put/get only touch disk for the actual PNG.
 */
export function createDiskFrameStore(maxFrames: number, framesDir: string): FrameStore {
  mkdirSync(framesDir, { recursive: true });

  const index = new Set<string>(
    readdirSync(framesDir)
      .map((name) => FILENAME_RE.exec(name)?.[1])
      .filter((timestamp): timestamp is string => !!timestamp),
  );

  function pathFor(timestamp: string): string {
    return path.join(framesDir, `${timestamp}.png`);
  }

  function evictExcess(): void {
    const sorted = Array.from(index).sort();
    while (sorted.length > maxFrames) {
      const oldest = sorted.shift();
      if (oldest === undefined) break;
      index.delete(oldest);
      try {
        unlinkSync(pathFor(oldest));
      } catch {
        // already gone; nothing to clean up
      }
    }
  }

  evictExcess();

  function get(timestamp: string) {
    if (!index.has(timestamp)) return undefined;
    try {
      return { timestamp, png: readFileSync(pathFor(timestamp)) };
    } catch {
      index.delete(timestamp);
      return undefined;
    }
  }

  return {
    put(frame) {
      writeFileSync(pathFor(frame.timestamp), frame.png);
      index.add(frame.timestamp);
      evictExcess();
    },
    get,
    has(timestamp) {
      return index.has(timestamp);
    },
    list() {
      return Array.from(index)
        .sort()
        .map((timestamp) => ({ timestamp }));
    },
    latest() {
      const sorted = Array.from(index).sort();
      const last = sorted[sorted.length - 1];
      return last ? get(last) : undefined;
    },
  };
}
