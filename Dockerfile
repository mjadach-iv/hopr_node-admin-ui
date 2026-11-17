# syntax=docker/dockerfile:1

# The app compiles to static files and the earnings indexer to one bundled
# script, so the build stages always run on the builder's native platform. Only
# the small nginx + node runtime stage is per-arch, which keeps multi-arch
# builds fast (no emulated pnpm install).

FROM --platform=$BUILDPLATFORM node:24-bookworm-slim AS deps

WORKDIR /app

# pnpm version comes from the "packageManager" field in package.json
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS build

COPY . .
RUN pnpm run build && \
    node -p "require('./package.json').version" > build/version.txt

# the node binary for the indexer, the same major as the build
FROM node:24-alpine AS node

FROM nginx:stable-alpine AS runtime

RUN apk add --no-cache libstdc++
COPY --from=node /usr/local/bin/node /usr/local/bin/node

# a template, so the entrypoint fills in the container's DNS resolvers for the registry proxy
COPY nginx.conf /etc/nginx/templates/default.conf.template
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
COPY --from=build /app/build /usr/share/nginx/html

# The earnings indexer and its SQLite file with the RPC, blokli and CT settings. No VOLUME on
# purpose: an anonymous one is lost on docker rm anyway, and without it the indexer can tell
# that nothing is mounted at /data and the app warns. Run with -v hopr-admin-data:/data
COPY --from=build /app/dist-indexer /opt/indexer
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
ENV INDEXER_DB=/data/indexer.sqlite \
    INDEXER_PORT=4680
RUN mkdir -p /data

EXPOSE 4677

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
