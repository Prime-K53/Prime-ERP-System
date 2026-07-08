import React, { useState, useEffect, useMemo } from 'react';
import { X, Calculator, Package, Printer, Layers, Check } from 'lucide-react';
import type { Item, FinishingOption } from '../../../../types';
import { calculateMaterialCosts } from '../../../../utils/pricingEngineShared';

const DEFAULT_FINISHING_OPTIONS: FinishingOption[] = [
  { id: 'binding', name: 'Binding', enabled: false, price: 150, description: 'Book binding - comb or spiral', items: [] },
  { id: 'coverPages', name: 'Cover Pages', enabled: false, price: 20, description: 'Front and back cover pages per copy', items: [] },
  { id: 'cutting', name: 'Cutting & Trimming', enabled: false, price: 30, description: 'Trim edges to clean finish', items: [], batchSize: 10 },
  { id: 'holePunch', name: 'Hole Punching', enabled: false, price: 20, description: 'Punch holes for folder binding', items: [], batchSize: 10 },
  { id: 'folding', name: 'Folding', enabled: false, price: 15, description: 'Fold pages for insertion', items: [], batchSize: 10 },
  { id: 'stapling', name: 'Stapling', enabled: false, price: 10, description: 'Corner or saddle stapling', items: [] },
];

interface RecipeEditorModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (recipe: {
    pages: number;
    paperId: string;
    tonerId: string;
    finishingOptions: FinishingOption[];
    baseCost: number;
    paperCost: number;
    tonerCost: number;
    finishingCost: number;
  }) => void;
  inventory: Item[];
  initialPages?: number;
  initialPaperId?: string;
  initialTonerId?: string;
  initialFinishingOptions?: FinishingOption[];
}

export const RecipeEditorModal: React.FC<RecipeEditorModalProps> = ({
  open, onClose, onSave, inventory,
  initialPages, initialPaperId, initialTonerId, initialFinishingOptions,
}) => {
  const [pages, setPages] = useState(1);
  const [selectedPaperId, setSelectedPaperId] = useState('');
  const [selectedTonerId, setSelectedTonerId] = useState('');
  const [finishingOptions, setFinishingOptions] = useState<FinishingOption[]>(DEFAULT_FINISHING_OPTIONS);

  const paperItems = useMemo(() => inventory.filter(i => {
    const cat = (i.category || '').toLowerCase();
    return cat.includes('paper') || cat.includes('bond') || cat.includes('sheet');
  }), [inventory]);

  const tonerItems = useMemo(() => inventory.filter(i => {
    const cat = (i.category || '').toLowerCase();
    return cat.includes('toner') || cat.includes('ink') || cat.includes('cartridge');
  }), [inventory]);

  const selectedPaper = useMemo(() => inventory.find(i => i.id === selectedPaperId), [selectedPaperId]);
  const selectedToner = useMemo(() => inventory.find(i => i.id === selectedTonerId), [selectedTonerId]);

  useEffect(() => {
    if (!open) return;
    setPages(initialPages || 1);
    setSelectedPaperId(initialPaperId || (paperItems.length > 0 ? paperItems[0].id : ''));
    setSelectedTonerId(initialTonerId || (tonerItems.length > 0 ? tonerItems[0].id : ''));
    if (initialFinishingOptions && initialFinishingOptions.length > 0) {
      setFinishingOptions(DEFAULT_FINISHING_OPTIONS.map(def => {
        const existing = initialFinishingOptions.find(o => o.id === def.id);
        return existing || def;
      }));
    } else {
      setFinishingOptions(DEFAULT_FINISHING_OPTIONS);
    }
  }, [open]);

  const { paperCost, tonerCost, finishingCost, baseCost } = useMemo(() => {
    const costs = calculateMaterialCosts({
      paper: selectedPaper,
      toner: selectedToner,
      pages,
      copies: 1,
      finishingOptions,
      inventory,
    });
    return costs;
  }, [pages, selectedPaper, selectedToner, finishingOptions, inventory]);

  const toggleFinishing = (id: string) => {
    setFinishingOptions(prev => prev.map(o => o.id === id ? { ...o, enabled: !o.enabled } : o));
  };

  const handleSave = () => {
    onSave({ pages, paperId: selectedPaperId, tonerId: selectedTonerId, finishingOptions, baseCost, paperCost, tonerCost, finishingCost });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Calculator size={18} className="text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">Recipe Editor</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Number of Pages</label>
            <input type="number" min={1} max={10000} value={pages}
              onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1) setPages(v); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Paper Stock</label>
            <select value={selectedPaperId} onChange={e => setSelectedPaperId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 bg-white">
              <option value="">-- Select Paper --</option>
              {paperItems.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
            {paperItems.length === 0 && <p className="text-[10px] text-amber-600 mt-1">No paper items found in inventory.</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Toner / Ink</label>
            <select value={selectedTonerId} onChange={e => setSelectedTonerId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 bg-white">
              <option value="">-- Select Toner --</option>
              {tonerItems.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.sku})</option>
              ))}
            </select>
            {tonerItems.length === 0 && <p className="text-[10px] text-amber-600 mt-1">No toner items found in inventory.</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">Finishing Options</label>
            <div className="space-y-1.5">
              {finishingOptions.map(opt => (
                <label key={opt.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                  <input type="checkbox" checked={opt.enabled} onChange={() => toggleFinishing(opt.id)} className="rounded text-blue-600" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-700">{opt.name}</div>
                    {opt.description && <div className="text-[10px] text-slate-400">{opt.description}</div>}
                  </div>
                  <span className="text-xs font-mono text-slate-600">K{opt.price.toFixed(2)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-50 to-indigo-50 rounded-xl p-4 space-y-1.5 border border-indigo-100">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Paper Cost</span>
              <span className="font-mono font-semibold">K{paperCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Toner Cost</span>
              <span className="font-mono font-semibold">K{tonerCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Finishing Cost</span>
              <span className="font-mono font-semibold">K{finishingCost.toFixed(2)}</span>
            </div>
            <hr className="border-indigo-200 my-1" />
            <div className="flex justify-between text-sm font-bold text-indigo-800">
              <span>Base Cost</span>
              <span>K{baseCost.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-1.5">
            <Check size={14} /> Apply Recipe
          </button>
        </div>
      </div>
    </div>
  );
};
