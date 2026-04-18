// 检查是否已登录
if (Storage.getToken()) {
  window.location.href = 'index.html';
}

const form = document.getElementById('registerForm');
const errorMsg = document.getElementById('errorMsg');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const submitBtn = form.querySelector('button[type="submit"]');

  // 前端校验
  if (!username || !password || !confirmPassword) {
    errorMsg.textContent = '请填写所有字段';
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

  if (password !== confirmPassword) {
    errorMsg.textContent = '两次密码输入不一致';
    return;
  }

  // 禁用按钮，防止重复提交
  submitBtn.disabled = true;
  errorMsg.textContent = '';

  try {
    await api.register(username, password);

    // 注册成功，提示并跳转登录页
    errorMsg.className = 'success-msg';
    errorMsg.textContent = '注册成功，正在跳转...';
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1500);
  } catch (error) {
    errorMsg.className = 'error-msg';
    errorMsg.textContent = error.message;
    submitBtn.disabled = false;
  }
});
