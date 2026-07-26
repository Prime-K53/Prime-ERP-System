import React, { useState } from 'react';
import { Layers, Package, DollarSign, Check, X, TrendingUp } from 'lucide-react';
import type { Item, ProductVariant } from '../../../../types';
import { resolveMinimumMarkup } from '../../../../services/pricingValidationService';

interface Props {
  item: Item;
}

const isProduct = (item: Item) => item.type === 'Product' || item.classification === 'product' || item.classification === 'finished_good';
const isStationery = (item: Item) => item.type === 'Stationery' || item.classification === 'stationery';
const showPages = (item: Item) => isProduct(item) || item.type === 'Service' || item.classification === 'printing_service';

export const VariantsTab: React.FC<Props> = ({ item }) => {
  const itemExt = item as Item & { variants?: ProductVariant[]; smartPricing?: { pages?: number }; pages?: number };
  const variants: ProductVariant[] = itemExt.variants || [];
  const hasVariants = variants.length > 0;
  const [editablePages, setEditablePages] = useState<Record<string, number>>({});

  const baseCost = item.costPrice || item.cost || 0;
  const basePages = itemExt.smartPricing?.pages || itemExt.pages || 1;

  if (!hasVariants) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <Layers size={48} className="mb-4 opacity-50" />
        <p className="text-sm font-semibold">No Variants</p>
        <p className="text-xs mt-1">This item has no variants configured.</p>
      </div>
    );
  }

  const totalStock = variants.reduce((s, v) => s + (v.stock || 0), 0);
  const avgPrice = variants.reduce((s, v) => s + (v.sellingPrice || v.price || 0), 0) / variants.length;
  const activeCount = variants.filter(v => v.active !== false).length;

  const kpis = [
    { label: 'Total Variants', value: variants.length, icon: <Layers size={16} />, color: 'text-slate-900' },
    { label: 'Combined Stock', value: totalStock, icon: <Package size={16} />, color: 'text-blue-600' },
    { label: 'Avg Price', value: avgPrice.toFixed(2), icon: <DollarSign size={16} />, color: 'text-emerald-600', mono: true },
    { label: 'Active', value: `${activeCount}/${variants.length}`, icon: <TrendingUp size={16} />, color: 'text-emerald-600' },
  ];

  const columns = showPages(item)
    ? ['Name & Attr', 'Pages', 'Cost Price', 'Selling Price', 'Markup', 'Active']
    : ['Name & Attr', 'Cost Price', 'Selling Price', 'Markup', 'Active'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{k.label}</span>
              <span className="text-slate-400">{k.icon}</span>
            </div>
            <p className={`text-2xl font-bold ${k.color} ${k.mono ? 'font-mono' : ''}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {columns.map(h => (
                <th key={h} className={`px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider ${['Cost Price', 'Selling Price', 'Markup', 'Pages'].includes(h) ? 'text-right' : h === 'Active' ? 'text-center' : 'text-left'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {variants.map((v) => {
              const cp = v.costPrice || v.cost || 0;
              const sp = v.sellingPrice || v.price || 0;
              const margin = cp > 0 ? ((sp - cp) / cp) * 100 : 0;
              const marginOk = margin >= (v.minimumMargin || resolveMinimumMarkup(item));
              const currentPages = editablePages[v.id] ?? v.pages ?? 1;
              const costPerPage = baseCost && basePages > 0 ? baseCost / basePages : 0;
              const autoCp = showPages(item) && costPerPage > 0 ? Number((costPerPage * currentPages).toFixed(2)) : cp;

              return (
                <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-800">{v.name}</td>
                  {showPages(item) && (
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min={1}
                        value={currentPages}
                        onChange={e => {
                          const p = Number(e.target.value);
                          if (p >= 1) setEditablePages(prev => ({ ...prev, [v.id]: p }));
                        }}
                        className="w-20 text-right text-sm border border-slate-200 rounded px-1.5 py-0.5 outline-none focus:border-blue-500"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600">{autoCp.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-blue-600 font-semibold">{sp.toFixed(2)}</td>
                  <td className={`px-4 py-3 text-right font-mono tabular-nums font-semibold ${marginOk ? 'text-emerald-600' : 'text-red-600'}`}>
                    {margin.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-center">
                    {v.active !== false
                      ? <Check size={16} className="text-emerald-500 mx-auto" />
                      : <X size={16} className="text-slate-300 mx-auto" />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
