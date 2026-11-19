# 生产域名切换记录

操作日期：2026-11-19（北京时间）。

## 当前部署

| 项目 | 配置 |
| --- | --- |
| 应用域名 | `https://minvitation.site` |
| 根域名 DNS | `@`，A，`124.222.10.61`，默认线路，TTL 600 秒 |
| www DNS | `www`，A，`124.222.10.61`，默认线路，TTL 600 秒 |
| 媒体域名 | `https://image.minvitation.site`，原 COS CNAME 保留 |
| 服务器目录 | `/srv/shining-star` |
| 应用环境 | `/srv/shining-star/.env.production` 中 `SITE_URL=https://minvitation.site` |
| Nginx 生效文件 | `/etc/nginx/sites-available/shining-star` |
| Nginx 反向代理 | `http://127.0.0.1:4321` |
| HTTPS 证书 | `/etc/nginx/ssl/minvitation.site/minvitation.site_bundle.crt` |
| HTTPS 私钥 | `/etc/nginx/ssl/minvitation.site/minvitation.site.key`，root 所有、权限 600 |
| 证书覆盖 | `minvitation.site`、`www.minvitation.site` |
| 证书到期 | 2027-02-17 15:59:59（北京时间） |
| EdgeOne Pages | 旧项目 `zjmarryinviation` 保留；复核时该域名绑定已解除，没有重复执行删除 |

## 已完成的操作

1. 复核备案：`minvitation.site` 状态正常，备案关联当前服务器。
2. 备份原 Nginx、环境变量和 Compose 配置。
3. 通过 Termius SFTP 上传新域名证书和私钥，安装到上述 root 目录。
4. 在现有 Nginx 文件中追加新域名的 HTTP/HTTPS 站点，保留原域名配置作为兼容入口；未重复添加缓存区或 map 定义。
5. 执行 `nginx -t` 成功后 reload；更新 `SITE_URL` 并重建应用容器，未重建镜像、未重新导入或覆盖数据库。
6. 使用 `curl --resolve minvitation.site:443:124.222.10.61` 在 DNS 切换前验证三个页面和三个 API，全部 200，TLS 校验通过，canonical 指向新域名。
7. 18:08:47 修改原 `@` 记录：CNAME 改为 A，值改为 `124.222.10.61`。没有新增与 CNAME 冲突的 A 记录。
8. Google、Cloudflare 的 DNS 查询均返回新服务器 IP；服务器使用正常公网 DNS 访问三个页面也全部 200，证书校验结果为 0。

## 验证状态

| 检查 | 结果 |
| --- | --- |
| 指定源站 IP，三个页面 | 200，标题正确，canonical 为新域名 |
| 指定源站 IP，三个 API | 200，JSON 与 slug 正确 |
| 服务器正常公网 DNS，三个页面 | 200，TLS 验证通过，连接 IP 为 `124.222.10.61` |
| 应用容器 | running=true，restarts=0 |
| Google、Cloudflare DNS | A=`124.222.10.61` |
| 本机浏览器 | 根域名与 www 均已在 Chrome 正常打开请柬，无证书警告 |
| 本机正常公网 DNS，三个页面和三个 API | 18:22 最终复核全部 200，TLS 校验通过，标题、slug、templateId 和 canonical 正确 |
| HTTP 跳转、www HTTPS、COS 图片/音频 | HTTP 301 到新域名 HTTPS，其余均 200 |

访问与接口完整路径见 [ONLINE_LINKS.md](./ONLINE_LINKS.md)。

## DNS 冲突和切换缓存

同一个 `@` 不能同时使用 A 和 CNAME。若控制台报告冲突，应修改原记录的类型和值，而不是重复新增。`image` 是独立的媒体子域名，不要改成服务器 IP。

切换后，部分网络可能继续缓存旧 Pages 边缘节点。若旧 Pages 绑定已解除，这些请求可能出现证书域名不匹配。本次公共 DNS 和服务器访问已更新后，这台 Mac 仍缓存旧节点；用户手动重连网络客户端后恢复。刚重连时出现过短暂连接超时，随后 Chrome 根域名访问成功，最终正常域名请求六个页面/API 全部通过，未跳过证书校验。没有修改代理规则、DNS 服务器或浏览器安全设置。

## 备份与回退依据

服务器原配置备份目录：`/var/backups/shining-star/domain-20261119T095608Z`，目录权限 700。

- `nginx.before.conf`：原生效站点配置。
- `env.production.before`：原环境变量，包含服务端配置，不放入 Git。
- `compose.before.yaml`：原 Compose 文件。
- 原根域名 DNS：CNAME `minvitation.site.pages.dnsoe5.com.`，TTL 600。

若需要回退到 Pages，先重新绑定域名并确认其 HTTPS 证书与旧项目可用，再将 DNS 指回该 CNAME。不要直接把 DNS 指向已解除域名绑定的 Pages 节点。

本次保留了旧 `minviation.cloud` 的 Nginx 配置，但该域名存在备案拦截，不能将它作为可靠的公网回退入口。

## 证书更新

当前为手动安装的证书，不由 Certbot 自动续期。到期前申请新证书，将匹配的 `.crt` 和 `.key` 安装至当前路径，然后执行：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

更新证书不需要重新导入数据库或重建 Docker 镜像。
