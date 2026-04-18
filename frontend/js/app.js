// 身份校验：未登录则跳转到登录页
if (!Storage.getToken()) {
  window.location.href = 'login.html';
}

const taskList = document.getElementById('taskList');
const emptyMsg = document.getElementById('emptyMsg');
const addTaskForm = document.getElementById('addTaskForm');
const taskInput = document.getElementById('taskInput');
const logoutBtn = document.getElementById('logoutBtn');
const tabBtns = document.querySelectorAll('.tab-btn');

let currentTab = 'all';
let tasks = [];

// 加载任务
async function loadTasks() {
  try {
    const res = await api.getTasks();
    tasks = res.data;
    renderTasks();
  } catch (error) {
    console.error('加载任务失败:', error);
  }
}

// 渲染任务列表
function renderTasks() {
  // 过滤任务
  let filteredTasks = tasks;
  if (currentTab === 'pending') {
    filteredTasks = tasks.filter(t => !t.completed);
  } else if (currentTab === 'completed') {
    filteredTasks = tasks.filter(t => t.completed);
  }

  // 清空列表
  taskList.innerHTML = '';

  if (filteredTasks.length === 0) {
    emptyMsg.style.display = 'block';
    return;
  }

  emptyMsg.style.display = 'none';

  // 渲染每个任务
  filteredTasks.forEach(task => {
    const li = document.createElement('li');
    li.className = `task-item${task.completed ? ' completed' : ''}`;
    li.innerHTML = `
      <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} data-id="${task.id}">
      <span class="task-content">${escapeHtml(task.content)}</span>
      <div class="task-actions">
        <button class="btn btn-danger delete-btn" data-id="${task.id}">删除</button>
      </div>
    `;
    taskList.appendChild(li);
  });
}

// HTML 转义，防止 XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 添加任务
addTaskForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const content = taskInput.value.trim();
  if (!content) return;

  const submitBtn = addTaskForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    await api.createTask(content);
    taskInput.value = '';
    await loadTasks();
  } catch (error) {
    alert(error.message);
  } finally {
    submitBtn.disabled = false;
  }
});

// 任务操作（切换状态、删除）
taskList.addEventListener('click', async (e) => {
  const target = e.target;

  // 切换完成状态
  if (target.classList.contains('task-checkbox')) {
    const id = parseInt(target.dataset.id);
    const task = tasks.find(t => t.id === id);
    if (task) {
      try {
        await api.updateTask(id, { completed: !task.completed });
        await loadTasks();
      } catch (error) {
        alert(error.message);
      }
    }
  }

  // 删除任务
  if (target.classList.contains('delete-btn')) {
    const id = parseInt(target.dataset.id);
    if (confirm('确定要删除这个任务吗？')) {
      try {
        await api.deleteTask(id);
        await loadTasks();
      } catch (error) {
        alert(error.message);
      }
    }
  }
});

// 标签页切换
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;
    renderTasks();
  });
});

// 退出登录
logoutBtn.addEventListener('click', () => {
  Storage.clear();
  window.location.href = 'login.html';
});

// 初始化
loadTasks();
