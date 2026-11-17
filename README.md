# Shining Star

多新人婚礼请柬平台。架构与后续开发要求见 [TECH_PLAN.md](./TECH_PLAN.md)。

当前仅完成开发环境准备：保留 Astro 初始页面，尚未实现业务表、数据库单例、迁移脚本、健康检查、请柬路由、模板和数据录入功能。

## 环境

- Node.js 24 LTS，`.nvmrc` 固定本次验证使用的 `24.11.0`；也兼容 `22.23.4+` 的 Node 22。
- npm 管理依赖，提交 `package-lock.json`，后续安装使用 `npm ci`。
- Astro SSR + `@astrojs/node` standalone。
- Tailwind CSS v4 + `@tailwindcss/vite`，入口为 `src/styles/global.css`，由现有布局统一引入。
- SQLite / `better-sqlite3` + Drizzle ORM / drizzle-kit + Zod。
- TypeScript strict，使用 Astro 检查工具兼容的 TypeScript 6。
- pm2 已作为生产依赖安装，并提供单实例 fork 配置。

## 本地启动

```sh
nvm use
npm ci
cp .env.example .env
mkdir -p data
npm run dev
```

访问 `http://localhost:4321`。开发服务器按 `AGENTS.md` 要求在后台运行。

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动后台开发服务 |
| `npm run dev:status` | 查看状态和地址 |
| `npm run dev:logs` | 查看日志 |
| `npm run dev:stop` | 停止后台服务 |
| `npm run check` | Astro 与 TypeScript 检查 |
| `npm run build` | 构建 standalone 服务到 `dist/` |
| `npm start` | 加载本地 `.env`，验证生产构建 |
| `npm run start:production` | 加载 `.env.production`，运行生产构建 |
| `npm run db:generate` | 后续添加 schema 后生成 SQL 迁移 |
| `npm run db:studio` | 启动仅监听本机的数据库查看工具 |

运行构建服务前先停止开发服务，避免默认端口冲突。开发服务使用 `astro.config.mjs` 的监听配置；standalone 服务使用 `HOST` / `PORT` 环境变量。

## 环境变量

变量已在 `astro.config.mjs` 中通过 Astro 环境变量 schema 声明，启用 secrets 校验。应用开发时从 `astro:env/server` 读取；独立脚本使用 `process.env`。

| 变量 | 本地值 | 说明 |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | standalone 监听地址，生产仅监听本机 |
| `PORT` | `4321` | standalone 端口 |
| `SITE_URL` | `http://localhost:4321` | 生产必须换为真实 HTTPS 站点地址 |
| `DATABASE_PATH` | `./data/app.db` | 生产使用构建目录外的持久化绝对路径 |
| `NODE_ENV` | 命令决定 | 生产配置为 `production` |

`.env` 不固定 `NODE_ENV`，避免影响 Astro 构建。生产变量示例见 `.env.production.example`。环境文件、数据库及其 WAL/SHM 文件、备份、`private/` 中的新人数据均已忽略；示例环境文件可提交。

## 数据库工具

`drizzle.config.ts` 使用 Node 原生能力加载 `.env`，指定 SQLite 方言、`src/lib/db/schema.ts` 和 `drizzle/` 迁移目录。schema 目前为空，未生成迁移或创建业务数据库。

后续在 M1 中实现 schema、单例连接及迁移脚本；连接需要启用方案规定的 WAL、NORMAL、foreign_keys 和 busy_timeout。生产只执行审核后的 SQL 迁移，禁止 `drizzle-kit push`。生产迁移脚本须能在 `npm ci --omit=dev` 后运行。

依赖检查记录：当前稳定版 drizzle-kit 的旧版 `@esbuild-kit` 依赖链带入 esbuild 0.18.20，npm 报告 4 项中危告警（同一漏洞及其依赖链，GHSA-67mh-4wv8-2f99）。这些包属于开发依赖，生产 `--omit=dev` 安装不包含它们。本次保留稳定版，未强制升级到预发布版本或覆盖上游依赖。

## 部署准备

在本地或 CI 检查并构建，在目标服务器安装与其系统和 CPU 架构匹配的生产依赖。不要上传本机的 `node_modules`，不要在 2G 服务器上构建 Astro。

服务器准备 `.env.production` 后，可使用已提供的进程配置：

```sh
npm ci --omit=dev
npx --no-install pm2 start ecosystem.config.cjs
```

该配置使用单实例 fork、300M 内存重启阈值，并加载 `.env.production`。这只是配置准备，未在当前机器启动 pm2 常驻进程。

Nginx、HTTPS、对象存储/CDN、日志轮转、开机自启、备份和监控需要在 M6 根据真实服务器与域名配置，本次未部署或开通外部服务。

参考：[Astro Node adapter](https://docs.astro.build/en/guides/integrations-guide/node/)、[Astro 环境变量](https://docs.astro.build/en/guides/environment-variables/)、[Astro 样式](https://docs.astro.build/en/guides/styling/)、[Drizzle 配置](https://orm.drizzle.team/docs/drizzle-config-file)。
