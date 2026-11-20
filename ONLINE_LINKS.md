# Shining Star 访问路径汇总

> 更新日期：2026-11-19。
> 生产域名（2026-11-19 从旧域名切换）：`https://minvitation.site`。
> 本地开发地址：`http://127.0.0.1:4321`。

## 1. 首页

| 用途 | 路径 | 线上地址 |
| --- | --- | --- |
| 平台首页，目前保留 Astro 初始页面 | `/` | [打开首页](https://minvitation.site/) |

## 2. 正式请柬页面

以下三个链接用于浏览器访问和分享给宾客。

| 请柬版本 | slug / 页面路径 | 线上地址 | 模板 ID |
| --- | --- | --- | --- |
| 新人版 | `/sddlh4zxebmfx` | [https://minvitation.site/sddlh4zxebmfx](https://minvitation.site/sddlh4zxebmfx) | `tc00ufeo7r67y` |
| 男方父母版 | `/s10nxtffcpevs` | [https://minvitation.site/s10nxtffcpevs](https://minvitation.site/s10nxtffcpevs) | `th0sxg4o5vj81` |
| 女方父母版 | `/s6jtlzuaybjru` | [https://minvitation.site/s6jtlzuaybjru](https://minvitation.site/s6jtlzuaybjru) | `th0sxg4o5vj81` |

男女双方父母共用同一个模板；姓名顺序、称呼、署名、婚宴日期和地点由各自 slug 对应的数据决定。

## 3. 请柬详情接口

统一接口：`GET /api/v1/invitations/{slug}`。这些地址返回 JSON，用于数据查询和调试。

| 请柬版本 | 接口路径 | 线上接口 |
| --- | --- | --- |
| 新人版 | `/api/v1/invitations/sddlh4zxebmfx` | [查看新人版 JSON](https://minvitation.site/api/v1/invitations/sddlh4zxebmfx) |
| 男方父母版 | `/api/v1/invitations/s10nxtffcpevs` | [查看男方父母版 JSON](https://minvitation.site/api/v1/invitations/s10nxtffcpevs) |
| 女方父母版 | `/api/v1/invitations/s6jtlzuaybjru` | [查看女方父母版 JSON](https://minvitation.site/api/v1/invitations/s6jtlzuaybjru) |

接口返回 `templateId`、人物、署名、婚期、婚宴、文案、相册、音乐和分享信息。字段说明见 [接口设计文档](./INVITATION_API_DESIGN.md)。

## 4. 本地预览

| 版本 | 本地页面 | 本地接口 |
| --- | --- | --- |
| 新人版 | [打开页面](http://127.0.0.1:4321/sddlh4zxebmfx) | [查看 JSON](http://127.0.0.1:4321/api/v1/invitations/sddlh4zxebmfx) |
| 男方父母版 | [打开页面](http://127.0.0.1:4321/s10nxtffcpevs) | [查看 JSON](http://127.0.0.1:4321/api/v1/invitations/s10nxtffcpevs) |
| 女方父母版 | [打开页面](http://127.0.0.1:4321/s6jtlzuaybjru) | [查看 JSON](http://127.0.0.1:4321/api/v1/invitations/s6jtlzuaybjru) |

启动本地服务：在项目目录执行 `npm run dev`。

## 5. COS 媒体路径

媒体域名为 `https://image.minvitation.site`，与应用域名分别管理。

| 资源 | 对象路径 / 规则 |
| --- | --- |
| 囍字背景 | `assets/double-happiness-bg.webp` |
| 丝带装饰 | `assets/ribbon-decoration.webp` |
| 线条装饰 | `assets/line-decoration.webp` |
| 花枝装饰 | `assets/qj_flower-decoration.webp` |
| 首屏照片 | `myphotos/header.webp` |
| 新郎头像 | `myphotos/groom_avatar.webp` |
| 新娘头像 | `myphotos/bride_avatar.webp` |
| 原数据库模式相册照片 | `myphotos/section_1.webp` 至 `myphotos/section_12.webp` |
| COS 动态模式相册照片 | `usersphotos/{slug}/` 下所有支持的图片，含子目录 |
| 分享封面 | `myphotos/share-cover.jpg` |
| 背景音乐 | `auido/jintianwoyaojiageini-96k.mp3` |

完整媒体 URL 为“媒体域名 + `/` + 对象路径”，例如：[第一张相册照片](https://image.minvitation.site/myphotos/section_1.webp)。音频目录实际拼写为 **`auido`**。

相册模式由服务端 `GALLERY_SOURCE` 决定，默认 `database`。设置为 `cos` 后，例如 `s6jtlzuaybjru` 将读取 `usersphotos/s6jtlzuaybjru/`，对象键开头不带 `/`；详情接口仍使用 `data.gallery`。环境配置、权限和缓存说明见 [README](./README.md#按-slug-读取-cos-相册)。

## 6. 路由规则

- 请柬页统一匹配 `/{slug}`，详情接口统一匹配 `/api/v1/invitations/{slug}`。
- 根路径 `/` 为首页；未知、非法或未发布的请柬返回 404。
- 旧 invitation 项目的 `/groom-parents`、`/bride-parents` 未在本项目设置跳转，分享时使用上表的新链接。
- 已有 `classic-red` 示例记录仍可通过各自原 slug 访问最小页面，不属于本轮正式分享链接；v1 详情接口不支持这类旧模板。
- 更换应用域名时，更新服务器 `SITE_URL` 和对应 Nginx 配置，并同步本文线上链接；三个 slug 保持不变。

部署操作见 [DOCKER_INSTALL.md](./DOCKER_INSTALL.md)，迁移验证见 [MIGRATION_REPORT.md](./MIGRATION_REPORT.md)。
