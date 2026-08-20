import { test } from "node:test";
import assert from "node:assert/strict";
import { pvToDbz, sampleDbz, sourceIndexFor } from "./samplePoint.js";
import type { RadarCalibration, RadarGeometry } from "./parseRadar.js";

// KNMI's real composite grid, from a downloaded RAD_NL25_PCP_NA file's own
// attributes. Note pixelSizeY is NEGATIVE while rowOffset is positive - that
// pairing is what makes sourceRowCol's asymmetric `+` for rows come out
// right (CLAUDE.md), and it's verifiable here: the product corners below map
// to grid corners (0,0), (0,765) and (700,0).
const geometry: RadarGeometry = {
  width: 700,
  height: 765,
  columnOffset: 0,
  rowOffset: 3649.9794921875,
  pixelSizeX: 1.0000026226043701,
  pixelSizeY: -1.0000044107437134,
  proj4Params:
    "+proj=stere +lat_0=90 +lon_0=0 +lat_ts=60 +a=6378.14 +b=6356.75 +x_0=0 y_0=0",
  productCorners: [0, 49.362, 0, 55.974, 10.856, 55.389, 8.337, 48.895],
};

// The sentinels really are this way round in KNMI's files - 0 for
// missing_data and 255 for out_of_image - which is what makes pvToDbz's
// asymmetric handling necessary rather than fussy.
const calibrationFixture = { a: 0.5, b: -32, missingData: 0, outOfImage: 255 };

test("fixture sanity: the product corners map to the grid's own corners", () => {
  // If this fails, the fixture geometry has drifted from a real file and
  // every other assertion here is meaningless.
  assert.equal(sourceIndexFor(0, 55.974, geometry), 0); // NW -> (0, 0)
  assert.equal(sourceIndexFor(5.12, 52.09, geometry), 430 * geometry.width + 366); // Utrecht
});

const calibration: RadarCalibration = calibrationFixture;

test("sourceIndexFor: a point inside the Netherlands lands inside the grid", () => {
  // Utrecht.
  const index = sourceIndexFor(5.12, 52.09, geometry);

  assert.notEqual(index, null);
  const row = Math.floor(index! / geometry.width);
  const col = index! % geometry.width;
  // Sanity-check against the grid's own extent rather than pinning exact
  // pixels: this asserts the projection is wired up, not the arithmetic that
  // reproject.test.ts already pins.
  assert.ok(row >= 0 && row < geometry.height, `row ${row} out of range`);
  assert.ok(col >= 0 && col < geometry.width, `col ${col} out of range`);
});

test("sourceIndexFor: points move the expected direction on the grid", () => {
  const utrecht = sourceIndexFor(5.12, 52.09, geometry)!;
  const east = sourceIndexFor(6.5, 52.09, geometry)!;
  const north = sourceIndexFor(5.12, 53.2, geometry)!;

  // Columns increase eastwards, rows increase southwards (row 0 is the top).
  assert.ok(east % geometry.width > utrecht % geometry.width, "east should be a higher column");
  assert.ok(
    Math.floor(north / geometry.width) < Math.floor(utrecht / geometry.width),
    "north should be a lower row",
  );
});

test("sourceIndexFor: a point far outside the grid is null, not a clamped edge pixel", () => {
  assert.equal(sourceIndexFor(-40, 12, geometry), null); // mid-Atlantic
  assert.equal(sourceIndexFor(30, 65, geometry), null); // northern Finland
});

test("pvToDbz: applies the frame's own calibration formula", () => {
  assert.equal(pvToDbz(100, calibration), 18); // 0.5 * 100 - 32
  assert.equal(pvToDbz(64, calibration), 0);
});

// Outside the radar's coverage: genuinely unmeasured, so the chart gaps.
test("pvToDbz: out-of-image is null", () => {
  assert.equal(pvToDbz(calibration.outOfImage, calibration), null);
});

// The one that bit in practice. KNMI calls PV 0 "missing_data", but it is
// what every no-echo pixel carries - most of a dry map. Reporting it as null
// made a normal dry day come back as 24 empty frames, so it has to read as
// the bottom of the scale (dry), not as an absent measurement.
test("pvToDbz: no-echo reads as the dry floor, not as missing", () => {
  assert.equal(pvToDbz(0, calibration), -32); // 0.5 * 0 - 32, the scale floor
});

// ...but only because the sentinel sits at the bottom of the PV range. Were
// it anywhere else, running the formula on it would invent a reading.
test("pvToDbz: a missing-data sentinel away from the floor stays null", () => {
  const odd: RadarCalibration = { a: 0.5, b: -32, missingData: 255, outOfImage: 254 };

  assert.equal(pvToDbz(255, odd), null); // not 95.5 dBZ
});

test("sampleDbz: reads the pixel the coordinate maps to", () => {
  const pixels = new Uint8Array(geometry.width * geometry.height);
  const index = sourceIndexFor(5.12, 52.09, geometry)!;
  pixels[index] = 120;

  assert.equal(sampleDbz(pixels, 5.12, 52.09, geometry, calibration), 28); // 0.5 * 120 - 32
});

test("sampleDbz: out-of-grid coordinates read as null instead of throwing", () => {
  const pixels = new Uint8Array(geometry.width * geometry.height);

  assert.equal(sampleDbz(pixels, -40, 12, geometry, calibration), null);
});
