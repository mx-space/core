FROM node:22-alpine AS build
WORKDIR /app
ENV REDISMS_DISABLE_POSTINSTALL=1
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/push-relay/package.json apps/push-relay/package.json
COPY packages/push-protocol/package.json packages/push-protocol/package.json
RUN pnpm install --frozen-lockfile --filter @mx-space/push-relay...
COPY apps/push-relay apps/push-relay
COPY packages/push-protocol packages/push-protocol
RUN pnpm --filter @mx-space/push-protocol build && pnpm --filter @mx-space/push-relay build
RUN pnpm --config.inject-workspace-packages=true deploy \
  --filter @mx-space/push-relay --prod /prod

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /prod ./
COPY --from=build /app/apps/push-relay/migrations ./migrations
USER node
CMD ["node", "dist/index.mjs"]
