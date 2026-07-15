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

export const config = {
  knmi: {
    apiKey: process.env.KNMI_API_KEY,
    apiBase: "https://api.dataplatform.knmi.nl/open-data/v1",
    datasetName: "radar_reflectivity_composites",
    datasetVersion: "2.0",
  },
  poll: {
    intervalMs: Number(process.env.POLL_INTERVAL_MS ?? 5 * 60 * 1000),
  },
  cache: {
    maxFrames: Number(process.env.MAX_FRAMES ?? 24), // ~2 hours at 5 min/frame
  },
  server: {
    port: Number(process.env.PORT ?? 3000),
    host: process.env.HOST ?? "0.0.0.0",
  },
  paths: {
    tmpDir: path.join(here, "..", ".tmp"),
    frontendDist: path.join(here, "..", "..", "frontend", "dist"),
  },
};
