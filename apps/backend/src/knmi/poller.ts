import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { fetchLatestFilename, fetchRecentFilenames, downloadFile } from "./client.js";
import { parseRadarFile } from "./parseRadar.js";
import { getRemapGrid } from "./reproject.js";
import { colorizeFrame } from "./colorize.js";
import { setGridBounds, type FrameStore } from "../cache/frameStore.js";

let lastFilename: string | null = null;

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
    lastFilename = filename;
    console.log(`[poller] processed ${filename} (${png.length} bytes)`);
  } finally {
    await rm(tmpPath, { force: true });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fills the cache with recent history on startup instead of waiting for
 * real time to pass one 5-minute poll at a time. Spaced out because the
 * shared anonymous KNMI key is rate-limited to 50 req/min across all
 * anonymous users, and each frame costs 2 requests. */
async function backfill(store: FrameStore): Promise<void> {
  const filenames = await fetchRecentFilenames(config.cache.maxFrames);
  for (const filename of filenames) {
    try {
      await processFile(store, filename);
    } catch (err) {
      console.error(`[poller] backfill failed for ${filename}:`, err);
    }
    await sleep(1500);
  }
}

async function processLatestFile(store: FrameStore): Promise<void> {
  const filename = await fetchLatestFilename();
  if (filename === lastFilename) {
    return;
  }
  await processFile(store, filename);
}

export function startPoller(store: FrameStore): void {
  backfill(store)
    .catch((err) => console.error("[poller] backfill failed:", err))
    .finally(() => {
      setInterval(() => {
        processLatestFile(store).catch((err) => {
          console.error("[poller] failed to process latest KNMI file:", err);
        });
      }, config.poll.intervalMs);
    });
}
