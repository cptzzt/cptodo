# Docker 常用命令速查

> 本文件作用：记录本项目中用到的所有 Docker 命令，每条标注作用和执行位置。
> 不需要背命令，用的时候来查。

---

## 前置说明

| 概念 | 说明 |
|------|------|
| 项目根目录 | `D:\SELF\self-project\CPToDo`（本地）或 `/root/cptodo`（服务器） |
| `docker compose` 命令 | 必须在项目根目录下执行（因为要读 `docker-compose.yml`） |
| `docker` 全局命令 | 任何目录都能执行 |
| 本地启动命令 | `docker compose up -d`（自动合并 override.yml） |
| 服务器启动命令 | `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build` |

---

## 一、容器生命周期

### 启动容器

```bash
# 本地 — 启动并后台运行（自动读取 override.yml，端口 8888 + 3307）
docker compose up -d

# 本地 — 启动并重新构建镜像（改了后端/前端代码后必须加 --build）
docker compose up -d --build

# 服务器 — 启动并重新构建
cd /root/cptodo && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

**执行位置：** 项目根目录

**什么时候用 `--build`：** 改了后端代码（`backend/src/`）、前端代码（`frontend/src/`）、Dockerfile、nginx 配置后，必须加 `--build`。不加的话容器用的还是旧代码。

**什么时候不需要 `--build`：** 只改了 `.env` 文件，`docker compose up -d` 就行（环境变量会重新注入）。

### 停止容器

```bash
# 停止并删除容器（数据卷保留，数据库不丢）
docker compose down

# 停止并删除容器和数据卷（数据库会丢失！）
docker compose down -v
```

**执行位置：** 项目根目录

**注意：** `down -v` 几乎用不到，除非要彻底重来。

### 重启容器

```bash
# 本地
docker compose restart

# 服务器
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart
```

**执行位置：** 项目根目录

**适用场景：** 容器在跑但状态异常，想快速重启。不重新构建镜像。

---

## 二、查看状态

### 查看运行中的容器

```bash
docker ps
```

**执行位置：** 任何目录

**输出示例：**
```
CONTAINER ID   IMAGE          STATUS          PORTS                    NAMES
a1b2c3d4e5f6   cptodo-nginx   Up 2 hours      0.0.0.0:80->80/tcp      cptodo-nginx-1
b2c3d4e5f6a7   cptodo-backend Up 2 hours                               cptodo-backend-1
c3d4e5f6a7b8   mariadb:10.11  Up 2 hours      0.0.0.0:3306->3306/tcp  cptodo-db-1
```

**关键列：**
- STATUS — `Up` 表示运行中，`Exited` 表示已停止
- PORTS — 端口映射，能看到容器对外暴露了哪些端口
- NAMES — 容器名称，`docker exec` 等命令要用

### 查看所有容器（含已停止的）

```bash
docker ps -a
```

### 查看镜像

```bash
docker images
```

### 查看数据卷

```bash
docker volume ls
```

### 查看容器资源占用

```bash
docker stats
```

**按 `Ctrl+C` 退出。**

---

## 三、日志

### 查看日志

```bash
# 本地 — 查看所有容器日志
docker compose logs

# 本地 — 只看某个容器的日志
docker compose logs backend
docker compose logs nginx
docker compose logs db

# 实时跟踪日志（像 tail -f）
docker compose logs -f
docker compose logs -f backend

# 服务器 — 需要加 -f 指定配置文件
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f
```

**执行位置：** `docker compose logs` 系列命令在项目根目录；也可以用 `docker logs 容器名` 在任何目录执行。

### 查看最近 N 行日志

```bash
docker compose logs --tail 50 backend
```

---

## 四、在容器内执行命令

### 进入容器 shell

```bash
docker exec -it cptodo-backend-1 sh
docker exec -it cptodo-db-1 bash
```

**执行位置：** 任何目录

**说明：**
- `-it` — 交互模式，能输入命令
- backend 容器是 Alpine Linux，用 `sh` 不是 `bash`
- db 容器可以用 `bash`
- 容器名用 `docker ps` 查看
- 输入 `exit` 退出容器

### 在容器内执行单条命令（不进入 shell）

```bash
# 检查后端容器时区
docker exec cptodo-backend-1 date

# 检查数据库容器时区
docker exec cptodo-db-1 date

# 在数据库容器内执行 SQL
docker exec cptodo-db-1 mysql -u todo_user -p密码 todo_app -e "SHOW TABLES;"
```

---

## 五、数据库操作

### 执行 SQL 迁移文件

```bash
# 本地 — 在项目根目录执行，-T 保持标准输入
docker compose exec -T db mysql -u todo_user -p密码 todo_app < database/15-original-created-at.sql

# 服务器 — 用容器名执行
docker exec -i cptodo-db-1 mysql -u todo_user -p密码 todo_app < /root/todo_app_backup.sql
```

**执行位置：** 本地在项目根目录；服务器在任何目录（用绝对路径）

**注意：** `-p` 和密码之间没有空格。

### 连接数据库客户端

```bash
# 进入 MySQL 命令行
docker exec -it cptodo-db-1 mysql -u todo_user -p密码 todo_app
```

**本地用 DBeaver 连接：**
- 主机：`127.0.0.1`
- 端口：`3307`
- 用户名/密码：`.env` 里的 `DB_USER` / `DB_PASSWORD`

---

## 六、更新部署（服务器）

### 完整更新流程

```bash
cd /root/cptodo && git pull && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

**执行位置：** 服务器 `/root/cptodo` 目录

**这条命令做了什么：**
1. `git pull` — 拉取最新代码
2. `docker compose up -d --build` — 重新构建镜像并启动容器

### 只更新后端代码

如果只改了后端，不需要重建前端：

```bash
cd /root/cptodo && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build backend
```

末尾加服务名，只重建指定容器。

---

## 七、清理

### 删除旧镜像

```bash
# 删除所有未使用的镜像（释放磁盘空间）
docker image prune -a

# 删除 dangling 镜像（没有标签的中间镜像）
docker image prune
```

### 完全清理（谨慎）

```bash
# 删除所有停止的容器、未使用的网络、dangling 镜像、构建缓存
docker system prune

# 加上 --volumes 连数据卷一起删（数据库会丢！）
docker system prune --volumes
```

---

## 八、故障排查

### 容器启动失败

```bash
# 看日志找原因
docker compose logs
docker compose logs backend

# 重建（清除构建缓存）
docker compose build --no-cache
docker compose up -d
```

### 端口被占用

```bash
# 查看哪个进程占了端口
netstat -tlnp | grep :80
netstat -tlnp | grep :3306

# 或者用 lsof
lsof -i :80
```

### 容器内网络不通

```bash
# 检查容器间是否能通信
docker exec cptodo-backend-1 ping db
docker exec cptodo-backend-1 wget -qO- http://db:3306
```

### 数据库连接失败

```bash
# 检查数据库是否健康
docker exec cptodo-db-1 mysqladmin ping -u todo_user -p密码

# 检查数据库内的表
docker exec cptodo-db-1 mysql -u todo_user -p密码 todo_app -e "SHOW TABLES;"
```

---

## 九、命令速查表

| 场景 | 本地命令 | 服务器命令 |
|------|---------|-----------|
| 启动 | `docker compose up -d` | `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build` |
| 重建启动 | `docker compose up -d --build` | 同上（服务器每次都 build） |
| 停止 | `docker compose down` | 同左 |
| 查看日志 | `docker compose logs -f` | `docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f` |
| 执行 SQL | `docker compose exec -T db mysql ... < 文件.sql` | `docker exec -i 容器名 mysql ... < 文件.sql` |
| 更新部署 | 不需要 | `cd /root/cptodo && git pull && docker compose ... up -d --build` |
| 看容器状态 | `docker ps` | 同左 |
