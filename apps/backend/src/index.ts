import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fs from "node:fs";
import { config } from "./config.js";
import { createDiskFrameStore } from "./cache/diskFrameStore.js";
import { loadGridBounds } from "./cache/frameStore.js";
import { startPoller } from "./knmi/poller.js";
import { registerFrameRoutes } from "./routes/frames.js";
import { registerAdminRoutes } from "./routes/admin.js";

const app = Fastify({ logger: true });

// Crash loudly and let Docker's `restart: unless-stopped` bring the process
// back up cleanly, rather than continuing in an unknown state or exiting
// with no explanation in the logs.
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

registerFrameRoutes(app, store);

if (process.env.NODE_ENV !== "production") {
  registerAdminRoutes(app);
}

if (fs.existsSync(config.paths.frontendDist)) {
  app.register(fastifyStatic, {
    root: config.paths.frontendDist,
  });
  app.setNotFoundHandler((req, reply) => {
    if (req.raw.url?.startsWith("/api")) {
      reply.status(404).send({ error: "Not found" });
      return;
    }
    reply.sendFile("index.html");
  });
}

startPoller(store);

app
  .listen({ port: config.server.port, host: config.server.host })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
