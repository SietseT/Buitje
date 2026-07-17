import type { FastifyInstance } from "fastify";
import type { FrameStore } from "../cache/frameStore.js";
import { gridBounds } from "../cache/frameStore.js";

export function registerFrameRoutes(app: FastifyInstance, store: FrameStore): void {
  app.get("/api/frames", async () => {
    return store.list().map(({ timestamp }) => ({
      timestamp,
      url: `/api/frames/${timestamp}.png`,
    }));
  });

  app.get("/api/frames/bounds", async (_req, reply) => {
    if (!gridBounds) {
      return reply.status(503).send({ error: "No frames processed yet" });
    }
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
