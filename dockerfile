FROM node:22-alpine as builder
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
RUN node apps/core/download-latest-admin-assets.js

FROM node:22-alpine

RUN apk add zip unzip mongodb-tools bash fish rsync jq curl openrc --no-cache

RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "aarch64" ]; then \
    CF_ARCH="arm64"; \
    elif [ "$ARCH" = "x86_64" ]; then \
    CF_ARCH="amd64"; \
    else \
    echo "Unsupported architecture: $ARCH"; exit 1; \
    fi && \
    curl -L "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}" \
    -o /usr/local/bin/cloudflared && \
    chmod +x /usr/local/bin/cloudflared

WORKDIR /app
COPY --from=builder /app/out .
COPY --from=builder /app/assets ./assets

RUN npm i sharp -g
RUN npm i sharp

COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

ENV TZ=Asia/Shanghai

EXPOSE 2333

ENTRYPOINT [ "./docker-entrypoint.sh" ]
