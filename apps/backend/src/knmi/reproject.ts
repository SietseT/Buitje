import proj4 from "proj4";
import type { RadarGeometry } from "./parseRadar.js";

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface RemapGrid {
  /**
   * target grid dimensions. Columns are linear in longitude; rows are linear
   * in Web Mercator y (see `latAtRowFraction`), because that is the space
   * MapLibre interpolates an image source in.
   */
  width: number;
  height: number;
  bounds: Bounds;
  /** length width*height; sourceIndex for each target pixel, or -1 if outside source grid */
  sourceIndex: Int32Array;
}

let cachedSignature: string | null = null;
let cachedGrid: RemapGrid | null = null;

function signatureOf(geo: RadarGeometry): string {
  return JSON.stringify({
    w: geo.width,
    h: geo.height,
    co: geo.columnOffset,
    ro: geo.rowOffset,
    psx: geo.pixelSizeX,
    psy: geo.pixelSizeY,
    proj: geo.proj4Params,
    corners: geo.productCorners,
  });
}

function boundsFromCorners(corners: number[]): Bounds {
  const lons = [corners[0], corners[2], corners[4], corners[6]];
  const lats = [corners[1], corners[3], corners[5], corners[7]];
  return {
    west: Math.min(...lons),
    east: Math.max(...lons),
    south: Math.min(...lats),
    north: Math.max(...lats),
  };
}

/**
 * NOTE: the row/column offset sign convention in KNMI's HDF5 format is NOT
 * symmetric — empirically verified against a real file's own
 * geo_product_corners (see CLAUDE.md). Using `-` for both (the "obvious"
 * symmetric guess) silently produces a vertically-offset-by-~7300-rows
 * image. Pinned by reproject.test.ts - don't "clean this up" without
 * re-verifying against a real downloaded file first.
 */
export function sourceRowCol(
  x: number,
  y: number,
  geo: Pick<RadarGeometry, "columnOffset" | "rowOffset" | "pixelSizeX" | "pixelSizeY">,
): { col: number; row: number } {
  return {
    col: Math.round((x - geo.columnOffset) / geo.pixelSizeX),
    row: Math.round((y + geo.rowOffset) / geo.pixelSizeY),
  };
}

const DEG = Math.PI / 180;

/** Web Mercator northing for a latitude, in radians (the usual ln(tan(...))). */
function mercatorY(latDeg: number): number {
  return Math.log(Math.tan(Math.PI / 4 + (latDeg * DEG) / 2));
}

function latFromMercatorY(y: number): number {
  return (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / DEG;
}

/**
 * Latitude of target row `fraction` (0 = top, 1 = bottom) of the output image.
 *
 * NOT a linear lat interpolation between north and south. The frontend hands
 * the PNG to MapLibre as an `image` source pinned by its four corners, and
 * MapLibre stretches it linearly in *Web Mercator* space, not in lat/lon. An
 * equirectangular (linear-in-latitude) image therefore gets drawn with its
 * corners right but everything in between displaced towards the pole - for
 * this grid, up to ~16 km too far north around the middle of the image, i.e.
 * squarely over the Netherlands, with longitudes unaffected (Mercator x IS
 * linear in longitude). Spacing the rows evenly in Mercator y instead makes
 * the image match what MapLibre draws.
 */
export function latAtRowFraction(fraction: number, bounds: Bounds): number {
  const yNorth = mercatorY(bounds.north);
  const ySouth = mercatorY(bounds.south);
  return latFromMercatorY(yNorth - fraction * (yNorth - ySouth));
}

/**
 * Builds (and caches) a nearest-neighbor remap from the target image grid
 * back to the source radar grid's pixel indices.
 */
export function getRemapGrid(geo: RadarGeometry): RemapGrid {
  const signature = signatureOf(geo);
  if (cachedGrid && cachedSignature === signature) {
    return cachedGrid;
  }

  const bounds = boundsFromCorners(geo.productCorners);
  const width = geo.width;
  const height = geo.height;
  const transformer = proj4("WGS84", geo.proj4Params);

  const sourceIndex = new Int32Array(width * height);
  for (let row = 0; row < height; row++) {
    const lat = latAtRowFraction(row / (height - 1), bounds);
    for (let col = 0; col < width; col++) {
      const lon = bounds.west + (col / (width - 1)) * (bounds.east - bounds.west);
      const [x, y] = transformer.forward([lon, lat]);
      const { col: srcCol, row: srcRow } = sourceRowCol(x, y, geo);

      const idx = row * width + col;
      if (srcCol >= 0 && srcCol < geo.width && srcRow >= 0 && srcRow < geo.height) {
        sourceIndex[idx] = srcRow * geo.width + srcCol;
      } else {
        sourceIndex[idx] = -1;
      }
    }
  }

  cachedGrid = { width, height, bounds, sourceIndex };
  cachedSignature = signature;
  return cachedGrid;
}
