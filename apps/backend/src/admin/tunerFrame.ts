import path from "node:path";
import { config } from "../config.js";
import { parseRadarFile, type RadarCalibration } from "../knmi/parseRadar.js";
import { getRemapGrid, type RemapGrid } from "../knmi/reproject.js";

// Fixed frame for the color tuner: 2026-07-16 14:30 CEST (UTC+2) = 12:30 UTC.
// KNMI filenames are UTC, 5-min aligned: RAD_NL25_PCP_NA_<YYYYMMDDHHmm>.h5
export const TUNER_FILENAME = "RAD_NL25_PCP_NA_202607161230.h5";

// Kept permanently (unlike the regular frame cache in `dataDir/frames`, which
// evicts down to MAX_FRAMES / ~2 hours) so the tuner survives backend
// restarts and doesn't depend on KNMI's Open Data API still serving this
// specific historical file down the line. Fetched once via
// `pnpm fetch-tuner-frame` (apps/backend/scripts/fetch-tuner-frame.ts) - this
// module only ever reads it from disk, never downloads it itself.
export const TUNER_FRAME_PATH = path.join(config.paths.dataDir, TUNER_FILENAME);

interface TunerFrame {
  pixels: Uint8Array;
  calibration: RadarCalibration;
  remap: RemapGrid;
}

let cached: TunerFrame | null = null;
let inflight: Promise<TunerFrame> | null = null;

async function loadTunerFrame(): Promise<TunerFrame> {
  const frame = await parseRadarFile(TUNER_FRAME_PATH, TUNER_FILENAME);
  const remap = getRemapGrid(frame.geometry);
  return { pixels: frame.pixels, calibration: frame.calibration, remap };
}

/** Parses the fixed color-tuner frame from disk once, then serves it from memory. */
export async function getTunerFrame(): Promise<TunerFrame> {
  if (cached) return cached;
  if (!inflight) {
    inflight = loadTunerFrame()
      .then((frame) => {
        cached = frame;
        return frame;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}
