# syntax=docker/dockerfile:1

# The app compiles to static files, so the build stages always run on the
# builder's native platform. Only the small nginx runtime stage is per-arch,
# which keeps multi-arch builds fast (no emulated pnpm install).

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

FROM nginx:stable-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 4677

CMD ["nginx", "-g", "daemon off;"]
