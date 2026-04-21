#!/bin/bash
# 一键部署脚本：上传前端文件到服务器并部署到 Nginx 目录
# 用法：在本地终端执行 bash deploy.sh

SERVER="root@122.51.29.69"
REMOTE_NGINX="/var/www/todo"
REMOTE_BACKEND="/root/todo"
LOCAL_HTML="D:/SELF/self-project/CPToDo/frontend/html"
LOCAL_CSS="D:/SELF/self-project/CPToDo/frontend/css"
LOCAL_JS="D:/SELF/self-project/CPToDo/frontend/js"
LOCAL_BACKEND="D:/SELF/self-project/CPToDo/backend"

echo "=== 上传前端文件 ==="
scp "$LOCAL_HTML"/*.html "$LOCAL_HTML"/*.svg "$SERVER:$REMOTE_NGINX/"
scp "$LOCAL_CSS"/*.css "$SERVER:$REMOTE_NGINX/css/"
scp "$LOCAL_JS"/*.js "$SERVER:$REMOTE_NGINX/js/"

echo "=== 上传后端文件 ==="
scp "$LOCAL_BACKEND"/src/controllers/*.js "$SERVER:$REMOTE_BACKEND/src/controllers/"
scp "$LOCAL_BACKEND"/src/routes/*.js "$SERVER:$REMOTE_BACKEND/src/routes/"
scp "$LOCAL_BACKEND"/src/utils/*.js "$SERVER:$REMOTE_BACKEND/src/utils/"
scp "$LOCAL_BACKEND"/src/app.js "$SERVER:$REMOTE_BACKEND/src/"

echo "=== 重启后端 ==="
ssh "$SERVER" "pm2 restart todo"

echo "=== 部署完成 ==="
