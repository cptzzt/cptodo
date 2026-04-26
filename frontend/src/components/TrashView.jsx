import { useState, useEffect } from 'react';
import { api } from '../api';
import { toast } from './Toast';
import '../styles/trash.css';

const TABS = [
  { type: 'task', label: '任务', icon: '☑' },
  { type: 'note', label: '随笔', icon: '📝' },
  { type: 'project', label: '项目', icon: '📁' },
];

export default function TrashView({ onClose, onRefresh }) {
  const [tab, setTab] = useState('task');
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        let data;
        if (tab === 'project') {
          const res = await api.getTrashProjects();
          data = (res.data || []).map((p) => ({ ...p, type: 'project' }));
        } else {
          const res = await api.getTrashItems({ type: tab });
          data = res.data || [];
        }
        setItems(data);
        setSelectedIds([]);
      } catch (e) { toast.error('加载回收站失败'); }
    }
    load();
  }, [tab]);

  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const hasSelected = selectedIds.length > 0;

  function toggleSelect(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  async function handleRestore() {
    if (!hasSelected) return;
    try {
      if (tab === 'project') {
        for (const id of selectedIds) await api.restoreProject(id);
      } else {
        const res = await api.batchRestoreItems(selectedIds);
        if (res.restoredProjects?.length > 0) {
          toast.success(`已恢复 ${selectedIds.length} 项，所属项目「${res.restoredProjects.join('、')}」将一并恢复`);
        } else {
          toast.success(`已恢复 ${selectedIds.length} 项`);
        }
      }
      setSelectedIds([]);
      onRefresh();
      // reload trash
      let data;
      if (tab === 'project') {
        const res = await api.getTrashProjects();
        data = (res.data || []).map((p) => ({ ...p, type: 'project' }));
      } else {
        const res = await api.getTrashItems({ type: tab });
        data = res.data || [];
      }
      setItems(data);
      setSelectedIds([]);
    } catch (e) { toast.error(e.message); }
  }

  async function handlePermanentDelete() {
    if (!hasSelected) return;
    const confirmed = window.confirm(`确认彻底删除选中的 ${selectedIds.length} 项？此操作不可恢复。`);
    if (!confirmed) return;
    try {
      if (tab === 'project') {
        for (const id of selectedIds) await api.permanentDeleteProject(id);
      } else {
        await api.batchPermanentDeleteItems(selectedIds);
      }
      toast.success(`已彻底删除 ${selectedIds.length} 项`);
      setSelectedIds([]);
      onRefresh();
      let data;
      if (tab === 'project') {
        const res = await api.getTrashProjects();
        data = (res.data || []).map((p) => ({ ...p, type: 'project' }));
      } else {
        const res = await api.getTrashItems({ type: tab });
        data = res.data || [];
      }
      setItems(data);
      setSelectedIds([]);
    } catch (e) { toast.error(e.message); }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-lg">
        <h3 className="modal-title">回收站</h3>

        <div className="trash-tabs">
          {TABS.map((t) => (
            <button key={t.type} className={`trash-tab ${tab === t.type ? 'active' : ''}`}
              onClick={() => setTab(t.type)}>
              {t.label}
            </button>
          ))}
        </div>

        {items.length > 0 && (
          <div className="trash-toolbar">
            <label className="checkbox-row">
              <input type="checkbox" checked={allSelected}
                onChange={() => setSelectedIds(allSelected ? [] : items.map((i) => i.id))} />
              <span>全选</span>
            </label>
            <div className="trash-actions">
              <button className="btn btn-secondary btn-sm" disabled={!hasSelected} onClick={handleRestore}>恢复选中</button>
              <button className="btn btn-danger btn-sm" disabled={!hasSelected} onClick={handlePermanentDelete}>彻底删除</button>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="empty-state"><p>回收站是空的</p></div>
        ) : (
          <div className="trash-list">
            {items.map((item) => (
              <div key={item.id} className={`trash-item trash-item-type-${item.type}`}>
                <div className="trash-item-check">
                  <input type="checkbox" checked={selectedIds.includes(item.id)}
                    onChange={() => toggleSelect(item.id)} />
                </div>
                <span className="trash-item-icon">
                  {item.type === 'note' ? '📝' : item.type === 'task' ? '☑' : '📁'}
                </span>
                <div className="trash-item-info">
                  <div className="trash-item-title">{item.title || item.name}</div>
                  <div className="trash-item-meta">
                    {item.type === 'note' ? '随笔' : item.type === 'task' ? '任务' : '项目'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}
