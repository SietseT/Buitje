import type { FastifyInstance } from "fastify";
import { DEFAULT_STOPS, colorizeFrame, type ColorStop } from "../knmi/colorize.js";
import { getTunerFrame } from "../admin/tunerFrame.js";

function parseStops(raw: unknown): ColorStop[] {
  if (!Array.isArray(raw) || raw.length < 2) {
    throw new Error("stops must be an array of at least 2 entries");
  }
  return raw.map((entry) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error("each stop must be an object");
    }
    const { dbz, r, g, b, a } = entry as Record<string, unknown>;
    for (const [key, value] of Object.entries({ dbz, r, g, b, a })) {
      if (typeof value !== "number" || Number.isNaN(value)) {
        throw new Error(`stop field "${key}" must be a number`);
      }
    }
    return { dbz, r, g, b, a } as ColorStop;
  });
}

export function registerAdminRoutes(app: FastifyInstance): void {
  app.get("/api/admin/colors/default-stops", async () => DEFAULT_STOPS);

  app.get("/api/admin/colors/preview", async (req, reply) => {
    const { stops: stopsParam } = req.query as { stops?: string };

    let stops = DEFAULT_STOPS;
    if (stopsParam) {
      try {
        stops = parseStops(JSON.parse(stopsParam));
      } catch (err) {
        return reply.status(400).send({ error: `invalid stops: ${(err as Error).message}` });
      }
    }

    const frame = await getTunerFrame();
    const png = colorizeFrame(frame.pixels, frame.calibration, frame.remap, stops);
    reply.header("Content-Type", "image/png");
    reply.header("Cache-Control", "no-store");
    return reply.send(png);
  });
}
