// Mirrors the color ramp in apps/backend/src/knmi/colorize.ts (STOPS).
// Keep these in sync if that ramp changes - there is no shared package
// between the two apps, and colorize.test.ts pins the backend's copy.
//
// This module exists so the frontend has exactly ONE copy: Legend.vue and
// RainChart.vue both import from here rather than each declaring their own.
export interface ColorStop {
  dbz: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

export const STOPS: readonly ColorStop[] = [
  { dbz: 5, r: 6, g: 232, b: 228, a: 200 },
  { dbz: 10, r: 9, g: 158, b: 242, a: 200 },
  { dbz: 15, r: 4, g: 0, b: 243, a: 200 },
  { dbz: 20, r: 0, g: 248, b: 6, a: 200 },
  { dbz: 25, r: 6, g: 194, b: 0, a: 200 },
  { dbz: 30, r: 0, g: 136, b: 0, a: 200 },
  { dbz: 35, r: 252, g: 246, b: 2, a: 200 },
  { dbz: 40, r: 215, g: 177, b: 0, a: 200 },
  { dbz: 45, r: 255, g: 148, b: 0, a: 200 },
  { dbz: 50, r: 240, g: 0, b: 0, a: 200 },
  { dbz: 55, r: 217, g: 0, b: 0, a: 215 },
  { dbz: 60, r: 164, g: 7, b: 16, a: 225 },
  { dbz: 65, r: 249, g: 0, b: 244, a: 235 },
  { dbz: 70, r: 136, g: 81, b: 201, a: 245 },
  { dbz: 75, r: 252, g: 252, b: 252, a: 255 },
] as const;

// Below the visible-rain floor nothing is drawn on the map, so a zero-alpha
// stop would render as the surface behind it showing through and read as
// "white = light rain" even though white is never actually shown on the map.
// Only stops that really appear (a > 0) are rendered.
export const VISIBLE_STOPS = STOPS.filter((s) => s.a > 0);

export const MIN_DBZ = VISIBLE_STOPS[0].dbz;
export const MAX_DBZ = VISIBLE_STOPS[VISIBLE_STOPS.length - 1].dbz;

const positions = VISIBLE_STOPS.map((s) => ((s.dbz - MIN_DBZ) / (MAX_DBZ - MIN_DBZ)) * 100);

function rgba(stop: ColorStop, alpha = stop.a / 255): string {
  return `rgba(${stop.r}, ${stop.g}, ${stop.b}, ${alpha.toFixed(2)})`;
}

/**
 * The legend bar's gradient.
 *
 * Smooth: one color-stop per position, blending between them as usual.
 * Hard: each color declared twice - at its band's start % and again at its
 * end % - so the gradient renders as flat plateaus with a sharp jump at each
 * threshold, matching what the backend's non-smooth PNG variant draws.
 */
export function rampGradient(smooth: boolean): string {
  if (smooth) {
    return `linear-gradient(to right, ${VISIBLE_STOPS.map(
      (s, i) => `${rgba(s)} ${positions[i].toFixed(1)}%`,
    ).join(", ")})`;
  }
  return `linear-gradient(to right, ${VISIBLE_STOPS.map((s, i) => {
    const start = positions[i].toFixed(1);
    const end = (i < VISIBLE_STOPS.length - 1 ? positions[i + 1] : 100).toFixed(1);
    return `${rgba(s)} ${start}%, ${rgba(s)} ${end}%`;
  }).join(", ")})`;
}

/**
 * Color for a single dBZ reading, interpolated the same way the backend's
 * smooth ramp does. Used for the chart fill and the per-place status dots so
 * they agree with what the map is showing.
 */
export function colorForDbz(dbz: number, alpha?: number): string {
  const first = VISIBLE_STOPS[0];
  const last = VISIBLE_STOPS[VISIBLE_STOPS.length - 1];
  if (dbz <= first.dbz) return rgba(first, alpha ?? first.a / 255);
  if (dbz >= last.dbz) return rgba(last, alpha ?? last.a / 255);

  for (let i = 0; i < VISIBLE_STOPS.length - 1; i++) {
    const s0 = VISIBLE_STOPS[i];
    const s1 = VISIBLE_STOPS[i + 1];
    if (dbz >= s0.dbz && dbz <= s1.dbz) {
      const t = (dbz - s0.dbz) / (s1.dbz - s0.dbz);
      const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
      const blended: ColorStop = {
        dbz,
        r: lerp(s0.r, s1.r),
        g: lerp(s0.g, s1.g),
        b: lerp(s0.b, s1.b),
        a: lerp(s0.a, s1.a),
      };
      return rgba(blended, alpha ?? blended.a / 255);
    }
  }
  return rgba(last, alpha ?? last.a / 255);
}
