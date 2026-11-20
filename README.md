# Shining Star

多新人婚礼请柬平台。架构与后续开发要求见 [TECH_PLAN.md](./TECH_PLAN.md)。

已将 `../invitation` 迁入本项目：两套 Astro 模板、三份独立 slug 数据，只有信封、相册、倒计时、音乐/滚动和地图交互使用 React。动画为 Tailwind CSS/CSS 关键帧，相册使用 Swiper 原生 JS，无 Framer Motion 或 Swiper React 封装。

请柬详情接口为 `GET /api/v1/invitations/{slug}`；API 与 SSR 页面复用同一服务。相册默认读取数据库，也可配置为根据数据库 `album_slug` 动态列出 COS 图片；浏览器直接向媒体域名加载图片。固定图片在模板中，相册由后端返回。

生产域名为 `https://minvitation.site`，直接访问服务器；完整路径见 [ONLINE_LINKS.md](./ONLINE_LINKS.md)，域名、证书、DNS 与备份记录见 [DOMAIN_SWITCH.md](./DOMAIN_SWITCH.md)。

| 本地页面 | 模板 ID |
| --- | --- |
| [新人版](http://localhost:4321/sddlh4zxebmfx) | `tc00ufeo7r67y` |
| [男方父母版](http://localhost:4321/s10nxtffcpevs) | `th0sxg4o5vj81` |
| [女方父母版](http://localhost:4321/s6jtlzuaybjru) | `th0sxg4o5vj81` |

原有 `classic-red` 示例和 `lin-yu-7k2m` 等记录继续保留最小展示。新接口只支持本轮两套模板。非法、不存在或未发布 slug 返回 404，新模板数据异常返回 500。数据库须已存在且有 `invitations` 表；升级本版前执行下文的 `album_slug` 增量迁移。

接口字段见 [INVITATION_API_DESIGN.md](./INVITATION_API_DESIGN.md)，迁移结果与验证见 [MIGRATION_REPORT.md](./MIGRATION_REPORT.md)。本轮只完成本地迁移，未发布线上。

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
| `npm test` | 构建后执行隔离数据库的单元、HTTP 与导入测试 |
| `npm run invitation:import -- private/invitations.json` | 校验并 dry-run，默认不写数据库 |
| `npm start` | 加载本地 `.env`，验证生产构建 |
| `npm run start:production` | 加载 `.env.production`，运行生产构建 |
| `npm run db:generate` | 后续添加 schema 后生成 SQL 迁移 |
| `npm run db:studio` | 启动仅监听本机的数据库查看工具 |
| `npm run db:migrate:album -- --apply` | 备份并添加独立相册字段，重复执行不会重复迁移 |
| `npm run album:assign -- <请柬slug> [...] --apply` | 生成或复用相册 slug，并将列出的请柬关联到同一相册 |

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

## 按 slug 读取 COS 相册

服务端使用腾讯云官方 `cos-nodejs-sdk-v5`。在 `.env`（本地）或服务器 `.env.production` 中配置：

```dotenv
GALLERY_SOURCE=cos
COS_SECRET_ID=你的子账号SecretId
COS_SECRET_KEY=你的子账号SecretKey
COS_BUCKET=你的桶名-1250000000
COS_REGION=ap-guangzhou
COS_PUBLIC_BASE_URL=https://image.minvitation.site
```

`COS_BUCKET` 必须包含 APPID 后缀，地域须与桶一致，`COS_PUBLIC_BASE_URL` 为指向这个桶的 HTTPS 公开媒体域名，只填域名、不带路径。这些配置在服务端运行时读取，不注入浏览器或镜像构建参数。服务端密钥只需要列举目标桶（`GetBucket`）的权限。图片由浏览器直接读取，需确保媒体域名允许访问；当前实现不生成私有图片签名 URL。

请柬 slug 与相册 slug 分开保存。`invitations.album_slug` 是 `photo` 加 12 位随机小写字母或数字，例如 `photoabc123def456`，API 返回为 `data.albumSlug`。多个请柬可以关联同一个相册。先迁移已有数据库，再为请柬分配相册：

```sh
# 默认 dry-run；--apply 前自动备份，不重建表、不更改现有照片数据。
npm run db:migrate:album -- --apply
# 多个请柬关联同一个随机相册；已有同一相册时复用，重复执行不重新生成。
npm run album:assign -- sddlh4zxebmfx s10nxtffcpevs s6jtlzuaybjru --apply
# 指定已有相册
npm run album:assign -- s6jtlzuaybjru --album photoabc123def456 --apply
```

将图片上传到命令输出的相册目录，**对象键开头不带 `/`**。例如 `album_slug=photoabc123def456`：

```text
usersphotos/photoabc123def456/1.webp
usersphotos/photoabc123def456/2.webp
usersphotos/photoabc123def456/10.webp
```

访问 `/s6jtlzuaybjru` 或 `/api/v1/invitations/s6jtlzuaybjru` 时，服务端先确认请柬已发布，再读取该条记录的 `album_slug`，分页列出 `usersphotos/{album_slug}/` 下的图片（包含子目录），按文件名数字顺序展示，如 1、2、10。支持 JPG/JPEG、PNG、WebP、GIF、AVIF，跳过目录占位、空文件和其他格式。目录完全由数据库关联决定，不能通过请求参数切换。

服务端只列举对象，不下载图片或读取图片头；相册条目包含 `url`、`alt`，宽高为可选字段，页面由 CSS 按固定 `3:4` 比例展示。图片加载失败时显示占位提示。目录列表按相册 slug 缓存 60 秒，共享相册的请柬复用缓存；未关联相册（`album_slug` 为 NULL）或空目录返回 `gallery: []`，隐藏相册，不回退到请柬 slug 目录。COS 权限、网络或配置错误按现有接口返回 500，不自动混入数据库旧照片。页面还可能有 Nginx 的 60 秒共享缓存，上传、删除或改名后最长约两分钟反映到页面；同名覆盖时浏览器/CDN 的图片缓存需单独刷新。

启用后，`data.gallery` 来自 COS，数据库中的 `content.gallery` 可设为 `[]` 或省略。姓名、婚宴、文案等仍从数据库读取，首屏照片、头像及装饰素材仍使用原模板地址。设回 `GALLERY_SOURCE=database` 可使用原有数据库相册。

部署新镜像后修改服务器环境配置，执行 `sudo docker compose up -d --force-recreate app` 生效；本地修改配置后重启开发服务。仅更改 COS 中的照片无需重新导入数据库或构建应用。

## 数据库工具

`drizzle.config.ts` 使用 Node 原生能力加载 `.env`，指定 SQLite 方言、`src/lib/db/schema.ts` 和 `drizzle/` 迁移目录。schema 已映射本地现有 `invitations` 表；仓库尚未包含初始化迁移，空数据库不能直接运行此页面。

数据库连接由 `src/lib/db/client.ts` 全局复用，已启用 WAL、NORMAL、foreign_keys 和 busy_timeout。本版的单列增量迁移位于 `drizzle/manual/add-album-slug.sql`，通过 `npm run db:migrate:album -- --apply` 执行，检查是否已迁移并自动备份；不修改现有 Drizzle 迁移历史。后续生成完整迁移前仍需核对已有迁移记录，避免重复建表。生产只执行审核后的 SQL 迁移，禁止 `drizzle-kit push`。

Docker 部署新版本时，先用新镜像执行 `sudo docker compose run --rm --no-deps app npm run db:migrate:album -- --apply`，再重建应用容器。相册分配也可通过 `docker compose run --rm --no-deps app npm run album:assign -- ... --apply` 完成。

依赖检查记录：当前稳定版 drizzle-kit 的旧版 `@esbuild-kit` 依赖链带入 esbuild 0.18.20，npm 报告 4 项中危告警（同一漏洞及其依赖链，GHSA-67mh-4wv8-2f99）。这些包属于开发依赖，生产 `--omit=dev` 安装不包含它们。本次保留稳定版，未强制升级到预发布版本或覆盖上游依赖。

## 部署准备

Docker Compose 部署按 [DOCKER_INSTALL.md](./DOCKER_INSTALL.md) 执行，包含安装、镜像构建与上传、数据库初始化、Nginx 缓存和 HTTPS。镜像在本地或 CI 构建，服务器无需安装 Node.js 或 PM2。已发布请柬允许共享缓存 60 秒，错误页及携带查询参数、Cookie 或 Authorization 的请求不缓存。

下面保留直接使用 Node.js + PM2 的部署方式：

在本地或 CI 检查并构建，在目标服务器安装与其系统和 CPU 架构匹配的生产依赖。不要上传本机的 `node_modules`，不要在 2G 服务器上构建 Astro。

服务器准备 `.env.production` 后，可使用已提供的进程配置：

```sh
npm ci --omit=dev
npx --no-install pm2 start ecosystem.config.cjs
```

该配置使用单实例 fork、300M 内存重启阈值，并加载 `.env.production`。这只是配置准备，未在当前机器启动 pm2 常驻进程。

Nginx、HTTPS、对象存储/CDN、日志轮转、开机自启、备份和监控需要在 M6 根据真实服务器与域名配置，本次未部署或开通外部服务。

参考：[Astro Node adapter](https://docs.astro.build/en/guides/integrations-guide/node/)、[Astro 环境变量](https://docs.astro.build/en/guides/environment-variables/)、[Astro 样式](https://docs.astro.build/en/guides/styling/)、[Drizzle 配置](https://orm.drizzle.team/docs/drizzle-config-file)。

## 请柬资料导入

真实三份资料位于本机被 Git 和 Docker 忽略的 `private/invitations.json`，每份含 12 张照片。不要依赖该文件随 Git 或镜像传输；其他环境需自行提供经校验的源 JSON 和已有数据库。

```sh
# 仅读取与校验
npm run invitation:import -- private/invitations.json
# 自动备份，再以事务导入；新记录默认 draft，已有状态保持
npm run invitation:import -- private/invitations.json --apply
# 明确发布
npm run invitation:import -- private/invitations.json --apply --publish
```

导入工具使用 Node 的 TypeScript 类型擦除，生产安装无需 tsx；不修改表结构。备份存于数据库所在目录的 `backups/`。重复导入按固定 slug 更新，同一 slug 若属于另一对新人或其他模板则拒绝覆盖；更新后页面共享缓存最多等待约 60 秒。

导入记录顶层可指定 `"albumSlug": "photoabc123def456"`，保存到 `album_slug` 列；省略时保留已有相册关联，新记录省略时为 NULL，显式 `null` 清除关联。相册 slug 不存放在 `content.gallery` 中。

独立演示资料可通过 `content.media` 指定 `cover`（含 url、width、height、alt）、`groomAvatarUrl`、`brideAvatarUrl`，替换模板默认的个人封面与头像；分享图仍通过 `shareImage` 指定。`content.legal` 为 null 时不展示备案姓名与链接，适用于本地虚构演示资料；原正式请柬保留其备案信息。

新记录的 `content_version` 为 2，API 的 `schemaVersion` 为 1；模板版本独立为 1。模板 ID 为 `t` 加 12 位随机字母数字，slug 为 `s` 加 12 位随机字母数字，生成后保持稳定。

## 可选内嵌地图

`PUBLIC_AMAP_KEY` 与 `PUBLIC_AMAP_SECURITY_CODE` 是高德 Web JS SDK 的公开浏览器配置，构建时注入；不出现在请柬 JSON。修改后需重新构建，域名须符合高德配置。留空仍显示场地和导航按钮；SDK 或地理编码失败会退回导航提示卡。

推荐使用 `npm run docker:build`，自动从本地 `.env` / `.env.production` 读取这两个配置并通过同名 build args 注入；缺少时拒绝构建，避免上线后只剩导航提示卡。运行 `npm run docker:build -- --dry-run` 可仅检查配置，`--platform linux/arm64` 可指定 ARM 服务器，明确关闭内嵌地图时使用 `--without-map`。独立 Node 构建从本地环境读取。应用域名来自 `SITE_URL`，与固定媒体域名分别管理。

Dockerfile 同样校验这两个构建参数，直接执行未传参数的 `docker build` 会失败。仅修改服务器运行时 `.env.production` 无法补回已经被编译成空值的地图配置，需重新构建并更新镜像。


<!-- 以后仅更新代码、没有资料变更时，服务器只需执行： -->

cd /srv/shining-star
sudo docker load -i shining-star-image.tar.gz &&
sudo docker compose up -d --force-recreate app
