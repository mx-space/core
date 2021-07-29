FROM node:16 as development

RUN npm i -g pnpm

WORKDIR /usr/src/app

COPY package.json ./
COPY pnpm-lock.yaml ./

RUN pnpm install glob rimraf

RUN pnpm install --only=development

COPY . .

RUN pnpm run build

FROM node:16 as production

RUN npm i -g pnpm

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package.json ./
COPY pnpm-lock.yaml ./

RUN pnpm install --only=production
RUN pnpm install pm2 --D
COPY . .

COPY --from=development /usr/src/app/dist ./dist

CMD ["pm2-prod", "ecosystem.config.js"]
