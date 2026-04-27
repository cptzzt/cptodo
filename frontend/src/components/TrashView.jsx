import { useState, useEffect } from 'react';
import { Modal, Tabs, Checkbox, Button, Empty, Popconfirm, Typography } from 'antd';
import { FileTextOutlined, CheckSquareOutlined, FolderOutlined } from '@ant-design/icons';
import { api } from '../api';
import { toast } from './Toast';

const { Text } = Typography;

const TAB_ITEMS = [
  { key: 'task', label: '任务', icon: <CheckSquareOutlined /> },
  { key: 'note', label: '随笔', icon: <FileTextOutlined /> },
  { key: 'project', label: '项目', icon: <FolderOutlined /> },
];

function typeIcon(type) {
  if (type === 'note') return <FileTextOutlined style={{ color: '#52c41a' }} />;
  if (type === 'project') return <FolderOutlined style={{ color: '#8c8c8c' }} />;
  return <CheckSquareOutlined style={{ color: '#8c8c8c' }} />;
}

function typeLabel(type) {
  return type === 'note' ? '随笔' : type === 'task' ? '任务' : '项目';
}

export default function TrashView({ onClose, onRefresh }) {
  const [tab, setTab] = useState('task');
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  async function loadTrash() {
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

  useEffect(() => { loadTrash(); }, [tab]);

  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const hasSelected = selectedIds.length > 0;

  function toggleSelect(id) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  }

  async function handleRestore() {
    if (!hasSelected) return;
    try {
      if (tab === 'project') {
        for (const id of selectedIds) await api.restoreProject(id);
        toast.success(`已恢复 ${selectedIds.length} 项`);
      } else {
        const res = await api.batchRestoreItems(selectedIds);
        if (res.restoredProjects?.length > 0) {
          toast.success(`已恢复 ${selectedIds.length} 项，所属项目「${res.restoredProjects.join('、')}」将一并恢复`);
        } else {
          toast.success(`已恢复 ${selectedIds.length} 项`);
        }
      }
      onRefresh();
      await loadTrash();
    } catch (e) { toast.error(e.message); }
  }

  async function handlePermanentDelete() {
    if (!hasSelected) return;
    try {
      if (tab === 'project') {
        for (const id of selectedIds) await api.permanentDeleteProject(id);
      } else {
        await api.batchPermanentDeleteItems(selectedIds);
      }
      toast.success(`已彻底删除 ${selectedIds.length} 项`);
      onRefresh();
      await loadTrash();
    } catch (e) { toast.error(e.message); }
  }

  return (
    <Modal
      title="回收站"
      open={true}
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
      width={640}
    >
      <Tabs activeKey={tab} onChange={setTab} items={TAB_ITEMS.map(t => ({ ...t, children: null }))} />

      {items.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0', marginBottom: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <Checkbox checked={allSelected} onChange={() => setSelectedIds(allSelected ? [] : items.map((i) => i.id))} />
            <span>全选</span>
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="small" disabled={!hasSelected} onClick={handleRestore}>恢复选中</Button>
            <Popconfirm
              title={`确认彻底删除 ${selectedIds.length} 项？`}
              description="此操作不可恢复"
              onConfirm={handlePermanentDelete}
              icon={null}
              okText="彻底删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger disabled={!hasSelected}>彻底删除</Button>
            </Popconfirm>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <Empty description="回收站是空的" style={{ padding: 40 }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map((item) => (
            <div key={item.id}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', background: selectedIds.includes(item.id) ? '#e6f4ff' : 'transparent' }}
              onClick={() => toggleSelect(item.id)}
            >
              <Checkbox checked={selectedIds.includes(item.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggleSelect(item.id)} />
              <span style={{ fontSize: 16 }}>{typeIcon(item.type)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{item.title || item.name}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>{typeLabel(item.type)}</Text>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
