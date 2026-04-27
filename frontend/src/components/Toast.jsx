let staticMessage = null;

export const toast = {
  init(messageApi) { staticMessage = messageApi; },
  success(msg) { staticMessage?.success(msg); },
  error(msg) { staticMessage?.error(msg); },
};

// 不再需要 ToastContainer 组件，antd message 自带渲染
export default function ToastContainer() { return null; }
