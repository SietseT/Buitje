import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const here = path.dirname(fileURLToPath(import.meta.url));

const maxFrames = Number(process.env.MAX_FRAMES ?? 24); // ~2 hours at 5 min/frame

export const config = {
  knmi: {
    apiKey: process.env.KNMI_API_KEY ?? "",
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
    //
    // NOTE: no ":3000". Most third-party clients (and most search results)
    // still show `wss://ws1.blitzortung.org:3000/`, but that port is now
    // closed on every relay host - the TCP connect fails and the WebSocket
    // upgrade returns a non-101 status. The feed lives on plain 443 now.
    // Verified by probing: ws1/ws7/ws8 accept connections and stream data;
    // ws5 and ws6 refuse them entirely, so they're deliberately not listed.
    // Don't "restore" the port or the missing hosts without re-probing.
    wsUrls: [
      "wss://ws1.blitzortung.org/",
      "wss://ws7.blitzortung.org/",
      "wss://ws8.blitzortung.org/",
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
    // How often the strike buffer is snapshotted to disk (see
    // cache/diskLightningStore.ts). Also the worst-case data loss on a hard
    // kill - normal shutdowns flush explicitly.
    flushIntervalMs: Number(process.env.LIGHTNING_FLUSH_INTERVAL_MS ?? 30 * 1000),
    reconnectBaseDelayMs: Number(process.env.LIGHTNING_RECONNECT_BASE_MS ?? 2000),
    reconnectMaxDelayMs: Number(process.env.LIGHTNING_RECONNECT_MAX_MS ?? 60000),
    // Blitzortung is a global firehose - connectLightningStream's onRawMessage
    // fires many times per second whenever the socket is actually healthy,
    // regardless of the NL bounds filter (that happens downstream in
    // relay.ts). A connection can go silently dead - open, no error, no close
    // event, just zero further messages forever - which the reconnect logic
    // in client.ts can't detect on its own since nothing fires to trigger it.
    // This is what previously required a manual container restart to fix.
    // The watchdog in client.ts force-closes the socket (triggering the
    // normal reconnect path) if this much time passes with no message at all.
    staleMs: Number(process.env.LIGHTNING_STALE_MS ?? 2 * 60 * 1000),
  },
  server: {
    port: Number(process.env.PORT ?? 3001),
    host: process.env.HOST ?? "0.0.0.0",
    // Off by default - Fastify's automatic per-request access log (one line
    // per incoming request, one per completed response) is noisy in normal
    // dev use since this app polls its own endpoints every 30s-5min from the
    // frontend. Flip on to debug routing/latency issues.
    logRequests: process.env.LOG_REQUESTS === "true",
  },
  paths: {
    tmpDir: path.join(here, "..", ".tmp"),
    dataDir: path.join(here, "..", ".data"),
    framesDir: path.join(here, "..", ".data", "frames"),
    // Inside dataDir so docker-compose's existing .data volume persists it
    // across container restarts without a second mount.
    lightningFile: path.join(here, "..", ".data", "lightning.json"),
    frontendDist: path.join(here, "..", "..", "frontend", "dist"),
  },
};

// Deliberately NOT a module-level check: importing this module must stay
// side-effect free so tests (and CI, which has no .env) can read the pure
// config values without a KNMI key. index.ts calls this before doing
// anything, so the backend itself still fails fast with a useful message.
export function assertRequiredConfig(): void {
  if (!config.knmi.apiKey) {
    throw new Error(
      "KNMI_API_KEY is not set. Register a free key at " +
        "https://developer.dataplatform.knmi.nl (or find the shared anonymous " +
        "key in the Open Data API docs at " +
        "https://developer.dataplatform.knmi.nl/open-data-api) and set it in " +
        "apps/backend/.env as KNMI_API_KEY=...",
    );
  }
}
