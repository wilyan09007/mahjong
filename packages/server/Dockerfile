# Game server image.
#
# Runs TypeScript directly with tsx rather than building. The engine and bot are
# consumed as TS source across the workspace (`main: src/index.ts`), so a build
# step would mean emitting and wiring three packages for no runtime benefit on a
# single small machine.
#
# Dependency manifests are copied before the source so that a code change does
# not invalidate the install layer.

FROM node:22-slim

WORKDIR /repo
RUN corepack enable

# React Native's tooling needs a hoisted layout; the root .npmrc sets it, and it
# must be present before install.
COPY .npmrc pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/engine/package.json packages/engine/package.json
COPY packages/bot/package.json packages/bot/package.json
COPY packages/server/package.json packages/server/package.json

# `@mahjong/server...` pulls the server plus everything it depends on, and
# nothing else — the Expo app never reaches this image.
RUN pnpm install --frozen-lockfile --filter @mahjong/server...

COPY packages/engine packages/engine
COPY packages/bot packages/bot
COPY packages/server packages/server

ENV NODE_ENV=production
ENV PORT=2567
EXPOSE 2567

# Fly's health check hits /health; see fly.toml.
CMD ["pnpm", "-F", "@mahjong/server", "exec", "tsx", "src/index.ts"]
