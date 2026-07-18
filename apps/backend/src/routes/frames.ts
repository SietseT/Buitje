import type { FastifyInstance } from "fastify";
import type { FrameStore } from "../cache/frameStore.js";
import { gridBounds } from "../cache/frameStore.js";

export function registerFrameRoutes(app: FastifyInstance, store: FrameStore): void {
  app.get("/api/frames", async (_req, reply) => {
    // Polled every 60s (useRadarFrames.ts); a short max-age just dedupes
    // near-simultaneous fetches (multiple tabs, remounts) without risking a
    // newly-arrived frame being hidden behind a stale cached response.
    reply.header("Cache-Control", "public, max-age=30");
    return store.list().map(({ timestamp }) => ({
      timestamp,
      url: `/api/frames/${timestamp}.png`,
    }));
  });

  app.get("/api/frames/bounds", async (_req, reply) => {
    if (!gridBounds) {
      return reply.status(503).send({ error: "No frames processed yet" });
    }
    // Fixed KNMI grid geometry, fetched once per session — safe to cache long.
    reply.header("Cache-Control", "public, max-age=86400");
    return gridBounds;
  });

  app.get("/api/frames/:timestamp(^\\d{12}$).png", async (req, reply) => {
    const { timestamp } = req.params as { timestamp: string };
    const { smooth } = req.query as { smooth?: string };
    const frame = store.get(timestamp);
    if (!frame) {
      return reply.status(404).send({ error: "Frame not found" });
    }
    const png = smooth === "false" ? frame.pngHard : frame.pngSmooth;
    reply.header("Content-Type", "image/png");
    reply.header("Cache-Control", "public, max-age=300, immutable");
    return reply.send(png);
  });
}
