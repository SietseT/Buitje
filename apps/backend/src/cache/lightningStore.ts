import type { Strike } from "../lightning/types.js";

export interface LightningStore {
  add(strike: Strike): void;
  /** Strikes with endMs - windowMs < timeMs <= endMs. */
  inWindow(endMs: number, windowMs: number): Strike[];
  /**
   * Every retained strike, oldest first. Exists so diskLightningStore.ts can
   * snapshot the buffer without having to guess a window wide enough to cover
   * it (a strike with a slightly-future timeMs from a skewed detector clock
   * would fall outside any inWindow(now, retentionMs) call).
   */
  all(): Strike[];
  size(): number;
}

/**
 * Append-ordered ring buffer of recent strikes, pruned by age on every add
 * (not FrameStore - that interface is built for one-named-blob-per-timestamp
 * radar PNGs, a poor fit for a continuous point-event stream). Separately
 * capped at maxStrikes as a hard memory ceiling independent of the age
 * window, in case of an unexpectedly dense burst.
 */
export function createLightningStore(
  retentionMs: number,
  maxStrikes: number,
  now: () => number = Date.now,
): LightningStore {
  let strikes: Strike[] = [];

  return {
    add(strike) {
      strikes.push(strike);
      const cutoff = now() - retentionMs;
      let start = 0;
      while (start < strikes.length && strikes[start].timeMs < cutoff) start++;
      if (start > 0) strikes = strikes.slice(start);
      if (strikes.length > maxStrikes) {
        strikes = strikes.slice(strikes.length - maxStrikes);
      }
    },
    inWindow(endMs, windowMs) {
      const startMs = endMs - windowMs;
      return strikes.filter((s) => s.timeMs > startMs && s.timeMs <= endMs);
    },
    all() {
      return strikes.slice();
    },
    size() {
      return strikes.length;
    },
  };
}
