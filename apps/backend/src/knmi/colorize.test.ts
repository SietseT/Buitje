import { test } from "node:test";
import assert from "node:assert/strict";
import { dbzToRGBA } from "./colorize.js";

// Pins the current color ramp (STOPS in colorize.ts) so a future edit to the
// ramp fails a test instead of silently changing the map's colors. If you
// intentionally change STOPS, update these expected values in the same
// change - and remember apps/frontend/src/components/Legend.vue mirrors the
// same ramp for the on-map legend gradient.

test("dbzToRGBA: below the visible-rain floor is fully transparent", () => {
  assert.deepEqual(dbzToRGBA(0), [100, 180, 255, 0]);
});

test("dbzToRGBA: exact stop values pass through unchanged", () => {
  assert.deepEqual(dbzToRGBA(15), [60, 140, 245, 200]); // light blue
  assert.deepEqual(dbzToRGBA(45), [240, 220, 40, 235]); // yellow - medium/heavy rain
  assert.deepEqual(dbzToRGBA(65), [200, 30, 200, 255]); // purple ceiling
});

test("dbzToRGBA: clamps to the last stop above the ceiling", () => {
  assert.deepEqual(dbzToRGBA(100), [200, 30, 200, 255]);
});

test("dbzToRGBA: interpolates linearly between stops", () => {
  // Midpoint between the 15 dBZ (light blue) and 25 dBZ (darker blue) stops.
  assert.deepEqual(dbzToRGBA(20), [40, 100, 208, 210]);
});
