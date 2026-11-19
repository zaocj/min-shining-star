# invitation 迁移验证记录

> 2026-11-19。本地迁移完成，开发服务运行于 `http://127.0.0.1:4321`。未部署线上，未修改 COS、DNS 或桶权限；旧 invitation 源项目保留。

## 已落地架构

- Astro SSR：动态路由、静态正文、模板选择、日期格式化、服务端 head 和缓存。
- 两套入口 `Template.astro`：新人模板与父母模板；男女父母共用同一模板，通过接口 people 顺序、label、署名、婚宴和文案展示差异。
- React islands：信封开启、相册、秒级倒计时、音乐/页面交互和地图。信封与音乐使用 `client:load`，相册/倒计时/地图使用 `client:visible`。不向岛屿传整份数据库记录。
- 动效为 Tailwind 过渡、CSS 关键帧和原生事件；不安装或导入 Framer Motion，不使用 `swiper/react`。相册通过 ref/effect 初始化 Swiper 原生 JS。
- `GET /api/v1/invitations/{slug}` 和页面共享 `src/lib/services/invitations.ts`；Zod 校验数据，公开接口 no-store。
- 固定模板图片引用 COS；数据库 gallery 返回 12 张照片 URL、真实尺寸和描述，浏览器直接请求媒体，不经过 Node 转发。

## 本地记录与入口

| slug | templateId | audience | 日期 | 相册张数 |
| --- | --- | --- | --- | --- |
| `sddlh4zxebmfx` | `tc00ufeo7r67y` | couple | 2027年1月1日 | 12 |
| `s10nxtffcpevs` | `th0sxg4o5vj81` | groom-parents | 2027年1月1日 | 12 |
| `s6jtlzuaybjru` | `th0sxg4o5vj81` | bride-parents | 2027年1月2日 | 12 |

- [新人版](http://127.0.0.1:4321/sddlh4zxebmfx)
- [男方父母版](http://127.0.0.1:4321/s10nxtffcpevs)
- [女方父母版](http://127.0.0.1:4321/s6jtlzuaybjru)
- [详情接口示例](http://127.0.0.1:4321/api/v1/invitations/s6jtlzuaybjru)

新记录使用 content_version=2、API schemaVersion=1、templateVersion=1。三条本地记录均已 published；原有三条 classic-red 示例继续保留最小展示。未更改表结构或迁移历史。

真实源资料是被 Git/Docker 忽略的 `private/invitations.json`。导入前已执行 dry-run，并通过 SQLite 在线 backup 备份；首次备份位于 `backups/before-import-1795076779928.db`，补充分享图元数据前另备份至 `backups/before-import-1795077629883.db`。当前导入工具把后续备份统一存放在数据库所在目录的 `backups/`（本地为 `data/backups/`），方便容器使用持久化卷。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| `npm run check` | 52 个源/测试文件，0 errors、0 warnings、0 hints |
| `npm test` | 构建成功，9 项测试全部通过 |
| 独立生产构建运行 | HTTP 测试以临时 SQLite 和独立端口启动 dist/server/entry.mjs，已验证 |
| 新人/两家父母数据 | 两个模板、三个 slug、日期/顺序/署名独立，女方 JSON 不携带男方父母姓名 |
| 旧页面兼容 | classic-red 保留最小展示，新 v1 API 不将其套入真实照片模板 |
| 错误与缓存 | 未找到/草稿 404，损坏新记录 500，POST 405，HEAD 无正文；query/Cookie 请求不进入页面共享缓存 |
| 数据导入 | dry-run 不写入、事务导入、自动备份、重复导入不重复、占用 slug 拒绝覆盖 |
| 媒体 | 21 个真实 COS 图片/音频地址 HEAD 均为 200，无 attachment 响应；尺寸从旧本地源图读取，浏览器照片可显示 |
| 浏览器 | Chrome 检查 375、390、430px 和桌面视口，无横向溢出；新版新人/父母信封、COS 照片、数据文案已查看 |
| 交互 | 新人和父母开信封、音乐播放/主动暂停、原生 Swiper 下一张、父母相册自动切换已验证；主动暂停后翻页未重启音乐 |
| 控制台 | 检查到的页面无 React 水合错误或其他 error/warn |
| 机械设计检查 | 仅提示原有滚动箭头 animate-bounce；为保留原项目已指定的动效而保留该 advisory |

9 项测试覆盖：三份完整 API、SSR/meta 和旧示例、方法/状态/缓存、导入事务与冲突、三版本数据、相册顺序/空数组/音乐关闭、损坏数据与版本、随机 slug 规则、导入/运行时契约。

无 JavaScript 时，静态正文已在原始 HTML 中，信封默认隐藏，不通过 SSR inert 阻挡阅读；有 JS 后才启用信封和滚动锁。倒计时由服务端传递统一初始时间，水合后再使用客户端时钟更新。

## 媒体与字体

实际媒体域名为 `https://image.minvitation.site`；照片路径是 `myphotos/`，音频路径是 **`auido/`**。当前曲目使用桶内 `jintianwoyaojiageini-96k.mp3`，没有使用旧的 `/audio/background.mp3`。详情见接口文档和迁移计划。

两个已有授权的本地 woff2 已迁入 public/fonts，并保留授权和来源记录。取消 Google Fonts 请求，使用本地字体与系统回退。音乐 preload=none，不在首屏完整预下载。

## 当前产物体积

- React 共享客户端运行时：gzip 约 64.2 KiB；多个 islands 共享此运行时。
- Swiper 原生 JS 共享代码：gzip 约 21.9 KiB，随相册可见时加载。
- 生成的全局与模板 CSS 合计：gzip 约 12.6 KiB。

原技术方案中单页约 50KB 的 JS 目标未达成，主要体积来自 React DOM；已采用静态 Astro、按交互 hydration 和相册延迟加载，没有把整份页面迁成 React 应用。

## 后续发布前核对

- iOS Safari、Android 真机及微信内的音乐、触摸和地图跳转尚未实际测试，本次手机尺寸验证是桌面 Chrome 视口检查。
- Dockerfile 已补入生产可用的导入脚本及必需的纯 TypeScript schema/metadata，并提供可选高德公开配置 build args。后续修复并验证了 linux/amd64 镜像构建及容器运行（见下节）；尚未线上发布。
- 高德 Web JS SDK 配置是构建期公开值，生产需确认域名白名单；未配置或加载/定位失败时保留导航入口。
- 新人与父母模板的固定首屏、头像仍为当前婚礼照片；本轮不扩展为任意新人的动态封面功能。
- 页面可能共享缓存 60 秒，导入后应考虑该窗口再核对；媒体 CDN、防盗链和缓存策略未在本轮修改。

相关文档：[接口设计](./INVITATION_API_DESIGN.md)、[迁移计划](./INVITATION_MIGRATION_PLAN.md)、[运行与导入说明](./README.md)。

## Docker 构建问题修复与实测（2026-11-19）

此前只验证本地 Node 构建，Docker 使用更新的 Node 24 镜像后，npm 11.19.1 校验发现锁文件缺少两个可选 WASM peer 依赖记录：@emnapi/core@2.0.0-beta.2、@emnapi/runtime@2.0.0-beta.2。已在隔离 Linux 环境补全锁文件，并在 Docker 构建阶段固定 npm 11.6.1，与 packageManager 一致。

- 本地 npm 11.6.1 和 Linux npm 11.19.1 对修复后的锁文件均通过 ci dry-run。
- 实际执行 `docker buildx build --platform linux/amd64 --load --progress=plain -t shining-star:latest .` 成功，镜像内 npm ci、52 文件类型检查、Astro 构建均通过。
- 最终生产镜像以默认 node 用户在隔离的虚构测试数据库中完成资料导入与在线备份，JSON API 和 SSR 页面均返回 200，人物顺序、场地及 canonical 正确。
- 镜像已导出至 `/tmp/shining-star-image.tar.gz`；测试容器已停止，没有修改服务器或线上数据库。
