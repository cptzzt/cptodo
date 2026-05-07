# CPTodo - 全栈待办管理工具

一个从零开始的全栈学习项目，通过 AI Coding 完成全部代码编写，覆盖前端、后端、数据库、服务器部署的完整链路。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + Ant Design + Vite |
| 后端 | Node.js + Express |
| 数据库 | MariaDB |
| 移动端 | Capacitor（Android APK） |
| 服务器 | 腾讯云 Debian / Nginx / PM2 |
| 域名 | cptodo.top |

## 功能

- 用户注册/登录（账号密码 + 邮箱验证码）
- 任务管理（创建、编辑、完成、截止日期、优先级）
- 随笔快速记录
- 项目分类 + 项目专属标签
- 全局标签系统
- 重复任务（每天/每周，周期自动重建）
- 日历视图（日期范围筛选）
- 回收站（软删除 + 恢复）
- 批量操作（批量删除、批量解除标签关联）
- 隐私模式（隐藏私密任务/项目/标签）
- 移动端适配（响应式布局 + Android APK）
- JWT 登录认证（浏览器 30 天 / APK 365 天）

## 分支说明

| 分支 | 说明 |
|------|------|
| `main` | 原生 JS 版本（已冻结） |
| `feature/react-migration` | React 迁移版本 |
| `feature/mobile-responsive` | 移动端响应式适配 |
| `feature/capacitor-android` | **当前分支**，Android APK 支持 + 持续迭代 |

各分支为独立版本，不存在合并关系。

## 本地运行

```bash
# 前端
cd frontend
npm install
npm run dev

# 后端
cd backend
npm install
npm start
```

后端需要配置 `backend/.env`（数据库连接、JWT 密钥、邮箱 SMTP）。

## 在线访问

http://124.220.19.21
