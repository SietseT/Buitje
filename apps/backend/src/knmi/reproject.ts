import proj4 from "proj4";
import type { RadarGeometry } from "./parseRadar.js";

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface RemapGrid {
  /** target grid dimensions (regular WGS84 lon/lat grid) */
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

/**
 * Builds (and caches) a nearest-neighbor remap from a regular target WGS84
 * lon/lat grid back to the source radar grid's pixel indices.
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
    const lat = bounds.north - (row / (height - 1)) * (bounds.north - bounds.south);
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
