import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Button, Input, Typography, Spin, Popconfirm, App as AntApp } from 'antd';
import Sidebar from './components/Sidebar';
import CardList from './components/CardList';
import DetailPanel from './components/DetailPanel';
import AddItemModal from './components/AddItemModal';
import TrashView from './components/TrashView';
import CalendarView from './components/CalendarView';
import { toast } from './components/Toast';
import { api, Storage } from './api';
import './styles/global.css';

const { Content } = Layout;
const { Title, Text } = Typography;

const VIEW_TITLES = {
  notes: '随笔', today: '今天', week: '本周',
  recurring: '重复任务', trash: '回收站', expired: '已过期', calendar: '日历',
};

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
function isToday(s) { return s && toDateStr(s) === today(); }
function isThisWeek(s) { if (!s) return false; const d = toDateStr(s); return d >= weekStart() && d <= weekEnd(); }

export default function App() {
  const { message, modal } = AntApp.useApp();
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState('notes');
  const [selectedId, setSelectedId] = useState(null);
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelectedIds, setBatchSelectedIds] = useState([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [quickNote, setQuickNote] = useState('');
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(null);

  // 初始化 toast 的 message 实例
  useEffect(() => {
    toast.init(message);
  }, [message]);

  const [allItems, setAllItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [itemsRes, projectsRes, tagsRes] = await Promise.all([
        api.getItems(), api.getProjects(), api.getTags(),
      ]);
      setAllItems(itemsRes.data || []);
      setProjects(projectsRes.data || []);
      setAllTags(tagsRes.data || []);
    } catch (e) { toast.error('加载失败: ' + e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function getFilteredItems() {
    let items = [];
    switch (currentView) {
      case 'notes': items = allItems.filter((i) => i.type === 'note' && !i.project_id); break;
      case 'today':
        items = allItems.filter((i) => i.type === 'task' && (isToday(i.due_date) || (i.recurring && !i.due_date)));
        if (!showCompleted) items = items.filter((i) => !i.completed); break;
      case 'week':
        items = allItems.filter((i) => { if (i.type !== 'task') return false; if (isToday(i.due_date)) return false; return isThisWeek(i.due_date) || (i.recurring && !i.due_date); });
        if (!showCompleted) items = items.filter((i) => !i.completed); break;
      case 'recurring':
        items = allItems.filter((i) => i.recurring);
        break;
      case 'expired':
        items = allItems.filter((i) => { if (i.type !== 'task' || i.completed || i.recurring || !i.due_date) return false; return toDateStr(i.due_date) < weekStart(); }); break;
      default:
        if (currentView.startsWith('project-')) {
          const pid = Number(currentView.split('-')[1]);
          items = allItems.filter((i) => (i.type === 'task' || i.type === 'note') && i.project_id === pid && !i.recurring);
          if (!showCompleted) items = items.filter((i) => !i.completed);
        } else if (currentView.startsWith('tag-')) {
          const tid = Number(currentView.split('-')[1]);
          items = allItems.filter((i) => i.tags && i.tags.some((t) => t.id === tid));
          if (!showCompleted) items = items.filter((i) => !i.completed);
        }
    }
    items.sort((a, b) => {
      if (a.type === 'note' && b.type !== 'note') return 1;
      if (a.type !== 'note' && b.type === 'note') return -1;
      const ai = a.priority === 'important' ? 0 : 1, bi = b.priority === 'important' ? 0 : 1;
      if (ai !== bi) return ai - bi;
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1; if (b.due_date) return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });
    return items;
  }

  function getViewTitle() {
    if (currentView.startsWith('project-')) { const p = projects.find((p) => p.id === Number(currentView.split('-')[1])); return p ? p.name : '项目'; }
    if (currentView.startsWith('tag-')) { const t = allTags.find((t) => t.id === Number(currentView.split('-')[1])); return t ? t.name : '标签'; }
    return VIEW_TITLES[currentView] || '';
  }

  function getViewSubtitle() {
    if (currentView === 'today') { const d = new Date(); return `${d.getMonth() + 1}月${d.getDate()}日`; }
    if (currentView === 'week') { const s = new Date(weekStart() + 'T00:00:00'), e = new Date(weekEnd() + 'T00:00:00'); return `${s.getMonth() + 1}月${s.getDate()}日 - ${e.getMonth() + 1}月${e.getDate()}日`; }
    if (currentView === 'expired') return '上周及之前未完成的任务';
    return '';
  }

  const badges = {
    today: allItems.filter((i) => i.type === 'task' && !i.completed && (isToday(i.due_date) || (i.recurring && !i.due_date))).length,
    week: allItems.filter((i) => i.type === 'task' && !i.completed && !isToday(i.due_date) && (isThisWeek(i.due_date) || (i.recurring && !i.due_date))).length,
    expired: allItems.filter((i) => i.type === 'task' && !i.completed && !i.recurring && i.due_date && toDateStr(i.due_date) < weekStart()).length,
  };

  const selectedItem = allItems.find((i) => i.id === selectedId);
  const filteredItems = getFilteredItems();
  const currentProjectId = currentView.startsWith('project-') ? Number(currentView.split('-')[1]) : null;
  const currentTagId = currentView.startsWith('tag-') ? Number(currentView.split('-')[1]) : null;

  // === 操作 ===
  function handleViewChange(view) {
    if (view === 'trash') { setShowTrash(true); return; }
    setCurrentView(view); setSelectedId(null); setBatchMode(false); setBatchSelectedIds([]);
  }

  async function handleToggleComplete(id, checked) {
    try { await api.updateItem(id, { completed: checked }); toast.success(checked ? '任务已完成' : '已取消完成'); loadData(); }
    catch (e) { toast.error(e.message); }
  }

  async function handleSave(id, data, tagsToAdd = [], tagsToRemove = []) {
    try {
      await api.updateItem(id, data);
      await Promise.all([
        ...tagsToAdd.map((tagId) => api.addItemTag(id, tagId)),
        ...tagsToRemove.map((tagId) => api.removeItemTag(id, tagId)),
      ]);
      toast.success('保存成功');
      setSelectedId(null);
      loadData();
    } catch (e) { toast.error(e.message); }
  }

  async function handleDelete(item) {
    try { await api.deleteItem(item.id); toast.success('已移入回收站'); setSelectedId(null); loadData(); }
    catch (e) { toast.error(e.message); }
  }

  async function handleAddProject(name) {
    try { await api.createProject({ name }); toast.success('项目创建成功'); loadData(); } catch (e) { toast.error(e.message); }
  }

  async function handleEditProject(id, name) {
    try { await api.updateProject(id, { name }); loadData(); } catch (e) { toast.error(e.message); }
  }

  async function handleDeleteProject(p) {
    if (p.item_count > 0) {
      message.warning(`项目「${p.name}」下还有 ${p.item_count} 个任务或随笔，请先清空项目`);
      return;
    }
    try { await api.deleteProject(p.id); toast.success('已删除'); if (currentView === 'project-' + p.id) setCurrentView('notes'); loadData(); }
    catch (e) { toast.error(e.message); }
  }

  async function handleAddTag(name, color) {
    try { await api.createTag({ name, color }); toast.success('标签创建成功'); loadData(); } catch (e) { toast.error(e.message); }
  }

  async function handleEditTag(id, name, color) {
    try { await api.updateTag(id, { name, color }); loadData(); } catch (e) { toast.error(e.message); }
  }

  async function handleDeleteTag(t) {
    if (t.item_count > 0) {
      message.warning(`标签「${t.name}」下还有 ${t.item_count} 个关联任务，请先在标签视图内解除关联`);
      return;
    }
    try { await api.deleteTag(t.id); toast.success('已删除'); if (currentView === 'tag-' + t.id) setCurrentView('notes'); loadData(); }
    catch (e) { toast.error(e.message); }
  }

  function handleLogout() {
    modal.confirm({
      title: '退出登录',
      content: '确定要退出登录吗？',
      okText: '退出',
      cancelText: '取消',
      icon: null,
      mask: { closable: true },
      onOk() {
        Storage.clear();
        navigate('/login', { replace: true });
      },
    });
  }

  async function handleBatchDelete() {
    if (batchSelectedIds.length === 0) return;
    try { await Promise.all(batchSelectedIds.map((id) => api.deleteItem(id))); toast.success(`已删除 ${batchSelectedIds.length} 条`); setBatchMode(false); setBatchSelectedIds([]); loadData(); }
    catch (e) { toast.error(e.message); }
  }

  async function handleBatchUnlinkTag() {
    if (batchSelectedIds.length === 0 || !currentTagId) return;
    try {
      await Promise.all(batchSelectedIds.map((id) => api.removeItemTag(id, currentTagId)));
      toast.success(`已解除 ${batchSelectedIds.length} 条关联`);
      setBatchMode(false); setBatchSelectedIds([]); loadData();
    } catch (e) { toast.error(e.message); }
  }

  function handleBatchToggle(id) {
    setBatchSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  }

  async function handleCreateItem(data, tagId) {
    try {
      const res = await api.createItem(data);
      if (tagId && res.data?.id) await api.addItemTag(res.data.id, tagId);
      toast.success('创建成功');
      setShowAddModal(false);
      loadData();
    } catch (e) { toast.error(e.message); }
  }

  async function handleQuickNote(e) {
    if (e.key !== 'Enter') return;
    const title = quickNote.trim();
    if (!title) return;
    try {
      await api.createItem({ type: 'note', title });
      setQuickNote('');
      loadData();
    } catch (err) { toast.error(err.message); }
  }

  const projectsWithCount = projects.map((p) => ({
    ...p,
    item_count: allItems.filter((i) => (i.type === 'task' || i.type === 'note') && i.project_id === p.id && !i.completed && !i.recurring).length,
  }));

  const tagsWithCount = allTags.map((t) => ({
    ...t,
    item_count: allItems.filter((i) => i.tags?.some((tag) => tag.id === t.id) && !i.completed && !i.deleted_at).length,
  }));

  const showBatchBtn = !['recurring', 'trash', 'calendar'].includes(currentView);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><Spin size="large" /></div>;

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        currentView={currentView} onViewChange={handleViewChange}
        projects={projectsWithCount} tags={tagsWithCount} badges={badges}
        onAddProject={handleAddProject} onAddTag={handleAddTag}
        onEditProject={handleEditProject} onDeleteProject={handleDeleteProject}
        onEditTag={handleEditTag} onDeleteTag={handleDeleteTag}
        allItems={allItems}
        onLogout={handleLogout}
      />
      <Content style={{ background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          background: 'var(--bg-card)', padding: '16px 24px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>{getViewTitle()}</Title>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {!['notes', 'recurring', 'expired', 'trash'].includes(currentView) && (
                <Button size="small" onClick={() => setShowCompleted((v) => !v)}>
                  {showCompleted ? '隐藏已完成' : '显示已完成'}
                </Button>
              )}
              {batchMode && batchSelectedIds.length > 0 && !currentView.startsWith('tag-') && (
                <Popconfirm
                  title={`确认删除 ${batchSelectedIds.length} 条？`}
                  onConfirm={handleBatchDelete}
                  icon={null}
                  okText="删除"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                >
                  <Button size="small" danger>删除选中 ({batchSelectedIds.length})</Button>
                </Popconfirm>
              )}
              {batchMode && batchSelectedIds.length > 0 && currentView.startsWith('tag-') && (
                <Button size="small" danger onClick={handleBatchUnlinkTag}>
                  解除关联 ({batchSelectedIds.length})
                </Button>
              )}
              {showBatchBtn && !currentView.startsWith('tag-') && (
                <Button size="small" danger={batchMode}
                  onClick={() => { if (batchMode) { setBatchMode(false); setBatchSelectedIds([]); } else { setBatchMode(true); setSelectedId(null); } }}>
                  {batchMode ? '取消批量' : '批量删除'}
                </Button>
              )}
              {currentView.startsWith('tag-') && (
                <Button size="small" type={batchMode ? 'primary' : 'default'} danger={batchMode}
                  onClick={() => { if (batchMode) { setBatchMode(false); setBatchSelectedIds([]); } else { setBatchMode(true); setSelectedId(null); } }}>
                  {batchMode ? '取消' : '批量解除'}
                </Button>
              )}
              {currentView !== 'notes' && currentView !== 'expired' && currentView !== 'trash' && (
                <Button type="primary" size="small" onClick={() => setShowAddModal(true)}>+ 新建</Button>
              )}
            </div>
          </div>
          {getViewSubtitle() && <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>{getViewSubtitle()}</Text>}
        </div>

        {/* 随笔快速输入 */}
        {currentView === 'notes' && (
          <div style={{ padding: '12px 24px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <Input placeholder="快速记录一条随笔，回车保存..." maxLength={255} allowClear
              value={quickNote} onChange={(e) => setQuickNote(e.target.value)} onKeyDown={handleQuickNote} />
          </div>
        )}

        {/* 回收站 */}
        {currentView === 'trash' ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#999' }}>
            <p>点击左侧"回收站"打开回收站管理</p>
          </div>
        ) : currentView === 'calendar' ? (
          <CalendarView
            items={allItems}
            selectedDate={calendarSelectedDate}
            onSelectDate={setCalendarSelectedDate}
            onAddItem={(item) => setSelectedId(item.id)}
            showCompleted={showCompleted}
          />
        ) : (
          <CardList
            items={filteredItems} currentView={currentView} selectedId={selectedId}
            projects={projects} batchMode={batchMode} batchSelectedIds={batchSelectedIds}
            onSelectItem={(item) => setSelectedId(item.id)}
            onToggleComplete={handleToggleComplete}
            onBatchToggle={handleBatchToggle}
            onBatchSelectAll={(items) => setBatchSelectedIds(items.map((i) => i.id))}
            onExitBatch={() => { setBatchMode(false); setBatchSelectedIds([]); }}
          />
        )}
      </Content>

      <DetailPanel item={selectedItem} projects={projects} allTags={allTags}
        onClose={() => setSelectedId(null)} onSave={handleSave} onDelete={handleDelete} />

      {showAddModal && (
        <AddItemModal currentView={currentView} currentProjectId={currentProjectId}
          currentTagId={currentTagId} currentCalendarDate={calendarSelectedDate} projects={projects}
          onConfirm={handleCreateItem} onCancel={() => setShowAddModal(false)} />
      )}

      {showTrash && <TrashView onClose={() => setShowTrash(false)} onRefresh={loadData} />}
    </Layout>
  );
}
