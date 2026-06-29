import React from 'react';
import { DollarSign, TrendingUp, TrendingDown, Percent, Shield, Settings } from 'lucide-react';
import type { Item } from '../../../../types';
import { validateMinimumMarkup, resolveMinimumMarkup } from '../../../../services/pricingValidationService';

interface Props {
  item: Item;
}

export const PricingTab: React.FC<Props> = ({ item }) => {
  const isRawMaterial = item.type === 'Raw Material' || item.type === 'Material' || item.classification === 'raw_material' || item.classification === 'material';
  const costPrice = item.costPrice || item.cost || 0;
  const sellingPrice = item.sellingPrice || item.price || 0;
  const profit = sellingPrice - costPrice;
  const markup = costPrice > 0 ? ((sellingPrice - costPrice) / costPrice) * 100 : 0;
  const validation = !isRawMaterial && sellingPrice > 0 ? validateMinimumMarkup(costPrice, sellingPrice, { category: item.category, id: item.id }) : null;
  const minMarkup = resolveMinimumMarkup(item);

  const kpis = [
    { label: 'Cost Price', value: costPrice.toFixed(2), icon: <DollarSign size={16} />, accent: false },
    ...(!isRawMaterial ? [{ label: 'Selling Price', value: sellingPrice.toFixed(2), icon: <TrendingUp size={16} />, accent: true }] : []),
    !isRawMaterial ? { label: 'Profit', value: profit.toFixed(2), color: profit >= 0 ? 'text-emerald-600' : 'text-red-600', icon: <TrendingDown size={16} /> } : null,
    !isRawMaterial ? { label: 'Markup', value: `${markup.toFixed(1)}%`, color: markup >= minMarkup ? 'text-emerald-600' : 'text-red-600', icon: <Percent size={16} /> } : null,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{k.label}</span>
              <span className={k.accent ? 'text-blue-400' : 'text-slate-400'}>{k.icon}</span>
            </div>
            <p className={`text-2xl font-bold font-mono ${k.color || (k.accent ? 'text-blue-600' : 'text-slate-900')}`}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {validation && (
        <div className={`rounded-xl border p-5 shadow-sm ${
          validation.valid ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center gap-3 mb-3">
            <Shield size={20} className={validation.valid ? 'text-emerald-600' : 'text-red-600'} />
            <div>
              <span className={`text-sm font-semibold ${validation.valid ? 'text-emerald-700' : 'text-red-700'}`}>
                {validation.valid ? 'Minimum Markup Passed' : 'Below Minimum Markup'}
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                Required: {validation.minimumMarkup}% &middot; Actual: {validation.profitMarkup.toFixed(1)}% &middot; Profit: {validation.profit.toFixed(2)}
              </p>
            </div>
          </div>
          {!validation.valid && validation.message && (
            <p className="text-xs text-red-600 ml-9">{validation.message}</p>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2.5">
          <Settings size={14} className="text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pricing Configuration</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-sm">
            <div>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">Min Markup</span>
              <p className="font-semibold text-slate-800">{minMarkup}%</p>
            </div>
            <div>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">Currency</span>
              <p className="font-semibold text-slate-800">{(item as Item & { currency?: string }).currency || 'KWD'}</p>
            </div>
            <div>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">Markup %</span>
              <p className="font-semibold text-slate-800">{(item as Item & { marginPercent?: number }).marginPercent || 0}%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
