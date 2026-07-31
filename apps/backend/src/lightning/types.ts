/** Raw abbreviated fields as sent by Blitzortung's WebSocket stream. */
export interface RawBlitzortungStrike {
  time: number; // nanosecond epoch
  lat: number;
  lon: number;
  alt?: number;
  pol?: number; // polarity
  mds?: number;
  mcg?: number;
  status?: number;
  region?: number;
  sig?: unknown[];
}

export interface Strike {
  lat: number;
  lon: number;
  timeMs: number;
  polarity: number | null;
}
