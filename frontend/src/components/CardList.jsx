import { Checkbox, Tag, Empty, Typography } from 'antd';
import {
  FileTextOutlined, CheckSquareOutlined, StarFilled, FolderOutlined, SyncOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

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

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function isOverdue(item) {
  if (!item.due_date || item.completed) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(item.due_date) < today;
}

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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--fg-muted)', gap: 8, padding: 60 }}>
        <Empty description={EMPTY_MESSAGES[viewKey] || '这里空空如也'} />
      </div>
    );
  }

  const selectableItems = items.filter((i) => !i.recurring);
  const allSelected = selectableItems.length > 0
    && selectableItems.every((i) => batchSelectedIds.includes(i.id));

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {batchMode && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <Checkbox checked={allSelected} onChange={(e) => onBatchSelectAll(e.target.checked ? selectableItems : [])} />
            <span>全选 ({selectableItems.length})</span>
          </label>
        </div>
      )}

      {items.map((item) => {
        const isNote = item.type === 'note';
        const isRecurring = !!item.recurring;
        const overdue = !isNote && !isRecurring && isOverdue(item);
        const completed = !!item.completed;
        const isRecurringView = currentView === 'recurring';

        const showProject = item.project_id && (['today', 'week', 'expired'].includes(currentView) || currentView.startsWith('tag-'));
        const proj = showProject ? projects.find((p) => p.id === item.project_id) : null;

        return (
          <div
            key={item.id}
            onClick={(e) => {
              if (e.target.type === 'checkbox') return;
              if (batchMode && !item.recurring) { onBatchToggle(item.id); return; }
              onSelectItem(item);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', borderRadius: 12,
              background: selectedId === item.id ? 'var(--accent-light)' : 'var(--bg-card)',
              cursor: 'pointer',
              border: selectedId === item.id ? '1px solid var(--accent)' : '1px solid var(--border)',
              boxShadow: selectedId === item.id ? '0 4px 16px color-mix(in srgb, var(--accent) 12%, transparent)' : '0 1px 3px rgba(0,0,0,0.04)',
              opacity: completed && !isRecurringView ? 0.5 : 1,
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            onMouseEnter={(e) => {
              if (selectedId !== item.id) {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedId !== item.id) {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            {batchMode && !item.recurring && (
              <div style={{ display: 'flex', alignItems: 'center', paddingRight: 4 }}>
                <Checkbox checked={batchSelectedIds.includes(item.id)} onChange={(e) => { e.stopPropagation(); onBatchToggle(item.id); }} />
              </div>
            )}

            <div style={{
              width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isNote ? 'var(--accent-light)' : completed ? 'var(--border)' : 'var(--accent-light)',
              color: isNote ? 'var(--complete)' : completed ? 'var(--fg-muted)' : 'var(--accent)',
              fontSize: 15, flexShrink: 0,
            }}>
              {isNote ? <FileTextOutlined /> : <CheckSquareOutlined />}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500, textDecoration: completed ? 'line-through' : 'none', color: completed ? 'var(--fg-muted)' : 'var(--fg-primary)', marginBottom: 2, wordBreak: 'break-word' }}>
                {item.title}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--fg-muted)' }}>
                {proj && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FolderOutlined style={{ fontSize: 11 }} /> {proj.name}</span>}
                {item.due_date && !isNote && (
                  <span style={{ color: overdue ? 'var(--overdue)' : 'var(--fg-muted)', fontWeight: overdue ? 500 : 400 }}>
                    {formatDate(item.due_date)}
                  </span>
                )}
                {item.recurring && completed && isRecurringView && (
                  <span style={{ color: 'var(--complete)', fontWeight: 500, fontSize: 12 }}>
                    {item.recurring === 'daily' ? '今日已完成' : '本周已完成'}
                  </span>
                )}
                {item.recurring && (!isRecurringView || !completed) && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontWeight: 500 }}><SyncOutlined style={{ fontSize: 11 }} /> {RECURRING_LABELS[item.recurring]}</span>
                )}
                {item.priority === 'important' && !completed && <StarFilled style={{ color: 'var(--important)', fontSize: 12 }} />}
                {item.tags && item.tags.map((t) => (
                  <Tag key={t.id} color={t.color} style={{ margin: 0, fontSize: 11 }}>{t.name}</Tag>
                ))}
              </div>
            </div>

            {!isNote && !isRecurringView && (
              <div style={{ flexShrink: 0 }}>
                <Checkbox checked={completed} onChange={(e) => { e.stopPropagation(); onToggleComplete(item.id, e.target.checked); }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
