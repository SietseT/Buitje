import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fs from "node:fs";
import { config, assertRequiredConfig } from "./config.js";
import { createDiskFrameStore } from "./cache/diskFrameStore.js";
import { loadGridBounds } from "./cache/frameStore.js";
import { createDiskLightningStore } from "./cache/diskLightningStore.js";
import { startPoller } from "./knmi/poller.js";
import { startLightningRelay } from "./lightning/relay.js";
import { registerFrameRoutes } from "./routes/frames.js";
import { registerLightningRoutes } from "./routes/lightning.js";
import { registerAdminRoutes } from "./routes/admin.js";

// Before anything else: no KNMI key means every poll would 401, so fail here
// with an actionable message rather than in a retry loop later.
assertRequiredConfig();

const app = Fastify({ logger: true, disableRequestLogging: !config.server.logRequests });

// Crash loudly and let Docker's `restart: unless-stopped` bring the process
// back up cleanly, rather than continuing in an unknown state or exiting
// with no explanation in the logs. The lightning relay (lightning/client.ts)
// is deliberately exempt from this - it catches its own WebSocket errors and
// reconnects internally, since a flaky external stream going down is not a
// reason to kill the whole radar service.
// Strikes can't be re-fetched after the fact (Blitzortung is a live-only
// feed), so the buffer gets one last snapshot on the way out - on the fatal
// paths too, since those exit deliberately rather than unexpectedly. Wrapped
// because a failed flush must never mask the original error, and because an
// exception thrown during module init would reach here before lightningStore
// is assigned.
function flushLightning(): void {
  try {
    lightningStore.flush();
  } catch (err) {
    app.log.warn({ err }, "[lightning] final flush failed");
  }
}

process.on("unhandledRejection", (reason) => {
  app.log.error({ reason }, "[fatal] unhandled promise rejection");
  flushLightning();
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  app.log.error({ err }, "[fatal] uncaught exception");
  flushLightning();
  process.exit(1);
});

// SIGTERM covers `docker stop` and tsx watch's reload-on-save; SIGINT covers
// Ctrl-C in dev. Both are the common case in practice, so this is what keeps
// the timeline populated across a restart.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    flushLightning();
    app.close().finally(() => process.exit(0));
  });
}

loadGridBounds();
const store = createDiskFrameStore(config.cache.maxFrames, config.paths.framesDir);
const lightningStore = createDiskLightningStore(
  config.lightning.retentionMs,
  config.lightning.maxStrikes,
  config.paths.lightningFile,
  config.lightning.flushIntervalMs,
);

registerFrameRoutes(app, store);
registerLightningRoutes(app, lightningStore);

if (process.env.NODE_ENV !== "production") {
  registerAdminRoutes(app);
}

if (fs.existsSync(config.paths.frontendDist)) {
  app.register(fastifyStatic, {
    root: config.paths.frontendDist,
    // Vite hashes filenames under assets/, so those can be cached forever;
    // everything else (index.html, favicon.svg, ...) must revalidate on
    // every request or clients get stuck on a stale build after a deploy.
    setHeaders: (res, filePath) => {
      if (/[\\/]assets[\\/]/.test(filePath)) {
        res.header("Cache-Control", "public, max-age=31536000, immutable");
      } else {
        res.header("Cache-Control", "no-cache");
      }
    },
  });
  app.setNotFoundHandler((req, reply) => {
    if (req.raw.url?.startsWith("/api")) {
      reply.status(404).send({ error: "Not found" });
      return;
    }
    reply.header("Cache-Control", "no-cache");
    reply.sendFile("index.html");
  });
}

startPoller(store);
startLightningRelay(lightningStore);

app
  .listen({ port: config.server.port, host: config.server.host })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
