#!/binbash

# 服务器配置
# 旧服务器（腾讯云免费试用，已停用）：root@122.51.29.69
# 新服务器（腾讯云 4核4G，一年期）：root@124.220.19.21
SERVER="root@124.220.19.21"

REMOTE_NGINX="/var/www/todo"
REMOTE_BACKEND="/root/todo"

echo "=== 本地构建前端 ==="
cd frontend && npm run build && cd ..

echo "=== 上传前端 dist ==="
scp -r frontend/dist/* "$SERVER:$REMOTE_NGINX/"

echo "=== 上传后端文件 ==="
scp -r backend/src "$SERVER:$REMOTE_BACKEND/"
scp backend/package.json backend/server.js "$SERVER:$REMOTE_BACKEND/"

echo "=== 服务器安装依赖并重启 ==="
ssh "$SERVER" "cd /root/todo && npm install && pm2 restart todo && pm2 logs todo --lines 10"

echo "=== 部署完成，访问 http://122.51.29.69 ==="
