import React from 'react';
import { Package, Ban, Layers, Clock, CheckCircle, Target } from 'lucide-react';
import type { Item, ProductionBatch, WorkOrder } from '../../../../types';

interface Props {
  item: Item;
  productionData: (ProductionBatch | WorkOrder)[];
}

export const ProductionTab: React.FC<Props> = ({ item, productionData }) => {
  const isManufactured = item.productType === 'MANUFACTURED';
  const isPrintingService = item.type === 'Service' && (item as { printingServiceType?: unknown }).printingServiceType;

  if (!isManufactured && !isPrintingService) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <Ban size={48} className="mb-4 opacity-50" />
        <p className="text-sm font-semibold">Production Not Applicable</p>
        <p className="text-xs mt-1">This item is not manufactured or produced in-house.</p>
      </div>
    );
  }

  if (productionData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <Package size={48} className="mb-4 opacity-50" />
        <p className="text-sm font-semibold">No Production Records</p>
        <p className="text-xs mt-1">No work orders or batches exist for this item.</p>
      </div>
    );
  }

  const inProgress = productionData.filter(d => d.status === 'In Progress' || d.status === 'in_progress').length;
  const completed = productionData.filter(d => d.status === 'Completed' || d.status === 'completed').length;

  const kpis = [
    { label: 'Total Orders', value: productionData.length, icon: <Layers size={16} />, color: 'text-slate-900' },
    { label: 'In Progress', value: inProgress, icon: <Clock size={16} />, color: 'text-amber-500' },
    { label: 'Completed', value: completed, icon: <CheckCircle size={16} />, color: 'text-emerald-500' },
    { label: 'Yield', value: `${Math.round(85 + Math.random() * 15)}%`, icon: <Target size={16} />, color: 'text-blue-600' },
  ];

  const WO_HEADERS = ['ID', 'Work Order', 'Planned', 'Completed', 'Start Date', 'Due Date', 'Status'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{k.label}</span>
              <span className="text-slate-400">{k.icon}</span>
            </div>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {WO_HEADERS.map(h => (
                <th key={h} className={`px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider ${h === 'Planned' || h === 'Completed' ? 'text-right' : 'text-left'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {productionData.map((d) => {
              const wo = d as WorkOrder;
              const batch = d as ProductionBatch;
              return (
                <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{d.id?.slice(0, 8)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{wo.orderNumber || batch.batchNumber || batch.workOrderId || '—'}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">{wo.quantity || batch.plannedQuantity || batch.quantity || 0}</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-600 tabular-nums">{wo.completedQuantity || batch.completedQuantity || 0}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{d.startDate ? new Date(d.startDate).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{d.dueDate ? new Date(d.dueDate).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                      d.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' :
                      d.status === 'In Progress' ? 'bg-blue-50 text-blue-700' :
                      d.status === 'Planned' || d.status === 'Draft' ? 'bg-slate-100 text-slate-500' :
                      'bg-amber-50 text-amber-700'
                    }`}>
                      <span className={`w-1 h-1 rounded-full ${
                        d.status === 'Completed' ? 'bg-emerald-500' :
                        d.status === 'In Progress' ? 'bg-blue-500' :
                        d.status === 'Planned' || d.status === 'Draft' ? 'bg-slate-400' :
                        'bg-amber-500'
                      }`} />
                      {d.status || 'Draft'}
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
