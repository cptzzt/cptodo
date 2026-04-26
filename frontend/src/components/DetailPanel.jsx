import { useState, useEffect } from 'react';
import '../styles/detail.css';

export default function DetailPanel({
  item,
  projects,
  allTags,
  onClose,
  onSave,
  onDelete,
  onAddItemTag,
  onRemoveItemTag,
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('normal');
  const [completed, setCompleted] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [convertToTask, setConvertToTask] = useState(false);

  // 当 item 变化时，重新填充表单
  useEffect(() => {
    if (!item) return;
    setTitle(item.title || '');
    setContent(item.content || '');
    setNotes(item.notes || '');
    if (item.due_date) {
      const d = new Date(item.due_date);
      setDueDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    } else {
      setDueDate('');
    }
    setPriority(item.priority || 'normal');
    setCompleted(!!item.completed);
    setProjectId(item.project_id || '');
    setConvertToTask(false);
  }, [item]);

  if (!item) return null;

  const isNote = item.type === 'note';
  const isRecurring = !!item.recurring;

  function handleSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    const data = { title: trimmedTitle, notes: notes.trim() };
    if (isNote && convertToTask) {
      if (!projectId) return;
      data.type = 'task';
      data.project_id = projectId;
    }
    if (!isNote) {
      data.content = content.trim();
      data.due_date = dueDate || null;
      data.priority = priority;
      data.completed = completed;
      if (!isRecurring) data.project_id = projectId || null;
    }
    onSave(item.id, data);
  }

  const itemTags = item.tags || [];
  const usedTagIds = itemTags.map((t) => t.id);
  const availableTags = allTags.filter((t) => !usedTagIds.includes(t.id));

  return (
    <aside className="detail-panel">
      <div className="detail-header">
        <span className="detail-title">{item.title}</span>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>关闭</button>
      </div>

      <div className="detail-body">
        <div className="detail-badge-wrapper">
          <span className={`detail-badge badge-${item.type}`}>
            {isNote ? '随笔' : isRecurring ? '重复任务' : '任务'}
          </span>
        </div>

        {/* 随笔转任务 */}
        {isNote && (
          <div className="detail-field">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={convertToTask}
                onChange={(e) => setConvertToTask(e.target.checked)}
              />
              <span>转为任务（不可逆）</span>
            </label>
          </div>
        )}

        {/* 标题 */}
        <div className="detail-field">
          <label className="detail-label">标题</label>
          <input
            type="text"
            className="detail-input"
            maxLength={255}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* 内容（仅任务） */}
        {!isNote && (
          <div className="detail-field">
            <label className="detail-label">内容</label>
            <textarea
              className="detail-textarea"
              rows={4}
              maxLength={500}
              placeholder="任务内容..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
        )}

        {/* 备注 */}
        <div className="detail-field">
          <label className="detail-label">备注</label>
          <textarea
            className="detail-textarea"
            rows={3}
            maxLength={1000}
            placeholder="添加备注..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* 截止日期（仅任务） */}
        {!isNote && (
          <div className="detail-field">
            <label className="detail-label">截止日期</label>
            <input
              type="date"
              className="detail-input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        )}

        {/* 优先级（仅任务） */}
        {!isNote && (
          <div className="detail-field">
            <label className="detail-label">优先级</label>
            <select
              className="detail-input"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="normal">普通</option>
              <option value="important">重要</option>
            </select>
          </div>
        )}

        {/* 所属项目 */}
        {!isRecurring && (
          <div className="detail-field">
            <label className="detail-label">所属项目</label>
            <select
              className="detail-input"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">无项目</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* 已完成（仅任务） */}
        {!isNote && (
          <div className="detail-field">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={completed}
                onChange={(e) => setCompleted(e.target.checked)}
              />
              <span>标记为已完成</span>
            </label>
          </div>
        )}

        {/* 标签 */}
        <div className="detail-field">
          <label className="detail-label">标签</label>
          <div className="detail-tags">
            {itemTags.map((t) => (
              <span key={t.id} className="detail-tag-chip" style={{ background: t.color }}>
                {t.name}
                <span className="detail-tag-remove" onClick={() => onRemoveItemTag(item.id, t.id)}>
                  &times;
                </span>
              </span>
            ))}
          </div>
          {availableTags.length > 0 && (
            <div className="tag-add-row">
              <select
                className="detail-input"
                value=""
                onChange={(e) => {
                  if (e.target.value) onAddItemTag(item.id, Number(e.target.value));
                }}
              >
                <option value="">添加标签...</option>
                {availableTags.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="detail-actions">
          <button className="btn btn-primary btn-full" onClick={handleSave}>保存修改</button>
          <button className="btn btn-danger btn-full" onClick={() => onDelete(item)}>删除</button>
          {isRecurring && (
            <p className="recurring-delete-hint">删除重复任务则下个周期不会重建</p>
          )}
        </div>
      </div>
    </aside>
  );
}
