import { Table, Checkbox, Tag, Empty, Grid } from 'antd';
import { StarFilled } from '@ant-design/icons';

// 截止日期格式化：与 CardList 保持一致（x月x日）
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

// 是否过期（未完成且早于今天）
function isOverdue(item) {
  if (!item.due_date || item.completed) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(item.due_date) < today;
}

export default function ProjectTable({
  items,
  selectedId,
  onSelectItem,
  onToggleComplete,
}) {
  const { md } = Grid.useBreakpoint();
  const isMobile = !md;

  if (!items || items.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--fg-muted)', gap: 8, padding: 60 }}>
        <Empty description="该项目下没有任务" />
      </div>
    );
  }

  const columns = [
    {
      title: '', key: 'completed', width: 48, align: 'center',
      render: (_, item) => {
        // 随笔没有完成状态，不显示勾选框
        if (item.type === 'note') return null;
        return (
          <Checkbox
            checked={!!item.completed}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onToggleComplete(item.id, e.target.checked)}
          />
        );
      },
    },
    {
      title: '标题', key: 'title', ellipsis: true,
      render: (_, item) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {item.project_label && (
            <span style={{
              flexShrink: 0, display: 'inline-block',
              padding: '0 8px', borderRadius: 9999, fontSize: 11, lineHeight: '18px',
              background: item.project_label.color + '18', color: item.project_label.color,
              whiteSpace: 'nowrap',
            }}>
              {item.project_label.name}
            </span>
          )}
          <span style={{
            textDecoration: item.completed ? 'line-through' : 'none',
            color: item.completed ? 'var(--fg-muted)' : 'var(--fg-primary)',
            fontSize: 13.5, fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {item.title}
          </span>
        </div>
      ),
    },
    {
      title: '截止日期', key: 'due_date', width: 100,
      sorter: (a, b) => (a.due_date || '').localeCompare(b.due_date || ''),
      render: (_, item) => {
        if (!item.due_date || item.type === 'note') {
          return <span style={{ color: 'var(--fg-muted)' }}>—</span>;
        }
        const overdue = isOverdue(item);
        return (
          <span style={{ color: overdue ? 'var(--overdue)' : 'var(--fg-muted)', fontWeight: overdue ? 500 : 400 }}>
            {formatDate(item.due_date)}
          </span>
        );
      },
    },
    {
      title: '优先级', key: 'priority', width: 80, align: 'center',
      sorter: (a, b) => (a.priority === 'important' ? 0 : 1) - (b.priority === 'important' ? 0 : 1),
      render: (_, item) => item.priority === 'important'
        ? <StarFilled style={{ color: 'var(--important)' }} />
        : <span style={{ color: 'var(--fg-muted)', fontSize: 12 }}>普通</span>,
    },
    {
      title: '标签', key: 'tags',
      render: (_, item) => {
        if (!item.tags || item.tags.length === 0) {
          return <span style={{ color: 'var(--fg-muted)' }}>—</span>;
        }
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {item.tags.map((t) => (
              <Tag key={t.id} color={t.color} style={{ margin: 0, fontSize: 11 }}>{t.name}</Tag>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '8px 12px 40px' : '16px 24px 40px' }}>
      {/* 表格主题微调：让 antd Table 贴合项目的 CSS 变量配色 */}
      <style>{`
        .proj-table .ant-table { background: transparent; }
        .proj-table .ant-table-thead > tr > th {
          background: var(--bg-sidebar) !important;
          color: var(--fg-secondary) !important;
          font-weight: 600;
          font-size: 13px;
          border-bottom: 1px solid var(--border) !important;
        }
        .proj-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid var(--border) !important;
        }
        .proj-table .ant-table-row { cursor: pointer; }
        .proj-table-row-selected > .ant-table-cell { background: var(--accent-light) !important; }
        .proj-table-row-selected:hover > .ant-table-cell { background: var(--accent-light) !important; }
      `}</style>
      <Table
        className="proj-table"
        dataSource={items}
        columns={columns}
        rowKey="id"
        pagination={false}
        size="middle"
        scroll={{ x: 600 }}
        onRow={(record) => ({ onClick: () => onSelectItem(record) })}
        rowClassName={(record) => (record.id === selectedId ? 'proj-table-row-selected' : '')}
      />
    </div>
  );
}
