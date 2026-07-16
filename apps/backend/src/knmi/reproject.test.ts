import { test } from "node:test";
import assert from "node:assert/strict";
import { sourceRowCol } from "./reproject.js";

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
