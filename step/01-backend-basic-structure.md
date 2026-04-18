# 步骤 1：后端基础架构搭建

## 完成时间

2026-04-18

## 做了什么

搭建了后端 Node.js + Express 项目骨架，包含用户模块（注册/登录）和任务模块（增删改查）。

## 创建的文件

```
backend/
├── .env                    # 环境变量配置
├── .gitignore
├── README.md
├── package.json
└── src/
    ├── app.js              # 服务器入口
    ├── controllers/
    │   ├── userController.js   # 用户注册/登录逻辑
    │   └── taskController.js   # 任务增删改查逻辑
    ├── middleware/
    │   └── auth.js         # JWT 验证中间件
    ├── routes/
    │   ├── userRoutes.js   # 用户路由
    │   └── taskRoutes.js   # 任务路由
    └── utils/
        └── db.js           # MySQL 连接池

database/
└── init.sql                # 数据库建表脚本
```

## 核心依赖

| 依赖 | 作用 |
|------|------|
| express | 后端框架 |
| mysql2 | MySQL 驱动（支持 Promise） |
| bcryptjs | 密码加密 |
| jsonwebtoken | JWT 生成与验证 |
| cors | 跨域支持 |
| dotenv | 环境变量加载 |

## 接口一览

| 接口 | 方法 | 地址 | 说明 | 需登录 |
|------|------|------|------|--------|
| 注册 | POST | /api/users/register | username + password | 否 |
| 登录 | POST | /api/users/login | username + password | 否 |
| 任务列表 | GET | /api/tasks | 获取当前用户所有任务 | 是 |
| 新增任务 | POST | /api/tasks | content | 是 |
| 更新任务 | PUT | /api/tasks/:id | content / completed | 是 |
| 删除任务 | DELETE | /api/tasks/:id | 任务ID | 是 |

## 注意事项

1. **.env 不提交 Git** - 已加入 .gitignore，clone 后需手动创建
2. **MySQL 表需手动创建** - 执行 `database/init.sql` 一次即可
3. **JWT 密钥** - 生产环境需使用复杂的随机字符串
4. **密码加密** - 使用 bcryptjs，salt rounds = 10

## 下一步

安装 MySQL，执行建表脚本，修改 .env 中的密码，启动服务验证接口。
