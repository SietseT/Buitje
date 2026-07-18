import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fs from "node:fs";
import { config } from "./config.js";
import { createDiskFrameStore } from "./cache/diskFrameStore.js";
import { loadGridBounds } from "./cache/frameStore.js";
import { createLightningStore } from "./cache/lightningStore.js";
import { startPoller } from "./knmi/poller.js";
import { startLightningRelay } from "./lightning/relay.js";
import { registerFrameRoutes } from "./routes/frames.js";
import { registerLightningRoutes } from "./routes/lightning.js";
import { registerAdminRoutes } from "./routes/admin.js";

const app = Fastify({ logger: true });

// Crash loudly and let Docker's `restart: unless-stopped` bring the process
// back up cleanly, rather than continuing in an unknown state or exiting
// with no explanation in the logs. The lightning relay (lightning/client.ts)
// is deliberately exempt from this - it catches its own WebSocket errors and
// reconnects internally, since a flaky external stream going down is not a
// reason to kill the whole radar service.
process.on("unhandledRejection", (reason) => {
  app.log.error({ reason }, "[fatal] unhandled promise rejection");
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  app.log.error({ err }, "[fatal] uncaught exception");
  process.exit(1);
});

loadGridBounds();
const store = createDiskFrameStore(config.cache.maxFrames, config.paths.framesDir);
const lightningStore = createLightningStore(config.lightning.retentionMs, config.lightning.maxStrikes);

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
