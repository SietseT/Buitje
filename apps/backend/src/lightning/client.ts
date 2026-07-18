import { config } from "../config.js";

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

    ws.addEventListener("open", () => {
      reconnectDelayMs = config.lightning.reconnectBaseDelayMs;
      ws?.send('{"time":0}');
    });

    ws.addEventListener("message", (event) => {
      try {
        onRawMessage(String(event.data));
      } catch {
        // Never let a bad message or handler bug escape as an unhandled
        // exception - just drop it and keep the stream alive.
      }
    });

    ws.addEventListener("error", () => {
      // The close event fires right after and triggers the actual
      // reconnect; nothing to do here beyond not crashing.
    });

    ws.addEventListener("close", () => {
      scheduleReconnect();
    });
  }

  connect();

  return {
    close() {
      closed = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    },
  };
}
