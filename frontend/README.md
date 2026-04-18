# 前端

## 页面结构

```
frontend/
├── html/
│   ├── login.html    # 登录页
│   ├── register.html # 注册页
│   └── index.html    # Todo 主页
├── css/
│   └── style.css     # 样式文件
└── js/
    ├── api.js       # API 请求封装
    ├── login.js     # 登录页逻辑
    ├── register.js  # 注册页逻辑
    └── app.js       # Todo 主页逻辑
```

## 运行方式

前端是纯静态文件，可直接用浏览器打开 `html/login.html`，或者用任意静态服务器：

```bash
# Python
python -m http.server 8080

# Node.js (npx)
npx serve .

# PHP
php -S localhost:8080
```

## 与后端联调

确保后端已启动（`cd backend && npm start`），前端默认请求 `http://localhost:3000/api`。

如需修改后端地址，编辑 `js/api.js` 中的 `API_BASE`。
