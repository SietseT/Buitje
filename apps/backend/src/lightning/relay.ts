import { config } from "../config.js";
import { gridBounds } from "../cache/frameStore.js";
import type { LightningStore } from "../cache/lightningStore.js";
import type { Bounds } from "../knmi/reproject.js";
import { connectLightningStream } from "./client.js";
import { parseStrikeMessage } from "./parseStrike.js";

const LOG_INTERVAL_MS = 5 * 60 * 1000;

/**
 * The box strikes are filtered against: the live KNMI grid once the first
 * frame has been processed, otherwise config's fallback, either way widened
 * by boundsPaddingDeg so storms just outside the radar footprint still show.
 *
 * Exported for relay.test.ts - this filter silently drops everything that
 * fails it, so it's worth pinning. Takes the bounds as an argument rather
 * than reading the `gridBounds` module binding so it stays testable.
 */
export function paddedBounds(bounds: Bounds = gridBounds ?? config.lightning.fallbackBounds): Bounds {
  const pad = config.lightning.boundsPaddingDeg;
  return {
    west: bounds.west - pad,
    east: bounds.east + pad,
    south: bounds.south - pad,
    north: bounds.north + pad,
  };
}

export function inBounds(lat: number, lon: number, bounds: Bounds): boolean {
  return lat >= bounds.south && lat <= bounds.north && lon >= bounds.west && lon <= bounds.east;
}

/**
 * Wires the Blitzortung WebSocket stream into the store: parses each raw
 * message, drops it unless it falls within (a padded) NL bounding box, and
 * appends the rest. Blitzortung is a global, high-volume firehose - nearly
 * every message is dropped here, so only a periodic summary is logged
 * rather than one line per message.
 */
export function startLightningRelay(store: LightningStore): void {
  let seen = 0;
  let kept = 0;
  let lastLog = Date.now();

  // On a timer rather than inside the message handler on purpose: a broken
  // feed delivers no messages, so a handler-driven summary would print
  // nothing at all and a dead stream would look identical to a quiet night.
  // "kept 0/0" is the signal that something is wrong upstream.
  const timer = setInterval(() => {
    const now = Date.now();
    console.log(
      `[lightning] kept ${kept}/${seen} strikes in the last ${Math.round((now - lastLog) / 1000)}s`,
    );
    seen = 0;
    kept = 0;
    lastLog = now;
  }, LOG_INTERVAL_MS);
  timer.unref();

  connectLightningStream((raw) => {
    seen++;
    const strike = parseStrikeMessage(raw);
    if (strike && inBounds(strike.lat, strike.lon, paddedBounds())) {
      store.add(strike);
      kept++;
    }
  });
}
