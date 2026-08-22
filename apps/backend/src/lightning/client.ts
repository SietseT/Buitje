import { config } from "../config.js";

/**
 * Subscription message the relays expect after connect. Nothing is streamed
 * until it's sent.
 *
 * Sending anything else - notably `{"time":0}`, which other Blitzortung
 * clients use - is NOT an error: the socket opens, stays open, and simply
 * never delivers a message. So a wrong handshake looks exactly like a quiet
 * sky rather than like a failure, which is why the periodic "kept N/M" line
 * in relay.ts fires unconditionally.
 */
const HANDSHAKE = '{"a":111}';

function pickUrl(): string {
  const urls = config.lightning.wsUrls;
  return urls[Math.floor(Math.random() * urls.length)];
}

/**
 * Maintains a connection to Blitzortung's unofficial real-time WebSocket
 * feed, reconnecting with exponential backoff on error/close (picking a
 * fresh random relay host each attempt). onRawMessage errors are caught
 * here so a bad packet can never escape as an unhandled exception - index.ts
 * registers global handlers that deliberately process.exit(1) on those, and
 * a flaky external stream going down is not a reason to kill the whole
 * radar service.
 */
export function connectLightningStream(onRawMessage: (data: string) => void): { close(): void } {
  let closed = false;
  let ws: WebSocket | undefined;
  let reconnectDelayMs = config.lightning.reconnectBaseDelayMs;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let lastMessageAt = Date.now();

  function scheduleReconnect() {
    if (closed) return;
    reconnectTimer = setTimeout(() => {
      reconnectDelayMs = Math.min(reconnectDelayMs * 2, config.lightning.reconnectMaxDelayMs);
      connect();
    }, reconnectDelayMs);
  }

  function connect() {
    if (closed) return;
    const url = pickUrl();
    ws = new WebSocket(url);
    // Reset here, not just on "open" - covers the connect attempt itself
    // hanging (no open, no error, no close), which the watchdog below
    // otherwise couldn't distinguish from a stale established connection.
    lastMessageAt = Date.now();

    ws.addEventListener("open", () => {
      reconnectDelayMs = config.lightning.reconnectBaseDelayMs;
      lastMessageAt = Date.now();
      console.log(`[lightning] connected to ${url}`);
      ws?.send(HANDSHAKE);
    });

    ws.addEventListener("message", (event) => {
      lastMessageAt = Date.now();
      try {
        onRawMessage(String(event.data));
      } catch {
        // Never let a bad message or handler bug escape as an unhandled
        // exception - just drop it and keep the stream alive.
      }
    });

    ws.addEventListener("error", () => {
      // The close event fires right after and triggers the actual reconnect,
      // so there's nothing to do here beyond logging it - an unreachable or
      // retired relay host is otherwise completely invisible.
      console.warn(`[lightning] connection error on ${url}`);
    });

    ws.addEventListener("close", (event) => {
      if (!closed) {
        console.warn(
          `[lightning] disconnected from ${url} (code ${event.code}), ` +
            `reconnecting in ${Math.round(reconnectDelayMs / 1000)}s`,
        );
      }
      scheduleReconnect();
    });
  }

  // Blitzortung connections can go silently dead - socket stays open, no
  // error, no close, just zero further messages forever. That leaves nothing
  // to trigger the reconnect logic above, which is what previously required
  // a manual container restart to recover from. This watchdog is the only
  // thing that detects that case: if too long passes with no message at all
  // (checked well inside the staleMs window, not just once at the deadline),
  // force-close the socket so the normal close/reconnect path takes over.
  const watchdog = setInterval(() => {
    if (closed) return;
    const idleMs = Date.now() - lastMessageAt;
    if (idleMs > config.lightning.staleMs) {
      console.warn(
        `[lightning] no messages for ${Math.round(idleMs / 1000)}s, ` +
          `forcing reconnect (stale connection)`,
      );
      // Let the close handler own the actual reconnect scheduling - just
      // force the dead socket closed so that fires.
      ws?.close();
    }
  }, Math.min(config.lightning.staleMs / 4, 30_000));
  watchdog.unref();

  connect();

  return {
    close() {
      closed = true;
      clearInterval(watchdog);
      clearTimeout(reconnectTimer);
      ws?.close();
    },
  };
}
