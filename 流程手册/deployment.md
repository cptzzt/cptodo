# 步骤 5：服务器部署实录

> **本文件作用：** 记录从零部署到腾讯云服务器的完整操作步骤，包括安装环境、配置数据库、Nginx 反向代理、日常部署命令。属于操作手册，每次重新部署或排查服务器问题时参考。底部包含我们踩过的 scp 路径坑等错误案例。

## 完成时间

2026-04-20

## 服务器信息

| 项目 | 值 |
|------|-----|
| 云厂商 | 腾讯云 |
| 公网 IP | 122.51.29.69 |
| 系统 | Debian |
| 配置 | 1核2G |

---

## 第一步：SSH 连接服务器

**在哪里执行：** 本地终端

```bash
ssh root@122.51.29.69
```

输入服务器密码后，提示符变为 `root@VM-0-16-debian:~#`，表示已连上服务器。

> **目的：** 远程控制服务器的命令行。后续所有标明"服务器终端"的命令都在这个提示符下执行。

---

## 第二步：安装 Node.js 20

**在哪里执行：** 服务器终端

```bash
apt update && apt install -y curl
```

> **目的：** 更新软件源列表，安装 curl（下载工具）。

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
```

> **目的：** 从 Node.js 官方源拉取安装脚本并执行，让系统知道从哪里下载新版本。不执行这步直接 `apt install nodejs` 会装到很旧的版本（v12）。

```bash
apt install -y nodejs
```

> **目的：** 安装 Node.js（包含 npm）。

```bash
node -v && npm -v
```

> **目的：** 验证安装成功，应输出版本号。

---

## 第三步：安装 MariaDB（MySQL 替代品）

**在哪里执行：** 服务器终端

```bash
apt install -y mariadb-server
```

> **目的：** 安装数据库。Debian 默认不含 MySQL，用 MariaDB 替代（协议和语法完全兼容）。

```bash
mysql --version
```

> **目的：** 验证安装成功。

### 安全初始化

```bash
mysql_secure_installation
```

按以下方式回答：

| 问题 | 回答 | 原因 |
|------|------|------|
| Switch to unix_socket authentication? | **n** | 需要密码验证才能远程连接 |
| Change the root password? | **Y** | 设置数据库 root 密码 |
| Remove anonymous users? | **y** | 删除匿名测试用户，更安全 |
| Disallow root login remotely? | **n** | 允许远程连接（DBeaver 需要用） |
| Remove test database? | **y** | 删除自带的测试库 |
| Reload privilege tables? | **y** | 让设置立即生效 |

> **不执行的后果：** 数据库处于不安全状态，任何人都可以无密码访问。

---

## 第四步：创建数据库和专用用户

**在哪里执行：** 服务器终端

```bash
mysql -u root -p
```

进入 MySQL 命令行后，逐行执行：

```sql
CREATE DATABASE todo_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

> **目的：** 创建项目的数据库，指定 utf8mb4 编码（支持中文和 emoji）。

```sql
CREATE USER 'todo_user'@'%' IDENTIFIED BY 'TodoApp2026!';
```

> **目的：** 创建专用数据库账号。`%` 表示允许从任何 IP 连接。不用 root 是为了限制权限 — 即使代码有漏洞，攻击者也只能操作这一个库。

```sql
GRANT ALL PRIVILEGES ON todo_app.* TO 'todo_user'@'%';
```

> **目的：** 给 todo_user 对 todo_app 数据库的全部权限。

```sql
FLUSH PRIVILEGES;
```

> **目的：** 让权限设置立即生效，不用重启数据库。

```sql
EXIT;
```

---

## 第五步：配置 MySQL 允许远程连接

**在哪里执行：** 服务器终端

```bash
nano /etc/mysql/mariadb.conf.d/50-server.cnf
```

找到 `bind-address = 127.0.0.1`，改为：

```
bind-address = 0.0.0.0
```

> **目的：** 默认只允许本机连接数据库。改为 0.0.0.0 后，外部 IP 也能连。
> **不执行的后果：** DBeaver 从本地远程连接会被拒绝。
> **nano 操作：** 方向键移动光标 → 改完 Ctrl+O 回车保存 → Ctrl+X 退出。

```bash
systemctl restart mysql
```

> **目的：** 重启数据库让配置生效。

### 开放安全组端口

**在哪里操作：** 腾讯云控制台 → 服务器 → 安全组/防火墙规则 → 添加入站规则

| 字段 | 值 |
|------|-----|
| 类型 | MySQL(3306) |
| 来源 | 0.0.0.0/0 |
| 协议端口 | TCP:3306 |
| 策略 | 允许 |

> **注意：** 新增一条规则，不要修改已有的规则。已有规则可能包含 SSH（22端口），改错会导致连不上服务器。
> **不执行的后果：** 即使数据库配了允许远程，外部请求也会被云平台防火墙拦住。

---

## 第六步：用 DBeaver 远程建表

**在哪里操作：** 本地 DBeaver

### 新建连接

| 字段 | 值 |
|------|-----|
| 数据库类型 | MariaDB |
| 主机 | 122.51.29.69 |
| 端口 | 3306 |
| 用户名 | todo_user |
| 密码 | TodoApp2026! |
| 数据库 | todo_app |

### 按顺序执行 SQL 文件

右键 `todo_app` → SQL 编辑器 → 打开文件 → 逐个执行：

| 顺序 | 文件 | 目的 |
|------|------|------|
| 1 | `database/init.sql` | 创建 users 和 tasks 表 |
| 2 | `database/02-add-due-date.sql` | tasks 表加 due_date 字段 |
| 3 | `database/03-tree-structure.sql` | 重建为 items 表（树形结构） |
| 4 | `database/04-add-no-prompt-flag.sql` | users 表加"不再提示"字段 |

> **注意：** 必须按顺序执行，后面的是基于前面的表结构修改的。

---

## 第七步：上传项目代码

**在哪里执行：** 本地终端（新窗口）

### 正确写法（目标路径必须明确指定）

```bash
scp -r D:/SELF/self-project/CPToDo/backend root@122.51.29.69:/root/todo/backend
```

```bash
scp -r D:/SELF/self-project/CPToDo/frontend root@122.51.29.69:/root/todo/frontend
```

> **目的：** 把后端和前端代码传到服务器。`scp` 是通过 SSH 传文件的命令。

### 错误案例（我们实际踩的坑）

```bash
# ❌ 错误写法
scp -r D:/SELF/self-project/CPToDo/backend root@122.51.29.69:/root/todo
scp -r D:/SELF/self-project/CPToDo/frontend root@122.51.29.69:/root/todo
```

**为什么会出错：** `scp -r 源文件夹 目标路径` 的行为取决于目标路径是否已存在：
- 目标路径**不存在** → scp 把目标路径当作新文件夹名，源文件夹的**内容**直接散在里面
- 目标路径**已存在** → scp 在里面创建以源文件夹**命名**的子目录

第一条命令执行时 `/root/todo` 不存在，所以 backend 的文件直接散落在 `/root/todo/` 里，没有创建 `/root/todo/backend/`。第二条命令时 `/root/todo` 已存在，所以正确创建了 `/root/todo/frontend/`。

**结果：** 后端文件散落在 `/root/todo/` 根目录，不影响功能但不整洁。

**教训：** scp 上传时，目标路径必须明确写到最终文件夹名，不要依赖 scp 自动创建。

### 注意事项

- `scp` 不看 `.gitignore`，会传所有文件（包括 `node_modules`、`.env`）
- `node_modules` 传上去只是浪费带宽和硬盘空间，不影响功能
- `.env` 会被传上去，但里面是**本地配置**，必须在服务器上手动改成服务器配置
- 更好的做法：先在服务器上创建目标文件夹 `mkdir -p /root/todo`，再用明确的路径上传

---

## 第八步：安装并配置 Nginx

**在哪里执行：** 服务器终端

```bash
apt install -y nginx
```

### 修改前端 API 地址

前端代码里的 `API_BASE` 从 `http://localhost:3000/api` 改为 `/api`（相对路径），这样不管部署到哪个 IP 都不用再改。

**在哪里执行：** 本地终端

```
scp D:/SELF/self-project/CPToDo/frontend/js/api.js root@122.51.29.69:/root/todo/frontend/js/api.js
```

### 编写 Nginx 配置

**在哪里执行：** 服务器终端

```bash
nano /etc/nginx/sites-available/todo
```

写入：

```nginx
server {
    listen 80;
    server_name 122.51.29.69;

    # 前端静态文件
    root /var/www/todo;
    index index.html;

    # 前端页面
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 反向代理
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

> **目的：** Nginx 监听 80 端口，访问网页返回前端文件，访问 `/api/` 转发给后端 3000 端口。
> **为什么不用 /root/todo/frontend/html：** `/root/` 目录只有 root 用户能进，Nginx 以 `www-data` 身份运行，读不到文件，会报 500。

启用配置并重启：

```bash
ln -s /etc/nginx/sites-available/todo /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx
```

> `nginx -t` 测试配置语法，输出 `syntax is ok` 才安全。

### 复制前端文件到 Nginx 可访问的位置

```bash
mkdir -p /var/www/todo
cp -r /root/todo/frontend/html/* /var/www/todo/
cp -r /root/todo/frontend/css /var/www/todo/
cp -r /root/todo/frontend/js /var/www/todo/
```

> **注意：** 必须把 html、css、js 三个目录都复制过去。HTML 里引用的是 `../css/style.css`，如果只复制 html，样式和脚本都会丢失。

---

## 第九步：后端持久运行

**在哪里执行：** 服务器终端

```bash
cd /root/todo && nohup node src/app.js > todo.log 2>&1 &
```

> **目的：** `nohup` 让进程在关闭终端后继续运行，`&` 放到后台，日志写入 `todo.log`。
> **不执行的后果：** 关掉 SSH 终端后端就停了，网站打不开。

验证：

```bash
curl http://localhost:3000/api/health
```

---

## 第十步：开放 HTTP 端口 + 测试访问

### 开放 80 端口

**在哪里操作：** 腾讯云控制台 → 安全组 → 添加入站规则

| 字段 | 值 |
|------|-----|
| 类型 | HTTP(80) |
| 来源 | 0.0.0.0/0 |
| 协议端口 | TCP:80 |
| 策略 | 允许 |

### 访问测试

浏览器打开 **http://122.51.29.69/login.html**

1. 注册账号
2. 登录
3. 添加目录、任务、展开折叠、拖拽

---

## 安全建议

- **3306 端口：** 建表完成后，删掉安全组的 3306 规则或限制来源 IP，避免暴力破解
- **数据库远程连接需要两步操作：** ① 服务器上改 `bind-address = 0.0.0.0` ② 安全组开放 3306，缺一不可
- **后端持久运行：** 已改用 pm2，服务器重启后会自动启动，不需要手动执行 nohup 命令

---

## 日常部署

改完代码后，**在本地终端**执行一条命令即可：

```
bash D:/SELF/self-project/CPToDo/deploy.sh
```

脚本会自动：
1. 上传前端 HTML/CSS/JS 到 Nginx 目录 `/var/www/todo/`
2. 上传后端代码到 `/root/todo/`
3. 通过 `pm2 restart todo` 重启后端

> `.env` 和 `node_modules` 不会被覆盖，只传代码文件。
