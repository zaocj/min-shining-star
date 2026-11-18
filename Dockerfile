# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app

# better-sqlite3 在目标 Linux 环境中安装，必要时编译原生模块。
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# 构建占位值；真实配置由 Compose 在运行时注入。
RUN SITE_URL=https://build.invalid DATABASE_PATH=/data/app.db npm run check \
    && SITE_URL=https://build.invalid DATABASE_PATH=/data/app.db npm run build
RUN npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]
