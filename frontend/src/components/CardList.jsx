import { useState, useRef, useEffect } from 'react';
import { Checkbox, Tag, Empty, Typography, Grid } from 'antd';
import {
  FileTextOutlined, CheckSquareOutlined, StarFilled, FolderOutlined, SyncOutlined, LockOutlined,
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
  showCompleted,
  onCheckAuth,
}) {
  const { md } = Grid.useBreakpoint();
  const isMobile = !md;
  const [completingIds, setCompletingIds] = useState(new Set());
  const [hidingIds, setHidingIds] = useState(new Set());
  const [collapsingIds, setCollapsingIds] = useState(new Set());
  const timerRef = useRef({});
  const heightMap = useRef({});
  const scrollRef = useRef(null);
  const collapsingCount = useRef(0);

  useEffect(() => {
    setCompletingIds(new Set());
    setHidingIds(new Set());
    setCollapsingIds(new Set());
    Object.values(timerRef.current).forEach(clearTimeout);
    timerRef.current = {};
    collapsingCount.current = 0;
    if (scrollRef.current) scrollRef.current.style.overflowY = 'auto';
  }, [showCompleted]);

  function handleToggleComplete(id, checked) {
    if (onCheckAuth && !onCheckAuth()) return;
    if (checked && !showCompleted) {
      setCompletingIds((prev) => new Set(prev).add(id));
      collapsingCount.current++;
      if (scrollRef.current) scrollRef.current.style.overflowY = 'hidden';
      timerRef.current[id] = setTimeout(() => {
        setCompletingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
        const h = heightMap.current[id] || 50;
        heightMap.current[id + '_h'] = h;
        setCollapsingIds((prev) => new Set(prev).add(id));
        requestAnimationFrame(() => {
          const el = heightMap.current[id + '_el'];
          const collapsedH = el ? el.offsetHeight + 8 : h + 8;
          requestAnimationFrame(() => {
            setHidingIds((prev) => new Set(prev).add(id));
            if (scrollRef.current) scrollRef.current.scrollTop -= collapsedH;
          });
        });
        timerRef.current[id + '_hide'] = setTimeout(() => {
          collapsingCount.current--;
          if (collapsingCount.current <= 0 && scrollRef.current) {
            scrollRef.current.style.overflowY = 'auto';
          }
          onToggleComplete(id, checked);
          delete heightMap.current[id];
          delete heightMap.current[id + '_h'];
          delete heightMap.current[id + '_el'];
          delete timerRef.current[id];
          delete timerRef.current[id + '_hide'];
        }, 300);
      }, 300);
    } else {
      onToggleComplete(id, checked);
    }
  }
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
    <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: isMobile ? '8px 12px' : '16px 24px', display: 'flex', flexDirection: 'column' }}>
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
        const recurringDone = isRecurring && item.recurring_target > 1 && (item.recurring_count || 0) >= item.recurring_target;
        const overdue = !isNote && !isRecurring && isOverdue(item);
        const completed = !!item.completed || recurringDone;
        const isRecurringView = currentView === 'recurring';

        const showProject = item.project_id && (['today', 'week', 'expired'].includes(currentView) || currentView.startsWith('tag-'));
        const proj = showProject ? projects.find((p) => p.id === item.project_id) : null;

        return (
          <div
            key={item.id}
            ref={(el) => { if (el) { heightMap.current[item.id] = el.offsetHeight; heightMap.current[item.id + '_el'] = el; } }}
            onClick={(e) => {
              if (e.target.type === 'checkbox') return;
              if (batchMode) {
                if (!item.recurring) onBatchToggle(item.id);
                return;
              }
              onSelectItem(item);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              marginBottom: hidingIds.has(item.id) || collapsingIds.has(item.id) ? 0 : (isMobile ? 6 : 8),
              padding: hidingIds.has(item.id) ? '0 16px' : '12px 16px',
              borderRadius: 12,
              background: selectedId === item.id ? 'var(--accent-light)' : 'var(--bg-card)',
              cursor: batchMode && item.recurring ? 'default' : 'pointer',
              border: selectedId === item.id ? '1px solid var(--accent)' : '1px solid var(--border)',
              boxShadow: selectedId === item.id ? '0 4px 16px color-mix(in srgb, var(--accent) 12%, transparent)' : '0 1px 3px rgba(0,0,0,0.04)',
              maxHeight: hidingIds.has(item.id) ? 0 : collapsingIds.has(item.id) ? (heightMap.current[item.id + '_h'] || 50) : undefined,
              overflow: (hidingIds.has(item.id) || collapsingIds.has(item.id)) ? 'hidden' : undefined,
              opacity: hidingIds.has(item.id) ? 0 : completingIds.has(item.id) ? 0.5 : 1,
              transition: (hidingIds.has(item.id) || collapsingIds.has(item.id))
                ? 'max-height 0.3s cubic-bezier(0.33, 1, 0.68, 1), padding 0.3s cubic-bezier(0.33, 1, 0.68, 1), margin-bottom 0.3s cubic-bezier(0.33, 1, 0.68, 1), opacity 0.3s ease-out'
                : 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
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
              <div style={{ fontSize: 13.5, fontWeight: 500, textDecoration: (completed || completingIds.has(item.id)) ? 'line-through' : 'none', color: (completed || completingIds.has(item.id)) ? 'var(--fg-muted)' : 'var(--fg-primary)', marginBottom: 2, lineHeight: '20px' }}>
                {item.project_label && currentView.startsWith('project-') && (
                  <span style={{
                    display: 'inline-block', verticalAlign: 'middle',
                    padding: '0 8px', borderRadius: 9999, fontSize: 11, lineHeight: '18px',
                    background: item.project_label.color + '18', color: item.project_label.color,
                    whiteSpace: 'nowrap',
                  }}>
                    {item.project_label.name}
                  </span>
                )}{' '}
                <span>{item.title}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--fg-muted)' }}>
                {proj && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FolderOutlined style={{ fontSize: 11 }} /> {proj.name}</span>}
                {item.due_date && !isNote && !(item.recurring && item.recurring_target > 1) && (
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
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontWeight: 500 }}>
                    <SyncOutlined style={{ fontSize: 11 }} /> {RECURRING_LABELS[item.recurring]}
                    {item.recurring_target > 1 && <span>({item.recurring_count || 0}/{item.recurring_target})</span>}
                  </span>
                )}
                {item.priority === 'important' && !completed && <StarFilled style={{ color: 'var(--important)', fontSize: 12 }} />}
                {item.tags && item.tags.map((t) => (
                  <Tag key={t.id} color={t.color} style={{ margin: 0, fontSize: 11 }}>{t.name}</Tag>
                ))}
                {item.is_private === 1 && <LockOutlined style={{ color: 'var(--fg-muted)', fontSize: 11 }} />}
              </div>
            </div>

            {!isNote && !isRecurringView && !batchMode && (
              item.recurring && item.recurring_target > 1 ? (
                <div
                  style={{
                    flexShrink: 0, cursor: recurringDone ? 'default' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 42, height: 24, borderRadius: 6, fontSize: 12, fontWeight: 600,
                    border: `2px solid ${recurringDone ? 'var(--complete)' : 'var(--accent)'}`,
                    color: recurringDone ? 'var(--complete)' : 'var(--accent)',
                    background: recurringDone ? 'var(--accent-light)' : 'transparent',
                    opacity: recurringDone ? 0.7 : 1,
                    transition: 'all 0.15s',
                  }}
                  onClick={(e) => { e.stopPropagation(); if (!recurringDone) onToggleComplete(item.id, true); }}
                >
                  {item.recurring_count || 0}/{item.recurring_target}
                </div>
              ) : !batchMode ? (
                <div
                  style={{ flexShrink: 0, padding: '8px 4px', cursor: 'pointer' }}
                  onClick={(e) => { if (e.target.closest('.ant-checkbox')) return; e.stopPropagation(); handleToggleComplete(item.id, !(completed || completingIds.has(item.id))); }}
                >
                  <Checkbox checked={completed || completingIds.has(item.id)} onChange={(e) => { e.stopPropagation(); handleToggleComplete(item.id, e.target.checked); }} />
                </div>
              ) : null
            )}
          </div>
        );
      })}
    </div>
  );
}
