# syntax=docker/dockerfile:1.4
FROM node:22-alpine AS build
RUN npm install -g pnpm@11.13.1
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile --store-dir=/pnpm-store

COPY . .
RUN pnpm --filter frontend build
RUN pnpm --filter backend build

RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm --filter backend --prod deploy --legacy --store-dir=/pnpm-store /prod/backend

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app/apps/backend

COPY --from=build /prod/backend ./
COPY --from=build /app/apps/frontend/dist /app/apps/frontend/dist

RUN mkdir -p .data && chown -R node:node /app
USER node

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/api/frames').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
