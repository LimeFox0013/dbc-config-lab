# Build the static site, then serve it from an unprivileged nginx.
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
# The hosted API the account page calls; the same value goes into the CSP below, so
# pointing the site at another API is one build argument (hosting-portability).
ARG DBC_LAB_API_URL=https://lf-aw-pod.dbc-lab-api.at.lime-fox.net
RUN VITE_DBC_LAB_API_URL="$DBC_LAB_API_URL" npm run build --workspace apps/web

FROM nginxinc/nginx-unprivileged:alpine@sha256:b9241c6e7b8e9a862f129d8d4199ab64b10390949a78bdd5603379b32c844083
# Pick up Alpine security fixes published after the base image was built. Deliberate
# trade-off: two builds from the same digest can differ in OS patch level.
USER root
RUN apk upgrade --no-cache
# The server config is a template: the image's entrypoint fills in the mainnet RPC upstream
# from the container's environment at start — DBC_LAB_MAINNET_RPC_URL, or Helius with
# HELIUS_API_KEY (runtime secrets, never baked into the image) — and substitutes nothing
# else. Without either the site still serves; only mainnet reads fail.
COPY apps/web/nginx.conf /etc/nginx/templates/default.conf.template
# The entrypoint sources only executable *.envsh files.
COPY --chmod=755 apps/web/rpc-upstream.envsh /docker-entrypoint.d/15-rpc-upstream.envsh
RUN rm -f /etc/nginx/conf.d/default.conf
ENV NGINX_ENVSUBST_FILTER="^DBC_LAB_MAINNET_RPC_URL$" \
    HELIUS_API_KEY=""
COPY apps/web/security-headers.conf /etc/nginx/snippets/security-headers.conf
ARG DBC_LAB_API_URL=https://lf-aw-pod.dbc-lab-api.at.lime-fox.net
RUN origin="$(echo "$DBC_LAB_API_URL" | sed -E 's#^(https?://[^/]+).*#\1#')" \
  && sed -i "s#https://lf-aw-pod.dbc-lab-api.at.lime-fox.net#$origin#" /etc/nginx/snippets/security-headers.conf \
  && grep -q "connect-src[^;]*$origin" /etc/nginx/snippets/security-headers.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
# Back to the base image's unprivileged nginx user.
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
