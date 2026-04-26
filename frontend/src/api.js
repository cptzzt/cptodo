const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:3000/api'
  : '/api';

const KEYS = {
  TOKEN: 'todo_token',
  USER: 'todo_user'
};

export const Storage = {
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

async function request(url, options = {}) {
  const token = Storage.getToken();
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    },
    ...options
  };
  const response = await fetch(`${API_BASE}${url}`, config);
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      Storage.clear();
    }
    throw new Error(data.message || '请求失败');
  }
  return data;
}

export const api = {
  // 用户
  login(username, password) {
    return request('/users/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  },
  register(username, password) {
    return request('/users/register', { method: 'POST', body: JSON.stringify({ username, password }) });
  },

  // 项目
  getProjects() { return request('/projects'); },
  createProject(data) { return request('/projects', { method: 'POST', body: JSON.stringify(data) }); },
  updateProject(id, data) { return request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
  deleteProject(id) { return request(`/projects/${id}`, { method: 'DELETE' }); },

  // 标签
  getTags() { return request('/tags'); },
  createTag(data) { return request('/tags', { method: 'POST', body: JSON.stringify(data) }); },
  updateTag(id, data) { return request(`/tags/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
  deleteTag(id) { return request(`/tags/${id}`, { method: 'DELETE' }); },

  // 条目
  getItems(params = {}) {
    const query = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return request(`/items${query ? '?' + query : ''}`);
  },
  createItem(data) { return request('/items', { method: 'POST', body: JSON.stringify(data) }); },
  updateItem(id, data) { return request(`/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
  deleteItem(id) { return request(`/items/${id}`, { method: 'DELETE' }); },

  // 条目标签
  addItemTag(itemId, tagId) { return request(`/items/${itemId}/tags`, { method: 'POST', body: JSON.stringify({ tag_id: tagId }) }); },
  removeItemTag(itemId, tagId) { return request(`/items/${itemId}/tags/${tagId}`, { method: 'DELETE' }); },

  // 回收站 - 条目
  getTrashItems(params = {}) {
    const query = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return request(`/items/trash${query ? '?' + query : ''}`);
  },
  restoreItem(id) { return request(`/items/trash/restore/${id}`, { method: 'POST' }); },
  permanentDeleteItem(id) { return request(`/items/trash/permanent/${id}`, { method: 'DELETE' }); },
  batchRestoreItems(ids) { return request('/items/trash/batch-restore', { method: 'POST', body: JSON.stringify({ ids }) }); },
  batchPermanentDeleteItems(ids) { return request('/items/trash/batch-permanent-delete', { method: 'POST', body: JSON.stringify({ ids }) }); },

  // 回收站 - 项目
  getTrashProjects() { return request('/projects/trash'); },
  restoreProject(id) { return request(`/projects/trash/restore/${id}`, { method: 'POST' }); },
  permanentDeleteProject(id) { return request(`/projects/trash/permanent/${id}`, { method: 'DELETE' }); }
};
