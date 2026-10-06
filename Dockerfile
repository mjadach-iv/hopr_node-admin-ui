FROM --platform=linux/amd64 node:22-bullseye-slim AS deps

SHELL ["/bin/bash", "-lc"]

# Check
# https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine
# to understand why libc6-compat might be needed.
RUN apt-get update && \
    apt-get install -y libc6 jq && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

RUN jq .version package.json -r > /app/version.txt
RUN pnpm install --frozen-lockfile

FROM --platform=linux/amd64 node:22-bullseye-slim AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY . .

RUN corepack enable && pnpm run build

FROM nginx:stable-alpine@sha256:e544ba68e68ddbcdff106010fa82f4ab30378899e78d4ff7aadf4ef5a7c65091 AS runtime

WORKDIR /usr/share/nginx/html
RUN rm -rf ./*

COPY --from=build /app/build .
COPY --from=deps /app/version.txt .
COPY nginx.conf /etc/nginx/conf.d/default.conf

ENTRYPOINT ["nginx", "-g", "daemon off;"]
