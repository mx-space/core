# This only for Debian based systems
# FROM node:16 as builder
# WORKDIR /app
# COPY . .
# RUN npm i -g pnpm
# RUN pnpm install
# RUN pnpm bundle

# FROM node:16
# ARG redis_host
# ARG mongo_host
# RUN apt update
# RUN apt install zip unzip mongo-tools -y

# WORKDIR /app
# COPY --from=builder /app/out .
# EXPOSE 2333
# CMD node index.js --redis_host=redis --db_host=mongo

# Use alpine to build smaller image
FROM node:16-alpine as builder
WORKDIR /app
COPY . .
RUN apk add git
RUN npm i -g pnpm
RUN pnpm install
RUN pnpm bundle
RUN git clone https://github.com/mx-space/assets.git --depth=1
RUN rm -rf assets/.git

FROM node:16-alpine
RUN apk add zip unzip mongodb-tools --no-cache

WORKDIR /app
COPY --from=builder /app/out .
COPY --from=builder /app/assets ./assets
EXPOSE 2333
CMD node index.js --redis_host=redis --db_host=mongo
