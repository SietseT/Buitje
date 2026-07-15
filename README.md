# Buitje

A fast, clean precipitation radar for the Netherlands — a modern alternative to buienradar.nl / weerplaza.nl, built on KNMI's own open radar data.

## How it works

KNMI publishes a nationwide precipitation radar composite (`radar_reflectivity_composites`, combining the Den Helder and Herwijnen radars) every 5 minutes as HDF5 files via their [Open Data API](https://developer.dataplatform.knmi.nl/open-data-api). A Node.js backend polls that API, parses the HDF5 grid, reprojects it from KNMI's polar-stereographic projection to a regular WGS84 grid, colorizes it into a PNG, and serves it to a Vue 3 + MapLibre GL frontend that overlays it on a map.

- `apps/backend` — Fastify + TypeScript. Polls KNMI, does the HDF5/reprojection/colorize pipeline, serves `/api/frames`.
- `apps/frontend` — Vue 3 + Vite + shadcn-vue + MapLibre GL. Map + scrub/play timeline over the last ~2 hours.

## Setup

Requires Node 20+ and [pnpm](https://pnpm.io).

```sh
pnpm install
cp apps/backend/.env.example apps/backend/.env
```

The `.env.example` already contains KNMI's public anonymous API key (rate-limited, shared, valid until Aug 2027) so it works out of the box. For real use, register your own free key at https://developer.dataplatform.knmi.nl and put it in `apps/backend/.env`.

### Development

```sh
pnpm dev:backend    # http://localhost:3000
pnpm dev:frontend   # http://localhost:5173 (proxies /api to the backend)
```

### Production (Docker)

```sh
cp .env.example .env   # add your own KNMI_API_KEY for real deployments
docker compose up --build
```

Serves the whole app (frontend + API) from a single container on port 3000.
