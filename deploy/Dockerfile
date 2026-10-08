# Build the static site, then serve it with nginx. Multi-stage: the builder
# stage only needs Node; the runtime stage is plain nginx.
#
# NOTE (offline dev container): the *authoritative* builds in this repo happen
# with the baked-in toolchain via `npm run build` (scripts are plain node).
# This Dockerfile is the deployable artifact for real hosting. It assumes a
# networked CI environment for `npm ci`. In the offline container, build with
# `node scripts/build.mjs` and run `docker build -f deploy/Dockerfile.prebuilt .`
# against the produced dist/.

# ---------- stage 1: build ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build            # emits dist/ (prerendered static site)

# ---------- stage 2: serve ----------
FROM nginx:1.27-alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/snippets /etc/nginx/snippets
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
# nginx:alpine ships without wget (busybox `nc` is present); use a
# busybox-compatible probe so the healthcheck actually runs.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD nc -z 127.0.0.1 80 || exit 1
