import React from 'react';
import { Scale, ArrowRight, ShoppingCart, TrendingUp, Beaker } from 'lucide-react';
import type { Item } from '../../../../types';

interface Props {
  item: Item;
}

export const UnitsTab: React.FC<Props> = ({ item }) => {
  const baseUnit = item.unit || 'pcs';
  const ext = item as Item & { purchaseUnit?: string; salesUnit?: string; consumptionUnit?: string; conversions?: { fromUnit: string; toUnit: string; factor: number }[]; unitConversions?: { fromUnit: string; toUnit: string; factor: number }[]; conversionRate?: number };
  const purchaseUnit = ext.purchaseUnit || item.purchaseUnit || '';
  const salesUnit = ext.salesUnit || '';
  const consumptionUnit = ext.consumptionUnit || item.consumptionUnit || '';
  const conversions: { fromUnit: string; toUnit: string; factor: number }[] = ext.conversions || ext.unitConversions || [];
  const conversionRate = item.conversionFactor || ext.conversionRate || 1;

  const cards = [
    { label: 'Base Unit', value: baseUnit, icon: <Scale size={16} />, color: 'text-slate-900' },
    { label: 'Purchase Unit', value: purchaseUnit || '—', icon: <ShoppingCart size={16} />, color: 'text-blue-600' },
    { label: 'Sales Unit', value: salesUnit || '—', icon: <TrendingUp size={16} />, color: 'text-emerald-600' },
    { label: 'Consumption Unit', value: consumptionUnit || '—', icon: <Beaker size={16} />, color: 'text-amber-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{c.label}</span>
              <span className={c.color}>{c.icon}</span>
            </div>
            <p className={`text-xl font-bold ${c.color} ${c.value !== '—' ? '' : 'text-slate-300'}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {purchaseUnit && !conversions.length && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-white shadow-sm text-slate-500"><Scale size={16} /></span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Conversion</span>
          </div>
          <div className="p-5 flex items-center gap-4">
            <div className="px-4 py-2.5 bg-slate-100 rounded-xl">
              <span className="font-bold text-slate-800">1 {purchaseUnit}</span>
            </div>
            <ArrowRight size={20} className="text-slate-300 flex-shrink-0" />
            <div className="px-4 py-2.5 bg-blue-50 rounded-xl border border-blue-200">
              <span className="font-bold text-blue-600">{conversionRate} {baseUnit}</span>
            </div>
          </div>
        </div>
      )}

      {conversions.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-white shadow-sm text-slate-500"><Scale size={16} /></span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Conversion Tree ({conversions.length})</span>
          </div>
          <div className="p-5 space-y-3">
            {conversions.map((c, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="px-3 py-1.5 bg-white rounded-lg shadow-sm">
                  <span className="font-bold text-slate-800">1 {c.fromUnit}</span>
                </div>
                <ArrowRight size={16} className="text-slate-300 flex-shrink-0" />
                <div className="px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="font-bold text-blue-600">{c.factor} {c.toUnit}</span>
                </div>
                <div className="flex gap-1 ml-auto">
                  {c.fromUnit === purchaseUnit && <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold">Purchasing</span>}
                  {c.toUnit === consumptionUnit && <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-semibold">Consumption</span>}
                  {(c.fromUnit === salesUnit || c.toUnit === salesUnit) && <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-semibold">Sales</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!purchaseUnit && !conversions.length && (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <Scale size={48} className="mb-4 opacity-50" />
          <p className="text-sm font-semibold">No Unit Conversions</p>
          <p className="text-xs mt-1">Configure purchase or sales units to enable conversions.</p>
        </div>
      )}
    </div>
  );
};
