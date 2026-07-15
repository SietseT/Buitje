import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fs from "node:fs";
import { config } from "./config.js";
import { createDiskFrameStore } from "./cache/diskFrameStore.js";
import { loadGridBounds } from "./cache/frameStore.js";
import { startPoller } from "./knmi/poller.js";
import { registerFrameRoutes } from "./routes/frames.js";

const app = Fastify({ logger: true });
loadGridBounds();
const store = createDiskFrameStore(config.cache.maxFrames, config.paths.framesDir);

registerFrameRoutes(app, store);

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
