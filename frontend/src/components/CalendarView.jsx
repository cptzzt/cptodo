import { useState, useMemo, useCallback } from 'react';
import { Calendar, Badge, Typography, Grid } from 'antd';
import { StarFilled } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

function CalendarHeader({ value, onChange, selectedDate, onClearDate }) {
  // value 可能是 undefined，确保有默认值
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
    const startYear = Math.floor((currentYear - 10) / 10) * 10;
    const opts = [];
    for (let i = startYear - 50; i < currentYear + 50; i++) {
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
        <select
          value={year}
          onChange={handleYearChange}
          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--fg)' }}
        >
          {yearOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <select
          value={month}
          onChange={handleMonthChange}
          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--fg)' }}
        >
          {monthOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>
      {selectedDate && selectedDate !== todayStr && onClearDate && (
        <button
          onClick={onClearDate}
          style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--fg-muted)', cursor: 'pointer' }}
        >
          回到今天
        </button>
      )}
    </div>
  );
}

export default function CalendarView({ items, onSelectDate, onAddItem, selectedDate, showCompleted }) {
  const { md } = Grid.useBreakpoint();
  const isMobile = !md;
  const [currentMonth, setCurrentMonth] = useState(dayjs());

  // 确保 selectedDate 有默认值（今天）
  const effectiveSelectedDate = selectedDate || dayjs().format('YYYY-MM-DD');

  // 按日期统计任务数量
  const dateTaskCounts = useMemo(() => {
    const counts = {};
    items.forEach((item) => {
      if (!item.due_date || item.completed || item.type !== 'task' || (item.recurring && item.recurring_target > 1)) return;
      // 处理时区：从数据库来的日期是 UTC，需要转本地日期
      const dateStr = item.due_date.split('T')[0];
      // 用 dayjs 解析并使用本地时区
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
      if (!showCompleted && item.completed) return false;
      const localDate = dayjs(item.due_date).format('YYYY-MM-DD');
      return localDate === effectiveSelectedDate;
    });
  }, [items, effectiveSelectedDate, showCompleted]);

  function onPanelChange(date) {
    setCurrentMonth(date);
  }

  function handleClearDate() {
    if (onSelectDate) onSelectDate(null); // 清除后会自动回退到今天
  }

  function dateCellRender(date) {
    const dateStr = date.format('YYYY-MM-DD');
    const count = dateTaskCounts[dateStr];
    if (!count) return null;
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', height: '100%' }}>
        <Badge count={count} size="small" style={{ background: 'var(--accent)', marginTop: 2 }} />
      </div>
    );
  }

  function monthCellRender(date) {
    return null;
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* 日历区域 */}
      <div style={{ padding: isMobile ? '12px 12px' : '16px 24px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
        <Calendar
          value={dayjs(effectiveSelectedDate)}
          onSelect={(date) => onSelectDate(date.format('YYYY-MM-DD'))}
          onPanelChange={onPanelChange}
          fullscreen={false}
          cellRender={{ current: dateCellRender, month: monthCellRender }}
          headerRender={(props) => <CalendarHeader {...props} selectedDate={selectedDate} onClearDate={handleClearDate} />}
        />
        <Text type="secondary" style={{ fontSize: 11, display: 'block', textAlign: 'center', marginTop: 4 }}>无具体日期的任务不在日历视图中</Text>
      </div>

      {/* 选中日期的任务 */}
      <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '12px 12px' : '16px 24px' }}>
        {effectiveSelectedDate ? (
          <>
            <Title level={5} style={{ marginBottom: 16 }}>
              {dayjs(effectiveSelectedDate).format('YYYY年M月D日')} 的任务
              {selectedDateTasks.length > 0 && <span style={{ color: 'var(--fg-muted)', fontWeight: 400, fontSize: 14, marginLeft: 8 }}>({selectedDateTasks.length})</span>}
            </Title>
            {selectedDateTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg-muted)' }}>当天没有任务</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedDateTasks.map((task) => {
                  function handleMouseEnter(e) { e.currentTarget.style.borderColor = 'var(--accent)'; }
                  function handleMouseLeave(e) { e.currentTarget.style.borderColor = 'var(--border)'; }
                  function handleClick() { onAddItem(task); }
                  return (
                    <div key={task.id} onClick={handleClick} style={{
                      padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                      background: task.completed ? 'transparent' : 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      transition: 'all 0.2s',
                      opacity: task.completed ? 0.6 : 1,
                    }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1, textDecoration: task.completed ? 'line-through' : 'none', color: task.completed ? 'var(--fg-muted)' : 'var(--fg)' }}>{task.title}</span>
                        {task.priority === 'important' && <StarFilled style={{ color: 'var(--important)', fontSize: 14 }} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg-muted)' }}>点击日历中的日期查看任务</div>
        )}
      </div>
    </div>
  );
}
