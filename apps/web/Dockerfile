# Build the static site, then serve it from an unprivileged nginx.
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY libs/deploy-templates/package.json libs/deploy-templates/
# No dependency install scripts run during the image build.
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build --workspace apps/web

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
