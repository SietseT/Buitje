import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const here = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.KNMI_API_KEY) {
  throw new Error(
    "KNMI_API_KEY is not set. Register a free key at " +
      "https://developer.dataplatform.knmi.nl (or find the shared anonymous " +
      "key in the Open Data API docs at " +
      "https://developer.dataplatform.knmi.nl/open-data-api) and set it in " +
      "apps/backend/.env as KNMI_API_KEY=...",
  );
}

const maxFrames = Number(process.env.MAX_FRAMES ?? 24); // ~2 hours at 5 min/frame

export const config = {
  knmi: {
    apiKey: process.env.KNMI_API_KEY,
    apiBase: "https://api.dataplatform.knmi.nl/open-data/v1",
    datasetName: "radar_reflectivity_composites",
    datasetVersion: "2.0",
  },
  poll: {
    intervalMs: Number(process.env.POLL_INTERVAL_MS ?? 60 * 1000),
  },
  cache: {
    maxFrames,
    // How many missing frames to download in parallel during backfill. A
    // dedicated (non-shared) KNMI key makes this much less rate-limit
    // sensitive than the old shared demo key was; fetchWithRetry's 429
    // backoff remains as a general safety net regardless.
    backfillConcurrency: Number(process.env.BACKFILL_CONCURRENCY ?? 8),
  },
  lightning: {
    // Blitzortung has no official API - these are its real-time WebSocket
    // relay hosts (unofficial, undocumented protocol). Picked randomly per
    // connection attempt to spread load and auto-recover if one is down.
    wsUrls: [
      "wss://ws1.blitzortung.org:3000/",
      "wss://ws5.blitzortung.org:3000/",
      "wss://ws6.blitzortung.org:3000/",
      "wss://ws7.blitzortung.org:3000/",
    ],
    // RadarMap.vue's NETHERLANDS_BOUNDS twin - used to filter the global
    // strike firehose before gridBounds (cache/frameStore.ts) is populated
    // by the first processed radar frame.
    fallbackBounds: { west: 3.2, south: 50.72, east: 7.35, north: 53.68 },
    boundsPaddingDeg: Number(process.env.LIGHTNING_BOUNDS_PADDING ?? 1.5),
    // Must cover the full radar timeline depth so scrubbing all the way
    // back still has matching lightning data - derived from maxFrames
    // rather than a fixed constant so the two stay in sync.
    retentionMs: Number(process.env.LIGHTNING_RETENTION_MS ?? maxFrames * 5 * 60 * 1000),
    maxStrikes: Number(process.env.LIGHTNING_MAX_STRIKES ?? 20000),
    reconnectBaseDelayMs: Number(process.env.LIGHTNING_RECONNECT_BASE_MS ?? 2000),
    reconnectMaxDelayMs: Number(process.env.LIGHTNING_RECONNECT_MAX_MS ?? 60000),
  },
  server: {
    port: Number(process.env.PORT ?? 3000),
    host: process.env.HOST ?? "0.0.0.0",
  },
  paths: {
    tmpDir: path.join(here, "..", ".tmp"),
    dataDir: path.join(here, "..", ".data"),
    framesDir: path.join(here, "..", ".data", "frames"),
    frontendDist: path.join(here, "..", "..", "frontend", "dist"),
  },
};
