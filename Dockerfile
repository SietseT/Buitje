FROM node:22-alpine AS build
RUN npm install -g pnpm@10.23.0
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter frontend build
RUN pnpm --filter backend build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app/apps/backend

COPY apps/backend/package.json ./package.json
RUN npm install --omit=dev

COPY --from=build /app/apps/backend/dist ./dist
COPY --from=build /app/apps/frontend/dist /app/apps/frontend/dist

EXPOSE 3000
CMD ["node", "dist/index.js"]
