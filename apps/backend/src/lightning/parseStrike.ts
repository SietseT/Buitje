import { decodeLzw } from "./lzw.js";
import type { RawBlitzortungStrike, Strike } from "./types.js";

/**
 * LZW-decodes and parses a single raw Blitzortung WebSocket message into a
 * Strike, or null if it's malformed - never throws, so the relay can just
 * skip bad messages instead of crashing the whole stream.
 */
export function parseStrikeMessage(raw: string): Strike | null {
  let decoded: string;
  try {
    decoded = decodeLzw(raw);
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const { time, lat, lon, pol } = parsed as RawBlitzortungStrike;
  if (!Number.isFinite(time) || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  return {
    lat,
    lon,
    // time is nanosecond epoch; JSON.parse already coerced it to a double,
    // so this division loses at most sub-millisecond precision.
    timeMs: Math.round(time / 1e6),
    polarity: Number.isFinite(pol) ? (pol as number) : null,
  };
}
