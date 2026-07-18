import { config } from "../config.js";
import { gridBounds } from "../cache/frameStore.js";
import type { LightningStore } from "../cache/lightningStore.js";
import type { Bounds } from "../knmi/reproject.js";
import { connectLightningStream } from "./client.js";
import { parseStrikeMessage } from "./parseStrike.js";

const LOG_INTERVAL_MS = 5 * 60 * 1000;

function paddedBounds(): Bounds {
  const bounds = gridBounds ?? config.lightning.fallbackBounds;
  const pad = config.lightning.boundsPaddingDeg;
  return {
    west: bounds.west - pad,
    east: bounds.east + pad,
    south: bounds.south - pad,
    north: bounds.north + pad,
  };
}

function inBounds(lat: number, lon: number, bounds: Bounds): boolean {
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

  connectLightningStream((raw) => {
    seen++;
    const strike = parseStrikeMessage(raw);
    if (strike && inBounds(strike.lat, strike.lon, paddedBounds())) {
      store.add(strike);
      kept++;
    }

    const now = Date.now();
    if (now - lastLog >= LOG_INTERVAL_MS) {
      console.log(`[lightning] kept ${kept}/${seen} strikes in the last ${Math.round((now - lastLog) / 1000)}s`);
      seen = 0;
      kept = 0;
      lastLog = now;
    }
  });
}
