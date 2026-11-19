# 请柬详情接口设计

> 2026-11-19 · v1 · 已实现本地接口与模板，发布前以迁移验证记录为准。
> 本文是本轮迁移的数据契约；涉及接口与渲染数据时，以本文为准。

## 1. 核心设计

**一个 slug 对应一份完整请柬数据和一个 templateId；多个 slug 可以共用同一个 templateId。** 模板决定布局和效果，接口数据决定姓名、称呼、顺序、署名、婚宴和相册等内容。

| slug（示例） | templateId | 内容版本 |
| --- | --- | --- |
| `sddlh4zxebmfx` | `tc00ufeo7r67y` | 新人版 |
| `s10nxtffcpevs` | `th0sxg4o5vj81` | 男方父母版 |
| `s6jtlzuaybjru` | `th0sxg4o5vj81` | 女方父母版 |

例如，父母模板不写死“儿子 / 儿媳”，也不判断 slug 是否含 `bride`：直接按照接口 `people` 数组的顺序渲染各自的 `label` 和 `name`。这样同一个模板就能展示儿子在先或女儿在先的不同页面。

```text
slug
  ↓ 查询请柬详情
{ templateId, templateVersion, people, hosts, wedding, banquet, gallery, ... }
  ↓ 按 templateId + templateVersion 查本地模板注册表
Astro 模板接收完整 data，React 交互组件只接收所需字段
  ↓ 按字段渲染
不同内容、可复用的页面
```

本期两个模板入口和静态正文均使用 Astro，只有信封、原生 Swiper 相册、倒计时、音乐/滚动及地图交互使用 React islands。动画使用 Tailwind CSS 过渡、CSS 关键帧和少量原生事件，不使用 Framer Motion，也不使用 `swiper/react`。接口只返回模板标识和数据，不返回 HTML、JS、组件路径或可执行代码。模板标识是生成后保持稳定的随机字符串，不另引入数字 ID 与字符串之间的映射。

### 标识生成与校验规则

| 标识 | 格式 | 基础格式校验 |
| --- | --- | --- |
| `templateId` | `t` + 12 位随机小写字母和数字，总长 13 位 | `^t[a-z0-9]{12}$` |
| `slug` | `s` + 12 位随机小写字母和数字，总长 13 位 | `^s[a-z0-9]{12}$` |

- 随机部分使用 `a-z`、`0-9`，且至少包含一个字母和一个数字；使用安全随机源生成，不使用自增序号、姓名、身份或日期编码。
- templateId 在创建模板时生成并登记到模板注册表；slug 在创建请柬记录时生成并持久化。页面请求、重启和重复导入不会重新生成标识。
- slug 由数据库唯一约束保证不重复；templateId 在模板注册表内唯一。生成碰撞时重试，不覆盖已有记录或模板。
- 一个模板对应一个 templateId，男女双方父母共用同一个 ID；模板版本通过 templateVersion 独立管理，不把版本编码进 ID。
- templateId 和 slug 都不承载业务含义，前端通过注册表和接口字段渲染；audience 等业务枚举仍保留原来的语义。
- 规则适用于本次新增模板和新请柬。已有 `classic-red` 及旧 slug 继续原兼容路径，不重命名、不改数据库；公开 v1 接口使用上述新标识格式。
- 本文中的两种模板 ID 与三条 slug 已登记并用于本地导入，后续更新和发布继续保留这些值。

## 2. 接口定义

| 项目 | 约定 |
| --- | --- |
| 请求 | `GET /api/v1/invitations/{slug}` |
| 用途 | 通过唯一 slug 获取渲染一份已发布请柬所需的全部可变信息 |
| 请求示例 | `/api/v1/invitations/s6jtlzuaybjru` |
| 路径参数 | `slug: string`，必填，`s` + 12 位随机小写字母和数字；符合上述标识规则，不接受带姓名、身份或连字符的新 slug |
| 查询参数 | v1 不提供覆盖模板、身份或内容的参数；额外 query 不改变查询结果，并禁止缓存 |
| 请求体 | 无 |
| 鉴权 | 已发布请柬无需登录；只返回该 slug 的公开展示数据 |
| 成功类型 | `application/json; charset=utf-8` |
| 缓存 | v1 JSON 接口统一 `Cache-Control: no-store`，Nginx 不缓存 `/api/`；SSR 页面沿用现有 60 秒共享缓存条件 |
| HEAD | 与 GET 一致的状态与响应头，无响应体 |

三个 slug 使用同一接口和同一响应结构，不分别设计新人接口、男方接口、女方接口。不提供全量请柬列表或按姓名搜索接口。

成功响应为 `{ "data": { ... } }`。未找到时使用正确的 HTTP 404，不返回 200 加业务错误码。所有成功字段均按以下契约返回，不依赖前端合并另一份婚礼配置。

## 3. 成功响应字段

### 3.1 顶层 data

以下字段在成功响应中全部必有，空值按照约定返回 `null` 或空数组。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `schemaVersion` | integer | 当前为 `1`，接口 data 结构版本 |
| `slug` | string | 本条请柬的随机标识，格式 `s` + 12 位随机小写字母和数字 |
| `templateId` | string | 格式 `t` + 12 位随机小写字母和数字；本期注册两个模板，示例见上表 |
| `templateVersion` | integer | 模板大版本，当前为 `1` |
| `audience` | string | `couple`、`groom-parents`、`bride-parents`，用于内容归属校验；不负责选择布局 |
| `people` | Person[] | 本期固定两人；**数组顺序就是展示顺序** |
| `hosts` | Host[] | 需要公开展示的邀请人；不展示则 `[]` |
| `hostSignature` | string 或 null | 完整署名，例如“赵壮虎 · 刘永娟 敬邀”；null 则不渲染署名区域 |
| `familyLabel` | string 或 null | 信封家族称谓，例如“赵府”；新人版为 null |
| `wedding` | Wedding | 婚期、时区、显示日期、农历 |
| `banquet` | Banquet | 本期单场婚宴的时间、场地、地址和导航 |
| `copy` | Copy | 本条请柬的差异文案 |
| `gallery` | Photo[] | 新人的婚纱相册，按数组顺序展示；无照片为 `[]` |
| `music` | Music | 已解析默认值后的音乐配置；关闭时 `url: null` |
| `templateOptions` | TemplateOptions | 已解析默认值后的展示和交互选项 |
| `meta` | PageMeta | 服务端 head 及分享所需信息 |
| `legal` | Legal | 页脚展示的备案信息 |

### 3.2 人物与署名

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `people[].id` | `groom` 或 `bride` | 人物身份，固定且不随显示顺序变化；也可用于匹配模板内固定头像 |
| `people[].name` | string | 姓名，如“梁紫艺” |
| `people[].label` | string | 当前请柬中的称呼，如“女儿” |
| `hosts[].label` | string | 如“父亲”“母亲” |
| `hosts[].name` | string | 允许公开展示的邀请人姓名 |

规则：

- people 中 `groom`、`bride` 各出现一次，不额外返回 `brideFirst` 或另一份排序字段。
- 男方父母版有两个 hosts 和非空 hostSignature；女方父母版返回 `hosts: []`、`hostSignature: null`，不会携带不展示的父母姓名。
- hosts 用于需要分别列出邀请人的区域；hostSignature 用于整行署名。两者由后端同一份来源生成，保持一致。
- audience 是语义标识；前端展示称呼读取 label，顺序读取数组，不在客户端按 audience 重写这些字段。

### 3.3 婚期与婚宴

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `wedding.at` | string | 带时区 ISO 日期时间，倒计时目标，旧项目为婚期当天 10:00 |
| `wedding.timezone` | string | 当前固定 `Asia/Shanghai` |
| `wedding.dateText` | string | 如“2027年1月2日” |
| `wedding.weekdayText` | string | 如“星期六” |
| `wedding.lunarText` | string 或 null | 如“农历十一月廿五”，人工维护；null 隐藏 |
| `banquet.title` | string | 如“喜宴” |
| `banquet.receptionAt` | string | 完整带时区 ISO 迎宾时间，09:30 |
| `banquet.startsAt` | string | 完整带时区 ISO 开席时间，12:00 |
| `banquet.receptionText` | string | 显示时间，如“09:30”；标题由模板通用文案呈现 |
| `banquet.startsText` | string | 显示时间，如“12:00” |
| `banquet.venue` | string | 场地全称 |
| `banquet.address` | string | 详细地址，不能返回“沿用旧配置”这类占位说明 |
| `banquet.navigation.provider` | string | 当前为 `amap` |
| `banquet.navigation.keyword` | string | 地图检索关键词，与本条婚宴对应 |
| `banquet.navigation.city` | string | 城市名 |

日期/星期和时间展示字段均由后端根据 ISO 时间及 timezone 生成，前端直接使用；日历可依据 `wedding.at` 与 timezone 计算。倒计时目标与开席时间独立，不用 12:00 覆盖旧配置的 10:00。

前端从 navigation 的 keyword、city 构造已知高德导航链接并进行 URL 参数编码；无需接口下发任意跳转地址。内嵌地图的 SDK 初始化配置独立管理，不在请柬 JSON 混入旧配置中的密钥常量。

### 3.4 文案、媒体、选项和分享

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `copy.envelopeRoles` | string 或 null | 信封身份文字，如“女儿 · 女婿”；新人版 null |
| `copy.heroTagline` | string | 首屏标语 |
| `copy.announcement` | string[] | 喜讯文案，各元素一行 |
| `copy.inviteLines` | string[] | 邀请文案，各元素一行 |
| `copy.countdownPrefix` | string | 倒计时前缀 |
| `copy.countdownDone` | string | 婚期已过文案 |
| `copy.thanks.title` / `message` | string | 致谢标题、正文；正文可含换行 |
| `gallery[].url` | string | COS 自定义域名的绝对 HTTPS 图片 URL |
| `gallery[].width` / `height` | integer | 真实图片宽高，正整数 |
| `gallery[].alt` | string | 图片描述 |
| `music.url` | string 或 null | 绝对 HTTPS MP3 URL；null 隐藏音乐组件 |
| `templateOptions.opening` | string | `envelope` 或 `none` |
| `templateOptions.autoScroll` | boolean | 是否在开信封后自动滚动 |
| `templateOptions.showCountdown` | boolean | 是否显示倒计时 |
| `templateOptions.showCalendar` | boolean | 是否显示日历；父母模板当前返回 false |
| `meta.title` / `description` | string | 独立的页面与分享文案 |
| `meta.canonicalPath` | string | 规范页面路径 `/{slug}`，不含 query |
| `meta.image.url` | string | 绝对 HTTPS 分享图 URL |
| `meta.image.width` / `height` | integer | 分享图真实尺寸 |
| `meta.image.alt` | string | 分享图描述 |
| `meta.noindex` | boolean | 默认 true |
| `legal.icpNumber` / `owner` / `url` | string | 备案号、主办者、官方备案查询链接 |

默认值在后端一次解析：数据库未配置音乐时采用模板默认曲目，显式关闭则返回 null；接口不会用“字段缺失”再要求前端猜测。选项必须为模板实际支持的值；例如父母模板 v1 不支持日历，不允许返回 true。

meta 的 canonicalPath 由后端根据 slug 生成。Astro layout 使用部署配置 `SITE_URL` 拼接绝对 canonical 和 `og:url`，不把应用域名写死为旧站或某个示例域名。

所有文案均为纯文本，不支持 HTML。模板按文本渲染，换行按数组或 CSS 处理。

## 4. 三份完整响应示例

以下展示三个接口各自独立返回的完整结构，无需前端合并“公共字段”。为便于阅读，相册每份仅展示两张；正式导入时返回完整 12 张的有序数组，不做分页。示例两张图尺寸已从旧本地源文件读取，COS 对象尺寸在导入时再核对。

### 4.1 新人版

`GET /api/v1/invitations/sddlh4zxebmfx`

```json
{
  "data": {
    "schemaVersion": 1,
    "slug": "sddlh4zxebmfx",
    "templateId": "tc00ufeo7r67y",
    "templateVersion": 1,
    "audience": "couple",
    "people": [
      { "id": "groom", "name": "赵杰", "label": "新郎" },
      { "id": "bride", "name": "梁紫艺", "label": "新娘" }
    ],
    "hosts": [],
    "hostSignature": null,
    "familyLabel": null,
    "wedding": {
      "at": "2027-01-01T10:00:00+08:00",
      "timezone": "Asia/Shanghai",
      "dateText": "2027年1月1日",
      "weekdayText": "星期五",
      "lunarText": "农历十一月廿四"
    },
    "banquet": {
      "title": "喜宴",
      "receptionAt": "2027-01-01T09:30:00+08:00",
      "startsAt": "2027-01-01T12:00:00+08:00",
      "receptionText": "09:30",
      "startsText": "12:00",
      "venue": "山西省太原清徐县清雅苑(二部)",
      "address": "山西省太原市清徐县",
      "navigation": { "provider": "amap", "keyword": "山西省太原清徐县清雅苑(二部)", "city": "太原" }
    },
    "copy": {
      "envelopeRoles": null,
      "heroTagline": "我们结婚啦",
      "announcement": ["愿以余生 相守相伴", "谨备薄酒 恭候亲友"],
      "inviteLines": ["我们诚挚地邀请您", "见证 赵杰 与 梁紫艺 的幸福时刻", "与我们一同分享这份喜悦"],
      "countdownPrefix": "距离我们的婚礼",
      "countdownDone": "我们已喜结连理 ❦",
      "thanks": { "title": "感谢你们的见证与祝福", "message": "人生最美好的时刻，有幸与你们一同分享。" }
    },
    "gallery": [
      { "url": "https://image.minvitation.site/myphotos/section_1.webp", "width": 1599, "height": 2133, "alt": "赵杰与梁紫艺的婚纱照，第1张" },
      { "url": "https://image.minvitation.site/myphotos/section_2.webp", "width": 1599, "height": 2133, "alt": "赵杰与梁紫艺的婚纱照，第2张" }
    ],
    "music": { "url": "https://image.minvitation.site/auido/jintianwoyaojiageini-96k.mp3" },
    "templateOptions": { "opening": "envelope", "autoScroll": true, "showCountdown": true, "showCalendar": true },
    "meta": {
      "title": "赵杰 & 梁紫艺 · 婚礼请柬",
      "description": "我们结婚啦！赵杰与梁紫艺诚邀您于2027年1月1日莅临清雅苑（二部），09:30迎宾，12:00开席。",
      "canonicalPath": "/sddlh4zxebmfx",
      "image": { "url": "https://image.minvitation.site/myphotos/share-cover.jpg", "width": 600, "height": 600, "alt": "赵杰与梁紫艺的婚纱合照" },
      "noindex": true
    },
    "legal": { "icpNumber": "晋ICP备2026016139号-1", "owner": "赵杰", "url": "https://beian.miit.gov.cn/" }
  }
}
```

### 4.2 男方父母版

`GET /api/v1/invitations/s10nxtffcpevs`

```json
{
  "data": {
    "schemaVersion": 1,
    "slug": "s10nxtffcpevs",
    "templateId": "th0sxg4o5vj81",
    "templateVersion": 1,
    "audience": "groom-parents",
    "people": [
      { "id": "groom", "name": "赵杰", "label": "儿子" },
      { "id": "bride", "name": "梁紫艺", "label": "儿媳" }
    ],
    "hosts": [
      { "label": "父亲", "name": "赵壮虎" },
      { "label": "母亲", "name": "刘永娟" }
    ],
    "hostSignature": "赵壮虎 · 刘永娟 敬邀",
    "familyLabel": "赵府",
    "wedding": {
      "at": "2027-01-01T10:00:00+08:00",
      "timezone": "Asia/Shanghai",
      "dateText": "2027年1月1日",
      "weekdayText": "星期五",
      "lunarText": "农历十一月廿四"
    },
    "banquet": {
      "title": "喜宴",
      "receptionAt": "2027-01-01T09:30:00+08:00",
      "startsAt": "2027-01-01T12:00:00+08:00",
      "receptionText": "09:30",
      "startsText": "12:00",
      "venue": "山西省太原清徐县清雅苑(二部)",
      "address": "山西省太原市清徐县",
      "navigation": { "provider": "amap", "keyword": "山西省太原清徐县清雅苑(二部)", "city": "太原" }
    },
    "copy": {
      "envelopeRoles": "儿子 · 儿媳",
      "heroTagline": "儿子儿媳 新婚志喜",
      "announcement": ["吾家有喜 喜结良缘", "谨备薄酒 恭候亲友"],
      "inviteLines": ["谨以父母之心邀您", "见证儿子 赵杰 与 儿媳 梁紫艺的婚礼", "与我们一同分享这份喜悦"],
      "countdownPrefix": "距离孩子们的婚礼",
      "countdownDone": "孩子们已喜结连理 ❦",
      "thanks": { "title": "感谢您的祝福与见证", "message": "儿子 赵杰 与 儿媳 梁紫艺的新婚之喜\n承蒙您来同贺。" }
    },
    "gallery": [
      { "url": "https://image.minvitation.site/myphotos/section_1.webp", "width": 1599, "height": 2133, "alt": "赵杰与梁紫艺的婚纱照，第1张" },
      { "url": "https://image.minvitation.site/myphotos/section_2.webp", "width": 1599, "height": 2133, "alt": "赵杰与梁紫艺的婚纱照，第2张" }
    ],
    "music": { "url": "https://image.minvitation.site/auido/jintianwoyaojiageini-96k.mp3" },
    "templateOptions": { "opening": "envelope", "autoScroll": true, "showCountdown": true, "showCalendar": false },
    "meta": {
      "title": "儿子囍儿媳 · 婚礼请柬",
      "description": "赵壮虎 · 刘永娟 敬邀，谨为儿子赵杰囍儿媳梁紫艺于2027年1月1日在清雅苑（二部）举行喜宴，09:30迎宾，12:00开席。",
      "canonicalPath": "/s10nxtffcpevs",
      "image": { "url": "https://image.minvitation.site/myphotos/share-cover.jpg", "width": 600, "height": 600, "alt": "赵杰与梁紫艺的婚纱合照" },
      "noindex": true
    },
    "legal": { "icpNumber": "晋ICP备2026016139号-1", "owner": "赵杰", "url": "https://beian.miit.gov.cn/" }
  }
}
```

### 4.3 女方父母版

`GET /api/v1/invitations/s6jtlzuaybjru`

```json
{
  "data": {
    "schemaVersion": 1,
    "slug": "s6jtlzuaybjru",
    "templateId": "th0sxg4o5vj81",
    "templateVersion": 1,
    "audience": "bride-parents",
    "people": [
      { "id": "bride", "name": "梁紫艺", "label": "女儿" },
      { "id": "groom", "name": "赵杰", "label": "女婿" }
    ],
    "hosts": [],
    "hostSignature": null,
    "familyLabel": "梁府",
    "wedding": {
      "at": "2027-01-02T10:00:00+08:00",
      "timezone": "Asia/Shanghai",
      "dateText": "2027年1月2日",
      "weekdayText": "星期六",
      "lunarText": "农历十一月廿五"
    },
    "banquet": {
      "title": "喜宴",
      "receptionAt": "2027-01-02T09:30:00+08:00",
      "startsAt": "2027-01-02T12:00:00+08:00",
      "receptionText": "09:30",
      "startsText": "12:00",
      "venue": "山西省太原市清徐县清徐喜来澄大酒店6楼",
      "address": "太原市清徐县039省道东侧",
      "navigation": { "provider": "amap", "keyword": "山西省太原市清徐县清徐喜来澄大酒店", "city": "太原" }
    },
    "copy": {
      "envelopeRoles": "女儿 · 女婿",
      "heroTagline": "女儿女婿 新婚志喜",
      "announcement": ["吾家有喜 喜结良缘", "谨备薄酒 恭候亲友"],
      "inviteLines": ["诚邀您拨冗莅临", "见证女儿 梁紫艺 与 女婿 赵杰的婚礼", "与我们一同分享这份喜悦"],
      "countdownPrefix": "距离孩子们的婚礼",
      "countdownDone": "孩子们已喜结连理 ❦",
      "thanks": { "title": "感谢您的祝福与见证", "message": "女儿 梁紫艺 与 女婿 赵杰的新婚之喜\n承蒙您来同贺。" }
    },
    "gallery": [
      { "url": "https://image.minvitation.site/myphotos/section_1.webp", "width": 1599, "height": 2133, "alt": "赵杰与梁紫艺的婚纱照，第1张" },
      { "url": "https://image.minvitation.site/myphotos/section_2.webp", "width": 1599, "height": 2133, "alt": "赵杰与梁紫艺的婚纱照，第2张" }
    ],
    "music": { "url": "https://image.minvitation.site/auido/jintianwoyaojiageini-96k.mp3" },
    "templateOptions": { "opening": "envelope", "autoScroll": true, "showCountdown": true, "showCalendar": false },
    "meta": {
      "title": "女儿梁紫艺与女婿赵杰 · 婚礼请柬",
      "description": "吾家有喜！谨为女儿梁紫艺与女婿赵杰于2027年1月2日在清徐喜来澄大酒店6楼举行喜宴，09:30迎宾，12:00开席，诚邀亲朋共贺良缘。",
      "canonicalPath": "/s6jtlzuaybjru",
      "image": { "url": "https://image.minvitation.site/myphotos/share-cover.jpg", "width": 600, "height": 600, "alt": "赵杰与梁紫艺的婚纱合照" },
      "noindex": true
    },
    "legal": { "icpNumber": "晋ICP备2026016139号-1", "owner": "赵杰", "url": "https://beian.miit.gov.cn/" }
  }
}
```

## 5. 前端渲染规则

| 场景 | 处理 |
| --- | --- |
| `tc00ufeo7r67y` + v1 | 渲染新人 Astro 模板及 React 交互 islands |
| `th0sxg4o5vj81` + v1 | 渲染父母 Astro 模板及 React 交互 islands；双方差异完全读取 data |
| people 数组 | 按原顺序遍历，不自行交换男女位置；用 id 作为稳定 key |
| hostSignature 为 null | 隐藏专属署名区，不补默认父母名字或“父母敬邀” |
| familyLabel 为 null / lunarText 为 null | 隐藏相应区域 |
| gallery 为空 / 单张 | 隐藏相册 / 显示单图并禁用循环 |
| music.url 为 null | 不渲染 audio 与开关 |
| options 关闭某功能 | 隐藏或停止相应功能，不依靠全局配置覆盖 |
| 相册加载失败 | 单图占位并允许继续阅读，不整页报错 |
| 未知 templateId、templateVersion 或 schemaVersion | 显示“暂时无法打开请柬”，记录诊断；不能随意套其他模板 |
| API 404 | 显示未找到页面，不回退新人模板 |
| 请求失败或 500 | 显示可重试错误状态，不从别的 slug 补数据 |

模板只保留通用固定文案与视觉结构；任何会随请柬变化的人名、身份、日期、场地、地址、署名、邀请语与分享信息必须来自 data。固定装饰图、首屏图与头像继续按迁移计划写在模板中；相册图片来自 gallery。

一个模板可以被任意多条 slug 复用，不能通过比较姓名或匹配这三个特定 slug 来决定内容。

## 6. Astro 接入与后端分层

API 和 Astro SSR 页面共享一个“按 slug 获取请柬详情”的服务，使用相同 data 契约：

```text
GET /api/v1/invitations/{slug} ──→ 请柬详情服务 ──→ repository ──→ SQLite
                                       ↑
GET /{slug} → Astro 页面 ────────────────┘
                 ↓
         data.templateId + templateVersion
                 ↓
         Astro 静态正文 + React 交互 islands
```

- **接口是正式交付项**，提供完整 JSON，可由前端直接按 slug 请求。
- 当前同仓部署首屏推荐 Astro 服务端直接调用共享服务，拿到与 API 相同的 data，完成 Astro 模板选择、静态正文和 meta 渲染，仅把交互必需字段交给各 React island 水合，避免首屏重复查询与浏览器二次拉取。
- 若页面采用浏览器请求 API，则先显示加载状态，成功后按 templateId 选组件；但不能只靠浏览器请求更新分享 head，首次 HTML 仍应由 Astro 使用相同数据生成。
- 这样“前端按 templateId 渲染”的契约不受请求发生在 Astro 服务端还是浏览器影响，也不需要在同一进程内绕 HTTP 请求自己。
- 后端步骤统一为：校验 slug → 查 published 记录 → 按内部数据版本校验 → 校验模板与 audience → 生成展示 data → 校验响应 → 输出。
- 模板注册表仅允许已知模板和版本，后端先检查可用性。查到不存在的模板配置属于服务端错误，返回 500，避免接口成功但页面无法渲染。

已实现 Astro API 路由 `src/pages/api/v1/invitations/[slug].ts` 和共享服务 `src/lib/services/invitations.ts`。Astro 的 SSR endpoint 可用于请求时生成 JSON：[官方 Endpoints 文档](https://docs.astro.build/en/guides/endpoints/)。

## 7. 数据库存储映射

沿用现有 invitations 表，一条记录对应一个 slug；本轮不新增模板表或男女父母专用表。

| 数据库来源 | API data |
| --- | --- |
| `slug` | `slug` |
| `template_key` | `templateId`，新模板存储 `t` 开头的随机 ID；只改接口命名，不要求重命名现有列 |
| `template_version` | `templateVersion` |
| `content_version` | 新请柬为 `2`；内部 content 校验/转换版本，不等同于对外 schemaVersion |
| `content.audience` | `audience` |
| `content.groom` / `bride` | 生成 people 的姓名；后端按 audience 及该条展示配置确定顺序与 label |
| `content.hosts`、相关文案 | hosts、hostSignature、familyLabel |
| `content.weddingAt`、`lunarText` | wedding，其他日期展示值服务端生成 |
| `content.events` 中本期唯一婚宴项 | banquet，迎宾与开席展示值服务端生成 |
| `content.copy` | copy，可合并模板通用默认文案；不得填入另一 slug 的专属内容 |
| `content.gallery` | gallery |
| `content.musicUrl` | music.url，服务端解析默认曲目或显式关闭 |
| `template_options` | templateOptions，服务端校验并补齐默认值 |
| `share_title` / `share_description` / `share_image_url`、`noindex` | meta；未配置的文本服务端按本条数据生成 |
| `content.legal` | legal，导入资料中三份备案信息一致 |

schemaVersion 是公开响应结构版本；数据库 content_version 是内部存储版本；templateVersion 是布局兼容版本，三者独立演进。

三个完整记录可由一份私有资料生成并在事务中导入，共享相册只重复保存元数据，不重复上传 COS 文件。任何记录都可独立更新婚宴、文案和发布时间；每次读取只根据该 slug 查询，不能临时读取另一 slug 填字段。

已有 `classic-red` 示例记录仍走原最小页面兼容路径，不映射为这两个新模板。v1 接口本期仅支持两种新模板；请求到已有但不在本接口范围内的模板记录，返回与未找到相同的 404，保留旧页面访问；若新模板记录的版本或配置损坏则返回 500。

## 8. 错误响应与约束

错误响应示例：

```json
{
  "error": {
    "code": "INVITATION_NOT_FOUND",
    "message": "未找到请柬，请检查链接是否完整、正确。"
  }
}
```

| HTTP | code | 场景 |
| --- | --- | --- |
| 404 | `INVITATION_NOT_FOUND` | slug 非法、保留字、记录不存在、draft、archived，或本期接口范围外的旧模板记录 |
| 405 | `METHOD_NOT_ALLOWED` | GET/HEAD 之外的方法；返回 `Allow: GET, HEAD` |
| 500 | `INVITATION_UNAVAILABLE` | 数据库读取失败、新模板记录损坏、模板/版本配置错误等 |

500 对用户统一显示“暂时无法打开请柬，请稍后重试”，具体原因只记录服务端日志。错误响应也返回 no-store。草稿预览不在本期公开接口中实现。

分享图宽高与 alt 元数据在导入时保存于 `content.shareImage`；`share_image_url` 仍作为分享 URL 的普通列。服务端校验二者匹配，避免自定义分享图被错误标成 600×600。

其他约束：

- 不暴露 preview_token、数据库路径、数据库主键、云密钥、SQL 或错误堆栈。
- templateId 与 audience 合法组合为：新人模板只接 couple；父母模板接两种 parents。人物称呼和顺序由后端校验一致性。
- URL 使用绝对 HTTPS；本次真实新记录的照片、分享图与音频均使用已确认的 `image.minvitation.site` 域名。保留桶内真实的 `myphotos/`、`auido/` 路径。
- gallery 顺序直接按数组输出，禁止请求时列桶、按字符串文件名排序或拼出 12 个 URL 让前端猜。
- 不返回 HTML 或任意 CSS；templateOptions 是受限字段集合，不接受任意脚本/样式配置。
- 不新增模糊的 null/缺省语义：本契约列出的成功字段全部存在，前端无需合并私有硬编码数据。

## 9. 后续实现验收

- [ ] 新 templateId 和 slug 符合 `t` / `s` 加 12 位随机字母数字的规则，唯一且持久化，不含业务语义。
- [ ] 一个详情接口可独立返回三份完整 JSON，结构一致、slug 不同、内容独立。
- [ ] 两个父母 slug 返回同一 templateId；修改接口 label、people 顺序、署名或婚宴即可改变展示，无需改父母模板。
- [ ] JSON 字段覆盖用户列出的身份、顺序、署名、日期、农历、场地、详细地址、迎宾及开席时间。
- [ ] 女方响应任何字段中均不出现男方父母姓名，且女儿在先、日期和场地正确。
- [ ] API 与 SSR 共享同一服务和 schema，不出现一份返回 1 月 1 日、另一份显示 1 月 2 日的双重配置。
- [ ] 原始 HTML 输出对应 slug 的 meta 和正文；React 交互组件的水合数据与初始 HTML 一致。
- [ ] gallery 来自数据库中的完整有序数组；固定模板图片继续直接使用 COS。
- [ ] 非法/不存在/未发布 slug 404，损坏新记录 500；页面与 API 各自遵守缓存规则。
- [ ] 在隔离数据中验证三个响应、空相册、单图、无署名、音乐关闭、未知版本及异常状态。

关联文档：[迁移计划](./INVITATION_MIGRATION_PLAN.md)、[迁移验证记录](./MIGRATION_REPORT.md)。
