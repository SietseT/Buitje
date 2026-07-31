import { test } from "node:test";
import assert from "node:assert/strict";
import { config } from "../config.js";
import { inBounds, paddedBounds } from "./relay.js";

// The real KNMI grid, as persisted to .data/bounds.json - this is what
// gridBounds holds once the first radar frame has been processed.
const GRID = {
  west: 0,
  east: 10.856453895568848,
  south: 48.895301818847656,
  north: 55.973602294921875,
};

const BREMEN = { lat: 53.08, lon: 8.8 };

test("paddedBounds: widens the grid by boundsPaddingDeg on every side", () => {
  const pad = config.lightning.boundsPaddingDeg;
  assert.deepEqual(paddedBounds(GRID), {
    west: GRID.west - pad,
    east: GRID.east + pad,
    south: GRID.south - pad,
    north: GRID.north + pad,
  });
});

test("inBounds: keeps a strike inside the box", () => {
  assert.equal(inBounds(52.1, 5.1, paddedBounds(GRID)), true);
});

test("inBounds: keeps a strike that only the padding brings inside", () => {
  const pad = config.lightning.boundsPaddingDeg;
  // Half a padding-width east of the grid edge: outside the radar footprint,
  // inside the padded box.
  assert.equal(inBounds(52.1, GRID.east + pad / 2, paddedBounds(GRID)), true);
});

test("inBounds: drops a strike just past the padded edge", () => {
  const pad = config.lightning.boundsPaddingDeg;
  assert.equal(inBounds(52.1, GRID.east + pad + 0.01, paddedBounds(GRID)), false);
  assert.equal(inBounds(GRID.north + pad + 0.01, 5.1, paddedBounds(GRID)), false);
});

test("inBounds: keeps a strike over Bremen against the live grid", () => {
  // Regression guard for the storm that surfaced the broken feed - Bremen is
  // well inside the padded KNMI grid, so an empty response there means the
  // stream is broken, not that the strike was filtered out.
  assert.equal(inBounds(BREMEN.lat, BREMEN.lon, paddedBounds(GRID)), true);
});

test("paddedBounds: falls back to config bounds before the first frame", () => {
  // gridBounds is null until the poller processes a frame, so this is the box
  // in use on a cold start.
  const fallback = paddedBounds(config.lightning.fallbackBounds);
  const pad = config.lightning.boundsPaddingDeg;
  assert.equal(fallback.east, config.lightning.fallbackBounds.east + pad);
  assert.equal(inBounds(52.1, 5.1, fallback), true);
});

test("the fallback box barely reaches Bremen - it clips anything further east", () => {
  // Documented cliff, not a bug today: the fallback's east edge lands at
  // ~8.85, only ~3km past Bremen at 8.8. During the startup window before the
  // first frame, anything further east (Hamburg, Hannover) is dropped at
  // ingest and is gone for good, since the filter runs on the way in.
  const fallback = paddedBounds(config.lightning.fallbackBounds);
  assert.equal(inBounds(BREMEN.lat, BREMEN.lon, fallback), true);
  assert.equal(inBounds(BREMEN.lat, BREMEN.lon + 0.1, fallback), false);
});
