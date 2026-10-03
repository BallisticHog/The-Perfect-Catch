# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
COPY . .
RUN pnpm install --frozen-lockfile
RUN mkdir -p apps/web/public && pnpm --filter @the-perfect-catch/web build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN mkdir -p /var/lib/catch/media /var/lib/catch/snapshots && chown -R node:node /var/lib/catch
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
COPY --chown=node:node infra/health ./infra/health
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
