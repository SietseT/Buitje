import type { FastifyInstance } from "fastify";
import type { LightningStore } from "../cache/lightningStore.js";

const BUCKET_MS = 5 * 60 * 1000;

/**
 * Parses a YYYYMMDDHHmm frame timestamp (UTC, per CLAUDE.md) into an epoch
 * ms - mirrors Timeline.vue's formatTime Date.UTC(...) construction, since
 * extractTimestampFromFilename (knmi/parseRadar.ts) only extracts the raw
 * substring, it doesn't convert it to a Date.
 */
function parseFrameTimestamp(timestamp: string): number {
  const year = Number(timestamp.slice(0, 4));
  const month = Number(timestamp.slice(4, 6)) - 1;
  const day = Number(timestamp.slice(6, 8));
  const hour = Number(timestamp.slice(8, 10));
  const minute = Number(timestamp.slice(10, 12));
  return Date.UTC(year, month, day, hour, minute);
}

export function registerLightningRoutes(app: FastifyInstance, store: LightningStore): void {
  app.get("/api/lightning/:timestamp(^\\d{12}$)", async (req, reply) => {
    const { timestamp } = req.params as { timestamp: string };
    const endMs = parseFrameTimestamp(timestamp);
    // Short cache just dedupes near-simultaneous requests (multiple tabs,
    // rapid timeline scrubbing re-requesting the same frame).
    reply.header("Cache-Control", "public, max-age=30");
    return {
      strikes: store.inWindow(endMs, BUCKET_MS).map(({ lat, lon, timeMs, polarity }) => ({
        lat,
        lon,
        timeMs,
        polarity,
      })),
    };
  });
}
