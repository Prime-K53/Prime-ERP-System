import React, { useState, useMemo } from 'react';
import { Warehouse, Plus, Edit3, Trash2, MapPin, Building2, X, Loader2, Check } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { useAuth } from '../../context/AuthContext';
import { useConfirmDialog, ConfirmDialog, ConfirmDialogType } from '../../components/ConfirmDialog';
import type { Warehouse as WarehouseType } from '../../types';

const WAREHOUSE_TYPES = ['Physical', 'Store', 'Virtual'] as const;

interface WarehouseForm {
  name: string;
  type: string;
  location: string;
  code: string;
}

const EMPTY_FORM: WarehouseForm = { name: '', type: 'Physical', location: '', code: '' };

export const WarehousePage: React.FC = () => {
  const { warehouses, addWarehouse, deleteWarehouse } = useInventory();
  const { notify } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WarehouseForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [confirmState, setConfirmState] = useState<{ open: boolean; title: string; message: string; confirmText?: string; type?: ConfirmDialogType; onConfirm?: () => void }>({ open: false, title: '', message: '' });

  const filtered = useMemo(() => {
    if (!search.trim()) return warehouses;
    const q = search.toLowerCase();
    return warehouses.filter((w: WarehouseType) =>
      (w.name || '').toLowerCase().includes(q) ||
      (w.location || '').toLowerCase().includes(q) ||
      (w.code || '').toLowerCase().includes(q)
    );
  }, [warehouses, search]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (wh: WarehouseType) => {
    setEditingId(wh.id);
    setForm({ name: wh.name || '', type: wh.type || 'Physical', location: wh.location || '', code: wh.code || '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { notify('Warehouse name is required', 'error'); return; }
    setSubmitting(true);
    try {
      const warehouse: WarehouseType = {
        id: editingId || `WH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
        name: form.name.trim(),
        type: form.type,
        location: form.location.trim(),
        code: form.code.trim() || undefined,
      };
      await addWarehouse(warehouse);
      notify(editingId ? 'Warehouse updated' : 'Warehouse created', 'success');
      setModalOpen(false);
    } catch (err: any) {
      notify(err?.message || 'Failed to save warehouse', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (wh: WarehouseType) => {
    setConfirmState({
      open: true,
      title: 'Delete Warehouse',
      message: `Delete warehouse "${wh.name}"? This cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await deleteWarehouse(wh.id);
          notify('Warehouse deleted', 'success');
        } catch (err: any) {
          notify(err?.message || 'Failed to delete warehouse', 'error');
        }
      }
    });
  };

  return (
    <div className="h-full flex flex-col p-6 bg-[#F6F7F2]" style={{ color: '#16201B' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-[40px] h-[40px] rounded-[10px] flex items-center justify-center bg-[#DCF0EA]" style={{ color: '#128C72' }}>
            <Warehouse size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: '#16201B' }}>Warehouses</h1>
            <p className="text-xs font-medium" style={{ color: '#6C766F' }}>{warehouses.length} location{warehouses.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button onClick={openCreate}
          className="px-4 py-2 rounded-[8px] text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer border-0"
          style={{ background: '#128C72', color: 'white' }}>
          <Plus size={16} /> Add Warehouse
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text" placeholder="Search warehouses..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 rounded-[8px] border text-sm outline-none transition-all"
          style={{ borderColor: '#E5E8E1', background: 'white', color: '#16201B' }}
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto rounded-[12px] border border-[#E5E8E1] bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6C766F', background: '#F6F7F2' }}>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Location</th>
              <th className="text-left px-4 py-3">Code</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-xs font-medium" style={{ color: '#9CA59E' }}>
                  {warehouses.length === 0 ? 'No warehouses found. Create one to get started.' : 'No matches'}
                </td>
              </tr>
            ) : filtered.map((wh: WarehouseType) => (
              <tr key={wh.id} className="border-t border-[#E5E8E1] hover:bg-[#FAFBFA] transition-colors">
                <td className="px-4 py-3 font-semibold" style={{ color: '#16201B' }}>{wh.name}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-semibold"
                    style={{
                      background: wh.type === 'Virtual' ? '#F0F0F5' : wh.type === 'Store' ? '#FFF3E0' : '#DCF0EA',
                      color: wh.type === 'Virtual' ? '#6B6B9C' : wh.type === 'Store' ? '#B76E00' : '#0E5C4C'
                    }}>
                    <Building2 size={12} />
                    {wh.type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: '#3B453F' }}>
                    <MapPin size={13} style={{ color: '#9CA59E' }} />
                    {wh.location || '-'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-medium" style={{ color: '#9CA59E' }}>{wh.code || '-'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(wh)}
                      className="p-1.5 rounded-[6px] transition-all cursor-pointer border-0"
                      style={{ color: '#6C766F' }} title="Edit">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => handleDelete(wh)}
                      className="p-1.5 rounded-[6px] transition-all cursor-pointer border-0"
                      style={{ color: '#C94A4A' }} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(22,32,27,.5)' }}>
          <div className="bg-white rounded-[16px] w-full max-w-md overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(15,30,25,.04), 0 6px 18px rgba(15,30,25,.05)' }}>
            <div className="px-5 py-4 border-b border-[#E5E8E1] flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center bg-[#DCF0EA]" style={{ color: '#128C72' }}>
                  {editingId ? <Edit3 size={18} /> : <Plus size={18} />}
                </div>
                <div>
                  <h2 className="font-bold" style={{ color: '#16201B' }}>{editingId ? 'Edit Warehouse' : 'Add Warehouse'}</h2>
                  <p className="text-xs font-medium" style={{ color: '#6C766F' }}>{editingId ? 'Update warehouse details' : 'Create a new storage location'}</p>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)} style={{ color: '#9CA59E' }}><X size={20} /></button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#6C766F' }}>Name *</label>
                <input
                  type="text" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Main Warehouse"
                  className="w-full px-3 py-2.5 rounded-[7px] border text-sm outline-none transition-all"
                  style={{ borderColor: '#E5E8E1', color: '#16201B' }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#6C766F' }}>Type</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-[7px] border text-sm outline-none transition-all"
                  style={{ borderColor: '#E5E8E1', color: '#16201B' }}
                >
                  {WAREHOUSE_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#6C766F' }}>Location</label>
                <input
                  type="text" value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="e.g. Lilongwe"
                  className="w-full px-3 py-2.5 rounded-[7px] border text-sm outline-none transition-all"
                  style={{ borderColor: '#E5E8E1', color: '#16201B' }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#6C766F' }}>Code</label>
                <input
                  type="text" value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. WH-001"
                  className="w-full px-3 py-2.5 rounded-[7px] border text-sm outline-none transition-all"
                  style={{ borderColor: '#E5E8E1', color: '#16201B' }}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-[#E5E8E1] rounded-[7px] text-sm font-medium transition-all cursor-pointer bg-white"
                  style={{ color: '#3B453F' }}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={submitting || !form.name.trim()}
                  className="flex-1 px-4 py-2.5 rounded-[7px] text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 border-0"
                  style={{ background: '#128C72', color: 'white', opacity: submitting || !form.name.trim() ? 0.6 : 1 }}>
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => !open && setConfirmState(c => ({ ...c, open: false }))}
        onConfirm={() => {
          confirmState.onConfirm?.();
          setConfirmState(c => ({ ...c, open: false }));
        }}
        onCancel={() => setConfirmState(c => ({ ...c, open: false }))}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        type={confirmState.type || 'danger'}
      />
    </div>
  );
};

export default WarehousePage;
