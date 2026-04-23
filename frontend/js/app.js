// 身份校验
if (!Storage.getToken()) {
  window.location.href = 'login.html';
}

// ===== 状态 =====
let currentView = 'notes';    // 'notes' | 'today' | 'week' | 'project' | 'tag'
let currentProjectId = null;
let currentTagId = null;
let selectedId = null;
let showCompleted = false;
let pendingAddTags = [];   // 待添加的标签 ID
let pendingRemoveTags = []; // 待移除的标签 ID

let allItems = [];
let allProjects = [];
let allTags = [];

// ===== DOM =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// 侧边栏
const logoutBtn = $('#logoutBtn');
const projectListEl = $('#projectList');
const tagListEl = $('#tagList');
const addProjectBtn = $('#addProjectBtn');
const addTagBtn = $('#addTagBtn');
const todayBadge = $('#todayBadge');
const weekBadge = $('#weekBadge');

// 内容区
const viewTitle = $('#viewTitle');
const viewSubtitle = $('#viewSubtitle');
const showCompletedBtn = $('#showCompletedBtn');
const addTaskBtn = $('#addTaskBtn');
const clearProjectBtn = $('#clearProjectBtn');
const quickNoteInput = $('#quickNoteInput');
const quickNoteField = $('#quickNoteField');
const cardList = $('#cardList');
const emptyHint = $('#emptyHint');
const emptyText = $('#emptyText');

// 详情面板
const detailPanel = $('#detailPanel');
const closeDetailBtn = $('#closeDetailBtn');
const detailTitle = $('#detailTitle');
const detailType = $('#detailType');
const convertToTaskField = $('#convertToTaskField');
const convertToTaskCheck = $('#convertToTaskCheck');
const detailTitleInput = $('#detailTitleInput');
const detailContentInput = $('#detailContentInput');
const detailNotesInput = $('#detailNotesInput');
const detailDueDateInput = $('#detailDueDateInput');
const detailPriorityInput = $('#detailPriorityInput');
const detailRecurringInput = $('#detailRecurringInput');
const detailProjectInput = $('#detailProjectInput');
const detailCompletedInput = $('#detailCompletedInput');
const contentField = $('#contentField');
const dueDateField = $('#dueDateField');
const priorityField = $('#priorityField');
const recurringField = $('#recurringField');
const projectField = $('#projectField');
const completedField = $('#completedField');
const tagsField = $('#tagsField');
const detailTagList = $('#detailTagList');
const tagAddSelect = $('#tagAddSelect');
const saveDetailBtn = $('#saveDetailBtn');
const deleteDetailBtn = $('#deleteDetailBtn');

// 弹窗
const addModal = $('#addModal');
const modalTitle = $('#modalTitle');
const modalTypeSelect = $('#modalTypeSelect');
const modalTitleInput = $('#modalTitleInput');
const modalContentInput = $('#modalContentInput');
const modalContentField = $('#modalContentField');
const modalDueDateInput = $('#modalDueDateInput');
const modalDueDateField = $('#modalDueDateField');
const modalPriorityInput = $('#modalPriorityInput');
const modalPriorityField = $('#modalPriorityField');
const modalRecurringInput = $('#modalRecurringInput');
const modalRecurringField = $('#modalRecurringField');
const modalProjectInput = $('#modalProjectInput');
const modalProjectField = $('#modalProjectField');
const modalCancelBtn = $('#modalCancelBtn');
const modalConfirmBtn = $('#modalConfirmBtn');
const modalTypeField = $('#modalTypeField');

// ===== 工具函数 =====
function escapeHtml(text) {
  if (!text) return '';
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

// 把 MySQL 返回的日期（可能带 T 和时区）转为本地日期字符串 YYYY-MM-DD
function localDate(dateStr) {
  if (!dateStr) return '';
  if (dateStr.includes('T')) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  return dateStr;
}

function formatDate(dateStr) {
  const d = localDate(dateStr);
  if (!d) return '';
  const [, m, day] = d.split('-');
  return `${parseInt(m)}月${parseInt(day)}日`;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function weekEnd() {
  const d = new Date();
  d.setDate(d.getDate() + (7 - d.getDay()));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function isOverdue(item) {
  if (!item.due_date || item.completed) return false;
  return localDate(item.due_date) < today();
}

function isToday(dateStr) {
  if (!dateStr) return false;
  return localDate(dateStr) === today();
}

function isThisWeek(dateStr) {
  if (!dateStr) return false;
  const d = localDate(dateStr);
  return d >= today() && d <= weekEnd();
}

function recurringLabel(r) {
  if (!r) return '';
  const map = { daily: '每天', weekly: '每周', monthly: '每月' };
  return map[r] || r;
}

function getItem(id) {
  return allItems.find(i => parseInt(i.id) === parseInt(id));
}

function getProject(id) {
  return allProjects.find(p => parseInt(p.id) === parseInt(id));
}

function getTag(id) {
  return allTags.find(t => parseInt(t.id) === parseInt(id));
}

// ===== 初始化 =====
async function init() {
  await Promise.all([loadProjects(), loadTags(), loadItems()]);
}

// ===== 加载数据 =====
async function loadItems() {
  try {
    const res = await api.getItems();
    allItems = res.data || [];
    renderContent();
    updateBadges();
  } catch (e) {
    Toast.error('加载失败: ' + e.message);
  }
}

async function loadProjects() {
  try {
    const res = await api.getProjects();
    allProjects = res.data || [];
    renderProjectList();
  } catch (e) {
    Toast.error('加载项目失败: ' + e.message);
  }
}

async function loadTags() {
  try {
    const res = await api.getTags();
    allTags = res.data || [];
    renderTagList();
  } catch (e) {
    Toast.error('加载标签失败: ' + e.message);
  }
}

// ===== 侧边栏导航 =====
// 视图切换按钮
$$('.nav-item[data-view]').forEach(el => {
  el.addEventListener('click', () => {
    switchView(el.dataset.view);
  });
});

function switchView(view, projectId, tagId) {
  currentView = view;
  currentProjectId = projectId || null;
  currentTagId = tagId || null;
  selectedId = null;
  closeDetail();
  updateNavActive();
  renderContent();
}

function updateNavActive() {
  // 清除所有 active
  $$('.nav-item').forEach(el => el.classList.remove('active'));
  $$('.nav-project-item').forEach(el => el.classList.remove('active'));
  $$('.nav-tag-item').forEach(el => el.classList.remove('active'));

  if (currentView === 'project' && currentProjectId) {
    const el = $(`.nav-project-item[data-id="${currentProjectId}"]`);
    if (el) el.classList.add('active');
  } else if (currentView === 'tag' && currentTagId) {
    const el = $(`.nav-tag-item[data-id="${currentTagId}"]`);
    if (el) el.classList.add('active');
  } else {
    const el = $(`.nav-item[data-view="${currentView}"]`);
    if (el) el.classList.add('active');
  }
}

// ===== 渲染侧边栏 =====
function renderProjectList() {
  projectListEl.innerHTML = '';
  allProjects.forEach(p => {
    const el = document.createElement('div');
    el.className = `nav-project-item${currentView === 'project' && currentProjectId == p.id ? ' active' : ''}`;
    el.dataset.id = p.id;
    el.innerHTML = `
      <span class="nav-project-dot"></span>
      <span class="nav-project-name">${escapeHtml(p.name)}</span>
      <span class="nav-project-edit" data-id="${p.id}" title="编辑项目">✎</span>
      <span class="nav-project-delete" data-id="${p.id}" title="删除项目">&times;</span>
    `;
    el.addEventListener('click', (e) => {
      if (e.target.closest('.nav-project-delete') || e.target.closest('.nav-project-edit')) return;
      switchView('project', p.id);
    });
    // 编辑项目
    el.querySelector('.nav-project-edit').addEventListener('click', async (e) => {
      e.stopPropagation();
      const newName = await Dialog.prompt({ title: '修改项目', defaultValue: p.name, placeholder: '项目名称' });
      if (!newName || newName === p.name) return;
      try {
        await api.updateProject(p.id, { name: newName });
        Toast.success('项目已更新');
        await loadProjects();
      } catch (err) {
        Toast.error(err.message);
      }
    });
    el.querySelector('.nav-project-delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      // 检查项目内是否有任务
      const taskCount = allItems.filter(i => i.project_id == p.id).length;
      if (taskCount > 0) {
        await Dialog.alert({
          title: '无法删除',
          message: `项目「${p.name}」下还有 ${taskCount} 个任务，请先进入项目清空任务后再删除。`
        });
        return;
      }
      const confirmed = await Dialog.confirm({
        title: '删除项目',
        message: `确认删除项目「${p.name}」？`,
        confirmText: '删除',
        cancelText: '取消'
      });
      if (!confirmed.confirmed) return;
      try {
        await api.deleteProject(p.id);
        Toast.success('项目已删除');
        if (currentView === 'project' && currentProjectId == p.id) {
          switchView('notes');
        }
        await loadProjects();
        await loadItems();
      } catch (e) {
        Toast.error(e.message);
      }
    });
    projectListEl.appendChild(el);
  });
}

function renderTagList() {
  tagListEl.innerHTML = '';
  allTags.forEach(t => {
    const el = document.createElement('div');
    el.className = `nav-tag-item${currentView === 'tag' && currentTagId == t.id ? ' active' : ''}`;
    el.dataset.id = t.id;
    el.innerHTML = `
      <span class="nav-tag-color" style="background:${t.color}"></span>
      <span class="nav-tag-name">${escapeHtml(t.name)}</span>
      <span class="nav-tag-count">${t.item_count || 0}</span>
      <span class="nav-tag-edit" data-id="${t.id}" title="编辑标签">✎</span>
      <span class="nav-tag-delete" data-id="${t.id}" title="删除标签">&times;</span>
    `;
    el.addEventListener('click', (e) => {
      if (e.target.closest('.nav-tag-delete') || e.target.closest('.nav-tag-edit')) return;
      switchView('tag', null, t.id);
    });
    // 编辑标签
    el.querySelector('.nav-tag-edit').addEventListener('click', async (e) => {
      e.stopPropagation();
      const newName = await Dialog.prompt({ title: '修改标签', defaultValue: t.name, placeholder: '标签名称' });
      if (!newName || newName === t.name) return;
      try {
        await api.updateTag(t.id, { name: newName.trim() });
        Toast.success('标签已更新');
        await Promise.all([loadTags(), loadItems()]);
      } catch (err) {
        Toast.error(err.message);
      }
    });
    el.querySelector('.nav-tag-delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      const confirmed = await Dialog.confirm({
        title: '删除标签',
        message: `确认删除标签「${t.name}」？`,
        confirmText: '删除',
        cancelText: '取消'
      });
      if (!confirmed.confirmed) return;
      try {
        await api.deleteTag(t.id);
        Toast.success('标签已删除');
        if (currentView === 'tag' && currentTagId == t.id) {
          switchView('notes');
        }
        await loadTags();
        await loadItems();
      } catch (e) {
        Toast.error(e.message);
      }
    });
    tagListEl.appendChild(el);
  });
}

// 新建项目
addProjectBtn.addEventListener('click', async () => {
  const name = await Dialog.prompt({ title: '新建项目', placeholder: '项目名称' });
  if (!name) return;
  try {
    await api.createProject({ name: name.trim() });
    Toast.success('项目创建成功');
    await loadProjects();
  } catch (e) {
    Toast.error(e.message);
  }
});

// 新建标签
addTagBtn.addEventListener('click', async () => {
  const name = await Dialog.prompt({ title: '新建标签', placeholder: '标签名称' });
  if (!name) return;
  try {
    await api.createTag({ name: name.trim() });
    Toast.success('标签创建成功');
    await loadTags();
  } catch (e) {
    Toast.error(e.message);
  }
});

// ===== 角标更新 =====
function updateBadges() {
  const todayItems = allItems.filter(i => i.type === 'task' && !i.completed && isToday(i.due_date));
  if (todayItems.length > 0) {
    todayBadge.style.display = '';
    todayBadge.textContent = todayItems.length;
  } else {
    todayBadge.style.display = 'none';
  }

  const weekItems = allItems.filter(i => i.type === 'task' && !i.completed && isThisWeek(i.due_date));
  if (weekItems.length > 0) {
    weekBadge.style.display = '';
    weekBadge.textContent = weekItems.length;
  } else {
    weekBadge.style.display = 'none';
  }
}

// ===== 渲染内容区 =====
function renderContent() {
  // 标题和快速输入
  quickNoteInput.style.display = 'none';
  addTaskBtn.style.display = '';
  clearProjectBtn.style.display = 'none';

  let items = [];

  switch (currentView) {
    case 'notes':
      viewTitle.textContent = '随笔';
      viewSubtitle.textContent = '';
      quickNoteInput.style.display = '';
      items = allItems.filter(i => i.type === 'note' && !i.project_id);
      if (!showCompleted) {
        // 随笔没有 completed 概念，全部显示
      }
      break;

    case 'today':
      viewTitle.textContent = '今天';
      viewSubtitle.textContent = formatDate(today());
      addTaskBtn.style.display = 'none';
      items = allItems.filter(i => i.type === 'task' && (isToday(i.due_date) || (i.recurring && !i.due_date)));
      if (!showCompleted) items = items.filter(i => !i.completed);
      break;

    case 'week':
      viewTitle.textContent = '本周';
      viewSubtitle.textContent = `${formatDate(today())} - ${formatDate(weekEnd())}`;
      addTaskBtn.style.display = 'none';
      items = allItems.filter(i => {
        if (i.type !== 'task') return false;
        // 排除今天（今天只在"今天"视图显示）
        if (isToday(i.due_date)) return false;
        return isThisWeek(i.due_date) || (i.recurring && !i.due_date);
      });
      if (!showCompleted) items = items.filter(i => !i.completed);
      break;

    case 'project': {
      const proj = getProject(currentProjectId);
      viewTitle.textContent = proj ? proj.name : '项目';
      viewSubtitle.textContent = '';
      clearProjectBtn.style.display = '';
      items = allItems.filter(i => (i.type === 'task' || i.type === 'note') && i.project_id == currentProjectId);
      if (!showCompleted) items = items.filter(i => !i.completed);
      break;
    }

    case 'tag': {
      const tag = getTag(currentTagId);
      viewTitle.textContent = tag ? tag.name : '标签';
      viewSubtitle.textContent = '';
      items = allItems.filter(i => i.tags && i.tags.some(t => t.id == currentTagId));
      if (!showCompleted) items = items.filter(i => !i.completed);
      break;
    }
  }

  // 排序：重要在前，然后按日期升序，最后按创建时间倒序
  items.sort((a, b) => {
    if (a.type === 'note' && b.type !== 'note') return 1;
    if (a.type !== 'note' && b.type === 'note') return -1;
    const aImp = a.priority === 'important' ? 0 : 1;
    const bImp = b.priority === 'important' ? 0 : 1;
    if (aImp !== bImp) return aImp - bImp;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  renderCards(items);
}

function renderCards(items) {
  cardList.innerHTML = '';

  if (items.length === 0) {
    emptyHint.style.display = '';
    const msgs = {
      notes: '还没有随笔，在上方输入框快速记录',
      today: '今天没有到期任务',
      week: '本周没有到期任务',
      project: '该项目下没有任务',
      tag: '没有任务使用此标签'
    };
    emptyText.textContent = msgs[currentView] || '这里空空如也';
    return;
  }

  emptyHint.style.display = 'none';
  items.forEach(item => {
    cardList.appendChild(createCard(item));
  });
}

function createCard(item) {
  const card = document.createElement('div');
  const isNote = item.type === 'note';
  const isImportant = item.priority === 'important';
  const overdue = !isNote && isOverdue(item);
  const completed = !!item.completed;

  card.className = [
    'item-card',
    isNote ? '' : 'task-card',
    overdue ? 'overdue' : '',
    completed ? 'completed-card' : '',
    isImportant && !completed ? 'important-card' : ''
  ].filter(Boolean).join(' ');
  card.dataset.id = item.id;

  // 标签 HTML
  const tagsHtml = (item.tags && item.tags.length > 0)
    ? item.tags.map(t => `<span class="card-tag" style="background:${t.color}">${escapeHtml(t.name)}</span>`).join('')
    : '';

  // 日期
  const dueHtml = !isNote && item.due_date
    ? `<span class="card-meta${overdue ? ' overdue' : ''}">${formatDate(item.due_date)}</span>`
    : '';

  // 重复
  const recurHtml = item.recurring
    ? `<span class="card-recurring">🔄 ${recurringLabel(item.recurring)}</span>`
    : '';

  // 右侧操作
  const rightAction = isNote
    ? ''
    : `<div class="card-check"><input type="checkbox"${completed ? ' checked' : ''} data-id="${item.id}"></div>`;

  card.innerHTML = `
    <span class="card-icon card-icon-${item.type}">${isNote ? '📝' : '☑'}</span>
    <div class="card-body">
      <div class="card-title">${escapeHtml(item.title)}</div>
      <div class="card-meta">
        ${dueHtml}
        ${recurHtml}
        ${tagsHtml}
      </div>
    </div>
    ${rightAction}
  `;

  // 点击卡片 → 选中开详情
  card.addEventListener('click', (e) => {
    if (e.target.type === 'checkbox') return;
    selectItem(item);
  });

  // 复选框
  if (!isNote) {
    const checkbox = card.querySelector('input[type="checkbox"]');
    if (checkbox) {
      checkbox.addEventListener('change', async (e) => {
        e.stopPropagation();
        try {
          await api.updateItem(item.id, { completed: e.target.checked });
          if (item.recurring && e.target.checked) {
            Toast.success('任务已完成，下一次已创建');
          } else {
            Toast.success(e.target.checked ? '任务已完成' : '已取消完成');
          }
          await loadItems();
        } catch (err) {
          e.target.checked = !e.target.checked;
          Toast.error(err.message);
        }
      });
    }
  }

  return card;
}

// ===== 选中条目（打开详情面板）=====
function selectItem(item) {
  selectedId = item.id;
  pendingAddTags = [];
  pendingRemoveTags = [];
  showDetail(item);
  // 高亮选中卡片
  $$('.item-card').forEach(c => c.classList.remove('selected'));
  const card = $(`.item-card[data-id="${item.id}"]`);
  if (card) card.classList.add('selected');
}

// ===== 右侧详情面板 =====
function populateProjectSelect(selectEl, includeEmpty) {
  const currentVal = selectEl.value;
  selectEl.innerHTML = '';
  if (includeEmpty) {
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '无项目';
    selectEl.appendChild(emptyOpt);
  }
  allProjects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    selectEl.appendChild(opt);
  });
  selectEl.value = currentVal;
}

function showDetail(item) {
  detailPanel.style.display = '';
  detailTitle.textContent = item.title;

  const isNote = item.type === 'note';

  detailType.textContent = isNote ? '随笔' : '任务';
  detailType.className = `detail-badge badge-${item.type}`;
  detailTitleInput.value = item.title;
  detailNotesInput.value = item.notes || '';

  if (isNote) {
    convertToTaskField.style.display = '';
    convertToTaskCheck.checked = false;
    contentField.style.display = 'none';
    dueDateField.style.display = 'none';
    priorityField.style.display = 'none';
    recurringField.style.display = 'none';
    projectField.style.display = '';
    completedField.style.display = 'none';
    tagsField.style.display = '';
    populateProjectSelect(detailProjectInput, true);
    detailProjectInput.value = item.project_id || '';
    renderDetailTags(item);
  } else {
    convertToTaskField.style.display = 'none';
    contentField.style.display = '';
    dueDateField.style.display = '';
    priorityField.style.display = '';
    recurringField.style.display = '';
    projectField.style.display = '';
    completedField.style.display = '';
    tagsField.style.display = '';

    detailContentInput.value = item.content || '';
    detailDueDateInput.value = item.due_date ? localDate(item.due_date) : '';
    detailPriorityInput.value = item.priority || 'normal';
    detailRecurringInput.value = item.recurring || '';
    populateProjectSelect(detailProjectInput, false);
    detailProjectInput.value = item.project_id || '';
    detailCompletedInput.checked = !!item.completed;

    // 渲染标签
    renderDetailTags(item);
  }
}

// 获取当前显示中的标签列表（含暂存变更）
function getVisibleTags(item) {
  const base = (item.tags || []).filter(t => !pendingRemoveTags.includes(t.id));
  const added = pendingAddTags.map(id => allTags.find(t => t.id == id)).filter(Boolean);
  return [...base, ...added];
}

function renderDetailTags(item) {
  detailTagList.innerHTML = '';
  const visibleTags = getVisibleTags(item);

  visibleTags.forEach(t => {
    const chip = document.createElement('span');
    chip.className = 'detail-tag-chip';
    chip.style.background = t.color;
    chip.innerHTML = `${escapeHtml(t.name)} <span class="detail-tag-remove" data-tag-id="${t.id}">&times;</span>`;
    chip.querySelector('.detail-tag-remove').addEventListener('click', () => {
      // 从待添加中移除，或加入待移除列表
      if (pendingAddTags.includes(t.id)) {
        pendingAddTags = pendingAddTags.filter(id => id !== t.id);
      } else {
        pendingRemoveTags.push(t.id);
      }
      renderDetailTags(item);
    });
    detailTagList.appendChild(chip);
  });

  updateTagAddSelect(item);
}

function updateTagAddSelect(item) {
  tagAddSelect.innerHTML = '<option value="">添加标签...</option>';
  const usedIds = getVisibleTags(item).map(t => t.id);
  allTags.forEach(t => {
    if (!usedIds.includes(t.id)) {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      tagAddSelect.appendChild(opt);
    }
  });
}

tagAddSelect.addEventListener('change', () => {
  if (!selectedId || !tagAddSelect.value) return;
  const tagId = parseInt(tagAddSelect.value);
  pendingAddTags.push(tagId);
  // 如果之前在待移除中，取消移除
  pendingRemoveTags = pendingRemoveTags.filter(id => id !== tagId);
  tagAddSelect.value = '';
  const item = getItem(selectedId);
  if (item) renderDetailTags(item);
});

function closeDetail() {
  detailPanel.style.display = 'none';
  selectedId = null;
  $$('.item-card').forEach(c => c.classList.remove('selected'));
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

  if (item.type === 'note' && convertToTaskCheck.checked) {
    // 随笔转任务：项目必选
    if (!detailProjectInput.value) {
      Toast.error('转为任务时必须选择所属项目');
      return;
    }
    data.type = 'task';
    data.project_id = detailProjectInput.value;
    data.content = detailContentInput.value.trim() || null;
    data.due_date = detailDueDateInput.value || null;
    data.priority = detailPriorityInput.value;
    data.recurring = detailRecurringInput.value || null;
    data.completed = false;
  } else if (item.type === 'note') {
    data.project_id = detailProjectInput.value || null;
  }

  if (item.type === 'task') {
    data.content = detailContentInput.value.trim();
    data.due_date = detailDueDateInput.value || null;
    data.priority = detailPriorityInput.value;
    data.recurring = detailRecurringInput.value || null;
    data.project_id = detailProjectInput.value || null;
    data.completed = detailCompletedInput.checked;
  }

  try {
    // 保存基本字段
    await api.updateItem(selectedId, data);

    // 提交标签变更
    const tagPromises = [
      ...pendingAddTags.map(tagId => api.addItemTag(selectedId, tagId)),
      ...pendingRemoveTags.map(tagId => api.removeItemTag(selectedId, tagId))
    ];
    if (tagPromises.length > 0) {
      await Promise.all(tagPromises);
    }

    pendingAddTags = [];
    pendingRemoveTags = [];
    Toast.success('保存成功');
    await Promise.all([loadItems(), loadTags()]);
    // 重新打开详情
    const updated = getItem(selectedId);
    if (updated) showDetail(updated);
  } catch (e) {
    Toast.error(e.message);
  }
});

// ===== 删除项目 =====
deleteDetailBtn.addEventListener('click', async () => {
  if (!selectedId) return;
  const item = getItem(selectedId);
  if (!item) return;

  const confirmed = await Dialog.confirm({
    title: '确认删除',
    message: `确认删除「${item.title}」？`,
    confirmText: '删除',
    cancelText: '取消'
  });
  if (!confirmed.confirmed) return;

  try {
    await api.deleteItem(item.id);
    Toast.success('删除成功');
    closeDetail();
    await loadItems();
  } catch (e) {
    Toast.error(e.message);
  }
});

// ===== 随笔转任务勾选 =====
convertToTaskCheck.addEventListener('change', () => {
  if (!selectedId) return;
  const item = getItem(selectedId);
  if (!item) return;

  if (convertToTaskCheck.checked) {
    // 显示任务字段，项目必选（无"无项目"）
    contentField.style.display = '';
    dueDateField.style.display = '';
    priorityField.style.display = '';
    recurringField.style.display = '';
    completedField.style.display = '';
    populateProjectSelect(detailProjectInput, false);
    detailProjectInput.value = item.project_id || '';
  } else {
    // 恢复随笔状态
    contentField.style.display = 'none';
    dueDateField.style.display = 'none';
    priorityField.style.display = 'none';
    recurringField.style.display = 'none';
    completedField.style.display = 'none';
    populateProjectSelect(detailProjectInput, true);
    detailProjectInput.value = item.project_id || '';
  }
});

closeDetailBtn.addEventListener('click', closeDetail);
clearProjectBtn.addEventListener('click', async () => {
  if (currentView !== 'project' || !currentProjectId) return;
  const projItems = allItems.filter(i => i.project_id == currentProjectId);
  if (projItems.length === 0) {
    Toast.success('项目已为空');
    return;
  }
  const confirmed = await Dialog.confirm({
    title: '清空项目',
    message: `将删除该项目下的所有 ${projItems.length} 个任务和随笔，确认？`,
    confirmText: '全部删除',
    cancelText: '取消'
  });
  if (!confirmed.confirmed) return;
  try {
    await Promise.all(projItems.map(item => api.deleteItem(item.id)));
    Toast.success('已清空');
    closeDetail();
    await Promise.all([loadItems(), loadProjects()]);
  } catch (e) {
    Toast.error(e.message);
  }
});

// ===== 显示已完成切换 =====
showCompletedBtn.addEventListener('click', () => {
  showCompleted = !showCompleted;
  showCompletedBtn.textContent = showCompleted ? '隐藏已完成' : '显示已完成';
  renderContent();
});

// ===== 随笔快速输入 =====
quickNoteField.addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  const title = quickNoteField.value.trim();
  if (!title) return;
  try {
    await api.createItem({ type: 'note', title });
    quickNoteField.value = '';
    Toast.success('随笔已保存');
    await loadItems();
  } catch (err) {
    Toast.error(err.message);
  }
});

// ===== 新建弹窗 =====
addTaskBtn.addEventListener('click', () => {
  openAddModal();
});

function openAddModal() {
  // 根据当前视图预设类型
  if (currentView === 'project') {
    modalTypeSelect.value = 'task';
    modalTypeField.style.display = 'none';
  } else {
    modalTypeSelect.disabled = false;
    modalTypeField.style.display = '';
    if (currentView === 'notes') {
      modalTypeSelect.value = 'note';
    } else {
      modalTypeSelect.value = 'task';
    }
  }

  modalTitle.textContent = '新建';
  modalTitleInput.value = '';
  modalContentInput.value = '';
  modalDueDateInput.value = '';
  modalPriorityInput.value = 'normal';
  modalRecurringInput.value = '';

  // 预设项目
  populateProjectSelect(modalProjectInput, false);
  if (currentView === 'project' && currentProjectId) {
    modalProjectInput.value = currentProjectId;
  } else {
    modalProjectInput.value = '';
  }

  updateModalFields();
  addModal.style.display = '';
  addModal.classList.add('show');
  modalTitleInput.focus();
}

function updateModalFields() {
  const isTask = modalTypeSelect.value === 'task';
  $$('.modal-task-field').forEach(el => el.style.display = isTask ? '' : 'none');
}

modalTypeSelect.addEventListener('change', updateModalFields);

modalCancelBtn.addEventListener('click', () => {
  addModal.style.display = 'none';
  addModal.classList.remove('show');
  modalTypeSelect.disabled = false;
  modalTypeField.style.display = '';
});

modalConfirmBtn.addEventListener('click', async () => {
  const type = modalTypeSelect.value;
  const title = modalTitleInput.value.trim();

  if (!title) {
    Toast.error('标题不能为空');
    return;
  }

  const data = { type, title };

  if (type === 'task') {
    data.content = modalContentInput.value.trim() || null;
    data.priority = modalPriorityInput.value;
    data.recurring = modalRecurringInput.value || null;
    // 设了重复但没设日期，自动用今天
    if (data.recurring && !modalDueDateInput.value) {
      data.due_date = today();
    } else {
      data.due_date = modalDueDateInput.value || null;
    }
    data.project_id = modalProjectInput.value || null;
    if (currentView === 'project' && currentProjectId) {
      data.project_id = currentProjectId;
    }
  }

  try {
    const res = await api.createItem(data);
    // 标签视图下自动给新任务打上当前标签
    if (currentView === 'tag' && currentTagId && res.data && res.data.id) {
      await api.addItemTag(res.data.id, currentTagId);
    }
    Toast.success('创建成功');
    addModal.style.display = 'none';
    addModal.classList.remove('show');
    modalTypeSelect.disabled = false;
    modalTypeField.style.display = '';
    await Promise.all([loadItems(), loadTags()]);
  } catch (e) {
    Toast.error(e.message);
  }
});

// 点击遮罩关闭弹窗
addModal.addEventListener('click', (e) => {
  if (e.target === addModal) {
    addModal.style.display = 'none';
    addModal.classList.remove('show');
  }
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

  setupResize('sidebarResizeHandle', '.sidebar', 200, 400, false);
  setupResize('detailResizeHandle', '.detail-panel', 240, 520, true);
})();

// ===== 启动 =====
init();
