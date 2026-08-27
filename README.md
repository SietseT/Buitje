# Buitje

A fast, clean precipitation radar for the Netherlands — a modern alternative to buienradar.nl / weerplaza.nl, built on KNMI's own open radar data.

## Public instance

A hosted instance is available at **https://buitje.sietsetrommelen.nl** — no signup, no ads, no tracking. You're also free to self-host it (see below).

## Disclaimer

This project is almost entirely built with an AI coding agent (Claude Code) — see "Why?" below for the reasoning. The code has been reviewed for correctness and security along the way, and the areas most likely to silently break (KNMI's coordinate reprojection math, the color ramp, the lightning feed parsing) have automated tests (see Testing). That said, this is a hobby project maintained by one person, not an audited production service — self-hosters should treat it accordingly, e.g. review the code and keep an eye on the KNMI API key they configure.

## Why?

Firstly, to test what the current state of coding agents (Claude Code) actually looks like on a real, non-trivial project. Secondly, because the most popular Dutch precipitation radar, Buienradar.nl, has ads and tracking in its website and apps, and a paid subscription to remove them — despite the underlying data being KNMI's public open data. KNMI shipped their own radar in their weather app using that same public data, and Buienradar (along with other weather companies) has sued them over it: https://tweakers.net/nieuws/231194/buienradar-en-andere-weerbedrijven-klagen-knmi-aan-om-vernieuwde-weerapp.html

## How it works

KNMI publishes a nationwide precipitation radar composite (`radar_reflectivity_composites`, combining the Den Helder and Herwijnen radars) every 5 minutes as HDF5 files via their [Open Data API](https://developer.dataplatform.knmi.nl/open-data-api). A Node.js backend polls that API, parses the HDF5 grid, reprojects it from KNMI's polar-stereographic projection to a regular WGS84 grid, colorizes it into a PNG, and serves it to a Vue 3 + MapLibre GL frontend that overlays it on a map.

- `apps/backend` — Fastify + TypeScript (ESM). Polls KNMI, runs the HDF5/reprojection/colorize pipeline, serves `/api/frames` and a lightning-strike overlay (via an unofficial Blitzortung feed).
- `apps/frontend` — Vue 3 + Vite + shadcn-vue + MapLibre GL. Just the radar: a map, a locate/lightning/smoothing rail, and a scrub/play timeline over the last ~2 hours.

It's a pnpm workspace monorepo; in production a single Docker image serves both (the backend serves the built frontend as static files).

## Getting a KNMI API key

KNMI's Open Data API needs a key in the `Authorization` header. `apps/backend/.env.example` already ships KNMI's own published **anonymous/demo key** — shared across all unregistered users, rate-limited to 3,000 requests/hour, valid until 1 Aug 2027 — so the app works out of the box for trying it out or local development.

For your own deployment, register a free personal key at **https://developer.dataplatform.knmi.nl** for a dedicated, higher quota, and put it in your `.env` as `KNMI_API_KEY=...`.

## Development

Requires Node 22+ and [pnpm](https://pnpm.io). The Docker image runs on Node 24 (Active LTS); 22 (Maintenance LTS) is the supported floor for local dev.

```sh
pnpm install
cp apps/backend/.env.example apps/backend/.env
pnpm dev:backend    # http://localhost:3001
pnpm dev:frontend   # http://localhost:5173 (proxies /api to the backend)
```

Or run both at once with `pnpm dev`.

## Testing

```sh
cd apps/backend
pnpm test
```

Uses Node's built-in test runner (no extra framework). Covers the riskiest math in the codebase: the KNMI reprojection sign convention, color ramp interpolation, and the Blitzortung lightning feed's LZW decoding/strike parsing/stores. Runs in CI on every push and gates the Docker image build.

## Self-hosting with Docker Compose

```sh
cp .env.example .env   # edit KNMI_API_KEY for your own key (recommended, see above)
docker compose up --build
```

This builds and runs the whole app — frontend and API — from a single container on port `3001`, with radar frames and lightning history persisted to a named Docker volume across restarts.

To run a prebuilt image instead of building locally, use `docker-compose.prod.yml`:

```sh
cp .env.example .env
docker compose -f docker-compose.prod.yml up
```

## Environment variables

All variables are optional except `KNMI_API_KEY`. Set them in `apps/backend/.env` for local dev, or in the root `.env` for Docker Compose (see `.env.example` in both locations).

| Variable                      | Default                      | Description                                                                                                                                    |
| ----------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `KNMI_API_KEY`                | — (required)                 | KNMI Open Data API key. See "Getting a KNMI API key" above.                                                                                    |
| `PORT`                        | `3001`                       | Port the backend HTTP server binds to.                                                                                                         |
| `POLL_INTERVAL_MS`            | `60000`                      | How often the backend polls KNMI for a new radar frame.                                                                                        |
| `MAX_FRAMES`                  | `24`                         | How many frames are retained (~2 hours of history at 5 min/frame). Also sizes lightning retention by default.                                  |
| `BACKFILL_CONCURRENCY`        | `8`                          | How many missing frames are downloaded in parallel on startup/poll (fills in timeline history).                                                |
| `LOG_REQUESTS`                | `false`                      | Enables Fastify's per-request access log. Off by default since the frontend polls its own endpoints frequently.                                |
| `LIGHTNING_BOUNDS_PADDING`    | `1.5`                        | Degrees of padding around the Netherlands bounding box used to filter the global lightning feed before the radar grid's real bounds are known. |
| `LIGHTNING_RETENTION_MS`      | `MAX_FRAMES * 5 * 60 * 1000` | How long lightning strikes are kept. Derived from `MAX_FRAMES` by default so it always covers the full radar timeline.                         |
| `LIGHTNING_MAX_STRIKES`       | `20000`                      | Cap on strikes kept in the lightning store.                                                                                                    |
| `LIGHTNING_FLUSH_INTERVAL_MS` | `30000`                      | How often the strike buffer is snapshotted to disk (also the worst-case data-loss window on a hard kill).                                      |
| `LIGHTNING_RECONNECT_BASE_MS` | `2000`                       | Base delay for the Blitzortung WebSocket reconnect backoff.                                                                                    |
| `LIGHTNING_RECONNECT_MAX_MS`  | `60000`                      | Max delay for the Blitzortung WebSocket reconnect backoff.                                                                                     |
| `LIGHTNING_STALE_MS`          | `120000`                     | Watchdog timeout — reconnects the Blitzortung feed if no message arrives for this long (handles silently-dead connections).                    |

`HOST` (default `0.0.0.0`) also exists but is intentionally left out of `.env.example` — inside Docker it needs to stay wildcard for port mapping to work, so it's not meant to be overridden there.

## Contributing

Issues and pull requests are welcome. A few things to know before diving in:

- Run `pnpm test` (from `apps/backend`) before opening a PR — CI runs the same suite and gates the Docker image build on it.
- Read [`CLAUDE.md`](./CLAUDE.md) first. It documents the non-obvious parts of this codebase in detail — KNMI's reprojection sign convention, Mercator row-spacing, the Blitzortung feed's undocumented quirks, and more — the kind of things that are easy to silently break if you don't know they're there.
- Keep the philosophy in mind: this app is deliberately minimal (precipitation and lightning, nothing else). New features should fit that, not expand it.

## License

MIT — see [LICENSE](./LICENSE).
