import '../styles/cardlist.css';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function isOverdue(item) {
  if (!item.due_date || item.completed) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(item.due_date + 'T00:00:00') < today;
}

const RECURRING_LABELS = { daily: '每天', weekly: '每周' };

const EMPTY_MESSAGES = {
  notes: '还没有随笔，在上方输入框快速记录',
  today: '今天没有到期任务',
  week: '本周没有到期任务',
  project: '该项目下没有任务',
  tag: '没有任务使用此标签',
  recurring: '没有重复任务',
  expired: '没有过期的任务',
};

export default function CardList({
  items,
  currentView,
  selectedId,
  projects,
  batchMode,
  batchSelectedIds,
  onSelectItem,
  onToggleComplete,
  onBatchToggle,
  onBatchSelectAll,
  onExitBatch,
}) {
  if (items.length === 0) {
    const viewKey = currentView.startsWith('project-') ? 'project'
      : currentView.startsWith('tag-') ? 'tag'
      : currentView;
    return (
      <div className="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p>{EMPTY_MESSAGES[viewKey] || '这里空空如也'}</p>
      </div>
    );
  }

  const selectableItems = items.filter((i) => !i.recurring);
  const allSelected = selectableItems.length > 0
    && selectableItems.every((i) => batchSelectedIds.includes(i.id));

  return (
    <div className="card-list">
      {/* 批量模式全选行 */}
      {batchMode && (
        <div className="batch-select-all-row">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => onBatchSelectAll(e.target.checked ? selectableItems : [])}
            />
            <span>全选 ({selectableItems.length})</span>
          </label>
          <button className="btn btn-ghost btn-sm" onClick={onExitBatch}>退出</button>
        </div>
      )}

      {items.map((item) => {
        const isNote = item.type === 'note';
        const overdue = !isNote && isOverdue(item);
        const completed = !!item.completed;
        const isImportant = item.priority === 'important' && !completed;

        // 所属项目（仅今天/本周/已过期/标签视图显示）
        const showProject = item.project_id && (['today', 'week', 'expired'].includes(currentView) || currentView.startsWith('tag-'));
        const proj = showProject ? projects.find((p) => p.id === item.project_id) : null;

        const cardClasses = [
          'item-card',
          overdue ? 'overdue' : '',
          completed ? 'completed-card' : '',
          isImportant ? 'important-card' : '',
          selectedId === item.id ? 'selected' : '',
        ].filter(Boolean).join(' ');

        return (
          <div
            key={item.id}
            className={cardClasses}
            onClick={(e) => {
              if (e.target.type === 'checkbox') return;
              if (batchMode && !item.recurring) {
                onBatchToggle(item.id);
                return;
              }
              onSelectItem(item);
            }}
          >
            {/* 批量选择框 */}
            {batchMode && !item.recurring && (
              <div className="card-batch-check">
                <input
                  type="checkbox"
                  checked={batchSelectedIds.includes(item.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    onBatchToggle(item.id);
                  }}
                />
              </div>
            )}

            {/* 图标 */}
            <span className={`card-icon card-icon-${item.type}`}>
              {isNote ? '📝' : '☑'}
            </span>

            {/* 内容 */}
            <div className="card-body">
              <div className="card-title">{item.title}</div>
              <div className="card-meta-row">
                {proj && <span className="card-meta">📁 {proj.name}</span>}
                {item.due_date && !isNote && (
                  <span className={`card-meta${overdue ? ' overdue' : ''}`}>
                    {formatDate(item.due_date)}
                  </span>
                )}
                {item.recurring && (
                  <span className="card-recurring">🔄 {RECURRING_LABELS[item.recurring]}</span>
                )}
                {item.tags && item.tags.map((t) => (
                  <span key={t.id} className="card-tag" style={{ background: t.color }}>
                    {t.name}
                  </span>
                ))}
              </div>
            </div>

            {/* 完成复选框 */}
            {!isNote && (
              <div className="card-check">
                <input
                  type="checkbox"
                  checked={completed}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggleComplete(item.id, e.target.checked);
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
