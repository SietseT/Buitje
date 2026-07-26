import { test } from "node:test";
import assert from "node:assert/strict";
import { latAtRowFraction, sourceRowCol } from "./reproject.js";

// Pins the empirically-verified, non-obvious sign convention documented in
// CLAUDE.md: col uses `-`, row uses `+`. Using `-` for both (the "obvious"
// symmetric guess) silently shifts the image ~7300 rows - this test exists
// so that regression is caught immediately instead of relying on someone
// remembering to re-verify against a real file.
test("sourceRowCol: column offset subtracts, row offset adds", () => {
  const geo = { columnOffset: 100, rowOffset: 50, pixelSizeX: 2, pixelSizeY: 2 };

  const { col, row } = sourceRowCol(104, 110, geo);

  assert.equal(col, 2); // (104 - 100) / 2
  assert.equal(row, 80); // (110 + 50) / 2 -- NOT (110 - 50) / 2 = 30
});

test("sourceRowCol: rounds to the nearest pixel", () => {
  const geo = { columnOffset: 0, rowOffset: 0, pixelSizeX: 10, pixelSizeY: 10 };

  const { col, row } = sourceRowCol(24, 26, geo);

  assert.equal(col, 2); // 24 / 10 = 2.4 -> 2
  assert.equal(row, 3); // 26 / 10 = 2.6 -> 3
});

// The output PNG's rows must be evenly spaced in Web Mercator y, not in
// latitude, because MapLibre stretches an `image` source linearly in Mercator
// space. A plain linear-in-latitude grid put the middle of the image ~16 km
// too far north (corners still correct, so it's easy to miss) - this test
// pins the Mercator spacing so that regression can't come back.
test("latAtRowFraction: rows are evenly spaced in Mercator, not in latitude", () => {
  // The real KNMI composite's lat range.
  const bounds = { west: 0, east: 10.856, south: 48.895301818847656, north: 55.973602294921875 };

  // Endpoints round-trip through log/exp, so compare within float noise.
  assert.ok(Math.abs(latAtRowFraction(0, bounds) - bounds.north) < 1e-9);
  assert.ok(Math.abs(latAtRowFraction(1, bounds) - bounds.south) < 1e-9);

  const linearMidpoint = (bounds.north + bounds.south) / 2; // 52.4345
  const mid = latAtRowFraction(0.5, bounds);

  // The middle row sits north of the plain average, by ~0.14 degrees.
  assert.ok(mid > linearMidpoint, `expected ${mid} > ${linearMidpoint}`);
  assert.ok(Math.abs(mid - 52.5770) < 1e-3, `unexpected midpoint latitude ${mid}`);
});
