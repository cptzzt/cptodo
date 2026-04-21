// 身份校验
if (!Storage.getToken()) {
  window.location.href = 'login.html';
}

// ===== 状态 =====
let allItems = [];
let selectedId = null;
let selectedParentId = null; // 当前所在目录ID
let modalParentId = null;    // 弹窗打开时的 parent_id，闭包用
const expandedNodes = new Set(); // 记住展开的节点

// ===== DOM =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const treeView = $('#treeView');
console.log('treeView found:', treeView, 'parent:', treeView ? treeView.parentElement : 'none');
const cardList = $('#cardList');
const emptyHint = $('#emptyHint');
const currentPath = $('#currentPath');
const addRootBtn = $('#addRootBtn');
const logoutBtn = $('#logoutBtn');
const detailPanel = $('#detailPanel');
const closeDetailBtn = $('#closeDetailBtn');
const detailTitle = $('#detailTitle');
const detailType = $('#detailType');
const detailTitleInput = $('#detailTitleInput');
const detailContentInput = $('#detailContentInput');
const detailNotesInput = $('#detailNotesInput');
const detailDueDateInput = $('#detailDueDateInput');
const detailCompletedInput = $('#detailCompletedInput');
const contentField = $('#contentField');
const dueDateField = $('#dueDateField');
const completedField = $('#completedField');
const saveDetailBtn = $('#saveDetailBtn');
const deleteDetailBtn = $('#deleteDetailBtn');
const addModal = $('#addModal');
const modalTitle = $('#modalTitle');
const modalTypeSelect = $('#modalTypeSelect');
const modalTitleInput = $('#modalTitleInput');
const modalContentInput = $('#modalContentInput');
const modalContentField = $('#modalContentField');
const modalDueDateInput = $('#modalDueDateInput');
const modalDueDateField = $('#modalDueDateField');
const modalCancelBtn = $('#modalCancelBtn');
const modalConfirmBtn = $('#modalConfirmBtn');

// ===== 初始化 =====
async function init() {
  await loadItems();
}

// ===== 加载数据 =====
async function loadItems() {
  try {
    const res = await api.getItems();
    allItems = res.data || [];

    // DEBUG
    console.log('allItems count:', allItems.length);
    const roots = allItems.filter(i => i.parent_id === null || i.parent_id === undefined);
    console.log('root items:', roots);

    // 同步用户设置
    const user = Storage.getUser();
    if (user) {
      user.no_child_delete_prompt = res.data._userNoChildDeletePrompt;
    }
    renderTree();
    renderCards();
    closeDetail();
  } catch (e) {
    Toast.error('加载失败: ' + e.message);
  }
}

// ===== 工具函数 =====
function escapeHtml(text) {
  if (!text) return '';
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function isOverdue(item) {
  if (!item.due_date || item.completed || item.type !== 'task') return false;
  const today = new Date().toISOString().split('T')[0];
  return item.due_date < today;
}

function getChildren(parentId) {
  if (parentId === null || parentId === undefined) {
    return allItems.filter(i => i.parent_id === null || i.parent_id === undefined);
  }
  return allItems.filter(i => parseInt(i.parent_id) === parseInt(parentId));
}

function getItem(id) {
  return allItems.find(i => parseInt(i.id) === parseInt(id));
}

function getPath(parentId) {
  const parts = [];
  let current = parentId;
  const visited = new Set();
  while (current !== null && !visited.has(current)) {
    visited.add(current);
    const item = allItems.find(i => parseInt(i.id) === parseInt(current));
    if (!item) break;
    parts.unshift(item.title);
    current = item.parent_id;
  }
  return parts.length > 0 ? parts.join(' / ') : '根目录';
}

function getChildCount(id) {
  return getChildren(id).length;
}

function hasChildren(id) {
  return getChildCount(id) > 0;
}

// ===== 渲染左侧树 =====
function renderTree() {
  treeView.innerHTML = '';
  const roots = getChildren(null);
  console.log('renderTree, roots count:', roots.length, 'roots:', roots);
  console.log('treeView element:', treeView);
  roots.forEach(item => {
    const node = createTreeNode(item, 0);
    treeView.appendChild(node);
  });
  console.log('treeView children count:', treeView.children.length);
  updateAddButton();
}

function createTreeNode(item, depth) {
  const node = document.createElement('div');
  node.className = 'tree-node';
  node.style.paddingLeft = `${depth === 0 ? 12 : 10}px`;
  node.dataset.id = item.id;

  const children = getChildren(item.id);
  const isFolder = item.type === 'folder';
  const hasKids = isFolder && children.length > 0;
  const isCurrentFolder = isFolder && selectedParentId !== null && parseInt(selectedParentId) === parseInt(item.id);

  if (isCurrentFolder) node.classList.add('active');

  const row = document.createElement('div');
  row.className = 'node-row';

  // toggle
  const isExpanded = expandedNodes.has(item.id);
  const toggle = document.createElement('span');
  toggle.className = `tree-toggle${hasKids ? '' : ' no-child'}`;
  toggle.dataset.id = item.id;
  toggle.textContent = hasKids ? (isExpanded ? '▼' : '▶') : '';
  if (hasKids) {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNode(item.id, node);
    });
  }
  row.appendChild(toggle);

  // icon + label: 目录→导航，任务→选中开详情
  const clickHandler = () => {
    if (isFolder) navigateTo(item.id);
    else selectTask(item);
  };

  const icon = document.createElement('span');
  icon.className = `tree-icon tree-icon-${item.type}`;
  icon.dataset.id = item.id;
  icon.textContent = isFolder ? '📁' : '☑';
  icon.addEventListener('click', clickHandler);
  row.appendChild(icon);

  const label = document.createElement('span');
  label.className = `tree-label${isCurrentFolder ? ' selected' : ''}`;
  label.dataset.id = item.id;
  label.textContent = item.title;
  label.addEventListener('click', clickHandler);
  row.appendChild(label);

  // overdue dot
  if (item.type === 'task' && isOverdue(item)) {
    const dot = document.createElement('span');
    dot.className = 'overdue-dot';
    row.appendChild(dot);
  }

  node.appendChild(row);

  // children
  if (hasKids) {
    const childContainer = document.createElement('div');
    childContainer.className = 'tree-children';
    childContainer.style.display = isExpanded ? 'block' : 'none';
    children.forEach(child => {
      childContainer.appendChild(createTreeNode(child, depth + 1));
    });
    node.appendChild(childContainer);
  }

  return node;
}

function toggleNode(id, node) {
  const childContainer = node.querySelector('.tree-children');
  const toggle = node.querySelector('.tree-toggle');
  if (!childContainer) return;
  const isOpen = childContainer.style.display !== 'none';
  childContainer.style.display = isOpen ? 'none' : 'block';
  toggle.textContent = isOpen ? '▶' : '▼';
  if (isOpen) {
    expandedNodes.delete(id);
  } else {
    expandedNodes.add(id);
  }
}

// ===== 选中任务（打开详情面板）=====
function selectTask(item) {
  selectedId = item.id;
  selectedParentId = item.parent_id || null;
  showDetail(item);
  updateAddButton();
  updateBreadcrumb();
  renderTree();
  renderCards();
}

// ===== 更新添加按钮文字 =====
function updateAddButton() {
  addRootBtn.textContent = selectedParentId ? '添加子目录/任务' : '添加根目录/任务';
}

// ===== 渲染中间卡片 =====
function renderCards() {
  cardList.innerHTML = '';
  const items = getChildren(selectedParentId);

  if (items.length === 0) {
    emptyHint.style.display = '';
    return;
  }
  emptyHint.style.display = 'none';

  items.forEach(item => {
    cardList.appendChild(createCard(item));
  });
}

function createCard(item) {
  const card = document.createElement('div');
  card.className = [
    'item-card',
    item.type === 'folder' ? 'folder-card' : '',
    isOverdue(item) ? 'overdue' : '',
    item.completed ? 'completed' : ''
  ].join(' ');
  card.dataset.id = item.id;

  const dueDateHtml = item.type === 'task' && item.due_date
    ? `<span class="card-meta${isOverdue(item) ? ' overdue' : ''}">📅 ${formatDate(item.due_date)}</span>` : '';
  const notesHtml = item.notes
    ? `<span class="card-meta">📝 ${escapeHtml(item.notes)}</span>` : '';
  const childCountHtml = item.type === 'folder' && getChildCount(item.id) > 0
    ? `<span class="card-meta">含 ${getChildCount(item.id)} 项</span>` : '';

  const rightAction = item.type === 'task'
    ? `<div class="card-check"><input type="checkbox"${item.completed ? ' checked' : ''} data-id="${item.id}"></div>`
    : `<div class="card-edit"><button class="card-edit-btn" title="编辑目录">编辑</button></div>`;

  card.innerHTML = `
    <span class="card-icon card-icon-${item.type}"></span>
    <div class="card-body">
      <div class="card-title">${escapeHtml(item.title)}</div>
      ${dueDateHtml}
      ${notesHtml}
      ${childCountHtml}
    </div>
    ${rightAction}
  `;

  // 点击卡片：目录→进入，任务→选中开详情
  card.addEventListener('click', (e) => {
    if (e.target.type === 'checkbox') return;
    if (e.target.closest('.card-edit-btn')) return;
    const it = getItem(parseInt(card.dataset.id));
    if (!it) return;
    if (it.type === 'folder') navigateTo(it.id);
    else selectTask(it);
  });

  // 复选框切换完成（仅任务）
  if (item.type === 'task') {
    card.querySelector('input[type="checkbox"]').addEventListener('change', async (e) => {
      e.stopPropagation();
      try {
        await api.updateItem(item.id, { completed: e.target.checked });
        Toast.success(e.target.checked ? '任务已完成' : '已取消完成');
        await loadItems();
      } catch (err) {
        e.target.checked = !e.target.checked;
        Toast.error(err.message);
      }
    });
  }

  // 编辑目录按钮（仅目录）
  if (item.type === 'folder') {
    card.querySelector('.card-edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      selectedId = item.id;
      showDetail(item);
    });
  }

  return card;
}

// ===== 右侧详情面板 =====
function showDetail(item) {
  detailPanel.style.display = '';

  detailTitle.textContent = item.title;
  detailType.textContent = item.type === 'folder' ? '目录' : '任务';
  detailType.className = `detail-badge badge-${item.type}`;
  detailTitleInput.value = item.title;
  detailNotesInput.value = item.notes || '';

  if (item.type === 'task') {
    contentField.style.display = '';
    dueDateField.style.display = '';
    completedField.style.display = '';
    detailContentInput.value = item.content || '';
    detailDueDateInput.value = item.due_date || '';
    detailCompletedInput.checked = !!item.completed;
  } else {
    contentField.style.display = 'none';
    dueDateField.style.display = 'none';
    completedField.style.display = 'none';
  }
}

function closeDetail() {
  detailPanel.style.display = 'none';
  selectedId = null;
  updateAddButton();
  updateBreadcrumb();
}

// ===== 更新面包屑 =====
function updateBreadcrumb() {
  const path = getPath(selectedParentId);
  const parts = path.split(' / ');

  // 构建 ID 路径：按顺序存从根到当前的每个祖先 ID
  const idPath = [null]; // 根目录
  let cur = selectedParentId;
  const visited = new Set();
  while (cur !== null && !visited.has(cur)) {
    visited.add(cur);
    idPath.push(cur);
    const item = allItems.find(it => parseInt(it.id) === parseInt(cur));
    if (!item) break;
    cur = item.parent_id;
  }

  const crumbs = parts.map((part, i) => {
    if (i === parts.length - 1) {
      return `<span class="crumb-current">${escapeHtml(part)}</span>`;
    }
    const targetId = idPath[i + 1]; // idPath[0]=根, [1]=第一层...
    return `<a class="crumb-link" data-id="${targetId === null ? '' : targetId}">${escapeHtml(part)}</a>`;
  });
  currentPath.innerHTML = crumbs.join('<span class="crumb-sep"> / </span>');

  // 绑定点击
  currentPath.querySelectorAll('.crumb-link').forEach(link => {
    link.addEventListener('click', () => {
      const id = link.dataset.id;
      navigateTo(id === '' ? null : parseInt(id));
    });
  });
}

// 导航到指定目录（不选中具体项，不开详情）
function navigateTo(parentId) {
  selectedId = null;
  selectedParentId = parentId;
  detailPanel.style.display = 'none';
  updateAddButton();
  updateBreadcrumb();
  renderTree();
  renderCards();
}

closeDetailBtn.addEventListener('click', closeDetail);

// ===== 保存详情 =====
saveDetailBtn.addEventListener('click', async () => {
  if (!selectedId) return;
  const item = getItem(selectedId);
  if (!item) return;

  const title = detailTitleInput.value.trim();
  if (!title) {
    Toast.error('标题不能为空');
    return;
  }

  const data = { title, notes: detailNotesInput.value.trim() };
  if (item.type === 'task') {
    data.content = detailContentInput.value.trim();
    data.due_date = detailDueDateInput.value || null;
    data.completed = detailCompletedInput.checked;
  }

  try {
    await api.updateItem(selectedId, data);
    Toast.success('保存成功');
    await loadItems();
  } catch (e) {
    Toast.error(e.message);
  }
});

// ===== 删除项目 =====
deleteDetailBtn.addEventListener('click', async () => {
  if (!selectedId) return;
  const item = getItem(selectedId);
  if (!item) return;

  const kids = hasChildren(item.id);
  const noPrompt = Storage.getNoChildDeletePrompt();

  if (kids && !noPrompt) {
    // 有子项且用户未勾选"不再提示"
    const firstConfirm = await Dialog.confirm({
      title: '确认删除',
      message: `该目录存在子项，确认删除「${item.title}」？`,
      confirmText: '确认删除',
      cancelText: '取消'
    });
    if (!firstConfirm.confirmed) return;

    const secondConfirm = await Dialog.confirm({
      title: '再次确认',
      message: '确认删除？',
      confirmText: '确认',
      cancelText: '取消',
      checkboxLabel: '以后删除带有子项的目录时不再二次提示'
    });

    if (secondConfirm.confirmed) {
      if (secondConfirm.dontPromptAgain) {
        // 存数据库
        Storage.setNoChildDeletePrompt(true);
        try {
          await api.updateSettings({ no_child_delete_prompt: true });
        } catch (e) { /* 静默失败 */ }
      }
    } else {
      return;
    }
  } else {
    // 无子项 或 用户已勾选"不再提示"
    const confirmed = await Dialog.confirm({
      title: '确认删除',
      message: `确认删除「${item.title}」？`,
      confirmText: '删除',
      cancelText: '取消'
    });
    if (!confirmed.confirmed) return;
  }

  try {
    await api.deleteItem(item.id);
    Toast.success('删除成功');
    await loadItems();
  } catch (e) {
    Toast.error(e.message);
  }
});

// ===== 添加按钮 =====
addRootBtn.addEventListener('click', () => {
  openAddModal(selectedParentId);
});

function openAddModal(parentId) {
  modalParentId = parentId;
  const parentItem = parentId ? getItem(parentId) : null;
  modalTitle.textContent = parentItem
    ? `在「${parentItem.title}」下添加`
    : '在根目录添加';

  modalTypeSelect.value = 'task';
  modalTitleInput.value = '';
  modalContentInput.value = '';
  modalDueDateInput.value = '';
  updateModalFields();
  addModal.style.display = ''; addModal.classList.add('show');
  modalTitleInput.focus();
}

function updateModalFields() {
  const isTask = modalTypeSelect.value === 'task';
  modalContentField.style.display = isTask ? '' : 'none';
  modalDueDateField.style.display = isTask ? '' : 'none';
}

modalTypeSelect.addEventListener('change', updateModalFields);

modalCancelBtn.addEventListener('click', () => {
  addModal.style.display = 'none'; addModal.classList.remove('show');
});

modalConfirmBtn.addEventListener('click', async () => {
  const type = modalTypeSelect.value;
  const title = modalTitleInput.value.trim();

  if (!title) {
    Toast.error('标题不能为空');
    return;
  }

  const content = type === 'task' ? modalContentInput.value.trim() : undefined;
  if (type === 'task' && !content) {
    Toast.error('任务内容不能为空');
    return;
  }

  const due_date = type === 'task' ? (modalDueDateInput.value || null) : undefined;

  try {
    await api.createItem({
      type,
      title,
      content,
      due_date,
      parent_id: modalParentId
    });
    Toast.success('添加成功');
    addModal.style.display = 'none'; addModal.classList.remove('show');
    await loadItems();
  } catch (e) {
    Toast.error(e.message);
  }
});

// 点击遮罩关闭弹窗
addModal.addEventListener('click', (e) => {
  if (e.target === addModal) { addModal.style.display = 'none'; addModal.classList.remove('show'); }
});

// ===== 退出登录 =====
logoutBtn.addEventListener('click', () => {
  Storage.clear();
  window.location.href = 'login.html';
});

// ===== 拖拽调整面板宽度 =====
(function initResizeHandles() {
  function setupResize(handleId, panelSelector, minW, maxW, reverse) {
    const handle = document.getElementById(handleId);
    const panel = document.querySelector(panelSelector);
    if (!handle || !panel) return;

    let isDragging = false;
    let startX = 0;
    let startWidth = 0;

    handle.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startWidth = panel.offsetWidth;
      handle.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const diff = reverse ? (startX - e.clientX) : (e.clientX - startX);
      const newWidth = Math.min(Math.max(startWidth + diff, minW), maxW);
      panel.style.width = newWidth + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      handle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    });
  }

  // 侧栏：160 ~ 600（向右拉变大）
  setupResize('sidebarResizeHandle', '.sidebar', 160, 600, false);
  // 详情面板：240 ~ 520（向左拉变大，方向反转）
  setupResize('detailResizeHandle', '.detail-panel', 240, 520, true);
})();

// ===== 启动 =====
init();
