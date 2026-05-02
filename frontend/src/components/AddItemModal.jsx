import { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker, Checkbox } from 'antd';
import dayjs from 'dayjs';

function toDateStr(val) {
  if (!val) return '';
  const d = val instanceof Date ? val : new Date(val);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function today() { return toDateStr(new Date()); }
function weekStart() {
  const d = new Date(); const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff); return toDateStr(d);
}
function weekEnd() {
  const d = new Date(); const diff = d.getDay() === 0 ? 0 : 7 - d.getDay();
  d.setDate(d.getDate() + diff); return toDateStr(d);
}
function nextDayOfWeek(day) {
  const d = new Date();
  const current = d.getDay();
  let diff = day - current;
  if (diff <= 0) diff += 7;
  d.setDate(d.getDate() + diff);
  return toDateStr(d);
}

export default function AddItemModal({ currentView, currentProjectId, currentTagId, currentCalendarDate, projects, onConfirm, onCancel }) {
  const [type, setType] = useState('task');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('normal');
  const [recurring, setRecurring] = useState('');
  const [recurringTarget, setRecurringTarget] = useState(1);
  const [weekDay, setWeekDay] = useState('1');
  const [projectId, setProjectId] = useState('');
  const [projectLabelId, setProjectLabelId] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (currentView === 'notes') setType('note');
    else setType('task');
    if (currentView === 'recurring') setRecurring('daily');
    else setRecurring('');
    setRecurringTarget(1);    if (currentView === 'today') setDueDate(today());
    else if (currentView === 'week') setDueDate(weekEnd());
    else if (currentView === 'calendar' && currentCalendarDate) setDueDate(currentCalendarDate);
    else setDueDate('');
    if (currentView.startsWith('project-')) setProjectId(currentProjectId || '');
    else setProjectId('');
    setTitle(''); setContent(''); setPriority('normal'); setWeekDay('1'); setProjectLabelId(''); setIsPrivate(false);
  }, [currentView, currentProjectId, currentCalendarDate]);

  const isTask = type === 'task';
  const isRecurringView = currentView === 'recurring';
  const isTodayView = currentView === 'today';
  const isWeekView = currentView === 'week';
  const isCalendarView = currentView === 'calendar';
  const hideTypeSelect = ['project', 'today', 'week', 'recurring', 'calendar'].includes(currentView) || currentView.startsWith('project-');

  const showRecurring = isRecurringView;
  const showDueDate = isTask && !isRecurringView && !isTodayView;
  const showWeekDay = isRecurringView && recurring === 'weekly' && recurringTarget === 1;
  const showRecurringTarget = isRecurringView && recurring === 'weekly';
  const showProject = isTask && !isRecurringView;
  const showContent = isTask;

  async function handleSubmit() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    const data = { type, title: trimmedTitle, is_private: isPrivate ? 1 : 0 };
    if (isTask) {
      data.content = content.trim() || null;
      data.priority = priority;
      if (isRecurringView) {
        data.recurring = recurring || 'daily';
        data.recurring_target = recurringTarget;
        if (data.recurring === 'daily') data.due_date = today();
        else if (recurringTarget > 1) data.due_date = weekStart();
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
        if (projectLabelId) data.project_label_id = projectLabelId;
      }
    }
    setSubmitting(true);
    await onConfirm(data, currentView.startsWith('tag-') ? currentTagId : null);
    setSubmitting(false);
  }

  return (
    <Modal
      title={isRecurringView ? '新建重复任务' : '新建'}
      open={true}
      onCancel={onCancel}
      centered
      onOk={handleSubmit}
      okText="确认新建"
      cancelText="取消"
      confirmLoading={submitting}
      okButtonProps={{ disabled: !title.trim() }}
      destroyOnHidden
    >
      <Form layout="vertical" style={{ marginTop: 16 }}>
        {!hideTypeSelect && (
          <Form.Item label="类型">
            <Select value={type} onChange={setType}>
              <Select.Option value="task">任务</Select.Option>
              <Select.Option value="note">随笔</Select.Option>
            </Select>
          </Form.Item>
        )}
        <Form.Item label="标题">
          <Input placeholder="输入标题..." maxLength={255} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </Form.Item>
        {showContent && (
          <Form.Item label="内容">
            <Input.TextArea rows={3} maxLength={500} placeholder="输入任务内容..." value={content} onChange={(e) => setContent(e.target.value)} />
          </Form.Item>
        )}
        {showDueDate && (
          <Form.Item label="截止日期">
            <DatePicker value={dueDate ? dayjs(dueDate) : null} onChange={(_, dateString) => setDueDate(dateString || '')}
              style={{ width: '100%' }} placeholder="选择截止日期"
              disabledDate={isWeekView ? (current) => {
                if (!current) return false;
                const d = toDateStr(current.toDate());
                return d < weekStart() || d > weekEnd();
              } : undefined} />
          </Form.Item>
        )}
        {isTask && (
          <Form.Item label="优先级">
            <Select value={priority} onChange={setPriority}>
              <Select.Option value="normal">普通</Select.Option>
              <Select.Option value="important">重要</Select.Option>
            </Select>
          </Form.Item>
        )}
        {showRecurring && (
          <Form.Item label="重复">
            <Select value={recurring} onChange={(v) => { setRecurring(v); if (v === 'daily') setRecurringTarget(1); }}>
              <Select.Option value="daily">每天</Select.Option>
              <Select.Option value="weekly">每周</Select.Option>
            </Select>
          </Form.Item>
        )}
        {showRecurringTarget && (
          <Form.Item label="每周目标次数">
            <Select value={recurringTarget} onChange={setRecurringTarget}>
              <Select.Option value={1}>1 次（固定日期）</Select.Option>
              <Select.Option value={2}>2 次</Select.Option>
              <Select.Option value={3}>3 次</Select.Option>
              <Select.Option value={4}>4 次</Select.Option>
              <Select.Option value={5}>5 次</Select.Option>
              <Select.Option value={6}>6 次</Select.Option>
              <Select.Option value={7}>7 次</Select.Option>
            </Select>
          </Form.Item>
        )}
        {showWeekDay && (
          <Form.Item label="重复日">
            <Select value={weekDay} onChange={setWeekDay}>
              <Select.Option value="1">周一</Select.Option>
              <Select.Option value="2">周二</Select.Option>
              <Select.Option value="3">周三</Select.Option>
              <Select.Option value="4">周四</Select.Option>
              <Select.Option value="5">周五</Select.Option>
              <Select.Option value="6">周六</Select.Option>
              <Select.Option value="0">周日</Select.Option>
            </Select>
          </Form.Item>
        )}
        {showProject && (
          <Form.Item label="项目">
            <Select value={projectId || undefined} onChange={setProjectId} allowClear placeholder="无项目">
              <Select.Option value="">无项目</Select.Option>
              {projects.map((p) => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
            </Select>
          </Form.Item>
        )}
        {showProject && currentView.startsWith('project-') && (() => {
          const currentProject = projects.find((p) => p.id === projectId);
          const labels = currentProject?.labels || [];
          if (labels.length === 0) return null;
          return (
            <Form.Item label="项目专属标签">
              <Select value={projectLabelId || undefined} onChange={setProjectLabelId} allowClear placeholder="无标签">
                {labels.map((l) => (
                  <Select.Option key={l.id} value={l.id}>{l.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          );
        })()}
        <Form.Item>
          <Checkbox checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)}>
            Private
          </Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  );
}
