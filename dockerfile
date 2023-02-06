FROM node:16-alpine as builder
WORKDIR /app
COPY . .
RUN apk add git make g++ alpine-sdk python3 py3-pip unzip
RUN git clone https://github.com/mx-space/assets.git --depth=1
RUN rm -rf assets/.git
RUN npm i -g pnpm
RUN pnpm install
RUN pnpm bundle
RUN node scripts/download-latest-admin-assets.js

FROM node:16-alpine

RUN apk add zip unzip mongodb-tools bash fish rsync jq curl --no-cache
WORKDIR /app
COPY --from=builder /app/out .
COPY --from=builder /app/assets ./assets
ENV TZ=Asia/Shanghai

EXPOSE 2333
CMD echo "MixSpace Server Image." && sh
