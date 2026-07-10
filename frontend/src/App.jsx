import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout, Button, Input, Typography, Spin, Popconfirm, App as AntApp, Grid, Drawer, Popover, Checkbox, Segmented, Select, Tag, DatePicker } from 'antd';
import { MenuOutlined, SearchOutlined } from '@ant-design/icons';
import { App as CapacitorApp } from '@capacitor/app';
import Sidebar from './components/Sidebar';
import CardList from './components/CardList';
import ProjectTable from './components/ProjectTable';
import DetailPanel from './components/DetailPanel';
import AddItemModal from './components/AddItemModal';
import TrashView from './components/TrashView';
import CalendarView, { QUICK_RANGES } from './components/CalendarView';
import dayjs from 'dayjs';
import { toast } from './components/Toast';
import { api, Storage, isTokenExpired } from './api';
import { requestPermission, showNotification } from './utils/notification';
import { getDueReminders, markNotified, cleanupOldReminders } from './utils/reminder';
import './styles/global.css';

const { Content } = Layout;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

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
  const { id: routeItemId } = useParams();
  const [currentView, setCurrentView] = useState(() => window.innerWidth < 768 ? 'today' : 'notes');
  const [selectedId, setSelectedId] = useState(null);
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelectedIds, setBatchSelectedIds] = useState([]);
  const [showCompleted, setShowCompleted] = useState(() => localStorage.getItem('show_completed') === 'true');
  const [sortCompletedLast, setSortCompletedLast] = useState(() => localStorage.getItem('sort_completed_last') === 'true');
  const [showShelved, setShowShelved] = useState(() => {
    const v = localStorage.getItem('show_shelved');
    return v === null ? true : v === 'true';
  });
  // 项目视图的展示模式：卡片 / 表格（持久化到 localStorage）
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('project_view_mode') || 'card');
  // 项目视图的筛选状态：搜索词 / 全局标签多选 / 项目专属标签单选 / 日期范围
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterTagIds, setFilterTagIds] = useState([]);
  const [filterProjectLabelId, setFilterProjectLabelId] = useState(null);
  const [filterDateRange, setFilterDateRange] = useState(null);
  const [privacyMode, setPrivacyMode] = useState(() => localStorage.getItem('privacy_mode') === 'true');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [trashHighlightId, setTrashHighlightId] = useState(null);
  const [quickNote, setQuickNote] = useState('');
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(null);
  const [calendarDateRange, setCalendarDateRange] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { md } = Grid.useBreakpoint();
  const isMobile = !md;
  const detailPanelCloseRef = useRef(null);
  const isDetailOpenRef = useRef(false);

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

  // 切换视图时清空项目筛选，避免上个项目的搜索词/标签带到新视图
  useEffect(() => {
    setSearchKeyword('');
    setFilterTagIds([]);
    setFilterProjectLabelId(null);
    setFilterDateRange(null);
  }, [currentView]);

  // 切回标签页时刷新数据
  useEffect(() => {
    const handleVisibility = () => { if (!document.hidden) loadData(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadData]);

  // 跨天自动刷新数据（每分钟检查日期是否变化）
  useEffect(() => {
    let lastDate = new Date().toDateString();
    const timer = setInterval(() => {
      const currentDate = new Date().toDateString();
      if (currentDate !== lastDate) { lastDate = currentDate; loadData(); }
    }, 60000);
    return () => clearInterval(timer);
  }, [loadData]);

  // 定时检查 token 是否过期，过期立即跳转
  useEffect(() => {
    const check = () => { if (isTokenExpired()) { Storage.clear(); toast.warning('登录信息已过期，请重新登录'); navigate('/login', { replace: true }); } };
    const timer = setInterval(check, 60000);
    return () => clearInterval(timer);
  }, [navigate]);

  // 请求浏览器通知权限
  useEffect(() => { requestPermission(); }, []);

  // 每 30 秒检查提醒
  useEffect(() => {
    const check = () => {
      const due = getDueReminders();
      due.forEach((r) => {
        showNotification('任务提醒', r.title);
        markNotified(r.id);
      });
      cleanupOldReminders();
    };
    check();
    const timer = setInterval(check, 30000);
    return () => clearInterval(timer);
  }, []);

  // 拦截 Android 返回按钮事件
  useEffect(() => {
    let handler;
    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (isDetailOpenRef.current) {
        // 详情页打开时，先播放关闭动画，再返回
        detailPanelCloseRef.current?.();
      } else if (canGoBack) {
        window.history.back();
      } else {
        CapacitorApp.exitApp();
      }
    }).then((listenerHandle) => {
      handler = listenerHandle;
    });
    return () => {
      handler?.remove();
    };
  }, []);

  // 操作前检查 token，过期返回 false 表示已跳转
  function checkAuth() {
    if (isTokenExpired()) { Storage.clear(); toast.warning('登录信息已过期，请重新登录'); navigate('/login', { replace: true }); return false; }
    return true;
  }

  function getFilteredItems() {
    let items = [];
    switch (currentView) {
      case 'notes': items = allItems.filter((i) => i.type === 'note' && !i.project_id); break;
      case 'today':
        items = allItems.filter((i) => {
          if (i.type !== 'task') return false;
          if (i.recurring === 'weekly' && i.recurring_target > 1) return false;
          if (isToday(i.due_date)) return true;
          if (i.recurring && !i.due_date) return true;
          if (i.show_early && i.due_date && toDateStr(i.due_date) > toDateStr(new Date())) return true;
          return false;
        });
        if (!showCompleted) items = items.filter((i) => {
          if (i.recurring === 'daily' && i.recurring_target > 1 && (i.recurring_count || 0) >= i.recurring_target) return false;
          return !i.completed;
        }); break;
      case 'week':
        items = allItems.filter((i) => {
          if (i.type !== 'task') return false;
          if (i.recurring === 'weekly' && i.recurring_target > 1) return true;
          if (isToday(i.due_date)) return false;
          return isThisWeek(i.due_date) || (i.recurring && !i.due_date);
        });
        if (!showCompleted) items = items.filter((i) => {
          if (i.recurring_target > 1 && (i.recurring_count || 0) >= i.recurring_target) return false;
          return !i.completed;
        }); break;
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
          // 项目视图筛选：搜索(标题/内容) + 全局标签(多选,任一匹配) + 项目专属标签(单选)
          if (searchKeyword) {
            const kw = searchKeyword.trim().toLowerCase();
            if (kw) items = items.filter((i) => (i.title || '').toLowerCase().includes(kw) || (i.content || '').toLowerCase().includes(kw));
          }
          if (filterTagIds.length > 0) {
            items = items.filter((i) => i.tags && i.tags.some((t) => filterTagIds.includes(t.id)));
          }
          if (filterProjectLabelId) {
            items = items.filter((i) => i.project_label_id === filterProjectLabelId);
          }
          // 日期范围筛选：随笔无截止日期，不受影响；任务需 due_date 落在范围内
          if (filterDateRange) {
            items = items.filter((i) => {
              if (i.type === 'note') return true;
              if (!i.due_date) return false;
              const d = toDateStr(i.due_date);
              return d >= filterDateRange.start && d <= filterDateRange.end;
            });
          }
        } else if (currentView.startsWith('tag-')) {
          const tid = Number(currentView.split('-')[1]);
          items = allItems.filter((i) => i.tags && i.tags.some((t) => t.id === tid));
          if (!showCompleted) items = items.filter((i) => !i.completed);
        }
    }
    // 隐私模式过滤
    if (privacyMode) {
      items = items.filter((i) => !i.is_private);
      // 同时隐藏隐私项目和隐私标签关联的任务
      const privateProjectIds = projects.filter((p) => p.is_private).map((p) => p.id);
      const privateTagIds = allTags.filter((t) => t.is_private).map((t) => t.id);
      items = items.filter((i) => {
        if (i.project_id && privateProjectIds.includes(i.project_id)) return false;
        if (i.tags && i.tags.some((t) => privateTagIds.includes(t.id))) return false;
        return true;
      });
    }
    // 搁置过滤
    if (!showShelved) {
      items = items.filter((i) => !i.shelved);
    }
    function isDone(i) { return !!(i.completed || (i.recurring && i.recurring_target > 1 && (i.recurring_count || 0) >= i.recurring_target)); }
    items.sort((a, b) => {
      if (sortCompletedLast && isDone(a) !== isDone(b)) return isDone(a) ? 1 : -1;
      if (a.type === 'note' && b.type !== 'note') return 1;
      if (a.type !== 'note' && b.type === 'note') return -1;
      // 项目视图下按项目专属标签分组
      if (currentView.startsWith('project-')) {
        const aLabel = a.project_label_id || 0;
        const bLabel = b.project_label_id || 0;
        if (aLabel !== bLabel) return aLabel - bLabel;
      }
      const ai = a.priority === 'important' ? 0 : 1, bi = b.priority === 'important' ? 0 : 1;
      if (ai !== bi) return ai - bi;
      // 今天视图下，提前显示但未到截止日的任务排到最后
      if (currentView === 'today') {
        const aEarly = a.show_early && !isToday(a.due_date) ? 1 : 0;
        const bEarly = b.show_early && !isToday(b.due_date) ? 1 : 0;
        if (aEarly !== bEarly) return aEarly - bEarly;
        // 同级之间按 planned_time 三层排序：
        // tier 0 = 高优先类型（重要/今天到期/重复）且没填字段 → 排最前
        // tier 1 = 有 planned_time → 按时间升序排中间
        // tier 2 = 普通且提前显示且没填字段 → 排最后
        const aTier = a.planned_time ? 1 : (a.priority === 'important' || isToday(a.due_date) || !!a.recurring ? 0 : 2);
        const bTier = b.planned_time ? 1 : (b.priority === 'important' || isToday(b.due_date) || !!b.recurring ? 0 : 2);
        if (aTier !== bTier) return aTier - bTier;
        if (aTier === 1) return a.planned_time.localeCompare(b.planned_time);
        return new Date(b.created_at) - new Date(a.created_at);
      }
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

  // 隐私模式下过滤掉 private 的条目（自身、所属项目、所属标签任一为 private 即隐藏）
  const visibleItems = privacyMode
    ? allItems.filter((i) => {
        if (i.is_private) return false;
        if (i.project_id && projects.some((p) => p.id === i.project_id && p.is_private)) return false;
        if (i.tags && i.tags.some((t) => allTags.some((tag) => tag.id === t.id && tag.is_private))) return false;
        return true;
      })
    : allItems;

  const badges = {
    today: visibleItems.filter((i) => {
      if (i.type !== 'task') return false;
      if (i.recurring === 'weekly' && i.recurring_target > 1) return false;
      if (i.recurring === 'daily' && i.recurring_target > 1) return (i.recurring_count || 0) < i.recurring_target;
      if (i.completed) return false;
      return isToday(i.due_date) || (i.recurring && !i.due_date);
    }).length,
    week: visibleItems.filter((i) => {
      if (i.type !== 'task' || i.completed) return false;
      if (i.recurring === 'weekly' && i.recurring_target > 1) return (i.recurring_count || 0) < i.recurring_target;
      if (isToday(i.due_date)) return false;
      return isThisWeek(i.due_date) || (i.recurring && !i.due_date);
    }).length,
    expired: visibleItems.filter((i) => i.type === 'task' && !i.completed && !i.recurring && i.due_date && toDateStr(i.due_date) < weekStart()).length,
  };

  const filteredItems = getFilteredItems();
  const currentProjectId = currentView.startsWith('project-') ? Number(currentView.split('-')[1]) : null;
  const currentTagId = currentView.startsWith('tag-') ? Number(currentView.split('-')[1]) : null;
  // 项目视图筛选条的可选项：只列出该项目内实际用到的全局标签 + 该项目的专属标签
  const projectFilterTags = currentProjectId
    ? allTags.filter((t) => allItems.some((i) => i.project_id === currentProjectId && (i.type === 'task' || i.type === 'note') && i.tags && i.tags.some((it) => it.id === t.id)))
    : [];
  const currentProjectObj = currentProjectId ? projects.find((p) => p.id === currentProjectId) : null;
  const projectLabelOptions = currentProjectObj?.labels || [];

  // 移动端使用路由控制详情页，PC 端使用状态控制
  const effectiveSelectedId = isMobile && routeItemId ? Number(routeItemId) : selectedId;
  const effectiveSelectedItem = allItems.find((i) => i.id === effectiveSelectedId);

  // 同步详情页打开状态到 ref（供 Capacitor 返回按钮使用）
  useEffect(() => {
    isDetailOpenRef.current = !!effectiveSelectedId;
  }, [effectiveSelectedId]);

  // === 操作 ===
  function handleViewChange(view) {
    if (view === 'trash') { setShowTrash(true); return; }
    setCurrentView(view); setSelectedId(null); setBatchMode(false); setBatchSelectedIds([]);
    // 移动端切换视图时，如果当前在详情页，返回列表
    if (isMobile && routeItemId) {
      navigate('/', { replace: true });
    }
  }

  async function handleToggleComplete(id, checked) {
    if (!checkAuth()) return;
    const item = allItems.find((i) => i.id === id);
    if (item && item.recurring && item.recurring_target > 1) {
      const newCount = Math.min((item.recurring_count || 0) + 1, item.recurring_target);
      const doneMsg = item.recurring === 'daily' ? '今天目标已达成' : '本周目标已达成';
      try { await api.updateItem(id, { recurring_count: newCount }); toast.success(newCount >= item.recurring_target ? doneMsg : `已完成 ${newCount}/${item.recurring_target}`); loadData(); }
      catch (e) { toast.error(e.message); }
    } else {
      try { await api.updateItem(id, { completed: checked }); toast.success(checked ? '任务已完成' : '已取消完成'); loadData(); }
      catch (e) { toast.error(e.message); }
    }
  }

  async function handleSave(id, data, tagsToAdd = [], tagsToRemove = []) {
    if (!checkAuth()) return;
    try {
      await api.updateItem(id, data);
      await Promise.all([
        ...tagsToAdd.map((tagId) => api.addItemTag(id, tagId)),
        ...tagsToRemove.map((tagId) => api.removeItemTag(id, tagId)),
      ]);
      toast.success('保存成功');
      setSelectedId(null);
      // 移动端保存后返回列表
      if (isMobile && routeItemId) {
        navigate('/', { replace: true });
      }
      loadData();
    } catch (e) { toast.error(e.message); }
  }

  async function handleDelete(item) {
    if (!checkAuth()) return;
    try { await api.deleteItem(item.id); toast.success('已移入回收站'); setSelectedId(null); loadData();
      // 移动端删除后返回列表
      if (isMobile && routeItemId) {
        navigate('/', { replace: true });
      }
    }
    catch (e) { toast.error(e.message); }
  }

  async function handleAddProject(name, isPrivate) {
    if (!checkAuth()) return;
    try { const res = await api.createProject({ name, is_private: isPrivate ? 1 : 0 }); toast.success('项目创建成功'); await loadData(); setCurrentView('project-' + res.data.id); } catch (e) { toast.error(e.message); }
  }

  async function handleEditProject(id, name, isPrivate) {
    if (!checkAuth()) return;
    try { await api.updateProject(id, { name, is_private: isPrivate ? 1 : 0 }); loadData(); } catch (e) { toast.error(e.message); }
  }

  async function handleDeleteProject(p) {
    if (!checkAuth()) return;
    if (p.item_count > 0) {
      message.warning(`项目「${p.name}」下还有 ${p.item_count} 个任务或随笔，请先清空项目`);
      return;
    }
    if (privacyMode && p.hidden_item_count > 0) {
      message.warning(`项目「${p.name}」下还有 ${p.hidden_item_count} 个隐私任务或随笔未解除关联，关闭隐私模式后可查看，请先清空项目`);
      return;
    }
    try { await api.deleteProject(p.id); toast.success('已删除'); if (currentView === 'project-' + p.id) setCurrentView('notes'); loadData(); }
    catch (e) { toast.error(e.message); }
  }

  async function handleAddTag(name, color, isPrivate) {
    if (!checkAuth()) return;
    try { const res = await api.createTag({ name, color, is_private: isPrivate ? 1 : 0 }); toast.success('标签创建成功'); await loadData(); setCurrentView('tag-' + res.data.id); } catch (e) { toast.error(e.message); }
  }

  async function handleEditTag(id, name, color, isPrivate) {
    if (!checkAuth()) return;
    try { await api.updateTag(id, { name, color, is_private: isPrivate ? 1 : 0 }); loadData(); } catch (e) { toast.error(e.message); }
  }

  async function handleDeleteTag(t) {
    if (!checkAuth()) return;
    if (t.item_count > 0) {
      message.warning(`标签「${t.name}」下还有 ${t.item_count} 个关联任务，请先在标签视图内解除关联`);
      return;
    }
    if (privacyMode && t.hidden_item_count > 0) {
      message.warning(`标签「${t.name}」下还有 ${t.hidden_item_count} 个隐私任务未解除关联，关闭隐私模式后可查看，请先解除关联`);
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
    if (!checkAuth()) return;
    if (batchSelectedIds.length === 0) return;
    try { await Promise.all(batchSelectedIds.map((id) => api.deleteItem(id))); toast.success(`已删除 ${batchSelectedIds.length} 条`); setBatchMode(false); setBatchSelectedIds([]); loadData(); }
    catch (e) { toast.error(e.message); }
  }

  async function handleBatchUnlinkTag() {
    if (!checkAuth()) return;
    if (batchSelectedIds.length === 0 || !currentTagId) return;
    // 检查解绑后是否会变成幽灵任务（无截止日期、无项目、无其他标签）
    const blocked = batchSelectedIds.map((id) => {
      const item = allItems.find((i) => i.id === id);
      if (!item || item.type === 'note') return null;
      const hasDueDate = !!item.due_date;
      const hasProject = !!item.project_id;
      const otherTags = (item.tags || []).filter((t) => t.id !== currentTagId);
      if (!hasDueDate && !hasProject && otherTags.length === 0) {
        return item.title;
      }
      return null;
    }).filter(Boolean);
    if (blocked.length > 0) {
      const names = blocked.length <= 3 ? blocked.map((n) => `「${n}」`).join('、') : blocked.slice(0, 3).map((n) => `「${n}」`).join('、') + `等${blocked.length}个任务`;
      message.warning(`${names} 解绑后将无截止日期、项目和标签，请至少填写一项信息`);
      return;
    }
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
    if (!checkAuth()) return;
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
    if (!checkAuth()) return;
    const title = quickNote.trim();
    if (!title) return;
    try {
      await api.createItem({ type: 'note', title });
      setQuickNote('');
      loadData();
    } catch (err) { toast.error(err.message); }
  }

  const projectsWithCount = projects.map((p) => {
    const visible = visibleItems.filter((i) => (i.type === 'task' || i.type === 'note') && i.project_id === p.id && !i.completed && !i.recurring).length;
    const hidden = privacyMode ? allItems.filter((i) => (i.type === 'task' || i.type === 'note') && i.project_id === p.id && !i.completed && !i.recurring && visibleItems.every((v) => v.id !== i.id)).length : 0;
    return { ...p, item_count: visible, hidden_item_count: hidden };
  });

  const tagsWithCount = allTags.map((t) => {
    const visible = visibleItems.filter((i) => i.tags?.some((tag) => tag.id === t.id) && !i.completed && !i.deleted_at).length;
    const hidden = privacyMode ? allItems.filter((i) => i.tags?.some((tag) => tag.id === t.id) && !i.completed && !i.deleted_at && visibleItems.every((v) => v.id !== i.id)).length : 0;
    return { ...t, item_count: visible, hidden_item_count: hidden };
  });

  const showBatchBtn = !['recurring', 'trash', 'calendar'].includes(currentView);

  // 隐私模式下的过滤
  const visibleProjects = privacyMode ? projectsWithCount.filter((p) => !p.is_private) : projectsWithCount;
  const visibleTags = privacyMode ? tagsWithCount.filter((t) => !t.is_private) : tagsWithCount;

  // 隐私模式切换时，如果当前视图是隐私项目/标签，自动跳走
  useEffect(() => {
    if (!privacyMode) return;
    setSelectedId(null);
    // 移动端隐私模式切换时，如果当前在详情页，返回列表
    if (isMobile && routeItemId) {
      navigate('/', { replace: true });
    }
    if (currentView.startsWith('project-')) {
      const pid = Number(currentView.split('-')[1]);
      if (projects.some((p) => p.id === pid && p.is_private)) {
        setCurrentView('today');
      }
    } else if (currentView.startsWith('tag-')) {
      const tid = Number(currentView.split('-')[1]);
      if (allTags.some((t) => t.id === tid && t.is_private)) {
        setCurrentView('today');
      }
    }
  }, [privacyMode]);

  function handleSearchSelect(item) {
    if (item.deleted_at) {
      setCurrentView('trash');
      setTrashHighlightId(item.id);
      setShowTrash(true);
      setMobileMenuOpen(false);
      return;
    }
    let targetView;
    if (item.recurring) {
      targetView = 'recurring';
    } else if (item.project_id) {
      targetView = 'project-' + item.project_id;
    } else if (item.type === 'note') {
      targetView = 'notes';
    } else if (item.tags && item.tags.length > 0) {
      targetView = 'tag-' + item.tags[0].id;
    } else if (item.due_date && isToday(item.due_date)) {
      targetView = 'today';
    } else if (item.due_date && isThisWeek(item.due_date)) {
      targetView = 'week';
    } else if (item.due_date) {
      targetView = 'calendar';
      setCalendarSelectedDate(toDateStr(item.due_date));
    } else {
      targetView = 'today';
    }
    setCurrentView(targetView);
    setSelectedId(item.id);
    setMobileMenuOpen(false);
    // 移动端搜索选择后导航到详情页
    if (isMobile) {
      navigate('/item/' + item.id, { replace: false });
    }
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}><Spin size="large" /></div>;

  return (
    <Layout style={{ height: '100dvh', overflow: 'hidden', position: 'relative' }}>
      {isMobile && !effectiveSelectedId && (
        <Button
          type="text"
          icon={<MenuOutlined />}
          onClick={() => setMobileMenuOpen((v) => !v)}
          style={{ position: 'fixed', top: 8, left: 8, zIndex: 1001, width: 40, height: 40, fontSize: 18, background: 'var(--bg-card)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
        />
      )}
      {isMobile ? (
        <Drawer
          placement="left"
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          closable={false}
          styles={{ body: { padding: 0, background: 'var(--bg-sidebar)' }, wrapper: { width: 280 } }}
        >
          <Sidebar
            currentView={currentView}
            onViewChange={(view) => {
              handleViewChange(view);
              if (!view.startsWith('project-') && !view.startsWith('tag-')) setMobileMenuOpen(false);
            }}
            projects={visibleProjects} tags={visibleTags} badges={badges}
            onAddProject={handleAddProject} onAddTag={handleAddTag}
            onEditProject={handleEditProject} onDeleteProject={handleDeleteProject}
            onEditTag={handleEditTag} onDeleteTag={handleDeleteTag}
            allItems={allItems}
            allProjects={projectsWithCount} allTagsList={allTags}
            onLogout={handleLogout}
            isMobile={isMobile}
            onRefresh={loadData}
            privacyMode={privacyMode}
            setPrivacyMode={(v) => { localStorage.setItem('privacy_mode', v); setPrivacyMode(v); }}
            onSearchSelect={handleSearchSelect}
          />
        </Drawer>
      ) : (
        <Sidebar
          currentView={currentView} onViewChange={handleViewChange}
          projects={visibleProjects} tags={visibleTags} badges={badges}
          onAddProject={handleAddProject} onAddTag={handleAddTag}
          onEditProject={handleEditProject} onDeleteProject={handleDeleteProject}
          onEditTag={handleEditTag} onDeleteTag={handleDeleteTag}
          allItems={allItems}
          allProjects={projectsWithCount} allTagsList={allTags}
          onLogout={handleLogout}
          onRefresh={loadData}
          privacyMode={privacyMode}
          setPrivacyMode={(v) => { localStorage.setItem('privacy_mode', v); setPrivacyMode(v); }}
          onSearchSelect={handleSearchSelect}
        />
      )}
      <Content style={{ background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          background: 'var(--bg-card)', padding: isMobile ? '8px 12px 4px 48px' : '16px 24px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <Title level={4} style={{ margin: 0, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 0%' }}>{getViewTitle()}</Title>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8, flexShrink: 0 }}>
              {currentView.startsWith('project-') && (
                <Segmented
                  size="small"
                  value={viewMode}
                  onChange={(v) => {
                    localStorage.setItem('project_view_mode', v);
                    setViewMode(v);
                    // 切换模式时退出批量选择（表格视图暂未接入批量）
                    setBatchMode(false);
                    setBatchSelectedIds([]);
                  }}
                  options={[
                    { label: '卡片', value: 'card' },
                    { label: '表格', value: 'table' },
                  ]}
                />
              )}
              {!['notes', 'recurring', 'expired', 'trash', 'calendar'].includes(currentView) && (
                <Popover
                  trigger="click"
                  placement="bottomRight"
                  content={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 140 }}>
                      <Checkbox checked={showCompleted} onChange={(e) => { const v = e.target.checked; localStorage.setItem('show_completed', v); setShowCompleted(v); }}>
                        显示已完成
                      </Checkbox>
                      {showCompleted && (
                        <Checkbox checked={sortCompletedLast} onChange={(e) => { const v = e.target.checked; localStorage.setItem('sort_completed_last', v); setSortCompletedLast(v); }} style={{ marginLeft: 24 }}>
                          已完成置底
                        </Checkbox>
                      )}
                      <Checkbox checked={showShelved} onChange={(e) => { const v = e.target.checked; localStorage.setItem('show_shelved', v); setShowShelved(v); }}>
                        显示暂时搁置项
                      </Checkbox>
                    </div>
                  }
                >
                  <Button size="small">筛选</Button>
                </Popover>
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
                  onClick={() => { if (batchMode) { setBatchMode(false); setBatchSelectedIds([]); } else { setBatchMode(true); setSelectedId(null); if (isMobile && routeItemId) navigate('/', { replace: true }); } }}>
                  {batchMode ? '取消批量' : '批量删除'}
                </Button>
              )}
              {currentView.startsWith('tag-') && (
                <Button size="small" type={batchMode ? 'primary' : 'default'} danger={batchMode}
                  onClick={() => { if (batchMode) { setBatchMode(false); setBatchSelectedIds([]); } else { setBatchMode(true); setSelectedId(null); if (isMobile && routeItemId) navigate('/', { replace: true }); } }}>
                  {batchMode ? '取消' : '批量解除'}
                </Button>
              )}
              {isMobile && currentView === 'calendar' && (
                <Popover
                  trigger="click"
                  placement="bottom"
                  align={{ offset: [0, 4] }}
                  content={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160, padding: '4px 0' }}>
                      <Typography.Text style={{ fontSize: 13, fontWeight: 500 }}>快捷日期范围</Typography.Text>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {QUICK_RANGES.map((r) => (
                          <Button key={r.days} size="small"
                            type={calendarDateRange?.end === dayjs().add(r.days, 'day').format('YYYY-MM-DD') ? 'primary' : 'default'}
                            onClick={() => {
                              const start = dayjs().format('YYYY-MM-DD');
                              const end = dayjs().add(r.days, 'day').format('YYYY-MM-DD');
                              setCalendarDateRange({ start, end });
                            }}
                          >{r.label}</Button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <Input type="number" min={1} max={365} size="small"
                          placeholder="请输入"
                          style={{ width: 110 }}
                          onPressEnter={(e) => {
                            const days = parseInt(e.target.value);
                            if (days > 0) {
                              const start = dayjs().format('YYYY-MM-DD');
                              const end = dayjs().add(days, 'day').format('YYYY-MM-DD');
                              setCalendarDateRange({ start, end });
                            }
                          }}
                          suffix={<Typography.Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>天</Typography.Text>}
                        />
                        <Button size="small" type="primary"
                          onClick={(e) => {
                            const input = e.currentTarget.parentElement.querySelector('input');
                            const days = parseInt(input?.value);
                            if (days > 0) {
                              const start = dayjs().format('YYYY-MM-DD');
                              const end = dayjs().add(days, 'day').format('YYYY-MM-DD');
                              setCalendarDateRange({ start, end });
                            }
                          }}
                        >确认</Button>
                      </div>
                      {calendarDateRange && <Button size="small" onClick={() => setCalendarDateRange(null)}>清除范围</Button>}
                    </div>
                  }
                >
                  <Button size="small" type={calendarDateRange ? 'primary' : 'default'}>
                    日期范围{calendarDateRange ? '·已选' : ''}
                  </Button>
                </Popover>
              )}
              {currentView !== 'notes' && currentView !== 'expired' && currentView !== 'trash' && (
                <Button type="primary" size="small" onClick={() => setShowAddModal(true)}>+ 新建</Button>
              )}
            </div>
          </div>
          {getViewSubtitle() && <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>{getViewSubtitle()}</Text>}
        </div>

        {/* 项目视图筛选条：搜索 + 全局标签多选 + 项目专属标签单选（卡片/表格共用） */}
        {currentView.startsWith('project-') && (
          <div style={{ padding: isMobile ? '8px 12px' : '10px 24px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
            <Input
              placeholder="搜索标题或内容"
              allowClear
              prefix={<SearchOutlined style={{ color: 'var(--fg-muted)' }} />}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{ width: isMobile ? '100%' : 220 }}
            />
            {projectFilterTags.length > 0 && (
              <Select
                mode="multiple"
                placeholder="全局标签"
                allowClear
                value={filterTagIds}
                onChange={setFilterTagIds}
                maxTagCount="responsive"
                style={{ minWidth: 140, flex: isMobile ? '1 1 100%' : '0 0 auto' }}
              >
                {projectFilterTags.map((t) => (
                  <Select.Option key={t.id} value={t.id}>
                    <Tag color={t.color} style={{ margin: 0 }}>{t.name}</Tag>
                  </Select.Option>
                ))}
              </Select>
            )}
            {projectLabelOptions.length > 0 && (
              <Select
                placeholder="项目标签"
                allowClear
                value={filterProjectLabelId || undefined}
                onChange={(v) => setFilterProjectLabelId(v || null)}
                style={{ minWidth: 120, flex: isMobile ? '1 1 100%' : '0 0 auto' }}
              >
                {projectLabelOptions.map((l) => (
                  <Select.Option key={l.id} value={l.id}>{l.name}</Select.Option>
                ))}
              </Select>
            )}
            <RangePicker
              size="small"
              value={filterDateRange ? [dayjs(filterDateRange.start), dayjs(filterDateRange.end)] : null}
              onChange={(dates) => {
                if (!dates || dates.length < 2) { setFilterDateRange(null); return; }
                setFilterDateRange({ start: dates[0].format('YYYY-MM-DD'), end: dates[1].format('YYYY-MM-DD') });
              }}
              presets={QUICK_RANGES.map((r) => ({ label: r.label, value: [dayjs().startOf('day'), dayjs().add(r.days, 'day').endOf('day')] }))}
              placeholder={['开始日期', '结束日期']}
              style={{ width: isMobile ? '100%' : 240 }}
            />
            {(searchKeyword || filterTagIds.length > 0 || filterProjectLabelId || filterDateRange) && (
              <Button size="small" onClick={() => { setSearchKeyword(''); setFilterTagIds([]); setFilterProjectLabelId(null); setFilterDateRange(null); }}>
                清除筛选
              </Button>
            )}
          </div>
        )}

        {/* 随笔快速输入 */}
        {currentView === 'notes' && (
          <div style={{ padding: isMobile ? '6px 12px' : '12px 24px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
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
            items={visibleItems}
            selectedDate={calendarSelectedDate}
            dateRange={calendarDateRange}
            onSetDateRange={setCalendarDateRange}
            onSelectDate={setCalendarSelectedDate}
            onAddItem={(item) => {
              if (isMobile) {
                navigate('/item/' + item.id, { replace: false });
              } else {
                setSelectedId(item.id);
              }
            }}
          />
        ) : currentView.startsWith('project-') && viewMode === 'table' ? (
          <ProjectTable
            items={filteredItems}
            selectedId={effectiveSelectedId}
            onSelectItem={(item) => {
              if (isMobile) {
                navigate('/item/' + item.id, { replace: false });
              } else {
                setSelectedId(item.id);
              }
            }}
            onToggleComplete={handleToggleComplete}
          />
        ) : (
          <CardList
            items={filteredItems} currentView={currentView} selectedId={effectiveSelectedId}
            projects={projects} batchMode={batchMode} batchSelectedIds={batchSelectedIds}
            onSelectItem={(item) => {
              if (isMobile) {
                navigate('/item/' + item.id, { replace: false });
              } else {
                setSelectedId(item.id);
              }
            }}
            onToggleComplete={handleToggleComplete}
            onBatchToggle={handleBatchToggle}
            onBatchSelectAll={(items) => setBatchSelectedIds(items.map((i) => i.id))}
            onExitBatch={() => { setBatchMode(false); setBatchSelectedIds([]); }}
            showCompleted={showCompleted}
            onCheckAuth={checkAuth}
          />
        )}
      </Content>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, textAlign: 'center', padding: '6px 0', background: 'var(--bg-card)', borderTop: '1px solid var(--border)', zIndex: 100 }}>
        <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>
苏ICP备2026027783号-1
        </a>
      </div>

      <DetailPanel key={effectiveSelectedItem?.id || 'empty'} item={effectiveSelectedItem} projects={visibleProjects} allTags={visibleTags}
        onClose={() => {
          if (isMobile) {
            setSelectedId(null);
            navigate(-1);
          } else {
            setSelectedId(null);
          }
        }} onSave={handleSave} onDelete={handleDelete} onRefresh={loadData}
        closeRef={detailPanelCloseRef} />

      {showAddModal && (
        <AddItemModal currentView={currentView} currentProjectId={currentProjectId}
          currentTagId={currentTagId} currentCalendarDate={currentView.startsWith('project-') ? (filterDateRange?.start || null) : calendarSelectedDate} projects={visibleProjects}
          onConfirm={handleCreateItem} onCancel={() => setShowAddModal(false)} />
      )}

      {showTrash && <TrashView onClose={() => { setShowTrash(false); setTrashHighlightId(null); }} onRefresh={loadData} highlightId={trashHighlightId} />}
    </Layout>
  );
}
