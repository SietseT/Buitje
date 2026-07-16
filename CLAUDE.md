# Buitje

A modern precipitation radar for the Netherlands (a fast, ad-free alternative to buienradar.nl), built on KNMI's public radar data.

## Architecture

- `apps/backend` — Fastify + TypeScript (Node, ESM). Polls the KNMI Open Data API every minute, parses the HDF5 radar composite, reprojects it, colorizes it to PNG, and serves it.
- `apps/frontend` — Vue 3 + Vite + shadcn-vue (Tailwind v4) + MapLibre GL. Full-screen map with a scrub/play timeline over recent frames.
- pnpm workspace monorepo. Single Docker image serves both (backend serves the built frontend `dist/` as static files in production).

Data source: KNMI's `radar_reflectivity_composites` v2.0 dataset (files `RAD_NL25_PCP_NA_<YYYYMMDDHHmm>.h5`), **not** the raw per-station volume datasets — KNMI already publishes the merged nationwide composite, so there's no need to combine Den Helder/Herwijnen data manually.

## Commands

```sh
pnpm install
pnpm dev:backend     # apps/backend, http://localhost:3000
pnpm dev:frontend    # apps/frontend, http://localhost:5173 (proxies /api)
pnpm build           # builds frontend then backend
docker compose up --build
```

Backend needs `apps/backend/.env` with `KNMI_API_KEY` (see `apps/backend/.env.example` — it already contains KNMI's public anonymous demo key).

## Non-obvious things worth knowing before touching this code

- **KNMI's row/col pixel-offset sign convention is asymmetric.** Empirically verified against real files (see `apps/backend/src/knmi/reproject.ts`): `col = (x - columnOffset) / pixelSizeX` but `row = (y + rowOffset) / pixelSizeY` — note the `+`, not `-`. Using `-` for both (the "obvious" symmetric guess) silently produces a vertically-offset-by-~7300-rows image. If you ever touch the reprojection math, re-verify against a real downloaded file's `geo_product_corners` attribute rather than trusting the KNMI HDF5 spec PDF alone.
- **Frame timestamps are UTC.** The `YYYYMMDDHHmm` string extracted from filenames (`apps/backend/src/knmi/parseRadar.ts:extractTimestampFromFilename`) is UTC, confirmed against the KNMI API's `created` field. The frontend (`Timeline.vue:formatTime`) parses it with `Date.UTC(...)` and renders via `toLocaleTimeString` so it displays in the viewer's local timezone — don't reintroduce a plain substring slice, that silently shows UTC instead of local time.
- **This app uses a dedicated personal KNMI API key, not the shared anonymous demo key** — the old shared key was rate-limited to 50 req/min across ALL anonymous users, which is why earlier versions of `poller.ts` spaced backfill requests ~1.5s apart. That budget no longer applies, so backfill instead downloads several missing frames concurrently (`config.cache.backfillConcurrency`, default 8, env `BACKFILL_CONCURRENCY`). `apps/backend/src/knmi/client.ts`'s retry-with-backoff (respects `Retry-After`) is kept as a general safety net for occasional 429s, not as a load-bearing rate-limit calculation.
- **Backend backfills history on startup and every poll** (fetches the last `MAX_FRAMES` files, newest first, and downloads whichever aren't already cached) so the timeline isn't empty for 2 hours after every restart, and a gap from a failed/delayed tick self-heals on the next one. Newest-first + concurrent means the current frame shows up almost immediately on a cold start, with older history filling in alongside it. Restarting the backend in dev re-runs this backfill each time (`tsx watch` will do this on every source save).
- **KNMI's own `visualisation1/color_palette` in the HDF5 file was deliberately not used.** It's a grayscale/red hazard-style palette, not the smooth blue→green→yellow→red→purple gradient users expect from a rain radar. `apps/backend/src/knmi/colorize.ts` defines its own color ramp from calibrated dBZ values instead.
- **The color ramp is duplicated in two places** — `apps/backend/src/knmi/colorize.ts` (`STOPS`, generates the actual PNG) and `apps/frontend/src/components/Legend.vue` (`STOPS`, renders the on-map legend gradient). No shared package between the two apps, so if you change one, update the other too.
- **`frameStore` (`apps/backend/src/cache/frameStore.ts`) is an interface**, currently backed by an in-memory ring buffer capped at ~2 hours. If asked for longer history retention, swap in a disk-backed implementation behind the same interface rather than reworking callers — this was designed for that from the start.
- **The basemap is OpenFreeMap ("Liberty" style), not CARTO.** CARTO's raster basemap tiles (`basemaps.cartocdn.com`) were used briefly, but CARTO's own docs state free basemap use requires being a registered "grantee" — not clearly free for an anonymous hobby app. OpenFreeMap's docs explicitly state no limits, no registration, no API keys. If a different look is wanted, only switch between OpenFreeMap's own styles (`positron`, `liberty`, `bright` confirmed working at `https://tiles.openfreemap.org/styles/<name>`) — don't reach for CARTO or another provider without re-checking its actual terms first, not just what search results/training data imply.
- **Local dev environment quirk (this machine, not the project):** `corepack pnpm` fails with a signature-verification error (`Cannot find matching keyid`) on this machine — unrelated to the project. Workarounds used: pin `"packageManager"` in package.json, and when running the `shadcn-vue` CLI, prefix with `COREPACK_INTEGRITY_KEYS=""` if it tries to shell out to corepack again.
- Frontend path alias `@` → `src/` (Vite + tsconfig `paths`, no `baseUrl` — TS 6+ deprecated `baseUrl`, dropped it rather than suppressing the warning).
- `pnpm-workspace.yaml` has `onlyBuiltDependencies: [esbuild, vue-demi]` — needed for their postinstall scripts to run under pnpm's default script-blocking.
