FROM node:16-alpine as builder
WORKDIR /app
COPY . .
RUN apk add git make gcc g++
RUN git clone https://github.com/mx-space/assets.git --depth=1
RUN rm -rf assets/.git
RUN npm i -g pnpm
RUN pnpm install
RUN pnpm bundle

FROM node:16-alpine
RUN apk add zip unzip mongodb-tools --no-cache

WORKDIR /app
COPY --from=builder /app/out .
COPY --from=builder /app/assets ./assets
EXPOSE 2333
CMD echo "MixSpace Sever Image." && sh
