# syntax=docker/dockerfile:1.4
FROM oven/bun:1.4.2-alpine AS bun
FROM node:24-alpine AS build
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN --mount=type=cache,id=bun-install-cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

COPY . .
RUN bun --filter frontend build
RUN bun --filter backend build

# Bun has no equivalent of pnpm's `--prod deploy`, so a self-contained
# prod-only install is done in a workspace-free copy instead: this
# re-resolves backend's direct deps (not pinned to the root bun.lock),
# which only matters for patch/minor drift within their caret ranges.
RUN mkdir -p /prod/backend/dist \
 && cp apps/backend/package.json /prod/backend/package.json \
 && cp -r apps/backend/dist/. /prod/backend/dist/
RUN --mount=type=cache,id=bun-install-cache,target=/root/.bun/install/cache \
    cd /prod/backend && bun install --production

FROM oven/bun:1.4.2-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app/apps/backend

COPY --from=build /prod/backend ./
COPY --from=build /app/apps/frontend/dist /app/apps/frontend/dist

RUN mkdir -p .data && chown -R bun:bun /app
USER bun

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD bun -e "fetch('http://localhost:3001/api/frames').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["bun", "dist/index.js"]
