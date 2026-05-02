import { useState, useEffect, useRef } from 'react';
import { Layout, Button, Input, Badge, Popconfirm, Tooltip, Dropdown, Modal, Form, App, Checkbox } from 'antd';
import {
  FileTextOutlined, CalendarOutlined, ScheduleOutlined,
  SyncOutlined, DeleteOutlined, WarningOutlined,
  PlusOutlined, EditOutlined, LogoutOutlined,
  FolderOutlined, BgColorsOutlined, CheckOutlined, CalendarFilled,
  CaretRightOutlined, UserOutlined, SettingOutlined, SearchOutlined,
  CheckSquareOutlined, StarFilled,
} from '@ant-design/icons';
import { useTheme } from '../ThemeContext';
import { api, Storage } from '../api';

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
  isMobile,
  onRefresh,
  allItems,
  privacyMode,
  setPrivacyMode,
  onSearchSelect,
  allProjects,
  allTagsList,
}) {
  const { themeKey, switchTheme, themes, themeKeys } = useTheme();
  const { message, modal } = App.useApp();
  const labelTimers = useRef(new Map());

  // 项目弹窗状态
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectModalMode, setProjectModalMode] = useState('add'); // 'add' | 'edit'
  const [projectModalName, setProjectModalName] = useState('');
  const [projectModalEditId, setProjectModalEditId] = useState(null);
  const [projectModalLabels, setProjectModalLabels] = useState([]);
  const [projectModalIsPrivate, setProjectModalIsPrivate] = useState(false);
  const [projectLabelInput, setProjectLabelInput] = useState('');
  const [projectLabelColor, setProjectLabelColor] = useState(TAG_COLORS[0]);
  const [editingLabelId, setEditingLabelId] = useState(null);
  const [editingLabelName, setEditingLabelName] = useState('');
  const [editingLabelColor, setEditingLabelColor] = useState(TAG_COLORS[0]);
  const [themeTooltipOpen, setThemeTooltipOpen] = useState(false);

  // 搜索状态
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef(null);

  // 标签弹窗
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagModalMode, setTagModalMode] = useState('add'); // 'add' | 'edit'
  const [tagModalName, setTagModalName] = useState('');
  const [tagModalColor, setTagModalColor] = useState(TAG_COLORS[0]);
  const [tagModalEditId, setTagModalEditId] = useState(null);
  const [tagModalIsPrivate, setTagModalIsPrivate] = useState(false);

  // 展开/收起状态（持久化到 localStorage）
  const [projectsExpanded, setProjectsExpanded] = useState(() => localStorage.getItem('sidebar_projects_expanded') === 'true');
  const [tagsExpanded, setTagsExpanded] = useState(() => localStorage.getItem('sidebar_tags_expanded') === 'true');

  // 设置弹窗状态
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm] = Form.useForm();
  const [user, setUser] = useState(null);

  // 获取当前用户信息
  useEffect(() => {
    setUser(Storage.getUser());
  }, []);

  // 打开设置弹窗
  function openSettings() {
    setSettingsOpen(true);
  }

  // 保存用户名
  async function handleSaveSettings() {
    try {
      const values = await settingsForm.validateFields();
      const usernameChanged = values.username !== (user?.username || '');
      if (usernameChanged) {
        await api.updateUsername(values.username);
        const updatedUser = { ...user, username: values.username };
        Storage.setUser(updatedUser);
        setUser(updatedUser);
        message.success('用户名已更新');
      }
      setSettingsOpen(false);
    } catch (err) {
      if (err.errorFields) {
        message.warning('请检查输入');
      } else {
        message.error(err.message || '更新失败');
      }
    }
  }

  function openAddTag() {
    setTagModalMode('add');
    setTagModalName('');
    setTagModalColor(TAG_COLORS[0]);
    setTagModalEditId(null);
    setTagModalIsPrivate(false);
    setTagModalOpen(true);
  }

  function openEditTag(t) {
    setTagModalMode('edit');
    setTagModalName(t.name);
    setTagModalColor(t.color || TAG_COLORS[0]);
    setTagModalEditId(t.id);
    setTagModalIsPrivate(!!t.is_private);
    setTagModalOpen(true);
  }

  function handleTagModalOk() {
    const name = tagModalName.trim();
    if (!name) return;
    if (tagModalMode === 'add') {
      onAddTag(name, tagModalColor, tagModalIsPrivate);
    } else {
      onEditTag(tagModalEditId, name, tagModalColor, tagModalIsPrivate);
    }
    setTagModalOpen(false);
  }

  // 打开项目弹窗
  function openProjectModal(mode, project = null) {
    setProjectModalMode(mode);
    if (mode === 'edit' && project) {
      setProjectModalEditId(project.id);
      setProjectModalName(project.name);
      setProjectModalIsPrivate(!!project.is_private);
      // 从 projects prop 中获取 labels（已由 App.jsx 传入）
      setProjectModalLabels(project.labels || []);
    } else {
      setProjectModalEditId(null);
      setProjectModalName('');
      setProjectModalIsPrivate(false);
      setProjectModalLabels([]);
    }
    setProjectLabelInput('');
    setProjectLabelColor(TAG_COLORS[0]);
    setEditingLabelId(null);
    setEditingLabelName('');
    setProjectModalOpen(true);
  }

  // 保存项目弹窗
  async function handleProjectModalOk() {
    const name = projectModalName.trim();
    if (!name) return;

    if (projectModalMode === 'add') {
      onAddProject(name, projectModalIsPrivate);
    } else {
      console.log('编辑项目:', { id: projectModalEditId, name, is_private: projectModalIsPrivate });
      onEditProject(projectModalEditId, name, projectModalIsPrivate);
    }
    setProjectModalOpen(false);
  }

  // 添加项目专属标签
  async function handleAddProjectLabel() {
    const name = projectLabelInput.trim();
    if (!name || !projectModalEditId) return;
    try {
      const res = await api.createProjectLabel(projectModalEditId, { name, color: projectLabelColor });
      setProjectModalLabels((prev) => [...prev, res.data]);
      setProjectLabelInput('');
      setProjectLabelColor(TAG_COLORS[0]);
    } catch (e) { message.error(e.message); }
  }

  // 删除项目专属标签
  async function handleDeleteProjectLabel(labelId) {
    const related = (allItems || []).filter((i) => i.project_label_id === labelId && !i.deleted_at);
    const notes = related.filter((i) => i.type === 'note');
    if (notes.length > 0) {
      message.warning(`该标签下还有 ${notes.length} 条关联随笔，请先解除关联`);
      return;
    }
    const uncompleted = related.filter((i) => i.type === 'task' && !i.completed);
    if (uncompleted.length > 0) {
      message.warning(`该标签下还有 ${uncompleted.length} 条未完成任务，请先解除关联或完成任务`);
      return;
    }
    const completedCount = related.filter((i) => i.type === 'task' && i.completed).length;
    if (completedCount > 0) {
      modal.confirm({
        title: '确认删除该标签？',
        content: `该标签下有 ${completedCount} 条已完成任务，删除后将自动解除关联。`,
        okText: '删除',
        cancelText: '取消',
        okButtonProps: { danger: true },
        onOk: async () => {
          try {
            await api.deleteProjectLabel(labelId);
            setProjectModalLabels((prev) => prev.filter((l) => l.id !== labelId));
            onRefresh?.();
          } catch (e) { message.error(e.message); }
        },
      });
      return;
    }
    try {
      await api.deleteProjectLabel(labelId);
      setProjectModalLabels((prev) => prev.filter((l) => l.id !== labelId));
      onRefresh?.();
    } catch (e) { message.error(e.message); }
  }

  // 编辑项目专属标签
  async function handleSaveEditLabel() {
    const name = editingLabelName.trim();
    if (!name || !editingLabelId) return;
    try {
      await api.updateProjectLabel(editingLabelId, { name, color: editingLabelColor });
      setProjectModalLabels((prev) => prev.map((l) => l.id === editingLabelId ? { ...l, name, color: editingLabelColor } : l));
      setEditingLabelId(null);
      setEditingLabelName('');
    } catch (e) { message.error(e.message); }
  }

  const themeMenuItems = themeKeys.map((key) => ({
    key,
    label: themes[key].name,
    onClick: () => switchTheme(key),
  }));

  return (
    <Sider width={isMobile ? '100%' : 240} style={{ background: 'var(--bg-sidebar)', borderRight: 'none', height: isMobile ? '100%' : '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 头部 */}
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.5px' }}>CPTodo</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {isMobile ? (
            <Button type="text" size="small" icon={<SearchOutlined />} onClick={() => { setSearchOpen(true); setSearchQuery(''); setSearchResults([]); }} style={{ color: 'var(--fg-muted)' }} />
          ) : (
            <Tooltip title="搜索"><Button type="text" size="small" icon={<SearchOutlined />} onClick={() => { setSearchOpen(true); setSearchQuery(''); setSearchResults([]); }} style={{ color: 'var(--fg-muted)' }} /></Tooltip>
          )}
          {isMobile ? (
            <Button type="text" size="small" icon={privacyMode ? null : <SettingOutlined />} onClick={openSettings} style={{ color: 'var(--fg-muted)', fontWeight: 700, fontSize: privacyMode ? 12 : undefined }}>{privacyMode ? 'PM' : null}</Button>
          ) : (
            <Tooltip title="设置"><Button type="text" size="small" icon={privacyMode ? null : <SettingOutlined />} onClick={openSettings} style={{ color: 'var(--fg-muted)', fontWeight: 700, fontSize: privacyMode ? 12 : undefined }}>{privacyMode ? 'PM' : null}</Button></Tooltip>
          )}
          <Dropdown menu={{ items: themeMenuItems, selectedKeys: [themeKey] }} trigger={['click']} onOpenChange={(open) => { if (open) setThemeTooltipOpen(false); }}>
            {isMobile ? (
              <Button type="text" size="small" icon={<BgColorsOutlined />} style={{ color: 'var(--fg-muted)' }} />
            ) : (
              <Tooltip title="切换主题" open={themeTooltipOpen} onOpenChange={setThemeTooltipOpen}><Button type="text" size="small" icon={<BgColorsOutlined />} style={{ color: 'var(--fg-muted)' }} /></Tooltip>
            )}
          </Dropdown>
          {isMobile ? (
            <Button type="text" size="small" icon={<LogoutOutlined />} onClick={onLogout} style={{ color: 'var(--fg-muted)' }} />
          ) : (
            <Tooltip title="退出登录"><Button type="text" size="small" icon={<LogoutOutlined />} onClick={onLogout} style={{ color: 'var(--fg-muted)' }} /></Tooltip>
          )}
        </div>
      </div>

      {/* 导航区 */}
      <div style={{ flex: 1, overflowY: 'scroll', overflowX: 'hidden', padding: '8px 0', minHeight: 0, maxHeight: isMobile ? '100%' : 'calc(100vh - 73px)' }}>
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
                  <Badge count={badges[item.view]} size="small" style={{ backgroundColor: 'var(--accent)' }} />
                )}
              </div>
            );
          })}
        </div>

        {/* 项目 */}
        <div style={{ padding: '16px 10px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 14px 6px', cursor: 'pointer' }} onClick={() => { const v = !projectsExpanded; setProjectsExpanded(v); localStorage.setItem('sidebar_projects_expanded', v); }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CaretRightOutlined style={{ fontSize: 10, color: 'var(--fg-muted)', transition: 'transform 0.2s', transform: projectsExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }} />
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--fg-muted)', fontWeight: 600 }}>项目</span>
            </div>
            <Button type="text" size="small" icon={<PlusOutlined />} onClick={(e) => { e.stopPropagation(); openProjectModal('add'); }} style={{ color: 'var(--fg-muted)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateRows: projectsExpanded ? '1fr' : '0fr', transition: 'grid-template-rows 0.25s ease' }}>
            <div style={{ overflow: 'hidden' }}>
            {(projects || []).map((p) => {
            const active = currentView === 'project-' + p.id;
            return (
              <div key={p.id}
                onClick={() => onViewChange('project-' + p.id)}
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
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); openProjectModal('edit', p); }}
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
              </div>
            );
          })}
            </div>
          </div>
        </div>

        {/* 标签 */}
        <div style={{ padding: '16px 10px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 14px 6px', cursor: 'pointer' }} onClick={() => { const v = !tagsExpanded; setTagsExpanded(v); localStorage.setItem('sidebar_tags_expanded', v); }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CaretRightOutlined style={{ fontSize: 10, color: 'var(--fg-muted)', transition: 'transform 0.2s', transform: tagsExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }} />
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--fg-muted)', fontWeight: 600 }}>标签</span>
            </div>
            <Button type="text" size="small" icon={<PlusOutlined />} onClick={(e) => { e.stopPropagation(); openAddTag(); }} style={{ color: 'var(--fg-muted)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateRows: tagsExpanded ? '1fr' : '0fr', transition: 'grid-template-rows 0.25s ease' }}>
            <div style={{ overflow: 'hidden' }}>
            {(tags || []).map((t) => {
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
          </div>
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
                  <Badge count={badges[item.view]} size="small" style={{ backgroundColor: 'var(--accent)' }} />
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
        centered
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
              onChange={(e) => setTagModalName(e.target.value)} maxLength={20} autoFocus />
            {tagModalName.length > 16 && (
              <div style={{ fontSize: 11, color: tagModalName.length >= 20 ? 'var(--overdue)' : 'var(--fg-muted)', marginTop: 4 }}>
                {tagModalName.length}/20
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 8 }}>标签颜色</div>
            <ColorPicker value={tagModalColor} onChange={setTagModalColor} />
          </div>
          <div style={{ marginTop: 16 }}>
            <Checkbox checked={tagModalIsPrivate} onChange={(e) => setTagModalIsPrivate(e.target.checked)}>
              Private
            </Checkbox>
          </div>
        </div>
      </Modal>

      {/* 设置弹窗 */}
      <Modal
        title="设置"
        open={settingsOpen}
        centered
        onCancel={() => setSettingsOpen(false)}
        onOk={handleSaveSettings}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 6 }}>当前邮箱</div>
            <div style={{ fontSize: 14, color: 'var(--fg)' }}>{user?.email || '-'}</div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 6 }}>用户名</div>
            <Form form={settingsForm} layout="vertical" initialValues={{ username: user?.username || '' }}>
              <Form.Item name="username" rules={[
                { min: 3, max: 50, message: '用户名长度需在 3-50 个字符之间' },
              ]}>
                <Input
                  prefix={<UserOutlined />}
                  placeholder="设置了用户名后可直接使用用户名登录"
                  maxLength={50}
                />
              </Form.Item>
            </Form>
            {user?.username ? (
              <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 4 }}>您已设置用户名，可以使用用户名登录</div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 4 }}>您尚未设置用户名，只能使用邮箱登录</div>
            )}
          </div>
          <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, color: 'var(--fg-primary)', marginBottom: 2 }}>Private Mode</div>
                <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>开启后隐藏设为Private的项目、标签和任务</div>
                <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>搜索、选项、视图内等任意有关联处都会隐藏</div>
              </div>
              <Checkbox checked={privacyMode} onChange={(e) => setPrivacyMode(e.target.checked)} />
            </div>
          </div>
        </div>
      </Modal>

      {/* 项目管理弹窗 */}
      <Modal
        title={projectModalMode === 'add' ? '新建项目' : '编辑项目'}
        open={projectModalOpen}
        centered
        onCancel={() => { setProjectModalOpen(false); onRefresh?.(); }}
        onOk={handleProjectModalOk}
        okText={projectModalMode === 'add' ? '创建' : '保存'}
        cancelText="取消"
        okButtonProps={{ disabled: !projectModalName.trim() }}
        destroyOnHidden
        width={400}
      >
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 6 }}>项目名称</div>
            <Input placeholder="输入项目名称..." value={projectModalName}
              onChange={(e) => setProjectModalName(e.target.value)} maxLength={100} autoFocus />
          </div>
          <div style={{ marginBottom: 16 }}>
            <Checkbox checked={projectModalIsPrivate} onChange={(e) => setProjectModalIsPrivate(e.target.checked)}>
              Private
            </Checkbox>
          </div>

          {/* 项目专属标签管理（仅编辑模式） */}
          {projectModalMode === 'edit' && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 8 }}>项目专属标签</div>
              {/* 已有标签列表 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {projectModalLabels.map((label) => (
                  <span key={label.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 6, fontSize: 12,
                    background: (editingLabelId === label.id ? editingLabelColor : label.color) + '18',
                    color: editingLabelId === label.id ? editingLabelColor : label.color,
                    border: `1px solid ${(editingLabelId === label.id ? editingLabelColor : label.color)}30`,
                  }}>
                    {editingLabelId === label.id ? (
                      <>
                        <Input size="small" value={editingLabelName}
                          onChange={(e) => setEditingLabelName(e.target.value)}
                          onPressEnter={handleSaveEditLabel}
                          onBlur={handleSaveEditLabel}
                          maxLength={20}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: 70, height: 20, fontSize: 12 }}
                        />
                        <input type="color" value={editingLabelColor}
                          onChange={(e) => setEditingLabelColor(e.target.value)}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: 16, height: 16, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0 }}
                        />
                      </>
                    ) : (
                      <span
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingLabelId(label.id); setEditingLabelName(label.name); setEditingLabelColor(label.color); }}
                        onPointerDown={() => { labelTimers.current.set(label.id, setTimeout(() => { setEditingLabelId(label.id); setEditingLabelName(label.name); setEditingLabelColor(label.color); }, 500)); }}
                        onPointerUp={() => { clearTimeout(labelTimers.current.get(label.id)); labelTimers.current.delete(label.id); }}
                        onPointerLeave={() => { clearTimeout(labelTimers.current.get(label.id)); labelTimers.current.delete(label.id); }}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        {label.name}
                      </span>
                    )}
                    {(() => {
                      const related = (allItems || []).filter((i) => i.project_label_id === label.id && !i.deleted_at);
                      const hasBlocking = related.some((i) => i.type === 'note' || (i.type === 'task' && !i.completed));
                      const hasCompleted = related.some((i) => i.type === 'task' && i.completed);
                      if (hasBlocking || hasCompleted) {
                        return (
                          <span style={{ cursor: 'pointer', opacity: 0.6, fontSize: 10 }}
                            onClick={(e) => { e.stopPropagation(); handleDeleteProjectLabel(label.id); }}>
                            &times;
                          </span>
                        );
                      }
                      return (
                        <Popconfirm title="确认删除该标签？" onConfirm={(e) => { e.stopPropagation(); handleDeleteProjectLabel(label.id); }} okText="删除" cancelText="取消" icon={null}>
                          <span style={{ cursor: 'pointer', opacity: 0.6, fontSize: 10 }} onClick={(e) => e.stopPropagation()}>
                            &times;
                          </span>
                        </Popconfirm>
                      );
                    })()}
                  </span>
                ))}
                {projectModalLabels.length === 0 && (
                  <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>暂无标签，在下方添加</span>
                )}
              </div>
              {/* 新增标签输入 */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Input size="small" placeholder="标签名称" value={projectLabelInput}
                  onChange={(e) => setProjectLabelInput(e.target.value)}
                  onPressEnter={handleAddProjectLabel}
                  maxLength={20}
                  style={{ flex: 1 }} />
                <input type="color" value={projectLabelColor}
                  onChange={(e) => setProjectLabelColor(e.target.value)}
                  style={{ width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 1 }} />
                <Button size="small" type="primary" onClick={handleAddProjectLabel}
                  disabled={!projectLabelInput.trim()}>添加</Button>
              </div>
              {projectLabelInput.length > 16 && (
                <div style={{ fontSize: 11, color: projectLabelInput.length >= 20 ? 'var(--overdue)' : 'var(--fg-muted)', marginTop: 4 }}>
                  {projectLabelInput.length}/20
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 6 }}>双击或长按标签名称可编辑，点 &times; 删除</div>
            </div>
          )}
        </div>
      </Modal>

      {/* 搜索弹窗 */}
      <Modal
        title="搜索"
        open={searchOpen}
        onCancel={() => setSearchOpen(false)}
        footer={null}
        centered
        destroyOnHidden
        width={520}
        styles={{ body: { padding: '12px 0 0' } }}
      >
        <div style={{ padding: '0 16px 12px' }}>
          <Input
            placeholder="搜索标题、内容、备注..."
            prefix={<SearchOutlined style={{ color: 'var(--fg-muted)' }} />}
            value={searchQuery}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              clearTimeout(searchTimerRef.current);
              if (!val.trim()) { setSearchResults([]); return; }
              setSearchLoading(true);
              searchTimerRef.current = setTimeout(async () => {
                try {
                  const res = await api.searchItems(val.trim());
                  let data = res.data || [];
                  if (privacyMode) {
                    const privateProjectIds = (allProjects || []).filter((p) => p.is_private).map((p) => p.id);
                    const privateTagIds = (allTagsList || []).filter((t) => t.is_private).map((t) => t.id);
                    data = data.filter((i) => {
                      if (i.is_private) return false;
                      if (i.project_id && privateProjectIds.includes(i.project_id)) return false;
                      if (i.tags && i.tags.some((t) => privateTagIds.includes(t.id))) return false;
                      return true;
                    });
                  }
                  setSearchResults(data);
                } catch (err) { /* ignore */ }
                setSearchLoading(false);
              }, 300);
            }}
            allowClear
            autoFocus
          />
        </div>
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          {searchLoading && <div style={{ textAlign: 'center', padding: 24, color: 'var(--fg-muted)' }}>搜索中...</div>}
          {!searchLoading && searchQuery.trim() && searchResults.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--fg-muted)' }}>没有找到结果</div>
          )}
          {searchResults.map((item) => {
            const inTrash = !!item.deleted_at;
            const isNote = item.type === 'note';
            const isRecurring = !!item.recurring;
            const location = inTrash ? '回收站'
              : isRecurring ? '重复任务'
              : item.project_name ? `项目 > ${item.project_name}`
              : isNote ? '随笔'
              : item.tags && item.tags.length > 0 ? `标签 > ${item.tags[0].name}`
              : item.due_date ? new Date(item.due_date).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
              : '任务';
            return (
              <div key={item.id}
                onClick={() => { setSearchOpen(false); onSearchSelect?.(item); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 16px', cursor: 'pointer',
                  opacity: inTrash ? 0.6 : 1,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-light)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{
                  width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isNote ? 'var(--accent-light)' : 'var(--border)', fontSize: 13, flexShrink: 0,
                  color: isNote ? 'var(--complete)' : item.completed ? 'var(--fg-muted)' : 'var(--accent)',
                }}>
                  {isNote ? <FileTextOutlined /> : <CheckSquareOutlined />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: item.completed ? 'line-through' : 'none', color: item.completed ? 'var(--fg-muted)' : 'var(--fg-primary)' }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
                    {location}
                    {item.tags && item.tags.length > 0 && (
                      <span> · {item.tags.map((t) => t.name).join(', ')}</span>
                    )}
                  </div>
                </div>
                {item.priority === 'important' && <StarFilled style={{ color: 'var(--important)', fontSize: 12, flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>
      </Modal>
    </Sider>
  );
}
