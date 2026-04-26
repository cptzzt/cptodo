import { useState, useEffect } from 'react';
import '../styles/toast.css';

let toastId = 0;
let addToastFn = null;

export const toast = {
  success(msg) { addToastFn?.(msg, 'success'); },
  error(msg) { addToastFn?.(msg, 'error'); },
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    addToastFn = (message, type = 'success') => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, type === 'error' ? 3500 : 2500);
    };
    return () => { addToastFn = null; };
  }, []);

  return (
    <div id="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type} show`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
