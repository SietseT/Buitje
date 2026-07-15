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
    const png = colorizeFrame(frame.pixels, frame.calibration, remap);

    store.put({ timestamp: frame.timestamp, png });
    console.log(`[poller] processed ${filename} (${png.length} bytes)`);
  } finally {
    await rm(tmpPath, { force: true });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches the most recent MAX_FRAMES filenames and processes whichever
 * aren't already cached. Used for both startup backfill and every
 * recurring poll (rather than just diffing against "the latest filename
 * I last saw"), so a delayed tick, timer drift, or a dev restart can
 * never silently leave a gap in the timeline - any file KNMI still has
 * in its recent window gets caught up on the next run. Spaced out
 * because the shared anonymous KNMI key is rate-limited to 50 req/min
 * across all anonymous users, and each frame costs 2 requests.
 */
async function syncRecentFiles(store: FrameStore): Promise<void> {
  const filenames = await fetchRecentFilenames(config.cache.maxFrames);
  for (const filename of filenames) {
    if (store.has(extractTimestampFromFilename(filename))) continue;
    try {
      await processFile(store, filename);
    } catch (err) {
      console.error(`[poller] failed to process ${filename}:`, err);
    }
    await sleep(1500);
  }
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
