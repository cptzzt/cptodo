# 步骤 2：前端页面搭建

## 完成时间

2026-04-18

## 做了什么

搭建了前端页面骨架，包含登录、注册、Todo 主页三个页面，基础 CSS 样式，以及与后端接口联调的前端逻辑。

## 创建的文件

```
frontend/
├── html/
│   ├── login.html    # 登录页
│   ├── register.html # 注册页
│   └── index.html    # Todo 主页
├── css/
│   └── style.css     # 样式（移动端适配）
├── js/
│   ├── api.js       # API 请求封装 + localStorage 存储
│   ├── login.js     # 登录页逻辑
│   ├── register.js  # 注册页逻辑
│   └── app.js       # Todo 主页逻辑（增删改查 + 标签页筛选）
├── .gitignore
└── README.md
```

## 核心功能

### 登录页 (login.html)
- 用户名/密码输入（前端校验：长度 3-50 / 至少 6 位）
- 登录成功后保存 token 到 localStorage，跳转主页
- 已有账号跳转注册页

### 注册页 (register.html)
- 用户名/密码/确认密码输入
- 前端校验：密码一致性、长度限制
- 注册成功后自动跳转登录页

### Todo 主页 (index.html)
- **添加任务**：输入框 + 添加按钮
- **查看任务**：区分已完成/未完成，支持标签页筛选
- **修改状态**：点击复选框切换完成状态
- **删除任务**：确认后删除
- **退出登录**：清除 localStorage，跳转登录页
- **身份校验**：无 token 则强制跳转登录页

## API 通信

| 功能 | 后端接口 | 说明 |
|------|---------|------|
| 登录 | POST /api/users/login | 返回 token + 用户信息 |
| 注册 | POST /api/users/register | 返回新用户信息 |
| 获取任务 | GET /api/tasks | 需带 Bearer Token |
| 新增任务 | POST /api/tasks | 需带 Bearer Token |
| 更新任务 | PUT /api/tasks/:id | 需带 Bearer Token |
| 删除任务 | DELETE /api/tasks/:id | 需带 Bearer Token |

## 注意事项

1. **后端需先启动** - 前端依赖 `http://localhost:3000/api`
2. **token 存储** - 存于 localStorage，刷新页面不丢失
3. **XSS 防护** - 内容显示时做 HTML 转义
4. **重复提交防护** - 提交时禁用按钮

## 下一步

1. 初始化 MySQL 数据库（执行 database/init.sql）
2. 修改 backend/.env 填入真实密码
3. 启动后端 `cd backend && npm start`
4. 测试前后端联调
