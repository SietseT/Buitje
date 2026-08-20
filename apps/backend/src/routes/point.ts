import type { FastifyInstance } from "fastify";
import type { FrameStore } from "../cache/frameStore.js";
import type { PvStore } from "../cache/pvStore.js";
import { gridInfo } from "../cache/frameStore.js";
import { sampleDbz } from "../knmi/samplePoint.js";

export function registerPointRoutes(
  app: FastifyInstance,
  frames: FrameStore,
  pv: PvStore,
): void {
  /**
   * Reflectivity over the cached timeline at a single coordinate - what the
   * place panel's chart and sparklines read. The frontend only ever receives
   * colorized PNGs, so it cannot recover a dBZ value itself.
   *
   * One entry per frame in the same ascending order as GET /api/frames, so
   * the two line up index-for-index without the client having to join them.
   */
  app.get("/api/point", async (req, reply) => {
    const { lat, lon } = req.query as { lat?: string; lon?: string };
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return reply.status(400).send({ error: "lat and lon must be numbers" });
    }

    const info = gridInfo;
    if (!info) {
      return reply.status(503).send({ error: "No frames processed yet" });
    }

    // Matches GET /api/frames: long enough to dedupe near-simultaneous
    // requests (several places on screen at once, remounts, extra tabs),
    // short enough that a newly-arrived frame is never hidden behind a stale
    // response. The series only changes when a frame lands, every 5 minutes.
    reply.header("Cache-Control", "public, max-age=30");

    // A coordinate outside the radar grid is a legitimate answer ("nothing
    // measured here"), not an error - the panel renders a gap for it.
    return {
      points: frames.list().map(({ timestamp }) => {
        const pixels = pv.get(timestamp);
        return {
          timestamp,
          dbz: pixels
            ? sampleDbz(pixels, longitude, latitude, info.geometry, info.calibration)
            : null,
        };
      }),
    };
  });
}
