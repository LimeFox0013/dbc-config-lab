# Build the static site, then serve it from an unprivileged nginx.
# Base images are pinned by digest; bump tag and digest together.
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY libs/deploy-templates/package.json libs/deploy-templates/
# No dependency install scripts run during the image build.
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build --workspace apps/web

FROM nginxinc/nginx-unprivileged:stable-alpine@sha256:ed04ec1ff34502c339ee5c3ae3f855442398edc1d05591e2b98981dcbbd20b1e
# Pick up Alpine security fixes published after the base image was built. Deliberate
# trade-off: two builds from the same digest can differ in OS patch level.
USER root
RUN apk upgrade --no-cache
# The server config is a template: the image's entrypoint fills in HELIUS_API_KEY from the
# container's environment at start (a runtime secret, never baked into the image) and
# substitutes nothing else. Without it the site still serves; only mainnet reads fail.
COPY apps/web/nginx.conf /etc/nginx/templates/default.conf.template
RUN rm -f /etc/nginx/conf.d/default.conf
ENV NGINX_ENVSUBST_FILTER=HELIUS_ \
    HELIUS_API_KEY=""
COPY apps/web/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
# Back to the base image's unprivileged nginx user.
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
