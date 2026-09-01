FROM node:24-alpine AS builder
ENV MONGOMS_DISABLE_POSTINSTALL=1
ENV REDISMS_DISABLE_POSTINSTALL=1
WORKDIR /app
COPY . .
RUN apk add git make g++ alpine-sdk python3 py3-pip unzip
RUN corepack enable
RUN corepack prepare --activate
RUN pnpm install
RUN pnpm bundle
RUN mv apps/core/out ./out
RUN cp -R apps/core/src/database/migrations ./out/migrations
# Build the admin dashboard from this workspace instead of downloading a
# prebuilt release. Vite emits apps/admin/dist/{index.html,assets,js}; the
# server expects index.html at the asset root, so copy dist/* into out/admin
# (flattening the dist/ wrapper, matching the old download layout exactly).
RUN pnpm --filter @mx-admin/admin run build
RUN mkdir -p ./out/admin && cp -R apps/admin/dist/. ./out/admin/
# Stamp the built-in admin version (mirrors the runtime updater's `version` file).
RUN node -p "require('./apps/admin/package.json').version" > ./out/admin/version

FROM node:24-alpine AS runner

RUN apk add zip unzip postgresql-client bash fish rsync jq curl openrc --no-cache

# Chromium + fonts/nss for the agent-browser headless fallback used by the
# Open Graph enrichment provider (fetchMode = "browser"). Alpine's chromium
# package is hardened against root, so we pin --no-sandbox via env below.
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-cjk

RUN npm i -g agent-browser

WORKDIR /app
COPY --from=builder /app/out .

RUN npm i sharp -g
RUN npm i sharp
# Nest 12 WsAdapter loads `ws` at runtime via createRequire(import.meta.url).
# The production image only copies the Vite bundle, so install it next to sharp.
RUN npm i ws@8.21.3

COPY --chmod=755 docker-entrypoint.sh .

# V8 code cache for the bundle. Warmed at build time so the cache ships inside
# the image — a fresh container (rolling deploy) hits it on first boot instead
# of re-parsing the ~6MB bootstrap chunk. The dummy env vars only satisfy
# app.config's eager validation during warmup; they are not baked into ENV.
ENV NODE_COMPILE_CACHE=/app/.compile-cache
RUN SNOWFLAKE_WORKER_ID=0 \
    ENCRYPT_KEY=0000000000000000000000000000000000000000000000000000000000000000 \
    node -e "const fs=require('fs');Object.assign(globalThis,{isDev:false,cwd:process.cwd(),consola:console});const c=fs.readdirSync('./chunks').find(n=>n.startsWith('bootstrap-'));import('./chunks/'+c).then(()=>process.exit(0),e=>{console.warn('[warmup] skipped:',e.message);process.exit(0)})" \
    && du -sh /app/.compile-cache

ENV TZ=Asia/Shanghai
ENV MIGRATIONS_DIR=/app/migrations
# agent-browser CLI picks up these knobs; system chromium replaces the
# bundled Chrome download (which has no musl build).
ENV AGENT_BROWSER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV AGENT_BROWSER_HEADED=0
ENV AGENT_BROWSER_CHROME_ARGS="--no-sandbox --disable-dev-shm-usage --disable-gpu"

EXPOSE 2333

ENTRYPOINT [ "./docker-entrypoint.sh" ]
