import { PNG } from "pngjs";
import type { RadarCalibration } from "./parseRadar.js";
import type { RemapGrid } from "./reproject.js";

interface ColorStop {
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
const STOPS: ColorStop[] = [
  { dbz: 0, r: 100, g: 180, b: 255, a: 0 },
  { dbz: 7, r: 100, g: 180, b: 255, a: 0 },
  { dbz: 15, r: 60, g: 140, b: 245, a: 200 },
  { dbz: 25, r: 20, g: 60, b: 170, a: 220 },
  { dbz: 45, r: 240, g: 220, b: 40, a: 235 },
  { dbz: 52, r: 250, g: 140, b: 30, a: 245 },
  { dbz: 58, r: 230, g: 30, b: 30, a: 255 },
  { dbz: 65, r: 200, g: 30, b: 200, a: 255 },
];

export function dbzToRGBA(dbz: number): [number, number, number, number] {
  if (dbz <= STOPS[0].dbz) return [STOPS[0].r, STOPS[0].g, STOPS[0].b, 0];
  const last = STOPS[STOPS.length - 1];
  if (dbz >= last.dbz) return [last.r, last.g, last.b, last.a];

  for (let i = 0; i < STOPS.length - 1; i++) {
    const s0 = STOPS[i];
    const s1 = STOPS[i + 1];
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
    const [r, g, b, a] = dbzToRGBA(dbz);
    png.data[outOffset] = r;
    png.data[outOffset + 1] = g;
    png.data[outOffset + 2] = b;
    png.data[outOffset + 3] = a;
  }

  return PNG.sync.write(png);
}
