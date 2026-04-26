import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import CardList from './components/CardList';
import DetailPanel from './components/DetailPanel';
import AddItemModal from './components/AddItemModal';
import TrashView from './components/TrashView';
import ToastContainer, { toast } from './components/Toast';
import { api, Storage } from './api';
import './styles/global.css';
import './styles/cardlist.css';
import './styles/detail.css';
import './styles/toast.css';
import './styles/modal.css';

const VIEW_TITLES = {
  notes: '随笔', today: '今天', week: '本周',
  recurring: '重复任务', trash: '回收站', expired: '已过期',
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
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState('notes');
  const [selectedId, setSelectedId] = useState(null);
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelectedIds, setBatchSelectedIds] = useState([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [quickNote, setQuickNote] = useState('');

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
        if (!showCompleted) items = items.filter((i) => !i.completed); break;
      case 'expired':
        items = allItems.filter((i) => { if (i.type !== 'task' || i.completed || i.recurring || !i.due_date) return false; return i.due_date.slice(0, 10) < weekStart(); }); break;
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

  async function handleSave(id, data) {
    try { await api.updateItem(id, data); toast.success('保存成功'); setSelectedId(null); loadData(); }
    catch (e) { toast.error(e.message); }
  }

  async function handleDelete(item) {
    try { await api.deleteItem(item.id); toast.success('已移入回收站'); setSelectedId(null); loadData(); }
    catch (e) { toast.error(e.message); }
  }

  async function handleAddItemTag(itemId, tagId) {
    try { await api.addItemTag(itemId, tagId); loadData(); } catch (e) { toast.error(e.message); }
  }

  async function handleRemoveItemTag(itemId, tagId) {
    try { await api.removeItemTag(itemId, tagId); loadData(); } catch (e) { toast.error(e.message); }
  }

  async function handleAddProject(name) {
    try { await api.createProject({ name }); toast.success('项目创建成功'); loadData(); } catch (e) { toast.error(e.message); }
  }

  async function handleEditProject(id, name) {
    try { await api.updateProject(id, { name }); loadData(); } catch (e) { toast.error(e.message); }
  }

  async function handleDeleteProject(p) {
    if (!window.confirm(`确认删除项目「${p.name}」？`)) return;
    try { await api.deleteProject(p.id); toast.success('已删除'); if (currentView === 'project-' + p.id) setCurrentView('notes'); loadData(); }
    catch (e) { toast.error(e.message); }
  }

  async function handleAddTag(name) {
    try { await api.createTag({ name }); toast.success('标签创建成功'); loadData(); } catch (e) { toast.error(e.message); }
  }

  async function handleEditTag(id, name) {
    try { await api.updateTag(id, { name }); loadData(); } catch (e) { toast.error(e.message); }
  }

  async function handleDeleteTag(t) {
    if (t.item_count > 0) {
      toast.error(`标签「${t.name}」下还有 ${t.item_count} 个关联任务，请先在标签视图内解除关联`);
      return;
    }
    if (!window.confirm(`标签删除后不可恢复，确认删除「${t.name}」？`)) return;
    try { await api.deleteTag(t.id); toast.success('已删除'); if (currentView === 'tag-' + t.id) setCurrentView('notes'); loadData(); }
    catch (e) { toast.error(e.message); }
  }

  function handleLogout() { Storage.clear(); navigate('/login', { replace: true }); }

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

  // 前端计算项目和标签的条目数，和显示内容一致
  const projectsWithCount = projects.map((p) => ({
    ...p,
    item_count: allItems.filter((i) => (i.type === 'task' || i.type === 'note') && i.project_id === p.id && !i.completed && !i.recurring).length,
  }));

  const tagsWithCount = allTags.map((t) => ({
    ...t,
    item_count: allItems.filter((i) => i.tags?.some((tag) => tag.id === t.id) && !i.completed && !i.deleted_at).length,
  }));

  const showBatchBtn = !['recurring', 'trash'].includes(currentView) && currentView !== 'trash';

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>加载中...</div>;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        currentView={currentView} onViewChange={handleViewChange}
        projects={projectsWithCount} tags={tagsWithCount} badges={badges}
        onAddProject={handleAddProject} onAddTag={handleAddTag}
        onEditProject={handleEditProject} onDeleteProject={handleDeleteProject}
        onEditTag={handleEditTag} onDeleteTag={handleDeleteTag}
        allItems={allItems}
        onLogout={handleLogout}
      />
      <main className="main-content">
        <header className="content-header">
          <div className="content-title-row">
            <h1>{getViewTitle()}</h1>
            <div className="content-actions">
              {!['recurring', 'expired', 'trash'].includes(currentView) && (
                <button className="btn btn-secondary btn-sm" onClick={() => setShowCompleted((v) => !v)}>
                  {showCompleted ? '隐藏已完成' : '显示已完成'}
                </button>
              )}
              {batchMode && batchSelectedIds.length > 0 && !currentView.startsWith('tag-') && (
                <button className="btn btn-danger btn-sm" onClick={handleBatchDelete}>
                  删除选中 ({batchSelectedIds.length})
                </button>
              )}
              {batchMode && batchSelectedIds.length > 0 && currentView.startsWith('tag-') && (
                <button className="btn btn-danger btn-sm" onClick={handleBatchUnlinkTag}>
                  解除关联 ({batchSelectedIds.length})
                </button>
              )}
              {showBatchBtn && !currentView.startsWith('tag-') && (
                <button className={`btn btn-sm ${batchMode ? 'btn-danger-active' : 'btn-danger'}`}
                  onClick={() => { if (batchMode) { setBatchMode(false); setBatchSelectedIds([]); } else { setBatchMode(true); setSelectedId(null); } }}>
                  {batchMode ? '取消批量' : '批量删除'}
                </button>
              )}
              {currentView.startsWith('tag-') && (
                <button className={`btn btn-sm ${batchMode ? 'btn-danger-active' : 'btn-secondary'}`}
                  onClick={() => { if (batchMode) { setBatchMode(false); setBatchSelectedIds([]); } else { setBatchMode(true); setSelectedId(null); } }}>
                  {batchMode ? '取消' : '批量解除'}
                </button>
              )}
              {currentView !== 'expired' && currentView !== 'trash' && (
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>+ 新建</button>
              )}
            </div>
          </div>
          {getViewSubtitle() && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{getViewSubtitle()}</div>}
        </header>

        {/* 随笔快速输入 */}
        {currentView === 'notes' && (
          <div className="quick-note-bar">
            <input type="text" placeholder="快速记录一条随笔，回车保存..." maxLength={255}
              value={quickNote} onChange={(e) => setQuickNote(e.target.value)} onKeyDown={handleQuickNote} />
          </div>
        )}

        {/* 回收站视图特殊处理 */}
        {currentView === 'trash' ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <p>点击左侧"回收站"打开回收站管理</p>
          </div>
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
      </main>

      <DetailPanel item={selectedItem} projects={projects} allTags={allTags}
        onClose={() => setSelectedId(null)} onSave={handleSave} onDelete={handleDelete}
        onAddItemTag={handleAddItemTag} onRemoveItemTag={handleRemoveItemTag} />

      {showAddModal && (
        <AddItemModal currentView={currentView} currentProjectId={currentProjectId}
          currentTagId={currentTagId} projects={projects}
          onConfirm={handleCreateItem} onCancel={() => setShowAddModal(false)} />
      )}

      {showTrash && <TrashView onClose={() => setShowTrash(false)} onRefresh={loadData} />}

      <ToastContainer />
    </div>
  );
}
