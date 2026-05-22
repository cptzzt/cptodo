const STORAGE_KEY = 'cptodo_reminders';

function getAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveAll(reminders) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

export function setReminder(itemId, time, title) {
  const reminders = getAll();
  reminders[itemId] = { time, title, notified: false };
  saveAll(reminders);
}

export function removeReminder(itemId) {
  const reminders = getAll();
  delete reminders[itemId];
  saveAll(reminders);
}

export function getReminder(itemId) {
  return getAll()[itemId] || null;
}

export function getDueReminders() {
  const reminders = getAll();
  const now = new Date();
  const due = [];
  for (const [id, r] of Object.entries(reminders)) {
    if (!r.notified && new Date(r.time) <= now) {
      due.push({ id, ...r });
    }
  }
  return due;
}

export function markNotified(itemId) {
  const reminders = getAll();
  if (reminders[itemId]) {
    reminders[itemId].notified = true;
    saveAll(reminders);
  }
}

export function cleanupOldReminders() {
  const reminders = getAll();
  const oneDayAgo = Date.now() - 86400000;
  let changed = false;
  for (const [id, r] of Object.entries(reminders)) {
    if (r.notified && new Date(r.time).getTime() < oneDayAgo) {
      delete reminders[id];
      changed = true;
    }
  }
  if (changed) saveAll(reminders);
}
