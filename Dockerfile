# syntax=docker/dockerfile:1
# Railway deploy image for the artworkPDF HTTP service (apps/service).
#
# pnpm 10 + turbo monorepo: install the workspace, build the service + the
# workspace packages it depends on (skipping the editor frontend), then run the
# compiled service. It boots HTTP-only when DATABASE_URL is unset — /healthz and
# the /.well-known/synergy-node.json capability descriptor work; pg-boss job
# processing lights up once DATABASE_URL is configured.
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

# The package tsconfigs extend the root config, so the full workspace context is
# needed for the build to resolve it (node_modules/dist pruned via .dockerignore).
COPY . .
RUN pnpm install --frozen-lockfile
# Build only @artworkpdf/service and its workspace dependencies (turbo ^build
# orders them) — avoids building the editor frontend in the service image.
RUN pnpm --filter @artworkpdf/service... build

# Drop privileges: run the server as a non-root user.
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app /pnpm
USER appuser

ENV NODE_ENV=production
# Railway injects PORT; the service falls back to 3001 when unset.
EXPOSE 3001
CMD ["node", "apps/service/dist/index.js"]
