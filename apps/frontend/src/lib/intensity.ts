// Rain intensity buckets for the panel headline and the per-place status.
//
// Thresholds line up with the color ramp's own breakpoints (lib/colorRamp.ts):
// 5 dBZ is the visible-rain floor, 20 is where the ramp jumps blue -> green,
// 35 is where it jumps green -> yellow. So a place described as "moderate"
// is always drawn in the green band on the map, and "heavy" always in
// yellow-and-above - the words and the colors can't disagree.
export type Intensity = "dry" | "light" | "moderate" | "heavy";

/**
 * `null` in, `null` out: that means the radar has no reading for this point
 * (outside the grid, or a missing-data pixel), which is NOT the same as dry
 * and must not be reported as such.
 */
export function classify(dbz: number | null): Intensity | null {
  if (dbz === null) return null;
  if (dbz < 5) return "dry";
  if (dbz < 20) return "light";
  if (dbz < 35) return "moderate";
  return "heavy";
}
