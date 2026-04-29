# 新服务器迁移实录（2026-04-29）

> **本文件作用：** 记录从旧服务器（122.51.29.69）迁移到新服务器（124.220.19.21）的完整步骤，包含与旧流程的对比和修复项。与 `deployment.md`（旧服务器部署实录）平级。

## 服务器对比

| 项目 | 旧服务器 | 新服务器 |
|------|---------|---------|
| 公网 IP | `122.51.29.69` | `124.220.19.21` |
| 配置 | 1核2G | **4核4G** |
| 系统 | Debian | Debian |
| 数据库 | MariaDB | MariaDB |
| 域名 | cptodo.top（未备案） | cptodo.top（未备案） |
| 部署脚本 | `deploy-react.sh` | `deploy-react-new.sh` |
| 后端目录 | `/root/todo/`（文件散落） | `/root/todo/backend/`（已修复） |
| 状态 | 运行中 | 迁移中 |

---

## 与旧流程的差异说明

| 步骤 | 旧流程 | 新流程 | 原因 |
|------|--------|--------|------|
| 后端目录 | `/root/todo/` 文件散落 | `/root/todo/backend/` 正确嵌套 | 修复早期 scp 路径问题 |
| 部署脚本 | `deploy-react.sh` | `deploy-react-new.sh` | 旧服务器未弃用，保留原脚本 |
| 数据库 | 全新安装 | 从旧服务器迁移 | 保留现有数据 |
| Nginx server_name | `122.51.29.69` | `cptodo.top` | 使用域名 |
| 初始目录 | 新建 `/root/todo/` | 新建 `/root/todo/backend/` | 后端文件正确归位 |

---

## 第一步：SSH 连接新服务器

**在哪里执行：** 本地终端

```bash
ssh root@124.220.19.21
```

---

## 第二步：安装 Node.js 20

**在哪里执行：** 服务器终端

```bash
apt update
```

> **目的：** 更新软件源列表。

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
```

> **目的：** 从 Node.js 官方源拉取安装脚本并执行。不执行这步直接 `apt install nodejs` 会装到很旧的版本（v12）。

```bash
apt install -y nodejs
```

> **目的：** 安装 Node.js（包含 npm）。

```bash
node -v && npm -v
```

> **目的：** 验证安装成功，应输出版本号。

---

## 第三步：安装 MariaDB

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

> **目的：** 创建专用数据库账号。`%` 表示允许从任何 IP 连接。

```sql
GRANT ALL PRIVILEGES ON todo_app.* TO 'todo_user'@'%';
```

> **目的：** 给 todo_user 对 todo_app 数据库的全部权限。

```sql
FLUSH PRIVILEGES;
EXIT;
```

> **目的：** 让权限设置立即生效。

---

## 第五步：配置 MariaDB 允许远程连接

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

---

## 第六步：从旧服务器迁移数据库

**在哪里执行：** 本地终端 + 服务器终端

### 6.1 从旧服务器导出

**先 SSH 登录旧服务器：**
```bash
ssh root@122.51.29.69
```

**在旧服务器上执行：**
```bash
mysqldump -u root -p todo_app > /tmp/todo_app_backup.sql
```

> **目的：** 导出数据库。输入数据库 root 密码后自动完成。
> **为什么不能用 ssh "mysqldump -u root -p ..."：** 密码提示在远程服务器上，本地终端看不到，会导致命令卡住或失败。需要先 SSH 登录再执行。

**验证导出成功：**
```bash
ls -lh /tmp/todo_app_backup.sql
```

**退出旧服务器：**
```bash
exit
```

### 6.2 下载到本地

**在本地终端执行：**
```bash
scp root@122.51.29.69:/tmp/todo_app_backup.sql ./
```

### 6.3 上传到新服务器

**在本地终端执行：**
```bash
scp todo_app_backup.sql root@124.220.19.21:/tmp/
```

### 6.4 导入到新服务器

**先 SSH 登录新服务器：**
```bash
ssh root@124.220.19.21
```

**在新服务器上执行：**
```bash
mysql -u root -p todo_app < /tmp/todo_app_backup.sql
```

> **注意：** 如果新服务器已有同名表，先清空：`mysql -u root -p -e "DROP DATABASE todo_app; CREATE DATABASE todo_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"`

**退出新服务器：**
```bash
exit
```

### 6.5 用 DBeaver 验证

连接新服务器 IP（124.220.19.21），检查数据是否完整。

---

## 第七步：安装 Nginx 并配置

**在哪里执行：** 服务器终端

```bash
apt install -y nginx
```

### 创建项目目录

```bash
mkdir -p /var/www/todo
mkdir -p /root/todo/backend
```

> **目的：** 提前创建目录，避免 scp 路径散落问题（旧服务器踩过的坑）。

### 编写 Nginx 配置

```bash
nano /etc/nginx/sites-available/todo
```

写入：

```nginx
server {
    listen 80;
    server_name cptodo.top 124.220.19.21;

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

> **与旧流程差异：** `server_name` 从 `122.51.29.69` 改为 `cptodo.top 124.220.19.21`（域名+IP，域名未备案时仍可通过 IP 访问）。

### 启用配置

```bash
ln -s /etc/nginx/sites-available/todo /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
```

---

## 第八步：安装 PM2

**在哪里执行：** 服务器终端

```bash
npm install -g pm2
```

---

## 第九步：部署代码

**在哪里执行：** 本地终端 + 服务器终端

### 9.1 执行部署脚本

**在本地终端执行：**
```bash
bash D:/SELF/self-project/CPToDo/deploy-react-new.sh
```

> **与旧流程差异：** 使用 `deploy-react-new.sh`（新服务器专用），后端文件上传到 `/root/todo/backend/` 而非 `/root/todo/`。

### 9.2 创建 .env 配置文件

**SSH 登录新服务器：**
```bash
ssh root@124.220.19.21
```

**在新服务器上创建 .env：**
```bash
nano /root/todo/backend/.env
```

写入以下内容：

```env
# 数据库配置
DB_HOST=localhost
DB_USER=todo_user
DB_PASSWORD='TodoApp2026!'
DB_NAME=todo_app

# JWT 密钥
JWT_SECRET=your_jwt_secret_key_here

# 服务器配置
PORT=3000

# 邮箱 SMTP 配置（阿里云邮件推送）
EMAIL_HOST=smtpdm.aliyun.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=dp@cptodo.top
EMAIL_PASS=ALiYunsmtp1909
EMAIL_FROM=CPTodo <dp@cptodo.top>
```

> **为什么脚本不传 .env：** .env 包含密码等敏感信息，需要单独处理，避免泄露。

### 9.3 安装依赖并启动

```bash
cd /root/todo/backend
npm install
pm2 start src/app.js --name todo
pm2 save
```

---

## 第十步：开放 HTTP 端口

**在哪里操作：** 腾讯云控制台 → 安全组 → 添加入站规则

| 字段 | 值 |
|------|-----|
| 类型 | HTTP(80) |
| 来源 | 0.0.0.0/0 |
| 协议端口 | TCP:80 |
| 策略 | 允许 |

---

## 第十一步：测试访问

浏览器打开 **http://124.220.19.21**

1. 登录功能正常
2. 主界面显示正常
3. 创建任务/随笔
4. 浏览器 Console 无报错

---

## 新服务器目录结构（部署后）

```
/root/todo/
├── backend/           # 后端代码（已修复，不再散落）
│   ├── src/
│   ├── .env
│   ├── node_modules/
│   ├── package.json
│   └── server.js
└── .env               # 旧的残留（可忽略）

/var/www/todo/         # 前端静态文件（Nginx 目录）
├── index.html
└── assets/
```

> **与旧服务器对比：** 旧服务器后端文件散落在 `/root/todo/`，新服务器正确放在 `/root/todo/backend/`。

---

## 部署脚本对比

| 脚本 | 服务器 | 后端目录 | 状态 |
|------|--------|---------|------|
| `deploy-react.sh` | 旧（122.51.29.69） | `/root/todo/`（散落） | 运行中 |
| `deploy-react-new.sh` | 新（124.220.19.21） | `/root/todo/backend/`（正确） | 迁移中 |
