FROM node:22-alpine as builder
WORKDIR /app
COPY . .
RUN apk add git make g++ alpine-sdk python3 py3-pip unzip
RUN npm i -g pnpm
RUN pnpm install
RUN pnpm bundle
RUN mv apps/core/out ./out
RUN node apps/core/download-latest-admin-assets.js

FROM node:22-alpine

RUN apk add zip unzip mongodb-tools bash fish rsync jq curl openrc --no-cache

RUN curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared \
    && chmod +x /usr/local/bin/cloudflared

WORKDIR /app
COPY --from=builder /app/out .
COPY --from=builder /app/assets ./assets

RUN npm i sharp -g

COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

ENV TZ=Asia/Shanghai

EXPOSE 2333

ENTRYPOINT [ "./docker-entrypoint.sh" ]
