import { useState } from 'react';
import '../styles/sidebar.css';

const NAV_ITEMS = [
  { view: 'notes', icon: '📝', label: '随笔' },
  { view: 'today', icon: '📅', label: '今天', badge: true },
  { view: 'week', icon: '📆', label: '本周', badge: true },
  { view: 'recurring', icon: '🔁', label: '重复任务' },
];

const BOTTOM_ITEMS = [
  { view: 'trash', icon: '🗑️', label: '回收站' },
  { view: 'expired', icon: '⚠️', label: '已过期', badge: true },
];

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
  const [projectInput, setProjectInput] = useState('');
  const [showProjectInput, setShowProjectInput] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [editingTagId, setEditingTagId] = useState(null);
  const [editingTagName, setEditingTagName] = useState('');

  function handleProjectSubmit() {
    const name = projectInput.trim();
    if (!name) return;
    onAddProject(name);
    setProjectInput('');
    setShowProjectInput(false);
  }

  function handleTagSubmit() {
    const name = tagInput.trim();
    if (!name) return;
    onAddTag(name);
    setTagInput('');
    setShowTagInput(false);
  }

  function startEditProject(p) {
    setEditingProjectId(p.id);
    setEditingProjectName(p.name);
  }

  function saveEditProject() {
    const name = editingProjectName.trim();
    if (name && editingProjectId) {
      onEditProject(editingProjectId, name);
    }
    setEditingProjectId(null);
    setEditingProjectName('');
  }

  function startEditTag(t) {
    setEditingTagId(t.id);
    setEditingTagName(t.name);
  }

  function saveEditTag() {
    const name = editingTagName.trim();
    if (name && editingTagId) {
      onEditTag(editingTagId, name);
    }
    setEditingTagId(null);
    setEditingTagName('');
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>CPTodo</h2>
        <button className="btn btn-ghost btn-sm" onClick={onLogout}>退出</button>
      </div>

      <nav className="nav-section">
        <div className="nav-group">
          {NAV_ITEMS.map((item) => (
            <div
              key={item.view}
              className={`nav-item ${currentView === item.view ? 'active' : ''}`}
              onClick={() => onViewChange(item.view)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.badge && badges[item.view] > 0 && (
                <span className="nav-badge">{badges[item.view]}</span>
              )}
            </div>
          ))}
        </div>

        {/* 项目 */}
        <div className="nav-group">
          <div className="nav-group-header">
            <span>项目</span>
            <button className="btn btn-ghost btn-xs" onClick={() => setShowProjectInput(true)}>+</button>
          </div>
          {showProjectInput && (
            <div className="nav-inline-input">
              <input value={projectInput}
                onChange={(e) => setProjectInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleProjectSubmit()}
                onBlur={() => { setShowProjectInput(false); setProjectInput(''); }}
                placeholder="项目名称..." autoFocus />
            </div>
          )}
          {(projects || []).map((p) => (
            <div key={p.id}
              className={`nav-item ${currentView === 'project-' + p.id ? 'active' : ''}`}
              onClick={() => editingProjectId !== p.id && onViewChange('project-' + p.id)}
            >
              {editingProjectId === p.id ? (
                <input className="nav-inline-edit" value={editingProjectName}
                  onChange={(e) => setEditingProjectName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveEditProject(); if (e.key === 'Escape') setEditingProjectId(null); }}
                  onBlur={saveEditProject} autoFocus
                  onClick={(e) => e.stopPropagation()} />
              ) : (
                <>
                  <span className="nav-label">{p.name}</span>
                  <span className="nav-count">{p.item_count || 0}</span>
                  <span className="nav-item-actions">
                    <button className="nav-action-btn" title="重命名"
                      onClick={(e) => { e.stopPropagation(); startEditProject(p); }}>✏</button>
                    <button className="nav-action-btn nav-action-delete" title="删除"
                      onClick={(e) => { e.stopPropagation(); onDeleteProject(p); }}>×</button>
                  </span>
                </>
              )}
            </div>
          ))}
        </div>

        {/* 标签 */}
        <div className="nav-group">
          <div className="nav-group-header">
            <span>标签</span>
            <button className="btn btn-ghost btn-xs" onClick={() => setShowTagInput(true)}>+</button>
          </div>
          {showTagInput && (
            <div className="nav-inline-input">
              <input value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTagSubmit()}
                onBlur={() => { setShowTagInput(false); setTagInput(''); }}
                placeholder="标签名称..." autoFocus />
            </div>
          )}
          {(tags || []).map((t) => (
            <div key={t.id}
              className={`nav-item ${currentView === 'tag-' + t.id ? 'active' : ''}`}
              onClick={() => editingTagId !== t.id && onViewChange('tag-' + t.id)}
            >
              {editingTagId === t.id ? (
                <input className="nav-inline-edit" value={editingTagName}
                  onChange={(e) => setEditingTagName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveEditTag(); if (e.key === 'Escape') setEditingTagId(null); }}
                  onBlur={saveEditTag} autoFocus
                  onClick={(e) => e.stopPropagation()} />
              ) : (
                <>
                  <span className="nav-color" style={{ background: t.color }}></span>
                  <span className="nav-label">{t.name}</span>
                  <span className="nav-count">{t.item_count || 0}</span>
                  <span className="nav-item-actions">
                    <button className="nav-action-btn" title="重命名"
                      onClick={(e) => { e.stopPropagation(); startEditTag(t); }}>✏</button>
                    <button className="nav-action-btn nav-action-delete" title="删除"
                      onClick={(e) => { e.stopPropagation(); onDeleteTag(t); }}>×</button>
                  </span>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="nav-group">
          {BOTTOM_ITEMS.map((item) => (
            <div key={item.view}
              className={`nav-item ${currentView === item.view ? 'active' : ''}`}
              onClick={() => onViewChange(item.view)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.badge && badges[item.view] > 0 && (
                <span className="nav-badge">{badges[item.view]}</span>
              )}
            </div>
          ))}
        </div>
      </nav>
    </aside>
  );
}
