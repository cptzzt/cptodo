#!/bin/bash

# 新服务器部署脚本（React 版本）
# 旧服务器：root@122.51.29.69（deploy-react.sh）
# 新服务器：root@124.220.19.21（本脚本）

SERVER="root@124.220.19.21"
REMOTE_NGINX="/var/www/todo"
REMOTE_BACKEND="/root/todo/backend"

echo "=== 本地构建前端 ==="
cd frontend && npm run build && cd ..

echo "=== 上传前端 dist ==="
scp -r frontend/dist/* "$SERVER:$REMOTE_NGINX/"

echo "=== 上传后端文件 ==="
# 先在服务器创建 backend 目录（避免 scp 路径散落问题）
ssh "$SERVER" "mkdir -p $REMOTE_BACKEND"
scp -r backend/src "$SERVER:$REMOTE_BACKEND/"
scp backend/package.json "$SERVER:$REMOTE_BACKEND/"

echo "=== 服务器安装依赖并重启 ==="
ssh "$SERVER" "cd /root/todo/backend && npm install && pm2 restart todo && pm2 logs todo --lines 10"

echo "=== 部署完成，访问 http://124.220.19.21 ==="
