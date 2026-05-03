# Web 转 APP 流程文档（Capacitor 套壳方案）

> **创建目的**：记录 React 网页应用通过 Capacitor 打包成 Android APK 的完整流程，包括每一步为什么要做、做了什么、以及和网页版的区别。方便复盘学习，也为后续类似项目提供参考。
>
> **内容概括**：
> 1. 方案选型对比（Capacitor vs React Native vs 安卓原生）
> 2. Capacitor 的工作原理
> 3. 代码改动详解（每处改动的原因）
> 4. 完整构建流程（从零到 APK 的每一条命令）
> 5. Android Studio 打包操作
> 6. 安装与测试
> 7. 后续优化方向

---

## 一、方案选型

### 为什么选 Capacitor？

| 方案 | 原理 | 改动量 | 学习价值 | 出 APK 速度 |
|------|------|--------|---------|------------|
| **Capacitor** | 网页套壳，藏在 APP 里的浏览器加载你的网页 | 极小（改 4 个文件） | 理解"网页如何变 APP" | 半天 |
| **React Native** | 用 JS 写，但渲染的是原生控件 | 前端全部重写 | 学 RN 框架 | 至少一周 |
| **安卓原生** | 直接写 Java/Kotlin | 完全重写 | 学安卓开发 | 更久 |

我们的目标是：**最小改动、最快出包、自己手机能用**。Capacitor 最合适。

### Capacitor 的工作原理

简单理解：

```
┌─────────────────────────────┐
│  Android APP（.apk）         │
│  ┌─────────────────────────┐│
│  │  WebView（一个隐藏的浏览器）││
│  │  ┌─────────────────────┐││
│  │  │  你的 React 网页代码  │││
│  │  │  （HTML/CSS/JS）     │││
│  │  └─────────────────────┘││
│  └─────────────────────────┘│
└─────────────────────────────┘
```

它不是把你的代码"翻译"成原生代码，而是**在 APP 里内嵌了一个浏览器引擎**，加载你打包好的网页文件。用户看到的是一个全屏的"网页"，但没有地址栏，看起来就像一个真正的 APP。

这意味着：
- 你写的 React 代码几乎不用改
- CSS、localStorage、fetch 这些 Web API 都能用
- 但本质上还是网页，性能和原生 APP 有差距

---

## 二、代码改动详解

### 总览

| 文件 | 改了什么 | 为什么 |
|------|---------|--------|
| `vite.config.js` | 加 `base: './'` | APK 内资源路径是文件系统，不是域名 |
| `src/main.jsx` | `BrowserRouter` → `HashRouter` | APK 里没有 HTTP 服务器，history 路由不工作 |
| `src/api.js` | API 地址改服务器 IP | APK 里 hostname 不是 localhost |
| `src/api.js` | `/login` → `#/login` | 配合 HashRouter |
| `package.json` | 加 Capacitor 依赖和脚本 | 构建工具链 |
| `capacitor.config.json` | 新建 | APP 的配置（名字、包名） |
| Android `network_security_config.xml` | 新建 | 允许 HTTP 明文请求 |
| Android `AndroidManifest.xml` | 加一行配置 | 引用上面的网络安全配置 |

下面逐个解释。

---

### 2.1 `vite.config.js` — 加 `base: './'`

**改动前：**
```js
export default defineConfig({
  plugins: [react()],
  server: { ... }
})
```

**改动后：**
```js
export default defineConfig({
  base: './',       // ← 新增
  plugins: [react()],
  server: { ... }
})
```

**为什么：**

Vite 默认构建时，资源路径是绝对路径 `/assets/xxx.js`。在浏览器里这没问题，因为 Web 服务器会从根目录找文件。

但在 APK 里，你的网页文件是作为本地文件加载的（`file:///android_asset/...`），没有 Web 服务器。绝对路径 `/assets/xxx.js` 会被理解成"设备根目录下的 assets"，找不到文件。

加了 `base: './'` 后，资源路径变成相对路径 `./assets/xxx.js`，相对于 `index.html` 的位置去找，就能正确加载了。

---

### 2.2 `src/main.jsx` — BrowserRouter → HashRouter

**改动前：**
```js
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// ...
<BrowserRouter>
  <Routes>...</Routes>
</BrowserRouter>
```

**改动后：**
```js
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
// ...
<HashRouter>
  <Routes>...</Routes>
</HashRouter>
```

**为什么：**

这是最关键的一处改动。要理解为什么，需要知道两种路由模式的区别：

**BrowserRouter（History 模式）**
- URL 长这样：`https://cptodo.top/login`、`https://cptodo.top/`
- 依赖 Web 服务器支持：当你访问 `/login` 时，服务器需要把所有路径都指向 `index.html`，然后由前端 JS 来解析路由
- Nginx 里通常配 `try_files $uri /index.html` 来实现

**HashRouter（Hash 模式）**
- URL 长这样：`https://cptodo.top/#/login`、`https://cptodo.top/#/`
- 路由信息在 `#` 后面，浏览器不会把 `#` 后面的内容发给服务器
- 不需要服务器做任何配置，纯前端就能处理路由

在 Capacitor APK 里：
- 网页文件是本地加载的（`file:///android_asset/public/index.html`）
- **没有 Web 服务器**，没人帮你做 `try_files` 的重写
- 如果用 BrowserRouter，刷新页面或直接访问 `/login` 会 404
- 用 HashRouter，所有路由都在 `#` 后面处理，完全不依赖服务器

**实际影响：**
- 网页版 URL 从 `cptodo.top/login` 变成 `cptodo.top/#/login`
- 功能完全不受影响，只是 URL 格式变了
- 这是很多 APP 内嵌网页的标准做法

---

### 2.3 `src/api.js` — API 地址改服务器 IP

**改动前：**
```js
const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:3000/api'
  : '/api';
```

**改动后：**
```js
const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:3000/api'
  : 'http://124.220.19.21/api';
```

**为什么：**

原来的逻辑是：
- 本地开发 → 请求 `localhost:3000`（后端在本地跑）
- 线上 → 请求 `/api`（Nginx 反向代理到后端）

在 APK 里：
- `location.hostname` 是空字符串或 `localhost`（因为是本地文件加载），但这不是"你在本地开发"，而是 APP 在加载本地 HTML
- 没有服务器做反向代理，所以不能写 `/api`
- 必须直接写明后端的公网 IP 地址

**注意：** 这里用的是 HTTP 明文请求。Android 9+ 默认禁止明文 HTTP（只允许 HTTPS），所以后面需要额外配置允许（见 2.7）。

**域名备案完成后**可以改成 `https://cptodo.top/api`，那时候就不用担心明文问题了。

---

### 2.4 `src/api.js` — 登录跳转改 Hash 格式

**改动前：**
```js
window.location.href = '/login';
```

**改动后：**
```js
window.location.href = '#/login';
```

**为什么：**

这是配合 2.2 的 HashRouter 改动。原来用的是 History 模式路径 `/login`，现在改成 Hash 模式 `#/login`。

这行代码在 token 过期自动跳转登录页时触发。如果这里不改，跳转会失败。

---

### 2.5 `package.json` — 加 Capacitor 依赖和脚本

**新增依赖：**
```json
"@capacitor/android": "^8.3.1",
"@capacitor/cli": "^8.3.1",
"@capacitor/core": "^8.3.1",
```

- `@capacitor/core` — Capacitor 核心，提供 WebView 等基础能力
- `@capacitor/cli` — 命令行工具，用来添加平台、同步代码
- `@capacitor/android` — Android 平台支持

**新增脚本：**
```json
"cap:add:android": "npx cap add android",
"cap:sync": "npx cap sync",
"cap:build": "npm run build && npx cap sync"
```

| 脚本 | 作用 |
|------|------|
| `cap:add:android` | 生成 Android 工程目录（只需执行一次） |
| `cap:sync` | 把 `dist/` 里的网页文件同步到 Android 工程里 |
| `cap:build` | 先构建前端，再同步到 Android（开发时常用） |

---

### 2.6 `capacitor.config.json` — APP 配置

```json
{
  "appId": "top.cptodo.app",
  "appName": "CPToDo",
  "webDir": "dist",
  "server": {
    "androidScheme": "https",
    "url": "http://124.220.19.21"
  }
}
```

| 字段 | 含义 |
|------|------|
| `appId` | APP 的唯一标识（反写的域名），安装和更新都靠它区分 |
| `appName` | APP 在手机上显示的名字 |
| `webDir` | 前端构建产物的目录，Capacitor 会从这里复制文件 |
| `server.androidScheme` | WebView 使用的协议（`https` 让 Capacitor 帮你处理一些安全策略） |
| `server.url` | 可选：直接加载远程网页而不是本地文件。如果设了这个，APP 打开后会从这个 URL 加载页面 |

**注意：** `server.url` 是可选的。如果不设，APP 会加载本地 `dist/` 里的文件。如果设了，每次打开 APP 都会从服务器拉取最新页面（更像一个"壳浏览器"）。两种方式各有利弊：

| | 本地文件 | 远程 URL |
|---|---------|---------|
| 离线可用 | 可以（但数据还是需要网络） | 不行 |
| 更新 | 需要重新打包 APK | 改服务器文件就行 |
| 加载速度 | 快（本地读取） | 取决于网络 |

---

### 2.7 Android 网络安全配置 — 允许 HTTP 明文

**新建文件：** `android/app/src/main/res/xml/network_security_config.xml`
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">124.220.19.21</domain>
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">127.0.0.1</domain>
    </domain-config>
</network-security-config>
```

**修改文件：** `android/app/src/main/AndroidManifest.xml`，在 `<application>` 标签加了一行：
```xml
android:networkSecurityConfig="@xml/network_security_config"
```

**为什么：**

Android 9（API 28）开始，**默认禁止明文 HTTP 请求**（只能用 HTTPS）。这是安卓的安全策略，防止网络传输中的数据被窃听。

我们的 API 地址是 `http://124.220.19.21`（HTTP，非加密），如果不在安卓配置里显式允许，APP 里的所有网络请求都会被拦截，功能全废。

这个配置的意思是："对 `124.220.19.21`、`localhost`、`127.0.0.1` 这几个地址，允许使用明文 HTTP。" 其他域名仍然走 HTTPS。

**域名备案完成后**，改成 HTTPS 就可以去掉这个配置了。

---

## 三、完整构建流程

### 前提条件

- Node.js 已安装
- Android Studio 已安装（用于最终打包 APK）
- 一台安卓手机（测试用）

### 步骤

#### 1. 切分支
```bash
git checkout -b feature/capacitor-android
```

#### 2. 安装 Capacitor 依赖
```bash
cd frontend
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android
```

#### 3. 代码改动（按第二节的说明修改 4 个文件）

#### 4. 创建 Capacitor 配置文件
在 `frontend/` 下新建 `capacitor.config.json`（内容见 2.6）

#### 5. 构建前端
```bash
npm run build
```
这一步会在 `frontend/dist/` 目录生成网页文件。

#### 6. 添加 Android 平台
```bash
npx cap add android
```
这一步会在 `frontend/android/` 目录生成一个完整的 Android 工程。Capacitor 会自动把 `dist/` 里的文件复制到 Android 工程的 assets 目录里。

#### 7. 配置 Android 网络安全
新建 `frontend/android/app/src/main/res/xml/network_security_config.xml`
修改 `frontend/android/app/src/main/AndroidManifest.xml`（见 2.7）

#### 8. 用 Android Studio 打开工程
1. 打开 Android Studio
2. File → Open
3. 选择 `D:\SELF\self-project\CPToDo\frontend\android` 目录
4. 等待 Gradle 同步完成（第一次会比较慢，要下载依赖）

#### 9. 构建 APK
1. 菜单栏：Build → Build Bundle(s) / APK(s) → Build APK(s)
2. 等待编译完成
3. 右下角会弹出通知，点击 `locate` 可以找到 APK 文件
4. APK 位置：`frontend/android/app/build/outputs/apk/debug/app-debug.apk`

#### 10. 安装到手机
- 把 `app-debug.apk` 发到手机（微信、QQ、数据线都行）
- 手机上打开文件，点击安装
- 如果提示"未知来源"，去设置里允许安装

---

## 四、日常开发流程

改了前端代码后，不需要每次都重新用 Android Studio 打包。开发流程是：

```bash
# 1. 修改代码后，重新构建
cd frontend
npm run build

# 2. 同步到 Android 工程
npx cap sync

# 3. 回到 Android Studio，重新 Build APK
```

也可以用快捷命令：
```bash
npm run cap:build    # = npm run build && npx cap sync
```

**debug APK 和 release APK 的区别：**

| | debug | release |
|---|-------|---------|
| 签名 | 自动用 debug 签名 | 需要自己创建签名密钥 |
| 能安装 | 任何手机 | 任何手机 |
| 体积 | 较大 | 较小（优化过） |
| 性能 | 稍差 | 更好 |
| 适用 | 开发测试 | 发给别人用 |

目前用 debug 就行，等要正式分发再搞 release 签名。

---

## 五、网页版 vs APP 版的区别

| 对比项 | 网页版 | APP 版 |
|--------|--------|--------|
| **访问方式** | 浏览器输入网址 | 点击手机桌面图标 |
| **URL 格式** | `cptodo.top/login` | `file:///android_asset/.../#/login` |
| **路由模式** | BrowserRouter（History） | HashRouter（Hash） |
| **API 请求** | Nginx 反向代理 `/api` | 直连 `http://124.220.19.21/api` |
| **HTTP 安全** | 浏览器无限制 | Android 默认禁止明文 HTTP |
| **资源路径** | 绝对路径 `/assets/` | 相对路径 `./assets/` |
| **localStorage** | 浏览器管理 | APP 沙盒内，卸载 APP 才清除 |
| **更新方式** | 改服务器文件 | 重新打包 APK |
| **离线能力** | 无 | 可以打开页面，但数据需要网络 |

---

## 六、后续优化方向

1. **域名 HTTPS** — 备案完成后，API 改成 `https://cptodo.top/api`，去掉 HTTP 明文配置
2. **APP 图标和启动屏** — 替换 `android/app/src/main/res/mipmap-*` 下的图标文件
3. **APP 名称** — 修改 `android/app/src/main/res/values/strings.xml`
4. **Release 签名** — 创建正式签名密钥，打包 release APK（体积更小、性能更好）
5. **代码分割** — 当前 JS 包 1.1MB，可以用动态 `import()` 拆分，加快首屏加载
6. **热更新** — 用 `server.url` 配置远程加载，这样改了代码不用重新发 APK

---

## 七、常见问题

### Q: APK 装上去白屏怎么办？
检查几个点：
1. `vite.config.js` 的 `base: './'` 是否加了
2. `main.jsx` 是否改成了 `HashRouter`
3. API 地址是否正确（打开 Chrome 远程调试看控制台报错）

### Q: Chrome 远程调试 APP 怎么做？
1. 手机连电脑，开 USB 调试
2. Chrome 打开 `chrome://inspect`
3. 找到你的 APP，点 `inspect`
4. 能看到和网页开发时一样的控制台

### Q: 改了前端代码，APP 里没变？
你需要重新 `npm run build && npx cap sync`，然后在 Android Studio 重新 Build。

### Q: APP 里的数据和网页版是同步的吗？
是的，数据都在服务器上的 MariaDB 数据库里。网页版和 APP 版操作的是同一个数据库，实时同步。

### Q: 能同时装网页版和 APP 版吗？
可以。APP 版是独立的，不会影响浏览器里的使用。
