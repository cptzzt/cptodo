# 后端服务

## 环境要求

- Node.js >= 18
- MySQL >= 8

## 初始化数据库

1. 登录 MySQL：`mysql -u root -p`
2. 执行初始化脚本：

```bash
mysql -u root -p < ../database/init.sql
```

3. 修改 `.env` 中的数据库配置（DB_PASSWORD）

## 启动服务

```bash
npm start
```

## 接口列表

| 接口 | 方法 | 地址 | 说明 | 需登录 |
|------|------|------|------|--------|
| 注册 | POST | /api/users/register | 用户名+密码 | 否 |
| 登录 | POST | /api/users/login | 用户名+密码 | 否 |
| 任务列表 | GET | /api/tasks | 获取当前用户任务 | 是 |
| 新增任务 | POST | /api/tasks | content | 是 |
| 更新任务 | PUT | /api/tasks/:id | content/completed | 是 |
| 删除任务 | DELETE | /api/tasks/:id | 任务ID | 是 |
