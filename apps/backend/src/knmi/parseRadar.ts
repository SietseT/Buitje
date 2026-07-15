import * as h5wasm from "h5wasm/node";

export interface RadarCalibration {
  a: number;
  b: number;
  missingData: number;
  outOfImage: number;
}

export interface RadarGeometry {
  width: number;
  height: number;
  columnOffset: number;
  rowOffset: number;
  pixelSizeX: number;
  pixelSizeY: number;
  proj4Params: string;
  /** [lon0,lat0, lon1,lat1, lon2,lat2, lon3,lat3] corners of the image, WGS84 */
  productCorners: number[];
}

export interface ParsedRadarFrame {
  timestamp: string; // RAD_NL25_PCP_NA_<YYYYMMDDHHmm> portion
  pixels: Uint8Array; // PV values, row-major, length width*height
  calibration: RadarCalibration;
  geometry: RadarGeometry;
}

let h5wasmReady = false;

function getAttrs(
  file: h5wasm.File,
  path: string,
): Record<string, { value: unknown }> {
  const entity = file.get(path);
  if (!entity || !("attrs" in entity)) {
    throw new Error(`Missing HDF5 group/dataset: ${path}`);
  }
  return (entity as unknown as { attrs: Record<string, { value: unknown }> }).attrs;
}

function attr(attrs: Record<string, { value: unknown }>, name: string): unknown {
  const entry = attrs[name];
  if (!entry) throw new Error(`Missing HDF5 attribute: ${name}`);
  return entry.value;
}

function scalar(attrs: Record<string, { value: unknown }>, name: string): number {
  const v = attr(attrs, name);
  if (ArrayBuffer.isView(v)) return Number((v as unknown as ArrayLike<number>)[0]);
  return Number(v);
}

function str(attrs: Record<string, { value: unknown }>, name: string): string {
  return String(attr(attrs, name));
}

function numArray(attrs: Record<string, { value: unknown }>, name: string): number[] {
  const v = attr(attrs, name);
  return Array.from(v as ArrayLike<number>);
}

function parseCalibrationFormula(formula: string): { a: number; b: number } {
  // e.g. "GEO = 0.500000 * PV + -32.000000"
  const match = formula.match(
    /GEO\s*=\s*([-\d.]+)\s*\*\s*PV\s*\+\s*([-\d.]+)/i,
  );
  if (!match) {
    throw new Error(`Unrecognized calibration formula: ${formula}`);
  }
  return { a: Number(match[1]), b: Number(match[2]) };
}

export function extractTimestampFromFilename(filename: string): string {
  const match = filename.match(/(\d{12})/);
  if (!match) throw new Error(`Cannot extract timestamp from filename: ${filename}`);
  return match[1];
}

export async function parseRadarFile(
  filePath: string,
  filename: string,
): Promise<ParsedRadarFrame> {
  if (!h5wasmReady) {
    await h5wasm.ready;
    h5wasmReady = true;
  }

  const f = new h5wasm.File(filePath, "r");
  try {
    const geoAttrs = getAttrs(f, "geographic");
    const projAttrs = getAttrs(f, "geographic/map_projection");
    const calibAttrs = getAttrs(f, "image1/calibration");
    const imageDataset = f.get("image1/image_data") as unknown as {
      value: Uint8Array;
      shape: number[];
    };

    const height = imageDataset.shape[0];
    const width = imageDataset.shape[1];
    const pixels = new Uint8Array(imageDataset.value);

    const { a, b } = parseCalibrationFormula(str(calibAttrs, "calibration_formulas"));

    return {
      timestamp: extractTimestampFromFilename(filename),
      pixels,
      calibration: {
        a,
        b,
        missingData: scalar(calibAttrs, "calibration_missing_data"),
        outOfImage: scalar(calibAttrs, "calibration_out_of_image"),
      },
      geometry: {
        width,
        height,
        columnOffset: scalar(geoAttrs, "geo_column_offset"),
        rowOffset: scalar(geoAttrs, "geo_row_offset"),
        pixelSizeX: scalar(geoAttrs, "geo_pixel_size_x"),
        pixelSizeY: scalar(geoAttrs, "geo_pixel_size_y"),
        proj4Params: str(projAttrs, "projection_proj4_params"),
        productCorners: numArray(geoAttrs, "geo_product_corners"),
      },
    };
  } finally {
    f.close();
  }
}
