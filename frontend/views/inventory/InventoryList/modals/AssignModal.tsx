import React, { useState } from 'react';
import { X, Warehouse, Users, Loader2, Check } from 'lucide-react';
import type { Item } from '../../../../types';
import { useInventory } from '../../../../context/InventoryContext';

interface Props {
  open: boolean;
  items: Item[];
  mode: 'warehouse' | 'supplier';
  onClose: () => void;
  onAssign: (ids: string[], value: string) => Promise<void>;
}

export const AssignModal: React.FC<Props> = ({ open, items, mode, onClose, onAssign }) => {
  const { warehouses } = useInventory();
  const [selected, setSelected] = useState('');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => { if (open) { setSelected(''); setSubmitting(false); } }, [open]);
  if (!open || items.length === 0) return null;

  const isWarehouse = mode === 'warehouse';

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try { await onAssign(items.map(i => i.id), selected); onClose(); } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(22,32,27,.5)' }}>
      <div className="bg-white rounded-[16px] w-full max-w-md overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(15,30,25,.04), 0 6px 18px rgba(15,30,25,.05)' }}>
        <div className="px-5 py-4 border-b border-[#E5E8E1] flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center" style={{ background: isWarehouse ? '#DCF0EA' : '#E6EEF6', color: isWarehouse ? '#128C72' : '#33639B' }}>
              {isWarehouse ? <Warehouse size={20} /> : <Users size={20} />}
            </div>
            <div>
              <h2 className="font-bold" style={{ color: '#16201B' }}>Assign {isWarehouse ? 'Warehouse' : 'Supplier'}</h2>
              <p className="text-xs font-medium" style={{ color: '#6C766F' }}>{items.length} item{items.length !== 1 ? 's' : ''} selected</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: '#9CA59E' }}><X size={20} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#6C766F' }}>{isWarehouse ? 'Select Warehouse' : 'Select Supplier'}</label>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {(isWarehouse ? warehouses : []).length === 0 && (
                <div className="flex items-center justify-center py-8 text-xs" style={{ color: '#9CA59E' }}>
                  No {isWarehouse ? 'warehouses' : 'suppliers'} available
                </div>
              )}
              {isWarehouse ? warehouses.map(wh => (
                <button key={wh.id} onClick={() => setSelected(wh.id)}
                  className="w-full text-left px-4 py-2.5 rounded-[7px] border text-sm font-medium flex items-center gap-3 transition-all cursor-pointer"
                  style={selected === wh.id ? { borderColor: '#128C72', background: '#F2FAF7', color: '#0E5C4C' } : { borderColor: '#E5E8E1', color: '#3B453F' }}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selected === wh.id ? 'bg-[#128C72] border-[#128C72]' : 'border-[#9CA59E]'}`}>
                    {selected === wh.id && <Check size={10} className="text-white" />}
                  </div>
                  <div>
                    <span className="font-semibold">{wh.name}</span>
                    {wh.code && <span className="text-xs ml-2" style={{ color: '#9CA59E' }}>({wh.code})</span>}
                  </div>
                </button>
              )) : (
                <div className="p-4 text-center text-xs rounded-[10px] border border-[#E5E8E1]" style={{ background: '#F6F7F2', color: '#9CA59E' }}>
                  <Users size={24} className="mx-auto mb-2" style={{ color: '#9CA59E' }} />
                  <p>Supplier data not loaded. Enter IDs manually in Bulk Edit.</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-[#E5E8E1] rounded-[7px] text-sm font-medium transition-all cursor-pointer bg-white" style={{ color: '#3B453F' }}>
              Cancel
            </button>
            <button type="button" onClick={handleSubmit} disabled={submitting || !selected}
              className="flex-1 px-4 py-2.5 rounded-[7px] text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 bg-[#128C72] text-white hover:bg-[#0E5C4C]">
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Assign
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
