// 检查是否已登录
if (Storage.getToken()) {
  window.location.href = 'index.html';
}

const form = document.getElementById('loginForm');
const errorMsg = document.getElementById('errorMsg');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const submitBtn = form.querySelector('button[type="submit"]');

  // 前端校验
  if (!username || !password) {
    errorMsg.textContent = '请填写用户名和密码';
    return;
  }

  if (username.length < 3 || username.length > 50) {
    errorMsg.textContent = '用户名长度需在 3-50 个字符之间';
    return;
  }

  if (password.length < 6) {
    errorMsg.textContent = '密码长度不能少于 6 位';
    return;
  }

  // 禁用按钮，防止重复提交
  submitBtn.disabled = true;
  errorMsg.textContent = '';

  try {
    const res = await api.login(username, password);

    // 保存 token 和用户信息
    Storage.setToken(res.data.token);
    Storage.setUser(res.data.user);

    // 跳转到主页
    window.location.href = 'index.html';
  } catch (error) {
    errorMsg.textContent = error.message;
  } finally {
    submitBtn.disabled = false;
  }
});
