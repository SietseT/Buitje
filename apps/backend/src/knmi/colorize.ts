import { PNG } from "pngjs";
import type { RadarCalibration } from "./parseRadar.js";
import type { RemapGrid } from "./reproject.js";

export interface ColorStop {
  dbz: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

// Standard-ish reflectivity color ramp: transparent below the visible-rain
// floor, then light blue -> darker blue -> yellow -> orange -> red -> magenta
// with alpha ramping in over the first few stops so light drizzle fades in
// softly. No green step - the blue deepens right up until it jumps to yellow.
// Yellow (medium/heavy rain) only kicks in at 45 dBZ - moved up from 35 so
// the blue band covers light-to-moderate rain, with orange/red/purple
// compressed proportionally above it to still reach the same 65 dBZ ceiling.
export const DEFAULT_STOPS: ColorStop[] = [
  { dbz: 5, r: 6, g: 232, b: 228, a: 200 },
  { dbz: 10, r: 9, g: 158, b: 242, a: 200 },
  { dbz: 15, r: 4, g: 0, b: 243, a: 200 },
  { dbz: 20, r: 0, g: 248, b: 6, a: 200 },
  { dbz: 25, r: 6, g: 194, b: 0, a: 200 },
  { dbz: 30, r: 0, g: 136, b: 0, a: 200 },
  { dbz: 35, r: 252, g: 246, b: 2, a: 200 },
  { dbz: 40, r: 215, g: 177, b: 0, a: 200 },
  { dbz: 45, r: 255, g: 148, b: 0, a: 200 },
  { dbz: 50, r: 240, g: 0, b: 0, a: 200 },
  { dbz: 55, r: 217, g: 0, b: 0, a: 215 },
  { dbz: 60, r: 164, g: 7, b: 16, a: 225 },
  { dbz: 65, r: 249, g: 0, b: 244, a: 235 },
  { dbz: 70, r: 136, g: 81, b: 201, a: 245 },
  { dbz: 75, r: 252, g: 252, b: 252, a: 255 },
];

export function dbzToRGBA(
  dbz: number,
  stops: ColorStop[] = DEFAULT_STOPS,
): [number, number, number, number] {
  if (dbz <= stops[0].dbz) return [stops[0].r, stops[0].g, stops[0].b, 0];
  const last = stops[stops.length - 1];
  if (dbz >= last.dbz) return [last.r, last.g, last.b, last.a];

  for (let i = 0; i < stops.length - 1; i++) {
    const s0 = stops[i];
    const s1 = stops[i + 1];
    if (dbz >= s0.dbz && dbz <= s1.dbz) {
      const t = (dbz - s0.dbz) / (s1.dbz - s0.dbz);
      return [
        Math.round(s0.r + (s1.r - s0.r) * t),
        Math.round(s0.g + (s1.g - s0.g) * t),
        Math.round(s0.b + (s1.b - s0.b) * t),
        Math.round(s0.a + (s1.a - s0.a) * t),
      ];
    }
  }
  return [last.r, last.g, last.b, last.a];
}

export function colorizeFrame(
  pixels: Uint8Array,
  calibration: RadarCalibration,
  remap: RemapGrid,
  stops: ColorStop[] = DEFAULT_STOPS,
): Buffer {
  const { width, height, sourceIndex } = remap;
  const png = new PNG({ width, height });

  for (let i = 0; i < sourceIndex.length; i++) {
    const srcIdx = sourceIndex[i];
    const outOffset = i * 4;

    if (srcIdx < 0) {
      png.data[outOffset + 3] = 0;
      continue;
    }

    const pv = pixels[srcIdx];
    if (pv === calibration.missingData || pv === calibration.outOfImage) {
      png.data[outOffset + 3] = 0;
      continue;
    }

    const dbz = calibration.a * pv + calibration.b;
    const [r, g, b, a] = dbzToRGBA(dbz, stops);
    png.data[outOffset] = r;
    png.data[outOffset + 1] = g;
    png.data[outOffset + 2] = b;
    png.data[outOffset + 3] = a;
  }

  return PNG.sync.write(png);
}
