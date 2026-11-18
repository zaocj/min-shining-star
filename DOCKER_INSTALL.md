# Ubuntu 24.04 安装与部署

通过 SSH 登录服务器后，按顺序执行。适用于尚未安装 Docker 的 Ubuntu 24.04 服务器，需要 sudo 权限。

## 1. 添加 Docker 官方软件源

```bash
sudo apt update
sudo apt install -y ca-certificates curl

sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: noble
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
```

## 2. 安装 Docker 和 Compose 插件

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo systemctl enable --now docker
```

## 3. 验证安装

```bash
sudo docker version
sudo docker compose version
sudo docker run --rm hello-world
```

看到版本信息和 `Hello from Docker!` 即表示安装成功。Compose 使用 `docker compose` 命令，中间是空格。

## 4. 安装宿主机 Nginx 和 HTTPS 工具

本项目计划由 Docker 运行 Astro，宿主机 Nginx 负责反向代理、页面缓存和 HTTPS。

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable --now nginx
```

至此完成服务器软件安装；宿主机无需另外安装 Node.js、npm 或 PM2。

## 5. 首次部署：准备服务器目录
SERVER_IP = 124.222.10.61

下面把 `ubuntu@SERVER_IP` 换成你的 SSH 用户和服务器 IP，把 `invite.example.com` 换成实际域名。服务器安全组需放行 SSH、80、443；域名 A 记录指向服务器 IP。

**在服务器执行：**

```bash
uname -m
sudo install -d -o "$USER" -g "$(id -gn)" /srv/shining-star
sudo install -d -o 1000 -g 1000 -m 750 /var/lib/invitation
sudo apt install -y sqlite3
```

记住 `uname -m` 的结果：`x86_64` 对应 `linux/amd64`，`aarch64` 对应 `linux/arm64`。数据库目录 UID/GID 1000 对应容器内的 node 用户。

## 6. 在本地构建并上传镜像

本地 Mac 需要安装并启动 Docker Desktop。在本地项目根目录执行；小内存服务器只运行镜像，不承担构建。

镜像内部使用 Debian（`node:24-bookworm-slim`），可以正常运行在 Ubuntu 24.04 服务器上，不需要改成 Ubuntu 基础镜像。

```bash
# 按服务器架构选择；ARM 服务器改为 linux/arm64。
docker buildx build --platform linux/amd64 --load -t shining-star:latest .

# 把镜像导出为压缩文件
docker save -o /tmp/shining-star-image.tar shining-star:latest && gzip -f /tmp/shining-star-image.tar

# 上传镜像和 Compose 配置
scp /tmp/shining-star-image.tar.gz compose.yaml \
  ubuntu@124.222.10.61:/srv/shining-star/

# 上传 Nginx 配置
scp deploy/nginx.conf ubuntu@124.222.10.61:/srv/shining-star/nginx.conf
```

镜像构建会自动安装依赖、检查类型并构建 Astro，不需要上传源码或 `node_modules`。`.env` 和本地数据库不会打进镜像。

先确认构建成功，再执行导出和上传。这里先导出 tar，成功后才压缩，避免导出失败却生成无效的 gzip 文件。

## 7. 首次部署：上传数据库

当前没有初始化迁移脚本，首次部署使用本地已有数据库的备份。**只在第一次部署执行，不要覆盖已上线的数据库。**

在本地项目根目录执行（需要已有项目依赖）：

```bash
node --env-file=.env --input-type=module <<'NODE'
import Database from 'better-sqlite3';
const db = new Database(process.env.DATABASE_PATH, { readonly: true });
await db.backup('/tmp/shining-star-app.db');
db.close();
NODE

scp /tmp/shining-star-app.db ubuntu@124.222.10.61:/srv/shining-star/initial.db
```

然后在服务器执行。`test` 用于防止误覆盖已有数据库；若数据库已存在，应跳过此步骤：

```bash
test ! -e /var/lib/invitation/app.db && sudo install -o 1000 -g 1000 -m 640 \
  /srv/shining-star/initial.db /var/lib/invitation/app.db

sudo sqlite3 /var/lib/invitation/app.db 'SELECT slug, status FROM invitations;'
rm /srv/shining-star/initial.db
```

## 8. 在服务器启动应用

```bash
cd /srv/shining-star
sudo docker load -i shining-star-image.tar.gz

nano .env.production
```

文件中填写（替换域名）：

```dotenv
SITE_URL=https://invite.example.com
```

其余运行变量由 `compose.yaml` 设置：容器内监听 `0.0.0.0:4321`，只映射到宿主机 `127.0.0.1:4321`；数据库 `/data/app.db` 对应宿主机 `/var/lib/invitation/app.db`。

```bash
chmod 600 .env.production
sudo docker compose config --quiet
sudo docker compose up -d
sudo docker compose ps

curl -I http://127.0.0.1:4321/lin-yu-7k2m
```

示例请柬应返回 `200`；如果使用其他数据，换成数据库里已发布的 slug。容器会自动重启，并限制日志大小。

## 9. 在服务器启用 Nginx 缓存和 HTTPS

本节使用 Certbot 申请证书；如果已经下载 `minviation.cloud` 的证书文件，改为执行第 12 节，不需要再申请证书。

```bash
cd /srv/shining-star
nano nginx.conf
```

把文件中的 `invite.example.com` 改成真实域名，再执行：

```bash
sudo install -d -o www-data -g www-data /var/cache/nginx/shining-star
sudo cp nginx.conf /etc/nginx/sites-available/shining-star
sudo ln -sfn /etc/nginx/sites-available/shining-star /etc/nginx/sites-enabled/shining-star
sudo nginx -t && sudo systemctl reload nginx

# 域名解析生效、80/443 端口放行后执行。
sudo certbot --nginx -d invite.example.com --redirect
sudo certbot renew --dry-run
```

连续请求两次查看缓存：

```bash
curl -I https://invite.example.com/lin-yu-7k2m
curl -I https://invite.example.com/lin-yu-7k2m
```

第一次通常显示 `X-Cache: MISS`，第二次显示 `X-Cache: HIT`。已发布请柬缓存 60 秒，不同 slug 分别缓存；错误页及带查询参数、Cookie 或 Authorization 的请求不缓存。修改数据或更新页面后，最多等待约 60 秒生效。

## 10. 后续更新与常用命令

在本地重复第 6 步的镜像构建和镜像上传命令；无需再次传数据库。只更新应用时也无需重新安装 Nginx 配置或申请证书。

在服务器执行：

```bash
cd /srv/shining-star
sudo docker load -i shining-star-image.tar.gz
sudo docker compose up -d --force-recreate
sudo docker compose ps
```

查看日志、重启或停止：

```bash
sudo docker compose logs --tail=100 -f app
sudo docker compose restart app
sudo docker compose down
```

停止或替换容器不会删除 `/var/lib/invitation` 的数据库。上线后定期备份，可在服务器执行以下命令（每次使用不同的备份文件名）：

```bash
sudo install -d -m 700 /var/backups/shining-star
sudo sqlite3 /var/lib/invitation/app.db ".backup '/var/backups/shining-star/app-$(date +%Y%m%d-%H%M%S).db'"
```

## 11. 构建失败时

若在 `apt-get install` 阶段报 `Unable to fetch some archives`，先看前面的 `Failed to fetch` 原因。`Unable to connect`、超时或 DNS 错误表示构建容器访问软件源失败；应检查本机网络及 Docker Desktop 的代理配置后重试。宿主机是 Mac，构建镜像内部是 Debian，不需要在 Mac 执行 `apt-get`。

在本地项目根目录重新执行（按服务器架构调整 platform）：

```bash
docker buildx build --platform linux/amd64 --load --progress=plain -t shining-star:latest .
```

构建成功后，再执行第 6 步的导出和上传命令。失败时不要继续导出；`No such image: shining-star:latest` 表示镜像尚未构建成功。`--progress=plain` 可以显示具体下载错误，重试会复用已成功的构建步骤。

## 12. 使用已下载的 minviation.cloud 证书

上传本地的 `minviation.cloud_nginx.zip`，在服务器解压后安装其中的 `.crt` 和 `.key`；`.pem` 和 `.csr` 不参与 Nginx 配置。证书覆盖 `minviation.cloud` 与 `www.minviation.cloud`。

先确认域名 A 记录指向 `124.222.10.61`，服务器安全组和已启用的防火墙允许 TCP 80、443。

### 在 Mac 本地终端上传

下面假设 SSH 用户是 ubuntu；如果使用其他账号，请替换用户名。

```bash
chmod 600 /Users/zj/Downloads/minviation.cloud_nginx.zip

scp /Users/zj/Downloads/minviation.cloud_nginx.zip \
  /Users/zj/my_code/shining-star/deploy/nginx-https.conf \
  ubuntu@124.222.10.61:/srv/shining-star/
```

此命令一次上传证书 ZIP 和 Nginx 配置，不需要逐个上传证书文件。

### 在服务器安装并启用

```bash
cd /srv/shining-star

sudo apt install -y unzip
chmod 600 minviation.cloud_nginx.zip
install -d -m 700 cert-upload
unzip -o minviation.cloud_nginx.zip -d cert-upload

sudo install -d -o root -g root -m 700 /etc/nginx/ssl/minviation.cloud
sudo install -o root -g root -m 644 \
  cert-upload/minviation.cloud_nginx/minviation.cloud_bundle.crt \
  /etc/nginx/ssl/minviation.cloud/
sudo install -o root -g root -m 600 \
  cert-upload/minviation.cloud_nginx/minviation.cloud.key \
  /etc/nginx/ssl/minviation.cloud/

sudo install -d -o www-data -g www-data /var/cache/nginx/shining-star

# 备份现有站点配置；备份文件放在 sites-enabled 目录之外。
sudo cp /etc/nginx/sites-available/shining-star "/etc/nginx/sites-available/shining-star.bak-$(date +%Y%m%d-%H%M%S)"

# 替换原站点，保留页面缓存，并添加 HTTPS 和 HTTP 跳转。
sudo cp nginx-https.conf /etc/nginx/sites-available/shining-star
sudo ln -sfn /etc/nginx/sites-available/shining-star /etc/nginx/sites-enabled/shining-star
sudo nginx -t && sudo systemctl reload nginx
```

`nginx -t` 成功后才会重新加载。如果报错，请先处理报错，不要继续后面的步骤。

更新应用站点地址：

```bash
cd /srv/shining-star
nano .env.production
```

把 SITE_URL 设置为：

```dotenv
SITE_URL=https://minviation.cloud
```

保存后执行：

```bash
sudo docker compose up -d --force-recreate
curl -I https://minviation.cloud/lin-yu-7k2m
```

用浏览器访问 `https://minviation.cloud/lin-yu-7k2m`。若返回 502，再检查 `sudo docker compose ps -a` 和 `sudo docker compose logs --tail=50 app`。

此证书在北京时间 2027 年 2 月 16 日到期，需在到期前续签并替换 `.crt`、`.key` 文件，然后检查并重新加载 Nginx。手动安装的证书不会由之前安装的 Certbot 自动续期。

参考：[Docker 安装](https://docs.docker.com/engine/install/ubuntu/)、[跨平台镜像构建](https://docs.docker.com/build/building/multi-platform/)、[Compose 配置](https://docs.docker.com/reference/compose-file/services/)、[Astro Node 部署](https://docs.astro.build/en/guides/integrations-guide/node/)、[Nginx 缓存](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_cache)、[Nginx HTTPS 证书配置](https://nginx.org/en/docs/http/configuring_https_servers.html)。
