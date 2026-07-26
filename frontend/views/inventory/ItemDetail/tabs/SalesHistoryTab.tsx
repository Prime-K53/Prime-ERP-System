import React from 'react';
import { TrendingUp, DollarSign, Package, Receipt } from 'lucide-react';
import type { Sale } from '../../../../types';

interface Props {
  sales: Sale[];
  itemId: string;
}

export const SalesHistoryTab: React.FC<Props> = ({ sales, itemId }) => {
  if (sales.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <TrendingUp size={48} className="mb-4 opacity-50" />
        <p className="text-sm font-semibold">No Sales History</p>
        <p className="text-xs mt-1">This item has not been sold yet.</p>
      </div>
    );
  }

  const totalQty = sales.reduce((s, sale) => {
    const line = sale.items?.find((i: any) => i.id === itemId || i.itemId === itemId);
    return s + (line?.quantity || 0);
  }, 0);
  const totalRevenue = sales.reduce((s, sale) => {
    const line = sale.items?.find((i: any) => i.id === itemId || i.itemId === itemId);
    const qty = line?.quantity || 0;
    const price = line?.price || line?.unitPrice || 0;
    return s + (qty * price);
  }, 0);
  const totalProfit = sales.reduce((s, sale) => {
    const line = sale.items?.find((i: any) => i.id === itemId || i.itemId === itemId);
    if (!line) return s;
    const qty = line.quantity || 0;
    const price = line.price || line.unitPrice || 0;
    const cost = line.costPrice || line.cost || 0;
    return s + ((price - cost) * qty);
  }, 0);

  const kpis = [
    { label: 'Total Orders', value: sales.length, icon: <Receipt size={16} />, color: 'text-slate-900' },
    { label: 'Total Quantity', value: totalQty, icon: <Package size={16} />, color: 'text-blue-600' },
    { label: 'Total Revenue', value: totalRevenue.toFixed(2), icon: <DollarSign size={16} />, color: 'text-emerald-600' },
    { label: 'Total Profit', value: totalProfit.toFixed(2), icon: <TrendingUp size={16} />, color: totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
              {['Invoice', 'Customer', 'Date', 'Quantity', 'Unit Price', 'Total', 'Profit', 'Status'].map(h => (
                <th key={h} className={`px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider ${h === 'Quantity' || h === 'Unit Price' || h === 'Total' || h === 'Profit' ? 'text-right' : h === 'Status' ? 'text-center' : 'text-left'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sales.map((s) => {
              const line = s.items?.find((i: any) => i.id === itemId || i.itemId === itemId);
              if (!line) return null;
              const qty = line.quantity || 0;
              const price = line.price || line.unitPrice || 0;
              const total = qty * price;
              const cost = line.costPrice || line.cost || 0;
              const profit = total - (qty * cost);
              return (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{s.id?.slice(0, 12)}</td>
                  <td className="px-4 py-3 text-slate-600">{s.customerName || s.customerId || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{s.date ? new Date(s.date).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">{qty}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600">{price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">{total.toFixed(2)}</td>
                  <td className={`px-4 py-3 text-right font-mono font-bold tabular-nums ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {profit.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                      s.status === 'Completed' || s.status === 'Paid' ? 'bg-emerald-50 text-emerald-700' :
                      s.status === 'Pending' ? 'bg-amber-50 text-amber-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      <span className={`w-1 h-1 rounded-full ${
                        s.status === 'Completed' || s.status === 'Paid' ? 'bg-emerald-500' :
                        s.status === 'Pending' ? 'bg-amber-500' :
                        'bg-slate-400'
                      }`} />
                      {s.status || 'Completed'}
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
