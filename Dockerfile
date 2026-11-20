FROM node:24-bookworm-slim AS build
WORKDIR /app

# better-sqlite3 在目标 Linux 环境中安装，必要时编译原生模块。
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
# 与 package.json 的 packageManager 保持一致，避免基础镜像更新改变依赖解析规则。
RUN npm install --global npm@11.6.1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# 地图公开配置在构建时注入；其余服务端配置由 Compose 在运行时注入。
ARG PUBLIC_AMAP_KEY=""
ARG PUBLIC_AMAP_SECURITY_CODE=""
ARG DISABLE_EMBEDDED_MAP=0
RUN if [ "$DISABLE_EMBEDDED_MAP" != "1" ]; then \
      test -n "$PUBLIC_AMAP_KEY" && test -n "$PUBLIC_AMAP_SECURITY_CODE" \
        || { echo 'Missing AMap build configuration. Use npm run docker:build, or explicitly disable the embedded map.' >&2; exit 1; }; \
    fi \
    && SITE_URL=https://build.invalid DATABASE_PATH=/data/app.db npm run check \
    && SITE_URL=https://build.invalid DATABASE_PATH=/data/app.db npm run build
RUN npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/scripts/invitation-import.ts ./scripts/invitation-import.ts
COPY --from=build --chown=node:node /app/src/lib/content/invitation-schema.ts /app/src/lib/content/view-model.ts ./src/lib/content/
COPY --from=build --chown=node:node /app/src/templates/manifest.ts ./src/templates/manifest.ts
USER node
EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]
