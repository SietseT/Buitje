import type { FastifyInstance } from "fastify";
import { config } from "../config.js";

export function registerMetaRoutes(app: FastifyInstance): void {
  app.get("/api/meta", async (_req, reply) => {
    // Short-lived, unlike /api/frames/bounds' day-long cache: bounds is
    // KNMI's fixed grid geometry and truly never changes across a restart,
    // but GITHUB_URL is meant to be flipped in .env and take effect on the
    // next restart - a long cache here just means a stale value lingers in
    // visitors' browsers for hours after an operator intentionally changed
    // it. Short max-age still dedupes near-simultaneous loads.
    reply.header("Cache-Control", "public, max-age=30");
    return { githubUrl: config.meta.githubUrl };
  });
}
