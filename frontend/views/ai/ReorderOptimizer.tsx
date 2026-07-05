import React, { useState } from 'react';
import { Loader2, Package, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '../../context/InventoryContext';
import { useAuth } from '../../context/AuthContext';
import { optimizeReorder } from '../../services/aiAnalyticsUtils';

const ReorderOptimizer: React.FC = () => {
  const navigate = useNavigate();
  const { companyConfig } = useAuth();
  const currency = companyConfig?.currencySymbol || 'K';
  const { inventory } = useInventory();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runOptimization = () => {
    setLoading(true);
    setTimeout(() => {
      const res = optimizeReorder(inventory || [], []);
      setResult(res);
      setLoading(false);
    }, 300);
  };

  return (
    <div className="h-full flex flex-col p-6 bg-slate-50/50 overflow-y-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/smart-operations/ai')} className="p-2 rounded-lg hover:bg-white transition-colors"><ArrowLeft size={20} /></button>
        <Package className="text-cyan-500" size={28} />
        <div><h1 className="text-xl font-bold text-slate-800">Reorder Optimizer</h1><p className="text-xs text-slate-500">Smart inventory reorder points</p></div>
      </div>

      {!result && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <Package size={48} className="mx-auto text-cyan-300 mb-4" />
            <h2 className="text-lg font-semibold text-slate-700 mb-2">Optimize Reorder Points</h2>
            <p className="text-sm text-slate-500 mb-2">{(inventory || []).length} inventory items loaded</p>
            <button onClick={runOptimization} className="mt-4 px-6 py-2.5 bg-cyan-500 text-white rounded-xl font-medium hover:bg-cyan-600 transition-colors">Run Analysis</button>
          </div>
        </div>
      )}

      {loading && <div className="flex-1 flex items-center justify-center"><Loader2 size={40} className="animate-spin text-cyan-500 mx-auto" /></div>}

      {result && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200"><div className="text-xs text-slate-500">Items</div><div className="text-2xl font-bold text-slate-800">{result.summary.totalItems}</div></div>
            <div className="bg-white rounded-xl p-4 border border-red-200"><div className="text-xs text-red-500">Need Reorder</div><div className="text-2xl font-bold text-red-600">{result.summary.needsReorder}</div></div>
            <div className="bg-white rounded-xl p-4 border border-amber-200"><div className="text-xs text-amber-500">Critical</div><div className="text-2xl font-bold text-amber-600">{result.summary.criticalItems}</div></div>
            <div className="bg-white rounded-xl p-4 border border-slate-200"><div className="text-xs text-slate-500">Est. Cost</div><div className="text-2xl font-bold text-slate-800">{currency}{(result.summary.totalOrderCost || 0).toLocaleString()}</div></div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-3 border-b border-slate-100 font-semibold text-sm text-slate-700">Recommendations</div>
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {result.recommendations?.filter((r: any) => r.isRecommended).map((r: any, i: number) => (
                <div key={i} className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">{r.itemName}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.urgency >= 80 ? 'bg-red-50 text-red-600' : r.urgency >= 50 ? 'bg-amber-50 text-amber-600' : 'bg-cyan-50 text-cyan-600'}`}>Urgency: {r.urgency}%</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs text-slate-500">
                    <div>Stock: <span className="font-medium text-slate-700">{r.currentStock}</span></div>
                    <div>Reorder: <span className="font-medium text-slate-700">{r.suggestedReorderPoint}</span></div>
                    <div>Safety: <span className="font-medium text-slate-700">{r.safetyStock}</span></div>
                    <div>Order: <span className="font-medium text-emerald-600">{r.suggestedOrderQuantity}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={runOptimization} className="text-sm text-cyan-500 hover:text-cyan-700 font-medium">Re-run</button>
        </div>
      )}
    </div>
  );
};

export default ReorderOptimizer;
