import React from 'react';
import { ShoppingCart, ClipboardList, DollarSign, Package } from 'lucide-react';
import type { Purchase } from '../../../../types';

interface Props {
  purchases: Purchase[];
  itemId: string;
}

export const PurchaseHistoryTab: React.FC<Props> = ({ purchases, itemId }) => {
  if (purchases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <ShoppingCart size={48} className="mb-4 opacity-50" />
        <p className="text-sm font-semibold">No Purchase History</p>
        <p className="text-xs mt-1">No purchase orders have been placed for this item.</p>
      </div>
    );
  }

  const totalQty = purchases.reduce((s, p) => {
    const line = p.items?.find(i => i.itemId === itemId);
    return s + (line?.quantity || 0);
  }, 0);
  const totalCost = purchases.reduce((s, p) => {
    const line = p.items?.find(i => i.itemId === itemId);
    return s + ((line?.cost || 0) * (line?.quantity || 0));
  }, 0);

  const kpis = [
    { label: 'Total Orders', value: purchases.length, icon: <ClipboardList size={16} />, color: 'text-slate-900' },
    { label: 'Total Quantity', value: totalQty, icon: <Package size={16} />, color: 'text-blue-600' },
    { label: 'Total Spent', value: totalCost.toFixed(2), icon: <DollarSign size={16} />, color: 'text-red-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{k.label}</span>
              <span className="text-slate-400">{k.icon}</span>
            </div>
            <p className={`text-xl font-bold ${k.color} font-mono`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {['PO #', 'Supplier', 'Date', 'Quantity', 'Unit Cost', 'Total', 'Status'].map(h => (
                <th key={h} className={`px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider ${h === 'Quantity' || h === 'Unit Cost' || h === 'Total' ? 'text-right' : 'text-left'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {purchases.map((p) => {
              const line = p.items?.find(i => i.itemId === itemId);
              if (!line) return null;
              return (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{p.id?.slice(0, 12)}</td>
                  <td className="px-4 py-3 text-slate-600">{p.supplierId || p.supplierName || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{p.date ? new Date(p.date).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">{line.quantity}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{line.cost?.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">{(line.cost * line.quantity).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                      p.status === 'Received' ? 'bg-emerald-50 text-emerald-700' :
                      p.status === 'Ordered' ? 'bg-blue-50 text-blue-700' :
                      'bg-amber-50 text-amber-700'
                    }`}>
                      <span className={`w-1 h-1 rounded-full ${
                        p.status === 'Received' ? 'bg-emerald-500' :
                        p.status === 'Ordered' ? 'bg-blue-500' :
                        'bg-amber-500'
                      }`} />
                      {p.status || 'Draft'}
                    </span>
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
