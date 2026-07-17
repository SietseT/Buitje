import { test } from "node:test";
import assert from "node:assert/strict";
import { dbzToRGBA } from "./colorize.js";

// Pins the current color ramp (STOPS in colorize.ts) so a future edit to the
// ramp fails a test instead of silently changing the map's colors. If you
// intentionally change STOPS, update these expected values in the same
// change - and remember apps/frontend/src/components/Legend.vue mirrors the
// same ramp for the on-map legend gradient.

test("dbzToRGBA: below the visible-rain floor is fully transparent", () => {
  assert.deepEqual(dbzToRGBA(0), [6, 232, 228, 0]);
});

test("dbzToRGBA: exact stop values pass through unchanged", () => {
  assert.deepEqual(dbzToRGBA(15), [4, 0, 243, 200]); // deep blue
  assert.deepEqual(dbzToRGBA(45), [255, 148, 0, 200]); // orange - medium/heavy rain
  assert.deepEqual(dbzToRGBA(65), [249, 0, 244, 235]); // magenta
});

test("dbzToRGBA: clamps to the last stop above the ceiling", () => {
  assert.deepEqual(dbzToRGBA(100), [252, 252, 252, 255]);
});

test("dbzToRGBA: smooth transition (default) - interpolates linearly between stops", () => {
  // Midpoint between the 15 dBZ and 20 dBZ stops.
  assert.deepEqual(dbzToRGBA(17.5), [2, 124, 125, 200]);
});

test("dbzToRGBA: smooth=false hard transition - snaps to the lower stop until the next threshold", () => {
  assert.deepEqual(dbzToRGBA(17.5, undefined, false), [4, 0, 243, 200]); // still 15's color
  assert.deepEqual(dbzToRGBA(19.9, undefined, false), [4, 0, 243, 200]); // still 15's color
  assert.deepEqual(dbzToRGBA(20, undefined, false), [0, 248, 6, 200]); // jumps to 20's color
});
