import React from 'react';
import { Package, AlertTriangle, TrendingDown, TrendingUp, BarChart3, Layers } from 'lucide-react';
import type { Item } from '../../../../types';

interface Props {
  item: Item;
  stockCalc: { currentStock: number; reserved: number; available: number; incoming: number; committed: number; inventoryValue: number } | null;
}

function stockColor(current: number, min: number): string {
  if (current <= 0) return 'text-red-600';
  if (current <= min) return 'text-amber-600';
  return 'text-emerald-600';
}

const KPI_BG: Record<string, string> = {
  good: 'bg-emerald-50 border-emerald-200',
  warn: 'bg-amber-50 border-amber-200',
  bad: 'bg-red-50 border-red-200',
  neutral: 'bg-slate-50 border-slate-200',
  info: 'bg-blue-50 border-blue-200',
};

export const InventoryTab: React.FC<Props> = ({ item, stockCalc }) => {
  if (!stockCalc) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <Package size={48} className="mb-4 opacity-50" />
        <p className="text-sm font-semibold">Stock tracking is not available</p>
        <p className="text-xs mt-1">This item type does not support inventory tracking.</p>
      </div>
    );
  }

  const minStock = item.minStockLevel || 0;
  const maxStock = (item as Item & { maxStockLevel?: number }).maxStockLevel || 0;
  const reorder = item.reorderPoint || 0;
  const safetyStock = Math.round(minStock * 0.2);

  const kpis = [
    { label: 'Current Stock', value: stockCalc.currentStock, unit: item.unit || 'pcs', bg: stockCalc.currentStock <= 0 ? 'bad' : stockCalc.currentStock <= minStock ? 'warn' : 'good', icon: <Package size={16} /> },
    { label: 'Reserved', value: stockCalc.reserved, unit: 'allocated', bg: 'neutral', icon: <TrendingDown size={16} /> },
    { label: 'Available', value: stockCalc.available, unit: 'ready to sell', bg: stockCalc.available > 0 ? 'good' : 'bad', icon: <TrendingUp size={16} /> },
    { label: 'Incoming', value: stockCalc.incoming, unit: 'on order', bg: 'info', icon: <Layers size={16} /> },
  ];

  const thresholds = [
    { label: 'Min Stock', value: minStock },
    { label: 'Max Stock', value: maxStock },
    { label: 'Reorder Point', value: reorder },
    { label: 'Safety Stock', value: safetyStock },
  ];

  const maxThreshold = Math.max(maxStock, stockCalc.currentStock, 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className={`rounded-xl border p-4 ${KPI_BG[k.bg]} shadow-sm`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{k.label}</span>
              <span className="text-slate-400">{k.icon}</span>
            </div>
            <p className={`text-2xl font-bold ${stockColor(k.value, minStock)}`}>{k.value}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{k.unit}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {thresholds.map(t => (
          <div key={t.label} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">{t.label}</span>
            <p className="text-lg font-bold text-slate-800">{t.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 size={16} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inventory Value</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{stockCalc.inventoryValue.toFixed(2)}</p>
          </div>
          {stockCalc.currentStock <= minStock && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle size={16} className="text-amber-600" />
              <span className="text-xs font-semibold text-amber-700">Low Stock Warning</span>
            </div>
          )}
        </div>
        {maxStock > 0 && (
          <div className="space-y-2">
            <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
              {thresholds.map((t, i) => {
                if (t.value <= 0) return null;
                const pct = Math.min(100, (t.value / maxThreshold) * 100);
                const colors = ['bg-red-400', 'bg-blue-400', 'bg-amber-400', 'bg-emerald-400'];
                return (
                  <div key={i} className={`absolute top-0 h-full w-0.5 ${colors[i]}`} style={{ left: `${pct}%`, opacity: 0.5 }} />
                );
              })}
              <div
                className={`h-full rounded-full transition-all ${
                  stockCalc.currentStock <= minStock ? 'bg-red-500' :
                  stockCalc.currentStock <= maxStock * 0.5 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, (stockCalc.currentStock / maxThreshold) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>0</span>
              {thresholds.filter(t => t.value > 0).map(t => (
                <span key={t.label}>{t.label}: {t.value}</span>
              ))}
              <span>{maxThreshold}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
