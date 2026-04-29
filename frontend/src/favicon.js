// 根据主题动态更新 favicon
function updateFavicon(themeColor) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="10" fill="${themeColor}"/>
      <path d="M14 24L20 30L34 16" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>
  `;
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = url;
}

// 初始化 favicon
function initFavicon() {
  // 从 CSS 变量获取当前主题色
  const computedStyle = getComputedStyle(document.documentElement);
  const accentColor = computedStyle.getPropertyValue('--accent').trim();

  updateFavicon(accentColor);

  // 监听主题变化（通过自定义事件）
  window.addEventListener('themeChanged', () => {
    setTimeout(() => {
      const newStyle = getComputedStyle(document.documentElement);
      const newAccent = newStyle.getPropertyValue('--accent').trim();
      updateFavicon(newAccent);
    }, 50);
  });
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFavicon);
} else {
  initFavicon();
}
