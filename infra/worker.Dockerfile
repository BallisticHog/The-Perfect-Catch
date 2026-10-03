# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @the-perfect-catch/worker typecheck && pnpm --filter @the-perfect-catch/worker --if-present build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate \
    && mkdir -p /var/lib/catch/media /var/lib/catch/snapshots \
    && chown -R node:node /var/lib/catch
# Workspace source exports and the migration runner require tsx at runtime.
COPY --from=build --chown=node:node /app /app
USER node
CMD ["pnpm", "--filter", "@the-perfect-catch/worker", "start"]
