# CPToDo Docker 容器化教程

> 本文件记录了将 CPToDo 项目从"手动部署"迁移到"Docker 容器化部署"的完整过程。
> 每一步都标注了：**在哪里执行**、**执行什么命令**、**命令做了什么**、**涉及什么知识**。

---

## 目录

1. [Docker 是什么](#1-docker-是什么)
2. [项目架构分析](#2-项目架构分析)
3. [创建 Docker 文件](#3-创建-docker-文件)
4. [本地安装 Docker](#4-本地安装-docker)
5. [本地启动测试](#5-本地启动测试)
6. [服务器部署](#6-服务器部署)
7. [日常操作手册](#7-日常操作手册)

---

## 1. Docker 是什么

### 1.1 没有 Docker 时怎么部署

CPToDo 之前的部署流程：

```
1. 在本地 npm run build 编译前端
2. scp 上传前端 dist 文件到服务器的 /var/www/todo/
3. scp 上传后端源码到服务器的 /root/todo/backend/
4. SSH 登录服务器，npm install 安装依赖
5. pm2 restart todo 重启后端
6. 手动配置 Nginx（静态文件托管 + 反向代理）
7. 手动安装和管理 MariaDB
```

问题：换一台服务器，以上所有步骤重来一遍。漏了一步就跑不起来。

### 1.2 Docker 做了什么

Docker 把每个服务的**完整运行环境**打包成一个"镜像"（Image）。拿到任何装了 Docker 的机器上，一条命令就能启动所有服务。

```
docker compose up --build
```

这一条命令 = 自动下载镜像 + 编译前端 + 启动数据库 + 启动后端 + 启动 Nginx。

### 1.3 核心概念

| 概念 | 类比 | 说明 |
|------|------|------|
| **Image（镜像）** | 安装光盘 | 包含运行一个服务所需的所有东西（代码、依赖、配置） |
| **Container（容器）** | 运行中的程序 | 从镜像启动的实例，可以启动、停止、删除 |
| **Dockerfile** | 安装脚本 | 描述如何构建一个镜像的步骤 |
| **docker-compose.yml** | 编排计划 | 描述多个容器如何协同工作 |
| **Volume（卷）** | 外接硬盘 | 容器删除后数据还在，用于持久化数据库数据 |
| **Network（网络）** | 局域网 | 容器之间通过容器名互相访问的虚拟网络 |

### 1.4 CPToDo 的容器架构

```
docker-compose.yml
├── nginx 容器（对外暴露 80 和 443 端口）
│   ├── 托管前端静态文件（React 编译产物）
│   └── 反向代理 /api/ → backend 容器的 3000 端口
├── backend 容器（不对外暴露，只在容器网络内）
│   └── Node.js Express 后端，连接 db 容器的 3306 端口
└── db 容器（MariaDB，不对外暴露）
    └── 数据持久化到 Docker Volume
```

用户访问流程：浏览器 → nginx 容器（80/443 端口）→ 静态文件 or 转发到 backend → backend 连 db

---

## 2. 项目架构分析

在写 Docker 文件之前，需要先理解现有项目的结构。

### 2.1 当前目录结构（与 Docker 相关的部分）

```
CPToDo/
├── frontend/                # React 前端
│   ├── src/                 # 源码
│   ├── package.json         # 依赖清单
│   ├── vite.config.js       # Vite 构建配置
│   └── dist/                # 编译产物（npm run build 生成）
├── backend/                 # Node.js 后端
│   ├── src/                 # 源码（app.js 入口）
│   ├── package.json         # 依赖清单
│   └── .env                 # 环境变量（数据库密码、JWT 密钥等）
├── database/                # SQL 迁移文件
│   ├── init.sql             # 初始建表
│   ├── 02-add-due-date.sql  # 增量迁移
│   └── ...                  # 共 14 个迁移文件
├── deploy-react-new.sh      # 旧部署脚本（将废弃）
└── .gitignore
```

### 2.2 关键文件内容

**`backend/src/app.js`**（后端入口）：
- 监听端口 3000
- 通过 `dotenv` 读取 `.env` 环境变量
- 连接数据库：`process.env.DB_HOST`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`

**`backend/src/utils/db.js`**（数据库连接）：
```javascript
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',   // Docker 里要改成 db（容器名）
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
```

**`frontend/vite.config.js`**（前端构建）：
```javascript
server: {
  proxy: {
    '/api': 'http://localhost:3000',   // 本地开发时代理 /api 请求
  },
}
```

**`frontend/src/api.js`**（前端 API 地址）：
```javascript
// 原来的写法（硬编码完整 URL，不合理）
const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:3000/api'
  : 'https://cptodo.top/api';

// Docker 化后改为相对路径（由 Nginx/Vite 代理处理）
const isCapacitor = typeof window !== 'undefined' && !!window.Capacitor;
const API_BASE = isCapacitor
  ? 'https://cptodo.top/api'   // Capacitor 移动端用完整 URL
  : '/api';                     // Web 端用相对路径
```

### 2.3 为什么要改 API 地址为相对路径 `/api`

**浏览器请求 `/api/users/login` 时发生了什么：**

1. 浏览器发现这是相对路径（不是完整 URL），自动拼上当前页面的协议+域名+端口
2. 如果页面在 `http://localhost:5173` → 请求变成 `http://localhost:5173/api/users/login` → 到达 Vite 开发服务器 → Vite 的 proxy 配置转发给 `localhost:3000`
3. 如果页面在 `https://cptodo.top` → 请求变成 `https://cptodo.top/api/users/login` → 到达 Nginx → Nginx 转发给 backend 容器

**对比原来的硬编码写法：**
- `http://localhost:3000/api` → 完整 URL，浏览器直接发给 3000 端口，绕过 Vite 代理（Vite proxy 等于白写了）
- Docker 本地测试时 3000 端口不对外暴露，直接失败

**结论：** 相对路径 `/api` 在本地开发（Vite 代理）和生产环境（Nginx 代理）都能工作，是最简洁的写法。

---

## 3. 创建 Docker 文件

**执行位置：** 本地项目根目录 `D:\SELF\self-project\CPToDo`

**前置条件：** 在 `feature/capacitor-android` 分支基础上切新分支

```bash
git checkout -b feature/docker
```

### 3.1 backend/Dockerfile

**目的：** 把 Node.js 后端打包成 Docker 镜像

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY src ./src

EXPOSE 3000

CMD ["node", "src/app.js"]
```

**逐行解释：**

| 行 | 含义 |
|---|------|
| `FROM node:20-alpine` | 基于 Node.js 20 的精简版 Linux 镜像。alpine 版本体积小（约 50MB），适合生产环境 |
| `WORKDIR /app` | 在容器内创建 `/app` 目录并设为工作目录，后续命令都在这个目录下执行 |
| `COPY package*.json ./` | 只复制 package.json 和 package-lock.json。先复制这两个文件而不是全部代码，是为了利用 Docker 的缓存机制 |
| `RUN npm install --production` | 安装生产依赖（跳过 devDependencies）。`--production` 是旧写法，新写法是 `--omit=dev` |
| `COPY src ./src` | 复制后端源码 |
| `EXPOSE 3000` | 声明容器监听 3000 端口（仅文档作用，实际端口映射在 docker-compose.yml 中配置） |
| `CMD ["node", "src/app.js"]` | 容器启动时执行的命令 |

**知识点：Docker 缓存机制**

Docker 构建镜像时，每一层都有缓存。如果 `package.json` 没变，`npm install` 那一层就直接用缓存，不会重新安装。所以先 COPY package.json → npm install → 再 COPY 源码。如果反过来（先复制所有代码），每次改一行代码都要重新 npm install。

### 3.2 backend/.dockerignore

**目的：** 告诉 Docker 构建时哪些文件不要复制进镜像

```
node_modules
.env
```

**为什么要排除 node_modules：** `npm install` 会在容器内重新安装依赖，不需要把本地的 node_modules 复制进去。而且本地是 Windows，容器是 Linux，二进制文件不兼容。

**为什么要排除 .env：** 环境变量通过 docker-compose.yml 注入，不应该打包进镜像（安全原因）。

**知识点：.dockerignore vs .gitignore**

| 文件 | 谁在读 | 什么时候生效 |
|------|--------|------------|
| `.gitignore` | git | `git add` / `git commit` 时，决定哪些文件不纳入版本控制 |
| `.dockerignore` | Docker | `docker build` 时，决定哪些文件不进入构建上下文 |

两者互相独立。一个文件可能被 git 追踪但被 Docker 忽略，也可能被 git 忽略但被 Docker 包含。

### 3.3 frontend/Dockerfile

**目的：** 多阶段构建 — 先编译 React，再交给 Nginx 托管

```dockerfile
# 阶段1：构建 React
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 阶段2：Nginx 托管
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
```

**逐行解释：**

| 行 | 含义 |
|---|------|
| `FROM node:20-alpine AS build` | 第一阶段，命名为 `build`。用于编译 React 代码 |
| `COPY . .` | 复制前端所有源码到容器 |
| `RUN npm run build` | 在容器内执行 `vite build`，编译 React，输出到 `/app/dist/` |
| `FROM nginx:alpine` | 第二阶段，全新的基础镜像，不包含第一阶段的东西 |
| `COPY --from=build /app/dist ...` | 从第一阶段（`build`）复制编译产物到 Nginx 的静态文件目录 |
| `COPY nginx.conf ...` | 复制自定义的 Nginx 配置 |

**知识点：多阶段构建**

最终镜像只包含第二阶段的东西（Nginx + 静态文件），不包含 Node.js、源码、node_modules。镜像体积从几百 MB 降到约 25MB。

如果没有多阶段构建，最终镜像会包含 Node.js 运行环境 + 全部源码 + node_modules，体积大而且不安全。

### 3.4 frontend/nginx.conf

**目的：** Docker 容器内 Nginx 的配置（本地开发用，HTTP only）

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # 前端路由 - SPA 回退到 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理到 backend 容器
    location /api/ {
        proxy_pass http://backend:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**关键点：**

- `server_name _` — 匹配任何域名/IP
- `try_files $uri $uri/ /index.html` — SPA 应用的关键配置。React 是单页应用，所有路由都由前端 JS 处理，所以任何 URL 都要返回 index.html
- `proxy_pass http://backend:3000` — 这里的 `backend` 不是域名，是 Docker 容器的名称。Docker 内部网络中，容器名就是主机名

**知识点：为什么用容器名而不是 localhost**

在 Docker 中，每个容器有自己独立的网络环境。`localhost` 在容器内指的是容器自己，不是宿主机。容器之间通过 Docker Network 通信，使用容器名（即 docker-compose.yml 中的 service 名称）作为主机名。

### 3.5 frontend/nginx-ssl.conf

**目的：** 服务器的 Nginx 配置（支持 HTTPS），通过 volume 挂载覆盖 nginx.conf

```nginx
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name _;

    ssl_certificate /etc/nginx/ssl/cptodo.top.pem;
    ssl_certificate_key /etc/nginx/ssl/cptodo.top.key;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**与 nginx.conf 的区别：**
- 多了一个 80 端口的 server 块，把所有 HTTP 请求 301 跳转到 HTTPS
- 443 端口的 server 块配置了 SSL 证书路径
- 证书从宿主机的 `/etc/nginx/ssl/` 目录挂载进容器
- 多了 `X-Forwarded-Proto` 头，告诉后端原始请求是 HTTP 还是 HTTPS

### 3.6 frontend/.dockerignore

```
node_modules
dist
android
```

排除说明：
- `node_modules` — 容器内 npm install 会重新安装
- `dist` — 容器内 npm run build 会重新生成
- `android` — Capacitor 的 Android 项目文件，Nginx 不需要

### 3.7 docker-compose.yml（基础配置）

**目的：** 定义三个容器的基础配置（不含端口和 SSL，由环境专属文件补充）

```yaml
services:
  nginx:
    build: ./frontend
    depends_on:
      - backend
    restart: unless-stopped

  backend:
    build: ./backend
    environment:
      - DB_HOST=db
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_NAME=${DB_NAME}
      - JWT_SECRET=${JWT_SECRET}
      - PORT=3000
      - EMAIL_HOST=${EMAIL_HOST}
      - EMAIL_PORT=${EMAIL_PORT}
      - EMAIL_SECURE=${EMAIL_SECURE}
      - EMAIL_USER=${EMAIL_USER}
      - EMAIL_PASS=${EMAIL_PASS}
      - EMAIL_FROM=${EMAIL_FROM}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: mariadb:10.11
    environment:
      - MYSQL_ROOT_PASSWORD=${DB_PASSWORD}
      - MYSQL_DATABASE=${DB_NAME}
      - MYSQL_USER=${DB_USER}
      - MYSQL_PASSWORD=${DB_PASSWORD}
    volumes:
      - db_data:/var/lib/mysql
      - ./database/docker-init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 5s
      timeout: 3s
      retries: 10
    restart: unless-stopped

volumes:
  db_data:
```

**逐段解释：**

**`services` 下的三个服务：** nginx、backend、db，分别对应三个容器。

**`build: ./frontend` vs `image: mariadb:10.11`：**
- `build` — 从本地 Dockerfile 构建镜像
- `image` — 直接从 Docker Hub 拉取现成镜像

**`environment` 中的 `${DB_USER}`：**
- 从同目录的 `.env` 文件读取变量值
- `DB_HOST=db` 写死为 `db`（MariaDB 容器的名称），不从 .env 读取

**`depends_on`：**
- nginx 依赖 backend（先启动 backend）
- backend 依赖 db，且 `condition: service_healthy`（等数据库健康检查通过后才启动）
- 这确保了启动顺序：db → backend → nginx

**`volumes`：**
- `db_data:/var/lib/mysql` — Docker 管理的命名卷，数据库数据持久化。容器删了数据还在
- `./database/docker-init.sql:/docker-entrypoint-initdb.d/init.sql` — 把建表 SQL 挂载进容器。MariaDB 首次启动时会自动执行这个目录下的 `.sql` 文件

**`healthcheck`：**
- 每 5 秒检查一次 MariaDB 是否健康
- 最多重试 10 次
- backend 通过 `condition: service_healthy` 等待这个检查通过

**`restart: unless-stopped`：**
- 容器崩溃时自动重启
- 除非你手动 `docker compose stop` 了

**`volumes:` （顶层）：**
- 声明 `db_data` 这个命名卷。如果不声明，docker compose 会报错

**知识点：MYSQL_USER 不能填 root**

MariaDB 的 Docker 镜像在初始化时会自动创建 root 用户（通过 `MYSQL_ROOT_PASSWORD`）。如果 `MYSQL_USER` 也填 `root`，就会出现"CREATE USER failed for root"错误，因为 root 已经存在了。所以 `MYSQL_USER` 必须填一个普通用户名（如 `todo_user`）。

### 3.8 docker-compose.prod.yml（服务器配置）

```yaml
services:
  nginx:
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /etc/nginx/ssl:/etc/nginx/ssl:ro
      - ./frontend/nginx-ssl.conf:/etc/nginx/conf.d/default.conf:ro
```

**逐行解释：**

- `ports: "80:80"` — 宿主机 80 端口映射到容器 80 端口（HTTP）
- `ports: "443:443"` — 宿主机 443 端口映射到容器 443 端口（HTTPS）
- `/etc/nginx/ssl:/etc/nginx/ssl:ro` — 把服务器上的 SSL 证书目录挂载进容器。`:ro` 表示只读
- `./frontend/nginx-ssl.conf:...:ro` — 用 HTTPS 版的 nginx 配置覆盖镜像内的 HTTP 版

### 3.9 docker-compose.override.yml（本地配置）

```yaml
services:
  nginx:
    ports:
      - "127.0.0.1:8888:80"
```

**解释：**
- `127.0.0.1:8888:80` — 只绑定本机回环地址的 8888 端口，映射到容器 80 端口
- 不加 `127.0.0.1` 前缀的话，默认绑定所有网卡（0.0.0.0），同局域网的人能通过你的 192.168.x.x 访问
- 这个文件加入 `.gitignore`，只存在于本地，不会推送到服务器

**知识点：Docker Compose 文件合并规则**

执行 `docker compose up` 时，自动读取当前目录下的：
1. `docker-compose.yml`（必须存在）
2. `docker-compose.override.yml`（如果存在，自动合并）

合并规则：
- 相同 service 的配置合并
- `ports` 和 `volumes` 列表是追加（不是替换）
- 所以基础文件不能放端口配置，否则本地和服务器都会暴露

服务器启动时用 `-f` 指定文件，跳过 override：
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 3.10 database/docker-init.sql

**目的：** MariaDB 容器首次启动时自动执行，创建所有表

这个文件是从 14 个增量迁移文件（`init.sql` → `02-add-due-date.sql` → ... → `14-add-show-early.sql`）合并而成的最终表结构。

**为什么不能直接用原始迁移文件：** 原始迁移文件包含数据迁移语句（如"把旧 tasks 表的数据搬到新 items 表"），假设已有数据存在。空数据库上执行会报错。合并后的文件只包含 CREATE TABLE，适合从零开始。

**挂载位置：** docker-compose.yml 中的 `./database/docker-init.sql:/docker-entrypoint-initdb.d/init.sql`

**注意：** 这个 SQL 只在 Volume 为空时（首次启动）执行。如果 Volume 已有数据，不会重复执行。

### 3.11 .env.example

**目的：** 环境变量模板，提交到 git，告诉其他人需要配置哪些变量

```
DB_USER=todo_user
DB_PASSWORD=your_password_here
DB_NAME=todo_app
JWT_SECRET=your_jwt_secret_key_here
EMAIL_HOST=smtp.example.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_email_password
EMAIL_FROM=YourApp <your_email@example.com>
```

### 3.12 .env（不提交 git）

**本地 `.env`（项目根目录，给 docker-compose 读）：**

```
DB_HOST=db
DB_USER=todo_user
DB_PASSWORD=实际密码
DB_NAME=todo_app
JWT_SECRET=实际密钥
...
```

**注意 `DB_HOST=db`：** docker-compose 里 MariaDB 的 service 名称是 `db`，容器间通过这个名字通信。

**本地 `backend/.env`（给直接 npm start 时用）：**

```
DB_HOST=localhost
DB_USER=todo_user
...
```

**两个 .env 的关系：**

| 文件 | 谁在读 | 什么时候用 |
|------|--------|-----------|
| `backend/.env` | Node.js 的 dotenv 模块 | 本地 `npm start` 直接跑后端时 |
| 项目根目录 `.env` | docker-compose | `docker compose up` 时 |

Docker 环境下，后端容器的环境变量通过 docker-compose.yml 的 `environment:` 注入，不读 backend/.env。

### 3.13 .gitignore 补充

在原有 `.gitignore` 基础上增加：

```
.env
docker-compose.override.yml
```

- `.env` — 不提交敏感信息（密码、密钥）
- `docker-compose.override.yml` — 本地专属配置，不推到服务器

---

## 4. 本地安装 Docker

### 4.1 下载安装

**执行位置：** 本地 Windows 电脑

1. 打开 https://www.docker.com/products/docker-desktop/
2. 点击 "Download for Windows" 下载安装包
3. 运行安装包，需要开启 WSL2（安装程序会提示）
4. 安装完成后重启电脑

### 4.2 验证安装

**执行位置：** VS Code 终端（或任何终端）

```bash
docker --version
docker compose version
```

**预期输出类似：**
```
Docker version 29.4.3
Docker Compose version v5.1.3
```

### 4.3 配置镜像加速（国内必须）

国内访问 Docker Hub 很慢或无法访问，需要配置镜像源。

**执行位置：** Docker Desktop 界面

1. 打开 Docker Desktop
2. 点击右上角齿轮图标 → **Settings**
3. 左侧选 **Docker Engine**
4. 在 JSON 配置中加入 `registry-mirrors`：

```json
{
  "builder": {
    "gc": {
      "defaultKeepStorage": "20GB",
      "enabled": true
    }
  },
  "experimental": false,
  "registry-mirrors": [
    "https://docker.1ms.run"
  ]
}
```

5. 点击 **Apply & Restart**，等待 Docker 重启完成

**知识点：** `registry-mirrors` 是 Docker Hub 的镜像站。Docker 拉取镜像时，会先尝试从镜像站拉，拉不到再从 Docker Hub 拉。

---

## 5. 本地启动测试

### 5.1 创建根目录 .env 文件

**执行位置：** 项目根目录 `D:\SELF\self-project\CPToDo`

从 `backend/.env` 复制一份，修改 `DB_HOST`：

```
DB_HOST=db          # 改为 db（Docker 容器名），原来可能是 localhost
DB_USER=todo_user   # 不能填 root，否则 MariaDB 初始化会报错
DB_PASSWORD=你的密码
DB_NAME=todo_app
JWT_SECRET=你的密钥
PORT=3000
EMAIL_HOST=smtpdm.aliyun.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=dp@cptodo.top
EMAIL_PASS=你的邮箱密码
EMAIL_FROM=CPTodo <dp@cptodo.top>
```

### 5.2 启动容器

**执行位置：** 项目根目录

```bash
docker compose up --build
```

**这个过程做了什么：**

1. 拉取 `node:20-alpine`、`nginx:alpine`、`mariadb:10.11` 三个基础镜像（第一次需要几分钟）
2. 构建 backend 镜像：npm install → 复制源码
3. 构建 frontend 镜像：npm install → npm run build → 复制 dist 到 nginx
4. 创建 Docker Network（`cptodo_default`）
5. 创建 Docker Volume（`cptodo_db_data`）
6. 启动 db 容器 → 等待健康检查通过 → 执行 docker-init.sql 建表
7. 启动 backend 容器 → 连接数据库
8. 启动 nginx 容器 → 暴露端口

**不加 `-d` 的效果：** 终端会实时显示三个容器的日志输出，按 `Ctrl+C` 可以停止所有容器。

**加 `-d` 的效果（后台运行）：** 容器在后台运行，终端可以继续执行其他命令。

### 5.3 验证

浏览器打开 `http://localhost:8888`，应该能看到登录页面。

注册一个新账号，测试增删改查是否正常。

### 5.4 查看状态

**执行位置：** 任何目录（这些是 Docker 全局命令）

```bash
docker images       # 查看本地所有镜像
docker ps           # 查看正在运行的容器
docker volume ls    # 查看所有数据卷
docker compose logs # 查看容器日志（需要在项目目录下）
docker stats        # 实时查看容器资源占用
```

### 5.5 停止容器

**执行位置：** 项目根目录

```bash
docker compose down       # 停止并删除容器（数据卷保留）
docker compose down -v    # 停止并删除容器和数据卷（数据库数据会丢失！）
```

---

## 6. 服务器部署

以下操作在腾讯云 Debian 服务器（124.220.19.21）上执行。

### 6.1 SSH 登录服务器

**执行位置：** 本地终端

```bash
ssh root@124.220.19.21
```

终端提示符变为 `root@VM-0-2-debian:~#` 表示已登录成功。

### 6.2 备份数据库（最重要，先做）

**执行位置：** 服务器

```bash
mysqldump -u root -p todo_app > /root/todo_app_backup.sql
```

输入数据库 root 密码。备份文件保存在 `/root/todo_app_backup.sql`。

**为什么先备份：** 后续操作会停掉 MariaDB。必须在数据库运行时才能导出数据。一旦停了就没法备份了。

**验证备份：**

```bash
ls -lh /root/todo_app_backup.sql
```

应该看到文件大小不为 0（本项目约 35KB）。

### 6.3 安装 Docker

**执行位置：** 服务器

国内无法直接用官方脚本，用阿里云镜像：

```bash
curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun
```

**验证安装：**

```bash
docker --version && docker compose version
```

### 6.4 配置 Docker 镜像加速

**执行位置：** 服务器

```bash
echo '{"registry-mirrors":["https://docker.1ms.run"]}' > /etc/docker/daemon.json && systemctl daemon-reload && systemctl restart docker
```

**这条命令做了什么：**
1. 写入镜像加速配置到 `/etc/docker/daemon.json`
2. `systemctl daemon-reload` — 重新加载 systemd 配置
3. `systemctl restart docker` — 重启 Docker 服务使配置生效

### 6.5 停掉旧服务

**执行位置：** 服务器

```bash
pm2 stop todo && pm2 delete todo
```
```bash
systemctl stop nginx && systemctl disable nginx
```
```bash
systemctl stop mariadb && systemctl disable mariadb
```

**为什么按这个顺序停：**
- PM2（后端）→ Nginx（反向代理）→ MariaDB（数据库）
- `stop` 是停止当前运行，`disable` 是禁止开机自启
- 旧服务不停的话，端口 80 和 3306 会被占用，Docker 容器启动不了

**注意：** 从这步开始网站暂时无法访问，直到 Docker 启动完成。

### 6.6 拉取项目代码

**执行位置：** 服务器

```bash
rm -rf /root/cptodo && git clone -b feature/docker https://github.com/cptzzt/cptodo.git /root/cptodo
```

**为什么用 git clone 而不是 scp：**
- git clone 只下载 git 追踪的文件，不会包含 `node_modules`、`.env` 等大文件或敏感文件
- 速度快，代码干净
- `-b feature/docker` 指定分支

### 6.7 创建服务器 .env 文件

**执行位置：** 服务器

```bash
nano /root/cptodo/.env
```

粘贴以下内容（使用服务器上的实际密码和密钥）：

```
DB_HOST=db
DB_USER=todo_user
DB_PASSWORD=服务器上的实际密码
DB_NAME=todo_app
JWT_SECRET=服务器上的实际JWT密钥
PORT=3000
EMAIL_HOST=smtpdm.aliyun.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=dp@cptodo.top
EMAIL_PASS=实际邮箱密码
EMAIL_FROM=CPTodo <dp@cptodo.top>
```

**注意：**
- 密码不加引号（Docker .env 文件中引号会被当作值的一部分）
- `DB_HOST=db` 必须是 `db`（docker-compose 里的 service 名称）
- `DB_USER` 不能填 `root`

**知识点：JWT_SECRET 是什么**

JWT_SECRET 是服务器用来生成和验证登录令牌的密钥。只有 `.env` 这一个地方配置，不需要在其他文件中同步。改了这个值，所有已登录用户的 token 会失效，需要重新登录。迁移数据时保持跟原来一样的值，老用户不用重新登录。

### 6.8 启动 Docker 容器

**执行位置：** 服务器 `/root/cptodo` 目录

```bash
cd /root/cptodo && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

**命令解释：**
- `-f docker-compose.yml` — 指定基础配置
- `-f docker-compose.prod.yml` — 追加生产环境配置（端口 80+443、SSL 证书）
- `up` — 创建并启动容器
- `-d` — 后台运行（不占用终端）
- `--build` — 重新构建镜像

**为什么服务器用 `-f` 指定文件：** 服务器上不存在 `docker-compose.override.yml`（被 gitignore 了），所以 `docker compose up` 不会暴露任何端口。必须显式指定 `docker-compose.prod.yml` 才能加上生产端口配置。

### 6.9 导入数据库

**执行位置：** 服务器（任何目录，因为用了绝对路径）

```bash
docker exec -i cptodo-db-1 mysql -u todo_user -p密码 todo_app < /root/todo_app_backup.sql
```

**注意：** `-p` 和密码之间没有空格，连在一起写。

**命令解释：**
- `docker exec -i` — 在容器内执行命令，`-i` 保持标准输入
- `cptodo-db-1` — 容器名称（用 `docker ps` 可以看到）
- `mysql -u todo_user -p密码 todo_app` — 用 todo_user 登录，选择 todo_app 数据库
- `< /root/todo_app_backup.sql` — 把备份文件的内容作为输入

**验证导入：**

```bash
docker exec cptodo-db-1 mysql -u todo_user -p密码 todo_app -e "SHOW TABLES;"
```

应该看到 `users`、`items`、`projects`、`tags` 等表。

### 6.10 最终验证

浏览器打开 `https://cptodo.top`，用原有账号登录，检查数据是否完整。

---

## 7. 日常操作手册

### 7.1 常用命令

**本地（在项目根目录执行）：**

```bash
docker compose up --build          # 启动（首次或改了代码）
docker compose up -d               # 后台启动
docker compose down                # 停止（数据保留）
docker compose down -v             # 停止并删除数据（慎用！）
docker compose logs                # 查看所有容器日志
docker compose logs backend        # 只看后端日志
docker compose logs -f             # 实时跟踪日志
docker ps                          # 查看运行中的容器
docker images                      # 查看所有镜像
```

**服务器（在 /root/cptodo 目录执行）：**

```bash
# 更新代码并重新部署
cd /root/cptodo && git pull && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 查看容器状态
docker ps

# 查看日志
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# 重启（不重新构建）
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart
```

### 7.2 更新部署流程对比

| 步骤 | 旧方式 | Docker 方式 |
|------|--------|------------|
| 1 | 本地 `npm run build` | 服务器上 `git pull` |
| 2 | `scp` 上传前端 dist | `docker compose ... up -d --build` |
| 3 | `scp` 上传后端 src | （自动在容器内编译） |
| 4 | `ssh` 进服务器 `npm install` | （自动在容器内安装） |
| 5 | `pm2 restart todo` | （自动重启容器） |
| 总计 | 5 步手动操作 | 2 条命令 |

### 7.3 数据持久化说明

Docker Volume `cptodo_db_data` 独立于容器存在：

- `docker compose down` — 容器删了，数据还在
- `docker compose down -v` — 容器和数据都删了（不要用！）
- `docker compose up -d` — 重新启动，数据自动恢复

### 7.4 端口映射速查

| 环境 | 端口映射 | 说明 |
|------|---------|------|
| 本地 | `127.0.0.1:8888 → 80` | 仅本机访问，HTTP |
| 服务器 | `80 → 80` + `443 → 443` | 对外提供 HTTP + HTTPS |

### 7.5 故障排查

**容器启动失败：**
```bash
docker compose logs          # 看日志找错误原因
docker compose logs backend  # 只看后端日志
```

**数据库连接失败：**
```bash
docker exec -it cptodo-db-1 mysql -u todo_user -p密码 -e "SELECT 1;"
```

**重新构建（清除缓存）：**
```bash
docker compose build --no-cache
```

**完全清理重来（会丢数据）：**
```bash
docker compose down -v
docker compose up -d --build
```
