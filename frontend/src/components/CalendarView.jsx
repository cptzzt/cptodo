import { useState, useMemo, useCallback } from 'react';
import { Calendar, Typography, Grid, Select, Button, DatePicker, Tag } from 'antd';
import { StarFilled } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

function CalendarHeader({ value, onChange, selectedDate, onClearDate }) {
  const safeValue = value || dayjs();
  const monthOptions = useMemo(() => {
    const opts = [];
    for (let i = 0; i < 12; i++) {
      opts.push({ label: `${i + 1}月`, value: i });
    }
    return opts;
  }, []);

  const yearOptions = useMemo(() => {
    const currentYear = dayjs().year();
    const opts = [];
    for (let i = currentYear - 10; i < currentYear + 10; i++) {
      opts.push({ label: `${i}年`, value: i });
    }
    return opts;
  }, []);

  const year = safeValue.year();
  const month = safeValue.month();
  const todayStr = dayjs().format('YYYY-MM-DD');

  const handleYearChange = useCallback((e) => {
    const newYear = Number(e.target.value);
    onChange(safeValue.clone().year(newYear));
  }, [safeValue, onChange]);

  const handleMonthChange = useCallback((e) => {
    const newMonth = Number(e.target.value);
    onChange(safeValue.clone().month(newMonth));
  }, [safeValue, onChange]);

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <Select
          value={year}
          onChange={(val) => handleYearChange({ target: { value: val } })}
          size="small"
          style={{ width: 90 }}
          options={yearOptions}
        />
        <Select
          value={month}
          onChange={(val) => handleMonthChange({ target: { value: val } })}
          size="small"
          style={{ width: 70 }}
          options={monthOptions}
        />
      </div>
      {selectedDate && selectedDate !== todayStr && onClearDate && (
        <Button size="small" onClick={onClearDate}>
          回到今天
        </Button>
      )}
    </div>
  );
}

export const QUICK_RANGES = [
  { label: '未来7天', days: 7 },
  { label: '未来15天', days: 15 },
  { label: '未来30天', days: 30 },
];

export default function CalendarView({ items, onSelectDate, onAddItem, selectedDate, dateRange, onSetDateRange }) {
  const { md } = Grid.useBreakpoint();
  const isMobile = !md;
  const [currentMonth, setCurrentMonth] = useState(dayjs());

  // 确保 selectedDate 有默认值（今天）
  const effectiveSelectedDate = selectedDate || dayjs().format('YYYY-MM-DD');

  // 按日期统计任务数量
  const dateTaskCounts = useMemo(() => {
    const counts = {};
    items.forEach((item) => {
      if (!item.due_date || item.type !== 'task' || (item.recurring && item.recurring_target > 1)) return;
      const localDate = dayjs(item.due_date).format('YYYY-MM-DD');
      counts[localDate] = (counts[localDate] || 0) + 1;
    });
    return counts;
  }, [items]);

  // 当前选中日期的任务
  const selectedDateTasks = useMemo(() => {
    if (!effectiveSelectedDate) return [];
    return items.filter((item) => {
      if (!item.due_date || item.type !== 'task' || (item.recurring && item.recurring_target > 1)) return false;
      const localDate = dayjs(item.due_date).format('YYYY-MM-DD');
      return localDate === effectiveSelectedDate;
    });
  }, [items, effectiveSelectedDate]);

  // 日期范围内的任务，按日期分组
  const rangeTasks = useMemo(() => {
    if (!dateRange) return null;
    const grouped = {};
    items.forEach((item) => {
      if (!item.due_date || item.type !== 'task' || (item.recurring && item.recurring_target > 1)) return;
      const localDate = dayjs(item.due_date).format('YYYY-MM-DD');
      if (localDate >= dateRange.start && localDate <= dateRange.end) {
        if (!grouped[localDate]) grouped[localDate] = [];
        grouped[localDate].push(item);
      }
    });
    // 按日期排序
    const sorted = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
    return sorted;
  }, [items, dateRange]);

  function onPanelChange(date) {
    setCurrentMonth(date);
  }

  function handleClearDate() {
    if (onSelectDate) onSelectDate(null);
  }

  function handleQuickRange(days) {
    const start = dayjs().format('YYYY-MM-DD');
    const end = dayjs().add(days, 'day').format('YYYY-MM-DD');
    onSetDateRange?.({ start, end });
  }

  function handleCustomRange(dates) {
    if (!dates || dates.length < 2) {
      onSetDateRange?.(null);
      return;
    }
    onSetDateRange?.({
      start: dates[0].format('YYYY-MM-DD'),
      end: dates[1].format('YYYY-MM-DD'),
    });
  }

  function handleClearRange() {
    onSetDateRange?.(null);
  }

  function dateCellRender(date) {
    const dateStr = date.format('YYYY-MM-DD');
    const count = dateTaskCounts[dateStr];
    if (!count) return null;
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', paddingTop: 2 }}>
        <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, lineHeight: 1.3 }}>{count}</span>
      </div>
    );
  }

  function monthCellRender(date) {
    return null;
  }

  const taskCard = (task) => (
    <div key={task.id} onClick={() => onAddItem(task)} style={{
      padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
      background: task.completed ? 'transparent' : 'var(--bg-card)',
      border: '1px solid var(--border)',
      transition: 'all 0.2s',
      opacity: task.completed ? 0.6 : 1,
    }} onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, textDecoration: task.completed ? 'line-through' : 'none', color: task.completed ? 'var(--fg-muted)' : 'var(--fg)' }}>{task.title}</span>
        {task.priority === 'important' && <StarFilled style={{ color: 'var(--important)', fontSize: 14 }} />}
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* 日历区域 */}
      <div style={{ padding: isMobile ? '12px 12px' : '16px 24px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
        {/* 日期范围选择 */}
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', color: 'var(--fg-primary)' }}>日期范围</Text>
            {QUICK_RANGES.map((r) => (
              <Button key={r.days} size="small"
                type={dateRange?.end === dayjs().add(r.days, 'day').format('YYYY-MM-DD') ? 'primary' : 'default'}
                onClick={() => handleQuickRange(r.days)}
              >{r.label}</Button>
            ))}
            <RangePicker size="small" onChange={handleCustomRange}
              value={dateRange ? [dayjs(dateRange.start), dayjs(dateRange.end)] : null}
              style={{ width: 220 }} placeholder={['开始日期', '结束日期']} />
            {dateRange && <Button size="small" onClick={handleClearRange}>清除范围</Button>}
          </div>
        )}

        <div style={isMobile ? { maxHeight: 290, overflow: 'hidden' } : {}}>
          <Calendar
            value={dayjs(effectiveSelectedDate)}
            onSelect={(date) => { onSetDateRange?.(null); onSelectDate(date.format('YYYY-MM-DD')); }}
            onPanelChange={onPanelChange}
            fullscreen={false}
            cellRender={{ current: dateCellRender, month: monthCellRender }}
            headerRender={(props) => <CalendarHeader {...props} selectedDate={selectedDate} onClearDate={handleClearDate} />}
          />
        </div>
        <Text type="secondary" style={{ fontSize: 11, display: 'block', textAlign: 'center', marginTop: 4 }}>无具体日期的任务不在日历视图中</Text>
      </div>

      {/* 任务列表 */}
      <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '12px 12px' : '16px 24px' }}>
        {dateRange ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Title level={5} style={{ margin: 0 }}>
                {dateRange.start} ~ {dateRange.end}
              </Title>
              <Text style={{ color: 'var(--fg-muted)', fontSize: 13 }}>
                {rangeTasks ? rangeTasks.reduce((s, [, tasks]) => s + tasks.length, 0) : 0} 个任务
              </Text>
            </div>
            {rangeTasks && rangeTasks.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {rangeTasks.map(([date, tasks]) => (
                  <div key={date}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Text strong style={{ fontSize: 14, color: 'var(--fg-primary)' }}>
                        {dayjs(date).format('M月D日')}
                      </Text>
                      <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{tasks.length} 项</span>
                      {date === dayjs().format('YYYY-MM-DD') && <Tag color="blue">今天</Tag>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {tasks.map(taskCard)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg-muted)' }}>该日期范围内没有任务</div>
            )}
          </>
        ) : (
          <>
            <Title level={5} style={{ marginBottom: 16 }}>
              {dayjs(effectiveSelectedDate).format('YYYY年M月D日')} 的任务
              {selectedDateTasks.length > 0 && <span style={{ color: 'var(--fg-muted)', fontWeight: 400, fontSize: 14, marginLeft: 8 }}>({selectedDateTasks.length})</span>}
            </Title>
            {selectedDateTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg-muted)' }}>当天没有任务</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedDateTasks.map(taskCard)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
