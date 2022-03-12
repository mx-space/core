FROM node:16-alpine as builder
WORKDIR /app
COPY . .
RUN apk add git make gcc g++ alpine-sdk python3 py3-pip python2 unzip
RUN git submodule update --init --recursive
RUN npm i -g pnpm
RUN pnpm install
RUN pnpm bundle
RUN node scripts/download-latest-admin-assets.js

FROM node:16-alpine
RUN apk add zip unzip mongodb-tools bash --no-cache
RUN mkdir -p /usr/local/lib/node_modules
WORKDIR /app
COPY --from=builder /app/out .
COPY --from=builder /app/assets ./assets
ENV TZ=Asia/Shanghai
ENV NODE_PATH=/usr/local/lib/node_modules
EXPOSE 2333

CMD echo "MixSpace Sever Image." && sh
