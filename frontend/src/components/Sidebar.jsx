import { useState } from 'react';
import { Layout, Button, Input, Badge, Popconfirm, Tooltip, Dropdown, Modal } from 'antd';
import {
  FileTextOutlined, CalendarOutlined, ScheduleOutlined,
  SyncOutlined, DeleteOutlined, WarningOutlined,
  PlusOutlined, EditOutlined, LogoutOutlined,
  FolderOutlined, BgColorsOutlined, CheckOutlined, CalendarFilled,
  CaretRightOutlined,
} from '@ant-design/icons';
import { useTheme } from '../ThemeContext';

const { Sider } = Layout;

const NAV_ITEMS = [
  { view: 'notes', icon: <FileTextOutlined />, label: '随笔' },
  { view: 'today', icon: <CalendarOutlined />, label: '今天', badge: true },
  { view: 'week', icon: <ScheduleOutlined />, label: '本周', badge: true },
  { view: 'calendar', icon: <CalendarFilled />, label: '日历' },
  { view: 'recurring', icon: <SyncOutlined />, label: '重复任务' },
];

const BOTTOM_ITEMS = [
  { view: 'trash', icon: <DeleteOutlined />, label: '回收站' },
  { view: 'expired', icon: <WarningOutlined />, label: '已过期', badge: true },
];

const TAG_COLORS = [
  '#2D5E3A', '#059669', '#14B8A6', '#0EA5E9',
  '#3B82F6', '#6366F1', '#8B5CF6', '#D4916E',
  '#EC4899', '#EF4444', '#F59E0B', '#84CC16',
];

function ColorPicker({ value, onChange }) {
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {TAG_COLORS.map((c) => {
          const selected = value === c;
          return (
            <div key={c} onClick={() => onChange(c)}
              style={{
                width: 28, height: 28, borderRadius: 8, cursor: 'pointer',
                background: c, position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: selected ? '2px solid var(--fg)' : '2px solid var(--border)',
                transition: 'all 0.15s',
                transform: selected ? 'scale(1.1)' : 'scale(1)',
              }}>
              {selected && <CheckOutlined style={{ color: '#fff', fontSize: 14, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>自定义</span>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          style={{ width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 1 }} />
        <span style={{
          width: 28, height: 28, borderRadius: 8, background: value,
          border: '2px solid var(--border)', display: 'inline-block',
        }} />
      </div>
    </div>
  );
}

export default function Sidebar({
  currentView,
  onViewChange,
  projects,
  tags,
  badges,
  onAddProject,
  onAddTag,
  onEditProject,
  onDeleteProject,
  onEditTag,
  onDeleteTag,
  onLogout,
}) {
  const { themeKey, switchTheme, themes, themeKeys } = useTheme();
  const [projectInput, setProjectInput] = useState('');
  const [showProjectInput, setShowProjectInput] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingProjectName, setEditingProjectName] = useState('');

  // 标签弹窗
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagModalMode, setTagModalMode] = useState('add'); // 'add' | 'edit'
  const [tagModalName, setTagModalName] = useState('');
  const [tagModalColor, setTagModalColor] = useState(TAG_COLORS[0]);
  const [tagModalEditId, setTagModalEditId] = useState(null);

  // 展开/收起状态
  const [projectsExpanded, setProjectsExpanded] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(false);

  function openAddTag() {
    setTagModalMode('add');
    setTagModalName('');
    setTagModalColor(TAG_COLORS[0]);
    setTagModalEditId(null);
    setTagModalOpen(true);
  }

  function openEditTag(t) {
    setTagModalMode('edit');
    setTagModalName(t.name);
    setTagModalColor(t.color || TAG_COLORS[0]);
    setTagModalEditId(t.id);
    setTagModalOpen(true);
  }

  function handleTagModalOk() {
    const name = tagModalName.trim();
    if (!name) return;
    if (tagModalMode === 'add') {
      onAddTag(name, tagModalColor);
    } else {
      onEditTag(tagModalEditId, name, tagModalColor);
    }
    setTagModalOpen(false);
  }

  function handleProjectSubmit() {
    const name = projectInput.trim();
    if (!name) return;
    onAddProject(name);
    setProjectInput('');
    setShowProjectInput(false);
  }

  function saveEditProject() {
    const name = editingProjectName.trim();
    if (name && editingProjectId) onEditProject(editingProjectId, name);
    setEditingProjectId(null);
    setEditingProjectName('');
  }

  const themeMenuItems = themeKeys.map((key) => ({
    key,
    label: themes[key].name,
    onClick: () => switchTheme(key),
  }));

  return (
    <Sider width={240} style={{ background: 'var(--bg-sidebar)', borderRight: 'none', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 头部 */}
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.5px' }}>CPTodo</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <Dropdown menu={{ items: themeMenuItems, selectedKeys: [themeKey] }} trigger={['click']}>
            <Tooltip title="切换主题"><Button type="text" size="small" icon={<BgColorsOutlined />} style={{ color: 'var(--fg-muted)' }} /></Tooltip>
          </Dropdown>
          <Tooltip title="退出登录"><Button type="text" size="small" icon={<LogoutOutlined />} onClick={onLogout} style={{ color: 'var(--fg-muted)' }} /></Tooltip>
        </div>
      </div>

      {/* 导航区 */}
      <div style={{ flex: 1, overflowY: 'scroll', overflowX: 'hidden', padding: '8px 0', minHeight: 0, maxHeight: 'calc(100vh - 73px)' }}>
        {/* 固定导航 */}
        <div style={{ padding: '0 10px' }}>
          {NAV_ITEMS.map((item) => {
            const active = currentView === item.view;
            return (
              <div
                key={item.view}
                onClick={() => onViewChange(item.view)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 14px', borderRadius: 10, cursor: 'pointer',
                  marginBottom: 2,
                  background: active ? 'var(--accent-light)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--fg-secondary)',
                  fontWeight: active ? 600 : 400,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--border)'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: 16, opacity: active ? 1 : 0.6 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && badges[item.view] > 0 && (
                  <Badge count={badges[item.view]} size="small" />
                )}
              </div>
            );
          })}
        </div>

        {/* 项目 */}
        <div style={{ padding: '16px 10px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 14px 6px', cursor: 'pointer' }} onClick={() => setProjectsExpanded(!projectsExpanded)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CaretRightOutlined style={{ fontSize: 10, color: 'var(--fg-muted)', transition: 'transform 0.2s', transform: projectsExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }} />
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--fg-muted)', fontWeight: 600 }}>项目</span>
            </div>
            <Button type="text" size="small" icon={<PlusOutlined />} onClick={(e) => { e.stopPropagation(); setShowProjectInput(true); }} style={{ color: 'var(--fg-muted)' }} />
          </div>
          {showProjectInput && (
            <div style={{ padding: '2px 8px 6px' }}>
              <Input size="small" placeholder="项目名称..." value={projectInput}
                onChange={(e) => setProjectInput(e.target.value)}
                onPressEnter={handleProjectSubmit}
                onBlur={() => { setShowProjectInput(false); setProjectInput(''); }}
                autoFocus />
            </div>
          )}
          {projectsExpanded && (projects || []).map((p) => {
            const active = currentView === 'project-' + p.id;
            return (
              <div key={p.id}
                onClick={() => editingProjectId !== p.id && onViewChange('project-' + p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                  background: active ? 'var(--accent-light)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--fg-secondary)',
                  fontWeight: active ? 500 : 400,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'var(--border)';
                  const actions = e.currentTarget.querySelector('.project-actions');
                  const count = e.currentTarget.querySelector('.project-count');
                  if (actions) actions.style.opacity = 1;
                  if (count) count.style.opacity = 1;
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent';
                  const actions = e.currentTarget.querySelector('.project-actions');
                  const count = e.currentTarget.querySelector('.project-count');
                  if (actions) actions.style.opacity = 0;
                  if (count) count.style.opacity = 0;
                }}
              >
                {editingProjectId === p.id ? (
                  <Input size="small" value={editingProjectName}
                    onChange={(e) => setEditingProjectName(e.target.value)}
                    onPressEnter={saveEditProject}
                    onBlur={saveEditProject} autoFocus
                    onClick={(e) => e.stopPropagation()} style={{ flex: 1 }} />
                ) : (
                  <>
                    <FolderOutlined style={{ fontSize: 14, color: active ? 'var(--accent)' : 'var(--fg-muted)' }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    <span className="project-count" style={{ fontSize: 12, color: 'var(--fg-muted)', opacity: 0, transition: 'opacity 0.2s' }}>{p.item_count || 0}</span>
                    <span className="project-actions" style={{ opacity: 0, transition: 'opacity 0.2s' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = 1;
                        e.currentTarget.parentElement.querySelector('.project-count').style.opacity = 1;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = 0;
                        e.currentTarget.parentElement.querySelector('.project-count').style.opacity = 0;
                      }}>
                      <Button type="text" size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); setEditingProjectId(p.id); setEditingProjectName(p.name); }}
                        style={{ color: 'var(--fg-muted)' }} />
                      {p.item_count > 0 ? (
                        <Button type="text" size="small" danger onClick={(e) => { e.stopPropagation(); onDeleteProject(p); }} title="该项目下还有任务或随笔">&times;</Button>
                      ) : (
                        <Popconfirm
                          title={`确认删除项目「${p.name}」？`}
                          onConfirm={() => onDeleteProject(p)}
                          icon={null}
                          okText="删除"
                          cancelText="取消"
                          okButtonProps={{ danger: true }}
                        >
                          <Button type="text" size="small" danger onClick={(e) => e.stopPropagation()}>&times;</Button>
                        </Popconfirm>
                      )}
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* 标签 */}
        <div style={{ padding: '16px 10px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 14px 6px', cursor: 'pointer' }} onClick={() => setTagsExpanded(!tagsExpanded)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CaretRightOutlined style={{ fontSize: 10, color: 'var(--fg-muted)', transition: 'transform 0.2s', transform: tagsExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }} />
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--fg-muted)', fontWeight: 600 }}>标签</span>
            </div>
            <Button type="text" size="small" icon={<PlusOutlined />} onClick={(e) => { e.stopPropagation(); openAddTag(); }} style={{ color: 'var(--fg-muted)' }} />
          </div>
          {tagsExpanded && (tags || []).map((t) => {
            const active = currentView === 'tag-' + t.id;
            return (
              <div key={t.id}
                onClick={() => onViewChange('tag-' + t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                  background: active ? 'var(--accent-light)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--fg-secondary)',
                  fontWeight: active ? 500 : 400,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'var(--border)';
                  const actions = e.currentTarget.querySelector('.tag-actions');
                  const count = e.currentTarget.querySelector('.tag-count');
                  if (actions) actions.style.opacity = 1;
                  if (count) count.style.opacity = 1;
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent';
                  const actions = e.currentTarget.querySelector('.tag-actions');
                  const count = e.currentTarget.querySelector('.tag-count');
                  if (actions) actions.style.opacity = 0;
                  if (count) count.style.opacity = 0;
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.color || TAG_COLORS[0], flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                <span className="tag-count" style={{ fontSize: 12, color: 'var(--fg-muted)', opacity: 0, transition: 'opacity 0.2s' }}>{t.item_count || 0}</span>
                <span className="tag-actions" style={{ opacity: 0, transition: 'opacity 0.2s' }}>
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); openEditTag(t); }}
                    style={{ color: 'var(--fg-muted)' }} />
                  {t.item_count > 0 ? (
                    <Button type="text" size="small" danger onClick={(e) => { e.stopPropagation(); onDeleteTag(t); }} title="该标签下还有关联任务">&times;</Button>
                  ) : (
                    <Popconfirm
                      title={`确认删除标签「${t.name}」？`}
                      description="删除后无法恢复"
                      onConfirm={() => onDeleteTag(t)}
                      icon={null}
                      okText="删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                    >
                      <Button type="text" size="small" danger onClick={(e) => e.stopPropagation()}>&times;</Button>
                    </Popconfirm>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* 底部导航 */}
        <div style={{ padding: '16px 10px 0', borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 16 }}>
          {BOTTOM_ITEMS.map((item) => {
            const active = currentView === item.view;
            return (
              <div key={item.view}
                onClick={() => onViewChange(item.view)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 14px', borderRadius: 10, cursor: 'pointer',
                  marginBottom: 2,
                  background: active ? 'var(--accent-light)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--fg-secondary)',
                  fontWeight: active ? 600 : 400,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--border)'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: 16, opacity: active ? 1 : 0.6 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && badges[item.view] > 0 && (
                  <Badge count={badges[item.view]} size="small" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 标签新建/编辑弹窗 */}
      <Modal
        title={tagModalMode === 'add' ? '新建标签' : '编辑标签'}
        open={tagModalOpen}
        onCancel={() => setTagModalOpen(false)}
        onOk={handleTagModalOk}
        okText={tagModalMode === 'add' ? '创建' : '保存'}
        cancelText="取消"
        okButtonProps={{ disabled: !tagModalName.trim() }}
        destroyOnHidden
      >
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 6 }}>标签名称</div>
            <Input placeholder="输入标签名称..." value={tagModalName}
              onChange={(e) => setTagModalName(e.target.value)} maxLength={50} autoFocus />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 8 }}>标签颜色</div>
            <ColorPicker value={tagModalColor} onChange={setTagModalColor} />
          </div>
        </div>
      </Modal>
    </Sider>
  );
}
