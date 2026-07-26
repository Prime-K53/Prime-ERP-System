import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Filter, Calendar, TrendingDown, TrendingUp } from 'lucide-react';
import type { InventoryTransaction } from '../../../../types';

interface Props {
  transactions: InventoryTransaction[];
}

type TxType = 'in' | 'out' | 'all';

export const TransactionsTab: React.FC<Props> = ({ transactions }) => {
  const [filter, setFilter] = useState<TxType>('all');
  const [dateRange, setDateRange] = useState<'all' | '30d' | '90d' | '1y'>('all');

  const filtered = useMemo(() => {
    let result = transactions;
    if (filter !== 'all') {
      result = result.filter(t => {
        const qty = t.quantityChange || t.quantity || 0;
        return filter === 'in' ? qty > 0 : qty < 0;
      });
    }
    if (dateRange !== 'all') {
      const now = Date.now();
      const cutoffs = { '30d': 30 * 86400000, '90d': 90 * 86400000, '1y': 365 * 86400000 };
      const cutoff = now - cutoffs[dateRange];
      result = result.filter(t => new Date(t.date || t.createdAt || '').getTime() >= cutoff);
    }
    return result;
  }, [transactions, filter, dateRange]);

  const inboundCount = filtered.filter(t => (t.quantityChange || t.quantity || 0) > 0).length;
  const outboundCount = filtered.length - inboundCount;

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <ArrowDown size={48} className="mb-4 opacity-50" />
        <p className="text-sm font-semibold">No Transactions</p>
        <p className="text-xs mt-1">No inventory movements recorded for this item.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          {(['all', 'in', 'out'] as TxType[]).map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${filter === t ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {t === 'all' ? 'All' : t === 'in' ? 'Inbound' : 'Outbound'}
            </button>
          ))}
        </div>
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          {(['all', '30d', '90d', '1y'] as const).map(d => (
            <button key={d} onClick={() => setDateRange(d)}
              className={`px-2 py-1.5 text-[10px] font-semibold rounded-md transition-all ${dateRange === d ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>
              {d === 'all' ? 'All' : d === '30d' ? '30d' : d === '90d' ? '90d' : '1y'}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 ml-auto">
          {filtered.length} of {transactions.length} transactions
        </span>
      </div>

      {filter !== 'all' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
            <TrendingDown size={20} className="text-emerald-500" />
            <div>
              <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Inbound</span>
              <p className="text-lg font-bold text-emerald-700">{inboundCount}</p>
            </div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-3">
            <TrendingUp size={20} className="text-red-500" />
            <div>
              <span className="text-[10px] font-semibold text-red-600 uppercase tracking-wider">Outbound</span>
              <p className="text-lg font-bold text-red-700">{outboundCount}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Date', 'Type', 'Reference', 'Warehouse', 'Qty In', 'Qty Out', 'Balance', 'Cost'].map(h => (
                  <th key={h} className={`px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider ${h === 'Qty In' || h === 'Qty Out' || h === 'Balance' || h === 'Cost' ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((t: any, i: number) => {
                const qty = t.quantityChange || t.quantity || 0;
                const isIn = qty > 0;
                const balance = t.balanceAfter || t.runningBalance || 0;
                return (
                  <tr key={t.id || i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-500">{new Date(t.date || t.createdAt || '').toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${isIn ? 'text-emerald-600' : 'text-red-600'}`}>
                        {isIn ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                        {t.type || (isIn ? 'Receipt' : 'Issue')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500">{t.reference || t.id?.slice(0, 8) || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{t.warehouseId || '—'}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-600 font-medium">{isIn ? Math.abs(qty) : '—'}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-red-600 font-medium">{!isIn ? Math.abs(qty) : '—'}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">{balance}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-500">{t.unitCost || t.cost || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
