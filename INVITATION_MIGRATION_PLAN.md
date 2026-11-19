# invitation → shining-star 迁移计划

> 日期：2026-11-19。状态：本地迁移已实现；原计划与验收范围保留，实际结果见 [迁移验证记录](./MIGRATION_REPORT.md)。
> 后续用户已授权实施。本轮修改本地代码并备份、导入三份本地请柬，未部署或修改云端配置。

> 更新：按用户最新要求，新增正式的按 slug 查询完整请柬详情接口。接口、字段及三份响应以 [INVITATION_API_DESIGN.md](./INVITATION_API_DESIGN.md) 为准；最新实现遵循“静态优先 Astro、交互使用 React”，移除 Framer Motion，相册仅用 Swiper 原生 JS。

## 1. 迁移目标与边界

将 `../invitation` 的婚礼请柬迁入当前项目，保留原有视觉、文案和交互，改由 **Astro SSR 负责路由、查库、数据校验和 HTML/head 输出，静态内容使用 Astro，React 仅负责交互 islands**。

本轮实现范围：

- 三份内容：新人版、男方父母版、女方父母版，各有独立 slug。
- 两套模板：新人模板一套；男女双方父母共用另一套，通过数据表达差异。
- 模板中的固定图片直接使用 COS 的绝对 HTTPS 地址；新人婚纱相册从后端数据读取。
- 保留信封开场、背景音乐、自动滚动、相册、婚宴导航、倒计时、日历、署名及备案展示。
- 三个链接各自的标题、描述、分享图、canonical 在服务端写进原始 HTML。

不扩展宾客回执、留言、账号、编辑后台、上传功能、微信 JS-SDK 或模板商城，也不重做页面设计。

### 与现有 TECH_PLAN.md 的关系

现有技术方案是平台总体规划，并非全部已实现。本次按用户最新需求调整以下约定，后续实现时同步修订该文档：

| 原约定 | 本次采用 |
| --- | --- |
| 同一对新人的多个版本暂不做 | 本次必须提供新人、男方父母、女方父母三个版本 |
| 默认原生 JS，必要时使用框架 | 静态模板和正文使用 Astro，交互组件使用 React |
| 模板装饰资源放本地或 public | 已上传 COS 的图片与音乐通过现有自定义域名引用 |
| slug 使用姓名等前缀加随机后缀，模板使用语义 key | 新标识统一为 `s` / `t` 加 12 位随机小写字母数字，不承载业务含义；旧数据保留兼容 |
| 每模板客户端 JS 约 50KB | 先实测 React 与 Swiper 原生 JS 的实际产物；保留原有功能，超出时记录并做按模板加载等优化，不宣称天然满足旧预算 |

保留 SQLite、Drizzle、Zod、Node standalone、Tailwind v4、单进程和现有部署架构。

## 2. 已核对的项目现状

### 2.1 invitation

| 位置 | 当前职责 | 迁移处理 |
| --- | --- | --- |
| `src/App.tsx` | 版本分支、信封、音乐、滚动及页面组装 | 拆为两套 Astro 模板入口及 React 交互组件，复用交互逻辑 |
| `src/config/invitation.ts` | 三个版本的真实资料、路径解析、全局配置对象 | 数据导入后端；去掉依赖浏览器路径的全局对象 |
| `src/components/envelope/`、`sections/` | 新人信封和正文、相册、婚宴、倒计时等 | 迁入新人模板，改为接收 props/context |
| `src/components/parents/` | 父母信封、红金正文、触屏相册、专属样式 | 迁入同一父母模板，由 audience 区分男女双方 |
| `src/hooks/`、`src/lib/amap.ts` | 倒计时、自动滚动、地图加载 | 保留行为并完成 SSR 适配 |
| `src/config/share.ts`、`src/lib/share-html.ts`、`vite.config.ts` | 三入口分享标签和静态目录 HTML 生成 | 替换为 Astro 动态路由与服务端 meta |
| `src/index.css`、`public/fonts/`、`index.html` | Tailwind token、字体、全局样式、预加载 | 提取模板主题；保留字体授权文件；由 Astro layout 管理 head |

旧项目不是三个独立模板：父母版已共用组件，只是称呼、顺序、署名及婚宴数据不同。父母版相册与新人版相册目前也读取同一组婚纱照。

### 2.2 shining-star 后端

- 已采用 Astro `output: 'server'`、Node standalone、SQLite / better-sqlite3、Drizzle、Zod。
- `src/pages/[slug].astro` 调用 `findCoupleBySlug()`，只展示新郎、新娘姓名。
- `src/lib/repositories/invitations.ts` 已校验 slug、过滤 `published`，但只查询 `content`；没有返回模板、相册或分享字段。
- `src/lib/content/schema.ts` 目前只解析双方姓名；需要增加本次模板所需的数据 schema。
- `invitations` 表已具备 `template_key`、`template_version`、`content_version`、`template_options`、分享字段等，本轮不必为了三版本新增关系表。
- 本地数据库有三条示例记录，均使用 `classic-red`；其中一条 JSON 含 Unsplash 示例相册，其余数据较少。这些不是待迁移的真实请柬，必须保留，不覆盖为本次婚礼资料。
- 仓库未实现 COS SDK、对象列表读取或签名服务；环境变量示例也没有 COS 配置。**目前不存在可直接复用的完整 COS 相册后端链路。**
- 页面已有缓存规则：符合条件的已发布 GET/HEAD 请求使用 `public, max-age=0, s-maxage=60`；错误页及带查询参数、Cookie、Authorization 的请求 `no-store`。本轮沿用实际代码与 Nginx 配置。
- 迁移前未安装 React 集成；现已接入 `@astrojs/react`，保留实际需要的 React 与 Swiper 原生 JS，不安装 Framer Motion。

## 3. COS 实际资源与访问方式

### 3.1 控制台与请求核对结果

已通过用户现有 Chrome 腾讯云控制台只读查看：

| 项目 | 实际值 |
| --- | --- |
| 存储桶 | `marry-image-1496496529` |
| 地域 | `ap-guangzhou`（广州） |
| 访问状态 | 桶列表显示“可匿名访问”；抽查照片继承桶权限 |
| 资源域名 | `https://image.minvitation.site`，对象详情显示为自定义源站域名 |
| 装饰图目录 | `assets/`，4 个 WebP 文件 |
| 照片目录 | `myphotos/`，16 个文件：双方头像、`header.webp`、12 张 `section_*.webp`、`share-cover.jpg` |
| 音频目录 | **`auido/`**，仅见 `jintianwoyaojiageini-96k.mp3`，约 3MB |

已使用普通 HTTPS HEAD 请求抽查（未下载媒体）：

| 地址 | 状态 | Content-Type |
| --- | --- | --- |
| `https://image.minvitation.site/myphotos/section_1.webp` | 200 | `image/webp` |
| `https://image.minvitation.site/myphotos/share-cover.jpg` | 200 | `image/jpeg` |
| `https://image.minvitation.site/auido/jintianwoyaojiageini-96k.mp3` | 200 | `audio/mpeg` |

上述响应均未见 `Content-Disposition: attachment`，支持字节范围请求；未见显式 `Cache-Control`。这里只验证了资源可访问与响应头，浏览器图片渲染、音频播放和完整清单仍在实现阶段逐项验收。已绑定自定义源站域名不等于已验证开通 CDN 加速。

特别注意：

1. 旧项目路径是 `/photos/`、`/audio/`，COS 实际路径是 `/myphotos/`、`/auido/`，不能直接沿用旧地址，也不能擅自把桶内目录“纠正”为 `audio/`。
2. 旧代码默认播放 `/audio/background.mp3`，当前桶内只看到另一首压缩版音频。迁移默认采用桶内已有的 `jintianwoyaojiageini-96k.mp3`，把曲目变化列入最终验收。
3. 腾讯云对新建桶的默认域名有浏览器预览限制，因此本项目使用已配置的自定义域名，不把默认 `myqcloud.com` 地址当展示地址。[腾讯云说明](https://cloud.tencent.com/document/product/436/96243)

### 3.2 固定素材与动态相册的分工

| 资源 | 来源与使用方式 |
| --- | --- |
| 囍字背景、丝带、线条、花饰 | Astro 静态模板或交互 JSX 的 `img src` 写固定 COS URL，不经数据库返回 |
| 模板首屏 `header.webp`、新人头像 | 本轮同样固定在相应模板 JSX 中，沿用当前照片；以后若做通用多新人模板再单独扩展 |
| 婚纱相册 `section_1.webp`～`section_12.webp` | 后端 `content.gallery` 返回 URL、尺寸和 alt，React 相册按数组顺序渲染 |
| 父母模板中的婚纱相册 | 同样使用后端 `gallery`；这也是新人的照片相册，不在父母组件里再写死 12 个地址 |
| 分享图 | 新记录的 `share_image_url` 指向 COS 的 `myphotos/share-cover.jpg`；由服务端 head 使用 |
| 背景音乐 | 模板提供现有 COS 音频默认值；可用经过校验的 `content.musicUrl` 覆盖或关闭 |
| 字体 | 桶中未见字体目录；可迁移现有本地 woff2 及许可文件，不编造 COS 字体 URL |

固定装饰文件为 `double-happiness-bg.webp`、`ribbon-decoration.webp`、`line-decoration.webp`、`qj_flower-decoration.webp`，全部在上述域名的 `assets/` 下。

这里“写死到模板 HTML”指 Astro 静态模板、或确实用于交互的 React 组件直接写固定 COS URL，SSR 后即为 HTML `src`；相册除外。layout 使用同一首屏固定 URL 预加载，保持地址一致。

### 3.3 后端如何把照片交给前端

```text
宾客访问 /{slug}
  → Astro 动态页面读取 slug
  → repository 查询已发布的 invitations 记录
  → Zod 校验 content、template_options 及模板版本
  → 共享请柬详情服务生成接口 data，含 templateId、人物、婚宴、文案、gallery 等
  → Astro 按 templateId + templateVersion 选择 Astro 模板，SSR 输出静态正文和图片标签
  → 将可序列化的展示数据传给 React island，接管轮播等交互
  → 浏览器直接向 image.minvitation.site 请求图片、音频字节
```

**首版无需 COS SDK，也无需每次列举桶文件。** 数据库保存已经上传好的公开 HTTPS URL；Node 负责查记录和返回展示数据，媒体由 COS 自定义域名直接提供，避免应用服务器转发照片和音频。

本次正式设计 `GET /api/v1/invitations/{slug}`，一次返回 templateId 与全部可变展示信息，不限于相册。Astro SSR 与 JSON API 复用同一请柬详情服务、schema 和 data 契约；同仓首屏可直接调用服务完成 SSR，再将交互必需字段交给 React islands 水合，浏览器无需重复拉取。前端也可直接消费该 API，按 templateId 选择模板。具体响应、错误及缓存规则见接口设计文档。

相册必须显式保持 1～12 的数字顺序，不能按文件名字典序排成 1、10、11、12、2。导入时读取旧本地图片的真实尺寸或已确认的资源元数据，不继续沿用组件中可能统一写死的尺寸。

当前公开读取流程不需要 SecretId、SecretKey，也不把控制台临时签名链接存进数据库。若以后改私有桶，再单独设计签名有效期、页面缓存和分享抓取方案。

## 4. 三个 slug、两套模板与数据结构

### 4.1 路由方案

复用 `src/pages/[slug].astro`，由数据库记录选择模板，不建三套硬编码页面，不使用 React Router，也不再通过 `window.location.pathname` 判断版本。

本次新增标识均不承载业务含义：templateId 为 `t` + 12 位随机小写字母和数字，slug 为 `s` + 12 位随机小写字母和数字，总长均为 13 位；随机部分至少含一个字母和一个数字。以下为示例，具体规则以接口设计文档为准：

| 版本 | slug 示例 | template_key（拟新增） | audience |
| --- | --- | --- | --- |
| 新人 | `sddlh4zxebmfx` | `tc00ufeo7r67y` | `couple` |
| 男方父母 | `s10nxtffcpevs` | `th0sxg4o5vj81` | `groom-parents` |
| 女方父母 | `s6jtlzuaybjru` | `th0sxg4o5vj81` | `bride-parents` |

三条独立 `invitations` 记录分别保存发布时间、婚宴、分享资料和状态，两个新模板的 `template_version` 从 1 开始。服务端校验模板与 audience 的合法组合。 模板注册时生成 templateId，创建请柬时生成 slug，使用安全随机源并检查唯一性；标识生成后持久化，碰撞时重试，更新和重复导入不重新生成。新 ID 格式替代旧方案中的语义名称和随机后缀规则；已有示例标识继续兼容，不重命名。

对外接口将 `template_key` 命名为 `templateId`，与 `templateVersion` 一起选择本地 Astro 模板；audience 用于内容归属和校验。人物称呼、顺序、署名、日期、婚宴等均由接口提供，模板不根据特定 slug 或 audience 硬编码这些内容。

首版不引入 `invitation_variants`、婚礼主表或跨 slug 隐式继承。通过同一份私有导入资料生成三条完整记录，重复的相册只重复 URL 元数据，不复制 COS 文件。共享照片变更时，导入工具一次更新三条记录，避免各自手改。

根路径 `/` 保持平台首页；未知、非法或未发布 slug 返回 404，不沿用旧 SPA“其他路径都回新人版”的行为。已有示例 slug 继续保留原来的最小展示，不自动套用包含真实照片的新模板。

### 4.2 必须保留的内容差异

| 项目 | 新人版 | 男方父母版 | 女方父母版 |
| --- | --- | --- | --- |
| 身份称呼 | 新郎 / 新娘 | 儿子 / 儿媳 | 女儿 / 女婿 |
| 展示顺序 | 新郎、新娘 | 儿子、儿媳 | 女儿、女婿 |
| 父母署名 | 无 | 赵壮虎、刘永娟敬邀 | 不展示父母姓名或父母署名 |
| 日期 | 2027-01-01 | 2027-01-01 | 2027-01-02 |
| 农历文字 | 十一月廿四 | 十一月廿四 | 十一月廿五 |
| 场地 | 清雅苑（二部） | 清雅苑（二部） | 清徐喜来澄大酒店 6 楼 |
| 详细地址 | 沿用旧新人配置 | 沿用旧男方配置 | 太原市清徐县039省道东侧 |
| 迎宾 / 开席 | 09:30 / 12:00 | 09:30 / 12:00 | 09:30 / 12:00 |

继续保留旧配置婚期倒计时目标 10:00 与婚宴开席 12:00 的区别，不把两者合并成一个时间字段。时间带 `+08:00`，服务端统一按 `Asia/Shanghai` 格式化；农历文字人工维护。

### 4.3 服务端数据契约

| 数据 | 规划 |
| --- | --- |
| 记录字段 | 读取 slug、状态、模板 key/version、content_version、content、template_options、分享字段、noindex |
| 双方资料 | `groom` / `bride` 的姓名、展示名；身份由 audience 生成 |
| 版本信息 | `content.audience`，限定三种值；与模板关联校验 |
| 邀请人 | hosts、familyLabel 等可选字段；女方版不从男方数据补父母姓名 |
| 婚宴 | `weddingAt`、lunarText、events，明确迎宾/开席时间、地点、地址、导航关键词和城市 |
| 文案 | 旧邀请语、标题、致谢等映射到 content.copy 或模板默认文案 |
| 相册 | `gallery: [{ url, width, height, alt }]`；绝对 HTTPS URL，尺寸为正整数，数组顺序即展示顺序 |
| 音乐 | 可选 `musicUrl`；明确“缺省使用模板默认曲目”和“显式关闭”的区别 |
| 模板选项 | 开场、是否倒计时、是否自动滚动等，按模板校验；新记录保持旧项目自动滚动行为 |

服务端负责格式化日期、称呼、署名及分享文案，输出普通可序列化对象。公开响应中的 people 数组携带 label 和展示顺序，hostSignature 为 null 时隐藏署名；完整字段以接口设计文档为准。React 不读取数据库、服务端环境变量或完整数据库记录，只消费接口 data。

两个新模板使用明确版本的完整 schema，不让新增必填字段破坏现有仅姓名的 `classic-red` 示例。现有旧记录走兼容分支；新模板记录按 `template_key + content_version` 选择校验器。结构变更明确版本，不静默塞入默认的真实婚礼资料。

相册允许空数组（隐藏区块），单张关闭循环；结构损坏、非法 URL 等应在导入时拒绝，数据库已有损坏记录则服务端记录错误并返回 500。单张图片网络加载失败由前端占位处理，不使整份请柬崩溃。

## 5. Astro 与 React 的职责和目录

### 5.1 渲染与交互

- Astro 页面负责查库、状态码、缓存、模板选择和 meta；layout 唯一输出 `<html>`、`<head>`。
- 两套模板入口使用 `.astro`；封面资料、人物、婚宴、日历、致谢和父母正文均为 Astro，服务端传递 View Model。
- 信封和音乐/页面交互用 `client:load`；相册、倒计时、地图用 `client:visible`。各 island 只接收自己的字段，通过当前页面根节点上的打开事件协调，不下发整页 View Model。
- Astro 直接输出静态正文，React islands 同样 SSR，不把整页设为 `client:only="react"`。动画改用 Tailwind 过渡与 CSS 关键帧；相册通过 ref/effect 初始化 Swiper 原生 JS，禁止 `swiper/react`。[React 集成](https://docs.astro.build/en/guides/integrations-guide/react/)、[框架组件](https://docs.astro.build/en/guides/framework-components/)
- 页面按需选择模板，检查最终构建是否把另一模板的组件、样式或图库打进当前页面，尤其避免注册表导致两个模板客户端代码无条件同时加载。
- 不迁移 `main.tsx` 的 `createRoot()`、旧 Vite 静态多入口插件或 HTML 字符串替换逻辑。

### 5.2 拟调整目录

```text
src/
  pages/[slug].astro                 # 保留并扩展现有动态 SSR 路由
  layouts/Layout.astro               # 扩展 meta、预加载、安全区配置
  lib/
    repositories/invitations.ts      # 返回完整的展示所需记录
    services/invitations.ts          # API 与 SSR 共用的按 slug 查询详情服务
    content/schema.ts                # 按模板/版本校验，保留旧 schema 兼容
    content/view-model.ts            # 日期、称呼、署名及展示数据
    meta/build-meta.ts               # 三版本的分享信息
  pages/api/v1/invitations/[slug].ts  # 正式 JSON 详情接口
  templates/
    manifest.ts                      # 随机模板 ID、版本、能力；页面分支选择入口
    tc00ufeo7r67y/
      manifest.ts
      Template.astro
      components/                    # Envelope、Hero、Gallery、Events 等
      theme.css
    th0sxg4o5vj81/
      manifest.ts
      Template.astro
      components/                    # ParentsEnvelope、ParentsGallery 等
      theme.css
  components/shared/                 # Astro 页面外壳、静态图标/花瓣与 React 交互 islands
  hooks/                             # 倒计时、自动滚动
  styles/global.css                  # 唯一 Tailwind 入口、语义 token 映射
public/fonts/                        # 已有本地字体和授权文件
scripts/invitation-import.ts         # 校验、dry-run、备份、事务导入三份资料
private/                             # 真实导入资料，沿用 Git 忽略规则
```

这是本次实际落地的主要结构。旧 `classic-red` 的最小展示保留兼容路径，避免误用这两套含固定真实照片的模板。

### 5.3 SSR 迁移重点

1. **去除全局 invitation 单例**：所有组件改接收数据，尤其不能在服务端按请求修改模块级共享对象，否则并发 slug 可能串内容。
2. **浏览器 API**：`window`、`document`、地图 SDK、音频与视口测量只在 effect 或事件中执行；副作用卸载时清理。
3. **倒计时水合一致**：不能直接沿用服务端和客户端首次各执行一次 `Date.now()` 的初始化；传入同一初始快照或渲染稳定占位，挂载后再开始计时。
4. **信封与音频**：保留打开动效、滚动锁和正文 inert；音乐在用户开信封等手势中尝试播放，处理播放失败并允许手动播放，主动暂停后不被后续触摸重新唤醒。
5. **自动滚动**：保持开启后的缓慢滚动，用户触摸、滚轮、导航或滚动按键时停止；切后台不瞬间跳远；减少动态效果设置下减弱或关闭。
6. **样式隔离**：唯一 Tailwind v4 入口；模板根节点用 `data-template` 定义主题变量；静态与交互组件均使用模板作用域 CSS 和 Tailwind，不直接搬旧 body 背景污染首页和另一模板。
7. **字体**：旧新人页依赖 Google Fonts，迁移不照搬外链；使用本地已授权字体、必要的子集和系统回退，确认姓名及地点不缺字。
8. **地图**：父母版保留当前页打开导航；新人版保留原内嵌地图及加载失败后的导航按钮。高德 loader 只在客户端按需执行；密钥和域名限制按实际部署配置核对，不将旧配置常量整份下发。
9. **无 JS 降级**：原始 HTML 已有正文；需提供无 JS 时可阅读的展示，避免信封及 inert 永久阻挡内容。

## 6. 后续实施步骤及交付物

按以下顺序实施，每阶段完成后再进入下一阶段；本地实现完成；实际检查、导入记录和剩余人工设备核对项见迁移验证记录。

| 阶段 | 工作 | 可检查的结果 |
| --- | --- | --- |
| M1：基线与资料清单 | 保存旧三入口手机截图；确认素材完整性、真实图片尺寸、字体；整理一份私有导入源 | 三版本对照资料、完整 COS 映射、迁移前基线 |
| M2：Astro React 基础 | 增加官方 React 集成、必要依赖与 TSX/路径别名；保留现有 Node/DB/Tailwind 配置 | 最小 React SSR + 水合可运行，check/build 通过 |
| M3：服务端数据链路 | 实现按 slug 查询详情的 API 与共享服务，扩展 schema/View Model/meta；注册两模板并保留示例兼容 | 一个接口返回 templateId 和完整 data；SSR 消费相同契约，原始 HTML 包含独立 meta |
| M4：新人模板 | 迁移原信封、正文、轮播、日历、地图、音乐等，替换固定图片和音频路径 | 新人页视觉与行为对照通过，相册来自后端 |
| M5：父母模板 | 迁移父母信封、红金布局、相册与署名；按接口 people、copy、婚宴等字段渲染 | 同一 templateId 覆盖两个 slug，女方数据不串用男方信息 |
| M6：真实数据导入 | 工具支持 dry-run；备份 DB；检查迁移历史后以事务写入三条记录，先 draft 验证、验收后 published | 固定三条链接，重复导入不产生重复记录，不覆盖其他示例 |
| M7：回归与交付 | 完成下述验收，记录资源/JS 体积，更新 README、TECH_PLAN 和链接说明 | 可部署构建、验证记录、后续发布步骤及回退办法 |

数据导入先核对已有 `__drizzle_migrations` 与真实表结构，不因为仓库缺少初始迁移就重新建表。首版预计只需数据导入，不修改表结构；确需 DDL 时再生成、审核 SQL 迁移，不执行生产 `drizzle-kit push`。

真实源资料留在已忽略的 `private/`，测试使用虚构人物，仓库保留导入工具。脚本不做隐式发布；草稿验证可先在本地测试库临时发布验收，生产预览功能若尚未实现，不视为现有能力。

## 7. 验收清单

### 7.1 数据、路由与分享

- [ ] 三条 slug 直接访问和刷新均正确；query 参数不能改变 audience；未知、非法、draft、archived 继续按现有规则返回 404。
- [ ] 新人和男方为 1 月 1 日，女方为 1 月 2 日；各自日期、农历、地点、导航和倒计时匹配。
- [ ] 男方显示真实父母署名；女方以女儿在先，不出现男方父母姓名或未经要求添加的女方父母署名。
- [ ] 三条链接独立的 title、description、og、canonical 在原始 HTML 可见，分享图为 COS JPEG；URL 使用部署时的 `SITE_URL`。
- [x] 2026-11-19 将生产应用域名切换为已备案的 `minvitation.site`；应用域名从环境配置取值，素材域名固定采用已核对的 `image.minvitation.site`。切换与验证记录见 [DOMAIN_SWITCH.md](./DOMAIN_SWITCH.md)。
- [ ] 保留已有示例记录和展示行为；不把真实固定照片套到示例 slug；损坏新记录返回 500 且 no-store。
- [ ] 现有页面及 Nginx 缓存规则保留；数据导入后考虑 60 秒共享缓存窗口再检查线上内容。

### 7.2 组件与媒体

- [ ] 新人模板保留信封、3D 相册轮播、日历、地图、倒计时和致谢；男女父母共用红金模板。
- [ ] 父母版维持约 500px 最大宽单列，手机横向手势翻页、纵向滚动互不干扰；无桌面鼠标拖动和前后箭头。
- [ ] 父母相册约每 2 秒切换，支持暂停/继续，离开视口、页面后台或触摸时暂停；新人轮播保留原有交互。
- [ ] 后端更新相册数组后，无需改 React 模板即可改变照片和顺序；空数组和单张场景正常。
- [ ] 详情接口一次返回 templateId 和完整 data；修改人物 label、people 数组顺序、署名、日期或场地，无需改模板即可改变对应 slug 展示。
- [ ] 所有实际图片/音频 URL 可访问、类型正确；无旧 `/photos/`、`/audio/` 媒体残留或猜测的 COS 路径。
- [ ] 首屏图高优先级，非首屏图懒加载，图片有真实尺寸/alt；音频避免首屏完整预下载，开信封及手动开关可用。
- [ ] 不出现水合警告、服务端浏览器 API 报错、跨 slug 数据串用或模板样式串扰；无 JS 时可阅读基本内容。
- [ ] 至少检查 375px、390px、430px 手机及桌面宽屏，音乐按钮/底部安全区正常；iOS Safari、Android 和微信内实际播放/导航做人工核对。

### 7.3 验证方式与发布准备

- 运行 `npm run check`、`npm run build`；开发服务遵循 `AGENTS.md` 使用后台模式。
- 将旧项目版本文案与分享用例的有效断言迁移为数据/SSR 检查；去掉“未知路径回新人版”等已经改变的旧断言，不照搬 Vite 测试启动方式。
- 对数据校验、三版本差异、已发布过滤及 HTTP 状态使用隔离测试数据；检查无需执行 JS 的返回 HTML；交互采用真实浏览器验证。
- 记录每套模板实际 JS/CSS、照片与音频请求；确认应用进程不转发媒体、不在请求时做图片处理。
- 沿用当前 Docker/Nginx 或已有 PM2 部署方式，不引入第二套后端；发布前备份 SQLite 并保留旧应用版本。本计划阶段不部署、不切换域名。
- 故障回退：先将本轮三条新记录下线或恢复其原状态，再回退应用版本；不删除其他记录、COS 对象或旧 invitation 项目。

## 8. 实现前需落实的资料项

本轮已取得足够信息制定方案，以下留作实施检查点，不影响当前文档交付：

1. 固定最终应用 `SITE_URL` 和实际生成的三条 slug；旧站 `/`、`/groom-parents`、`/bride-parents` 是否重定向留到发布阶段决定，本轮不动旧站。
2. 对完整资源清单验证可访问性与尺寸，并在实际手机中确认桶内现有曲目；本次只抽查了照片、分享图和音乐的 HTTP 响应。
3. 明确新人与父母模板使用的本地字体及缺字回退，避免迁移后意外改用 Google Fonts。
4. 媒体缓存、Referer 防盗链、CDN 加速和字体跨域尚未全面核对；实现联调遇到实际需要时再按现有域名设置处理，不在本轮更改桶权限或云端配置。

## 9. 参考资料

- 本地依据：旧项目 `src/config/invitation.ts`、`src/App.tsx`、两套组件及分享测试；当前项目动态页、repository、schema、README、TECH_PLAN、部署配置；本地 SQLite 只读检查；腾讯云现有桶与对象详情。
- Astro 动态 SSR 路由沿用 `[slug].astro`，无需静态路径枚举：[官方路由文档](https://docs.astro.build/en/guides/routing/)。
- Astro 页面外壳与组件职责：[Astro 组件文档](https://docs.astro.build/en/basics/astro-components/)。
- React 服务端渲染与水合：[官方 React 集成](https://docs.astro.build/en/guides/integrations-guide/react/)、[框架组件文档](https://docs.astro.build/en/guides/framework-components/)。
- COS 对象键和访问地址：[对象概述](https://cloud.tencent.com/document/product/436/13324)；默认域名预览限制：[腾讯云通知](https://cloud.tencent.com/document/product/436/96243)。
