FROM node:16 as development

RUN npm i -g pnpm

WORKDIR /usr/src/app

COPY package.json ./
COPY pnpm-lock.yaml ./

RUN pnpm install -D glob rimraf @vercel/ncc

RUN pnpm install
RUN pnpm run build
COPY . .
RUN pnpm run bundle

COPY . .

FROM node:16 as production

RUN npm i -g pnpm

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

RUN pnpm i -g pm2

COPY --from=development /usr/src/app/build ./dist

EXPOSE 2333
CMD ["pm2-runtime", "ecosystem.config.js"]
