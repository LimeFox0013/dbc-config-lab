# The hosted agent-tools API (NestJS, bundled by webpack) on Node, as an unprivileged user.
# Base images are pinned by digest; bump tag and digest together.
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY packages/core/package.json packages/core/
# Stands in for bigint-buffer (root overrides); installed from its own files.
COPY vendor/bigint-buffer vendor/bigint-buffer/
COPY libs/deploy-templates/package.json libs/deploy-templates/
COPY libs/mcp-http-sessions/package.json libs/mcp-http-sessions/
COPY libs/agentic-account/package.json libs/agentic-account/
COPY libs/agentic-account-drizzle/package.json libs/agentic-account-drizzle/
COPY libs/safe-fetch/package.json libs/safe-fetch/
# No dependency install scripts run during the image build.
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build --workspace apps/api

FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402
# Pick up Alpine security fixes published after the base image was built.
RUN apk upgrade --no-cache
WORKDIR /app
ENV NODE_ENV=production
# The bundle keeps npm packages external: install the API's production dependencies only
# (its workspace packages are bundled, so their sources are not needed at run time).
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY packages/core/package.json packages/core/
# Stands in for bigint-buffer (root overrides); installed from its own files.
COPY vendor/bigint-buffer vendor/bigint-buffer/
COPY libs/deploy-templates/package.json libs/deploy-templates/
COPY libs/mcp-http-sessions/package.json libs/mcp-http-sessions/
COPY libs/agentic-account/package.json libs/agentic-account/
COPY libs/agentic-account-drizzle/package.json libs/agentic-account-drizzle/
COPY libs/safe-fetch/package.json libs/safe-fetch/
# npm is only needed to install: removing it drops the base image's bundled npm and its
# dependency tree (the source of most of its scanner findings) from what runs.
RUN npm ci --ignore-scripts --omit=dev --workspace apps/api \
  && npm cache clean --force \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
    /usr/local/lib/node_modules/corepack /usr/local/bin/corepack
COPY --from=build /repo/apps/api/dist ./dist
USER node
EXPOSE 8080
# DATABASE_URL (from the platform) and CALLER_HASH_KEY are required at run time.
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://127.0.0.1:8080/health || exit 1
CMD ["node", "dist/main.js"]
