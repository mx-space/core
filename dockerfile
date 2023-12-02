FROM node:21-alpine as builder
WORKDIR /app
COPY . .
RUN apk add git make g++ alpine-sdk python3 py3-pip unzip
RUN npm i -g pnpm
RUN pnpm install
RUN pnpm bundle
RUN mv apps/core/out ./out
RUN node apps/core/download-latest-admin-assets.js

FROM node:21-alpine

RUN apk add zip unzip mongodb-tools bash fish rsync jq curl --no-cache
WORKDIR /app
COPY --from=builder /app/out .
COPY --from=builder /app/assets ./assets
COPY ./docker-run.sh .
ENV TZ=Asia/Shanghai

EXPOSE 2333
CMD echo "MixSpace Server Image." && sh
