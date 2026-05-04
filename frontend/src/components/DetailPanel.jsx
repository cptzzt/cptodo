import { useState, useEffect, useRef } from 'react';
import { Drawer, Input, Select, Checkbox, Tag, Button, Typography, Popconfirm, DatePicker, App, Grid } from 'antd';
import { StarFilled, StarOutlined } from '@ant-design/icons';
import { api } from '../api';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Text } = Typography;

export default function DetailPanel({
  item,
  projects,
  allTags,
  onClose,
  onSave,
  onDelete,
  onRefresh,
  closeRef,
}) {
  const { message } = App.useApp();
  const [open, setOpen] = useState(!!item);
  const closingRef = useRef(false);
  const closingItemRef = useRef(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('normal');
  const [completed, setCompleted] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [convertToTask, setConvertToTask] = useState(false);
  const [pendingTags, setPendingTags] = useState([]);
  const [projectLabelId, setProjectLabelId] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [shelved, setShelved] = useState(false);

  useEffect(() => {
    if (!item) {
      // item 消失了（路由返回），播放关闭动画
      if (closingItemRef.current) {
        closingRef.current = true;
        setOpen(false);
        setTimeout(() => {
          closingRef.current = false;
          closingItemRef.current = null;
        }, 300);
      }
      return;
    }
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
    setPendingTags(item.tags ? [...item.tags] : []);
    setProjectLabelId(item.project_label_id || '');
    setIsPrivate(!!item.is_private);
    setShelved(!!item.shelved);
    setOpen(true);
    closingRef.current = false;
    closingItemRef.current = item;
  }, [item]);

  function handleClose() {
    closingRef.current = true;
    setOpen(false);
    setTimeout(() => {
      if (closingRef.current) {
        closingRef.current = false;
        closingItemRef.current = null;
        onClose();
      }
    }, 300);
  }

  // 暴露关闭函数给父组件
  useEffect(() => {
    if (closeRef) {
      closeRef.current = item ? handleClose : null;
    }
  }, [item, closeRef]);

  const { md } = Grid.useBreakpoint();
  const isMobile = !md;

  // 关闭动画期间用 closingItemRef 渲染，否则 item 没了就直接隐藏
  const displayItem = item || closingItemRef.current;
  if (!displayItem) return null;

  const isNote = displayItem.type === 'note';
  const isRecurring = !!displayItem.recurring;

  function handleSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    const data = { title: trimmedTitle, notes: notes.trim(), priority, is_private: isPrivate ? 1 : 0, shelved: shelved ? 1 : 0 };
    if (isNote && convertToTask) {
      const hasDueDate = !!dueDate;
      const hasProject = !!projectId;
      const hasTags = pendingTags.length > 0;
      if (!hasDueDate && !hasProject && !hasTags) {
        message.warning('请至少填写截止日期、所属项目或标签其中一项');
        return;
      }
      data.type = 'task';
      data.due_date = dueDate || null;
      if (projectId) data.project_id = projectId;
      if (projectLabelId) data.project_label_id = projectLabelId;
    } else if (isNote) {
      data.project_id = projectId || null;
      data.project_label_id = projectLabelId || null;
    }
    if (!isNote) {
      data.content = content.trim();
      data.due_date = dueDate || null;
      data.priority = priority;
      data.completed = completed;
      if (!isRecurring) {
        data.project_id = projectId || null;
        data.project_label_id = projectLabelId || null;
      }
    }

    // 计算标签变更
    const originalTagIds = (displayItem.tags || []).map((t) => t.id);
    const pendingTagIds = pendingTags.map((t) => t.id);
    const tagsToAdd = pendingTagIds.filter((id) => !originalTagIds.includes(id));
    const tagsToRemove = originalTagIds.filter((id) => !pendingTagIds.includes(id));

    onSave(displayItem.id, data, tagsToAdd, tagsToRemove);
  }

  const pendingTagIds = pendingTags.map((t) => t.id);
  const availableTags = allTags.filter((t) => !pendingTagIds.includes(t.id));

  return (
    <Drawer
      title={displayItem.title}
      placement="right"
      onClose={handleClose}
      open={open}
      styles={{ body: { padding: isMobile ? '12px 16px' : undefined }, wrapper: isMobile ? {} : { width: 480 } }}
      extra={
        <Button
          type="text"
          icon={priority === 'important' ? <StarFilled style={{ color: 'var(--important)' }} /> : <StarOutlined style={{ color: 'var(--fg-muted)' }} />}
          onClick={() => setPriority(priority === 'important' ? 'normal' : 'important')}
        />
      }
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="primary" onClick={handleSave} style={{ flex: 1 }}>保存修改</Button>
          <Popconfirm
            title="确认删除？"
            onConfirm={() => onDelete(displayItem)}
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
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Tag color={isNote ? 'green' : isRecurring ? 'purple' : 'blue'}>
          {isNote ? '随笔' : isRecurring ? '重复任务' : '任务'}
        </Tag>
        {priority === 'important' && (
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

      {/* 截止日期（非重复任务，或随笔转任务时） */}
      {(!isNote && !isRecurring || (isNote && convertToTask)) && (
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>截止日期</Text>
          <DatePicker value={dueDate ? dayjs(dueDate) : null} onChange={(_, dateString) => setDueDate(dateString || '')}
            style={{ width: '100%' }} placeholder="选择截止日期" />
        </div>
      )}

      {/* 每周重复任务 target=1 - 选择星期几 */}
      {isRecurring && displayItem.recurring === 'weekly' && !(displayItem.recurring_target > 1) && (
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>重复日期</Text>
          <Select value={dueDate ? new Date(dueDate).getDay() : undefined} onChange={(targetDay) => {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            let diff = targetDay - d.getDay();
            if (diff < 0) diff += 7;
            d.setDate(d.getDate() + diff);
            const newDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            setDueDate(newDate);
          }} style={{ width: '100%' }}>
            <Select.Option value={1}>周一</Select.Option>
            <Select.Option value={2}>周二</Select.Option>
            <Select.Option value={3}>周三</Select.Option>
            <Select.Option value={4}>周四</Select.Option>
            <Select.Option value={5}>周五</Select.Option>
            <Select.Option value={6}>周六</Select.Option>
            <Select.Option value={0}>周日</Select.Option>
          </Select>
        </div>
      )}

      {/* 频次目标进度 */}
      {isRecurring && displayItem.recurring_target > 1 && (
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>每周目标</Text>
          <div style={{ fontSize: 16, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button size="small" onClick={async () => {
                const cur = displayItem.recurring_count || 0;
                if (cur > 0) { await api.updateItem(displayItem.id, { recurring_count: cur - 1 }); onRefresh?.(); }
              }} disabled={(displayItem.recurring_count || 0) <= 0}>-</Button>
              <span>{displayItem.recurring_count || 0} / {displayItem.recurring_target} 次</span>
              <Button size="small" onClick={async () => {
                const cur = displayItem.recurring_count || 0;
                if (cur < displayItem.recurring_target) { await api.updateItem(displayItem.id, { recurring_count: cur + 1 }); onRefresh?.(); }
              }} disabled={(displayItem.recurring_count || 0) >= displayItem.recurring_target}>+</Button>
            </div>
          </div>
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

      {/* 项目标签 */}
      {!isRecurring && (() => {
        const currentProject = projects.find((p) => p.id === projectId);
        const labels = currentProject?.labels || [];
        if (labels.length === 0) return null;
        return (
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>项目专属标签</Text>
            <Select value={projectLabelId || undefined} onChange={setProjectLabelId} style={{ width: '100%' }} allowClear placeholder="无标签">
              {labels.map((l) => (
                <Select.Option key={l.id} value={l.id}>{l.name}</Select.Option>
              ))}
            </Select>
          </div>
        );
      })()}

      {/* 已完成（仅任务） */}
      {!isNote && (
        <div style={{ marginBottom: 16 }}>
          <Checkbox checked={completed} onChange={(e) => setCompleted(e.target.checked)}>
            标记为已完成
          </Checkbox>
          {isRecurring && !(displayItem.recurring_target > 1) && (
            <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 4, marginLeft: 24 }}>
              下个周期会自动创建
            </div>
          )}
        </div>
      )}

      {/* 隐私 & 搁置 */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
        <Checkbox checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)}>
          Private
        </Checkbox>
        <Checkbox checked={shelved} onChange={(e) => setShelved(e.target.checked)}>
          暂时搁置
        </Checkbox>
      </div>

      {/* 标签 */}
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>标签</Text>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {pendingTags.map((t) => (
            <Tag key={t.id} color={t.color} closable onClose={() => setPendingTags((prev) => prev.filter((pt) => pt.id !== t.id))}>
              {t.name}
            </Tag>
          ))}
        </div>
        {availableTags.length > 0 && (
          <Select value={undefined} onChange={(val) => {
            if (val) {
              const tag = allTags.find((t) => t.id === val);
              if (tag) setPendingTags((prev) => [...prev, tag]);
            }
          }} style={{ width: '100%' }} placeholder="添加标签..." allowClear>
            {availableTags.map((t) => (
              <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>
            ))}
          </Select>
        )}
      </div>

      {isRecurring && (
        <Text style={{ fontSize: 12, color: 'var(--overdue)' }}>删除重复任务则下个周期不会重建</Text>
      )}

      {/* 创建/更新时间 */}
      <div style={{ marginTop: 24, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <Text style={{ fontSize: 12, color: 'var(--fg-muted)', display: 'block', marginBottom: 4 }}>
          创建于 {new Date(displayItem.created_at).toLocaleString('zh-CN')}
        </Text>
        {displayItem.updated_at && displayItem.updated_at !== displayItem.created_at && (
          <Text style={{ fontSize: 12, color: 'var(--fg-muted)', display: 'block' }}>
            更新于 {new Date(displayItem.updated_at).toLocaleString('zh-CN')}
          </Text>
        )}
      </div>
    </Drawer>
  );
}
