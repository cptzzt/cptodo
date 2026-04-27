import { useState, useEffect } from 'react';
import { Drawer, Form, Input, Select, Checkbox, Tag, Button, Typography, Popconfirm, DatePicker } from 'antd';
import { DeleteOutlined, StarFilled } from '@ant-design/icons';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Text, Title } = Typography;

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
    <Drawer
      title={item.title}
      placement="right"
      size="default"
      onClose={onClose}
      open={!!item}
      extra={
        <Popconfirm
          title="确认删除？"
          onConfirm={() => onDelete(item)}
          icon={null}
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      }
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="primary" onClick={handleSave} style={{ flex: 1 }}>保存修改</Button>
          <Popconfirm
            title="确认删除？"
            onConfirm={() => onDelete(item)}
            icon={null}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button danger>删除</Button>
          </Popconfirm>
        </div>
      }
    >
      {/* 类型标记 */}
      <div style={{ marginBottom: 16 }}>
        <Tag color={isNote ? 'green' : isRecurring ? 'purple' : 'blue'}>
          {isNote ? '随笔' : isRecurring ? '重复任务' : '任务'}
        </Tag>
        {!isNote && priority === 'important' && (
          <Tag color="var(--important)" icon={<StarFilled />}>重要</Tag>
        )}
      </div>

      {/* 随笔转任务 */}
      {isNote && (
        <div style={{ marginBottom: 16 }}>
          <Checkbox checked={convertToTask} onChange={(e) => setConvertToTask(e.target.checked)}>
            转为任务（不可逆）
          </Checkbox>
        </div>
      )}

      {/* 标题 */}
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>标题</Text>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} />
      </div>

      {/* 内容（仅任务） */}
      {!isNote && (
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>内容</Text>
          <TextArea rows={4} maxLength={500} placeholder="任务内容..." value={content} onChange={(e) => setContent(e.target.value)} />
        </div>
      )}

      {/* 备注 */}
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>备注</Text>
        <TextArea rows={3} maxLength={1000} placeholder="添加备注..." value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {/* 截止日期（仅任务） */}
      {!isNote && (
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>截止日期</Text>
          <DatePicker value={dueDate ? dayjs(dueDate) : null} onChange={(_, dateString) => setDueDate(dateString || '')}
            style={{ width: '100%' }} placeholder="选择截止日期" />
        </div>
      )}

      {/* 优先级（仅任务） */}
      {!isNote && (
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>优先级</Text>
          <Select value={priority} onChange={setPriority} style={{ width: '100%' }}>
            <Select.Option value="normal">普通</Select.Option>
            <Select.Option value="important">重要</Select.Option>
          </Select>
        </div>
      )}

      {/* 所属项目 */}
      {!isRecurring && (
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>所属项目</Text>
          <Select value={projectId || undefined} onChange={setProjectId} style={{ width: '100%' }} allowClear placeholder="无项目">
            {projects.map((p) => (
              <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
            ))}
          </Select>
        </div>
      )}

      {/* 已完成（仅任务） */}
      {!isNote && (
        <div style={{ marginBottom: 16 }}>
          <Checkbox checked={completed} onChange={(e) => setCompleted(e.target.checked)}>
            标记为已完成
          </Checkbox>
        </div>
      )}

      {/* 标签 */}
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>标签</Text>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {itemTags.map((t) => (
            <Tag key={t.id} color={t.color} closable onClose={() => onRemoveItemTag(item.id, t.id)}>
              {t.name}
            </Tag>
          ))}
        </div>
        {availableTags.length > 0 && (
          <Select value={undefined} onChange={(val) => { if (val) onAddItemTag(item.id, val); }} style={{ width: '100%' }} placeholder="添加标签..." allowClear>
            {availableTags.map((t) => (
              <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>
            ))}
          </Select>
        )}
      </div>

      {isRecurring && (
        <Text type="secondary" style={{ fontSize: 12 }}>删除重复任务则下个周期不会重建</Text>
      )}
    </Drawer>
  );
}
