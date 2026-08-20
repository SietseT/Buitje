import proj4 from "proj4";
import { sourceRowCol } from "./reproject.js";
import type { RadarCalibration, RadarGeometry } from "./parseRadar.js";

// proj4 ships no type declarations in this install (its package.json points
// at a dist/index.d.ts it doesn't publish), so name the one method we use
// rather than reaching for a proj4.* namespace that doesn't exist.
interface Transformer {
  forward(coords: [number, number]): [number, number];
}

// proj4() parses the projection string on every call; the grid is fixed, so
// build the transformer once per distinct proj4 string.
const transformers = new Map<string, Transformer>();

function transformerFor(proj4Params: string): Transformer {
  let transformer = transformers.get(proj4Params);
  if (!transformer) {
    transformer = proj4("WGS84", proj4Params);
    transformers.set(proj4Params, transformer);
  }
  return transformer;
}

/**
 * Index into a frame's PV array for a WGS84 coordinate, or null when the
 * point falls outside the radar grid.
 *
 * Reuses sourceRowCol() rather than repeating the projection math: KNMI's
 * row/column offset sign convention is asymmetric (`-` for col, `+` for row)
 * and that helper is the one place it's pinned by a test. See CLAUDE.md.
 */
export function sourceIndexFor(
  lon: number,
  lat: number,
  geometry: RadarGeometry,
): number | null {
  const [x, y] = transformerFor(geometry.proj4Params).forward([lon, lat]);
  const { col, row } = sourceRowCol(x, y, geometry);
  if (col < 0 || col >= geometry.width || row < 0 || row >= geometry.height) {
    return null;
  }
  return row * geometry.width + col;
}

/**
 * Applies the frame's own calibration formula (GEO = a * PV + b).
 *
 * The two sentinels need OPPOSITE treatment here, which is the trap:
 *
 * - `outOfImage` (255 in the real files) marks pixels outside the radar's
 *   coverage. Genuinely unmeasured, so null - the chart draws a gap.
 * - `missingData` (0 in the real files) is what every pixel with no
 *   detectable echo gets, i.e. the overwhelming majority of a dry map. For
 *   the map that means "paint nothing", which is why colorize.ts makes it
 *   transparent - but for a chart it means DRY, not "no measurement".
 *   Reporting it as null turned a normal dry day into 24 empty frames.
 *
 * Because a > 0, PV 0 is also the bottom of the calibrated scale (a*0+b = b),
 * so the formula already yields the right "nothing here" floor for it. The
 * explicit zero check keeps that reasoning valid: if a future product ever
 * puts the missing-data sentinel somewhere other than the bottom of the PV
 * range, running the formula on it would invent a huge dBZ value instead.
 */
export function pvToDbz(pv: number, calibration: RadarCalibration): number | null {
  if (pv === calibration.outOfImage) return null;
  if (pv === calibration.missingData && calibration.missingData !== 0) return null;
  return calibration.a * pv + calibration.b;
}

/** Convenience wrapper: lon/lat straight to a dBZ reading for one frame. */
export function sampleDbz(
  pixels: Uint8Array,
  lon: number,
  lat: number,
  geometry: RadarGeometry,
  calibration: RadarCalibration,
): number | null {
  const index = sourceIndexFor(lon, lat, geometry);
  if (index === null || index >= pixels.length) return null;
  return pvToDbz(pixels[index], calibration);
}
