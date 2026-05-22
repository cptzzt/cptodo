export function isSupported() {
  return 'Notification' in window;
}

export async function requestPermission() {
  if (!isSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function showNotification(title, body) {
  if (!isSupported() || Notification.permission !== 'granted') return;
  new Notification(title, {
    body,
    icon: '/favicon.ico',
  });
}
