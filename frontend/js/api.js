// API 配置
const API_BASE = 'http://localhost:3000/api';

// 存储 token 和用户信息
const Storage = {
  getToken() {
    return localStorage.getItem('todo_token');
  },
  setToken(token) {
    localStorage.setItem('todo_token', token);
  },
  getUser() {
    const user = localStorage.getItem('todo_user');
    return user ? JSON.parse(user) : null;
  },
  setUser(user) {
    localStorage.setItem('todo_user', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('todo_token');
    localStorage.removeItem('todo_user');
  }
};

// 通用请求封装
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
    // 401/403 表示未登录或登录过期
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

// API 方法
const api = {
  // 用户相关
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

  // 任务相关
  getTasks() {
    return request('/tasks');
  },

  createTask(content) {
    return request('/tasks', {
      method: 'POST',
      body: JSON.stringify({ content })
    });
  },

  updateTask(id, data) {
    return request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteTask(id) {
    return request(`/tasks/${id}`, {
      method: 'DELETE'
    });
  }
};
