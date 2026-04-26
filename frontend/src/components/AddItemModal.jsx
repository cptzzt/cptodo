import { useState, useEffect } from 'react';
import '../styles/modal.css';

function toDateStr(val) {
  if (!val) return '';
  const d = val instanceof Date ? val : new Date(val);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function today() { return toDateStr(new Date()); }
function weekStart() {
  const d = new Date();
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  return toDateStr(d);
}
function weekEnd() {
  const d = new Date();
  const diff = d.getDay() === 0 ? 0 : 7 - d.getDay();
  d.setDate(d.getDate() + diff);
  return toDateStr(d);
}
function nextDayOfWeek(day) {
  const d = new Date();
  const current = d.getDay();
  let diff = day - current;
  if (diff <= 0) diff += 7;
  d.setDate(d.getDate() + diff);
  return toDateStr(d);
}

export default function AddItemModal({ currentView, currentProjectId, currentTagId, projects, onConfirm, onCancel }) {
  const [type, setType] = useState('task');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('normal');
  const [recurring, setRecurring] = useState('');
  const [weekDay, setWeekDay] = useState('1');
  const [projectId, setProjectId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (currentView === 'notes') setType('note');
    else setType('task');

    if (currentView === 'recurring') setRecurring('daily');
    else setRecurring('');

    if (currentView === 'today') setDueDate(today());
    else if (currentView === 'week') setDueDate(weekEnd());
    else setDueDate('');

    if (currentView.startsWith('project-')) setProjectId(currentProjectId || '');
    else setProjectId('');

    setTitle('');
    setContent('');
    setPriority('normal');
    setWeekDay('1');
  }, [currentView, currentProjectId]);

  const isTask = type === 'task';
  const isRecurringView = currentView === 'recurring';
  const isTodayView = currentView === 'today';
  const isWeekView = currentView === 'week';
  const hideTypeSelect = ['project', 'today', 'week', 'recurring'].includes(currentView) || currentView.startsWith('project-');

  function getModalTitle() {
    if (isRecurringView) return '新建重复任务';
    return '新建';
  }

  // 控制字段可见性
  const showRecurring = isRecurringView;
  const showDueDate = isTask && !isRecurringView && !isTodayView && !(isRecurringView && recurring === 'daily');
  const showWeekDay = isRecurringView && recurring === 'weekly';
  const showProject = isTask && !isRecurringView;
  const showContent = isTask;

  async function handleSubmit() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const data = { type, title: trimmedTitle };

    if (isTask) {
      data.content = content.trim() || null;
      data.priority = priority;

      if (isRecurringView) {
        data.recurring = recurring || 'daily';
        if (data.recurring === 'daily') data.due_date = today();
        else data.due_date = nextDayOfWeek(parseInt(weekDay));
      } else if (isTodayView) {
        data.due_date = today();
      } else if (isWeekView) {
        const d = dueDate;
        if (d && (d < weekStart() || d > weekEnd())) return;
        data.due_date = d || weekEnd();
      } else {
        data.due_date = dueDate || null;
      }

      if (currentView.startsWith('project-') && currentProjectId) {
        data.project_id = currentProjectId;
      }
    }

    setSubmitting(true);
    await onConfirm(data, currentView.startsWith('tag-') ? currentTagId : null);
    setSubmitting(false);
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal-box">
        <h3 className="modal-title">{getModalTitle()}</h3>

        {!hideTypeSelect && (
          <div className="modal-field">
            <label>类型</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="task">任务</option>
              <option value="note">随笔</option>
            </select>
          </div>
        )}

        <div className="modal-field">
          <label>标题</label>
          <input
            type="text"
            maxLength={255}
            placeholder="输入标题..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !submitting && handleSubmit()}
            autoFocus
          />
        </div>

        {showContent && (
          <div className="modal-field">
            <label>内容</label>
            <textarea rows={3} maxLength={500} placeholder="输入任务内容..."
              value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
        )}

        {showDueDate && (
          <div className="modal-field">
            <label>截止日期</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              min={isWeekView ? weekStart() : undefined} max={isWeekView ? weekEnd() : undefined} />
          </div>
        )}

        {isTask && (
          <div className="modal-field">
            <label>优先级</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="normal">普通</option>
              <option value="important">重要</option>
            </select>
          </div>
        )}

        {showRecurring && (
          <div className="modal-field">
            <label>重复</label>
            <select value={recurring} onChange={(e) => setRecurring(e.target.value)}>
              <option value="daily">每天</option>
              <option value="weekly">每周</option>
            </select>
          </div>
        )}

        {showWeekDay && (
          <div className="modal-field">
            <label>重复日</label>
            <select value={weekDay} onChange={(e) => setWeekDay(e.target.value)}>
              <option value="1">周一</option>
              <option value="2">周二</option>
              <option value="3">周三</option>
              <option value="4">周四</option>
              <option value="5">周五</option>
              <option value="6">周六</option>
              <option value="0">周日</option>
            </select>
          </div>
        )}

        {showProject && (
          <div className="modal-field">
            <label>项目</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">无项目</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onCancel}>取消</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || !title.trim()}>
            {submitting ? '创建中...' : '确认新建'}
          </button>
        </div>
      </div>
    </div>
  );
}
