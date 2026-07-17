import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { fetchRecentFilenames, downloadFile } from "./client.js";
import { extractTimestampFromFilename, parseRadarFile } from "./parseRadar.js";
import { getRemapGrid } from "./reproject.js";
import { colorizeFrame } from "./colorize.js";
import { setGridBounds, type FrameStore } from "../cache/frameStore.js";

async function processFile(store: FrameStore, filename: string): Promise<void> {
  const buffer = await downloadFile(filename);
  await mkdir(config.paths.tmpDir, { recursive: true });
  const tmpPath = path.join(config.paths.tmpDir, filename);
  await writeFile(tmpPath, buffer);

  try {
    const frame = await parseRadarFile(tmpPath, filename);
    const remap = getRemapGrid(frame.geometry);
    setGridBounds(remap.bounds);
    const pngSmooth = colorizeFrame(frame.pixels, frame.calibration, remap, undefined, true);
    const pngHard = colorizeFrame(frame.pixels, frame.calibration, remap, undefined, false);

    store.put({ timestamp: frame.timestamp, pngSmooth, pngHard });
    console.log(
      `[poller] processed ${filename} (${pngSmooth.length + pngHard.length} bytes)`,
    );
  } finally {
    await rm(tmpPath, { force: true });
  }
}

/**
 * Runs `task` over `items` with at most `concurrency` in flight at once.
 * Each worker pulls the next item off the shared index until the list is
 * exhausted, so - combined with a newest-first `items` order - the most
 * recent items are guaranteed to be among the first ones processed,
 * regardless of how individual downloads happen to interleave.
 */
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const item = items[next++];
      await task(item);
    }
  }
  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
}

/**
 * Fetches the most recent MAX_FRAMES filenames (newest first) and
 * processes whichever aren't already cached, several at a time. Used for
 * both startup backfill and every recurring poll (rather than just
 * diffing against "the latest filename I last saw"), so a delayed tick,
 * timer drift, or a dev restart can never silently leave a gap in the
 * timeline - any file KNMI still has in its recent window gets caught up
 * on the next run. Newest-first + concurrent means a cold start shows the
 * current frame almost immediately, with older history backfilling
 * alongside it rather than after it.
 */
async function syncRecentFiles(store: FrameStore): Promise<void> {
  const filenames = await fetchRecentFilenames(config.cache.maxFrames);
  const missing = filenames.filter(
    (filename) => !store.has(extractTimestampFromFilename(filename)),
  );

  await runWithConcurrency(missing, config.cache.backfillConcurrency, async (filename) => {
    try {
      await processFile(store, filename);
    } catch (err) {
      console.error(`[poller] failed to process ${filename}:`, err);
    }
  });
}

export function startPoller(store: FrameStore): void {
  // Chained so a slow sync can never overlap the next interval tick.
  let syncing = Promise.resolve();
  const runSync = () => {
    syncing = syncing
      .then(() => syncRecentFiles(store))
      .catch((err) => console.error("[poller] sync failed:", err));
  };

  runSync();
  setInterval(runSync, config.poll.intervalMs);
}
