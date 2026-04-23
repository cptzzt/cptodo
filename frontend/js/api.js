// API 配置：本地开发用完整地址，线上用相对路径（Nginx 代理）
const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:3000/api'
  : '/api';

// localStorage keys
const KEYS = {
  TOKEN: 'todo_token',
  USER: 'todo_user'
};

// 存储
const Storage = {
  getToken() {
    return localStorage.getItem(KEYS.TOKEN);
  },
  setToken(token) {
    localStorage.setItem(KEYS.TOKEN, token);
  },
  getUser() {
    const u = localStorage.getItem(KEYS.USER);
    return u ? JSON.parse(u) : null;
  },
  setUser(user) {
    localStorage.setItem(KEYS.USER, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(KEYS.TOKEN);
    localStorage.removeItem(KEYS.USER);
  }
};

// Toast 提示
const Toast = {
  container: null,
  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      document.body.appendChild(this.container);
    }
  },
  show(message, type = 'success', duration = 2500) {
    this.init();
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = message;
    this.container.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    }, duration);
  },
  success(m) { this.show(m, 'success'); },
  error(m) { this.show(m, 'error', 3500); }
};

// 自定义对话框
const Dialog = {
  confirm({ title, message, confirmText = '确认', cancelText = '取消', checkboxLabel = null }) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay';

      let checkboxHtml = '';
      if (checkboxLabel) {
        checkboxHtml = `
          <label class="dialog-checkbox">
            <input type="checkbox" id="dialogCheckbox"> ${checkboxLabel}
          </label>
        `;
      }

      overlay.innerHTML = `
        <div class="dialog-box">
          <div class="dialog-header">${title}</div>
          <div class="dialog-body">
            <div class="dialog-message">${message}</div>
            ${checkboxHtml}
          </div>
          <div class="dialog-footer">
            <button class="btn btn-secondary" id="dialogCancel">${cancelText}</button>
            <button class="btn btn-primary" id="dialogConfirm">${confirmText}</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const cleanup = (result, checked = false) => {
        overlay.classList.add('dialog-fade-out');
        setTimeout(() => overlay.remove(), 250);
        resolve({ confirmed: result, dontPromptAgain: checked });
      };

      overlay.querySelector('#dialogCancel').addEventListener('click', () => cleanup(false));
      overlay.querySelector('#dialogConfirm').addEventListener('click', () => {
        const cb = overlay.querySelector('#dialogCheckbox');
        cleanup(true, cb ? cb.checked : false);
      });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup(false);
      });
    });
  },

  alert({ title, message, confirmText = '确定' }) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay';
      overlay.innerHTML = `
        <div class="dialog-box dialog-alert">
          <div class="dialog-header">${title}</div>
          <div class="dialog-body"><div class="dialog-message">${message}</div></div>
          <div class="dialog-footer">
            <button class="btn btn-primary" id="dialogConfirm">${confirmText}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      const cleanup = () => {
        overlay.classList.add('dialog-fade-out');
        setTimeout(() => overlay.remove(), 250);
        resolve();
      };
      overlay.querySelector('#dialogConfirm').addEventListener('click', cleanup);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });
    });
  },

  prompt({ title, message = '', placeholder = '', defaultValue = '', confirmText = '确认', cancelText = '取消' }) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay';
      overlay.innerHTML = `
        <div class="dialog-box">
          <div class="dialog-header">${title}</div>
          <div class="dialog-body">
            ${message ? `<div class="dialog-message">${message}</div>` : ''}
            <input type="text" id="dialogInput" class="dialog-input" placeholder="${placeholder}" value="${defaultValue}" maxlength="100">
          </div>
          <div class="dialog-footer">
            <button class="btn btn-secondary" id="dialogCancel">${cancelText}</button>
            <button class="btn btn-primary" id="dialogConfirm">${confirmText}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      const input = overlay.querySelector('#dialogInput');
      input.focus();
      input.select();
      const cleanup = (value) => {
        overlay.classList.add('dialog-fade-out');
        setTimeout(() => overlay.remove(), 250);
        resolve(value);
      };
      overlay.querySelector('#dialogCancel').addEventListener('click', () => cleanup(null));
      overlay.querySelector('#dialogConfirm').addEventListener('click', () => cleanup(input.value.trim()));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') cleanup(input.value.trim());
      });
      overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(null); });
    });
  }
};

// 通用请求
async function request(url, options = {}) {
  const token = Storage.getToken();
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers
    },
    ...options
  };
  const response = await fetch(`${API_BASE}${url}`, config);
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      Storage.clear();
      if (!window.location.pathname.includes('login.html')) {
        window.location.href = 'login.html';
      }
    }
    throw new Error(data.message || '请求失败');
  }
  return data;
}

const api = {
  // 用户
  register(username, password) {
    return request('/users/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },
  login(username, password) {
    return request('/users/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },

  // 项目
  getProjects() {
    return request('/projects');
  },
  createProject(data) {
    return request('/projects', { method: 'POST', body: JSON.stringify(data) });
  },
  updateProject(id, data) {
    return request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteProject(id) {
    return request(`/projects/${id}`, { method: 'DELETE' });
  },

  // 标签
  getTags() {
    return request('/tags');
  },
  createTag(data) {
    return request('/tags', { method: 'POST', body: JSON.stringify(data) });
  },
  updateTag(id, data) {
    return request(`/tags/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteTag(id) {
    return request(`/tags/${id}`, { method: 'DELETE' });
  },

  // 条目
  getItems(params = {}) {
    const query = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return request(`/items${query ? '?' + query : ''}`);
  },
  createItem(data) {
    return request('/items', { method: 'POST', body: JSON.stringify(data) });
  },
  updateItem(id, data) {
    return request(`/items/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteItem(id) {
    return request(`/items/${id}`, { method: 'DELETE' });
  },

  // 条目标签
  addItemTag(itemId, tagId) {
    return request(`/items/${itemId}/tags`, { method: 'POST', body: JSON.stringify({ tag_id: tagId }) });
  },
  removeItemTag(itemId, tagId) {
    return request(`/items/${itemId}/tags/${tagId}`, { method: 'DELETE' });
  }
};
