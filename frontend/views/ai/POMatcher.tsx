import React, { useState } from 'react';
import { Loader2, FileSearch, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProcurement } from '../../context/ProcurementContext';
import { useFinance } from '../../context/FinanceContext';
import { matchPOs } from '../../services/aiAnalyticsUtils';

const POMatcher: React.FC = () => {
  const navigate = useNavigate();
  const { purchases, goodsReceipts, suppliers } = useProcurement();
  const { supplierPayments } = useFinance();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runMatch = () => {
    setLoading(true);
    setTimeout(() => {
      const res = matchPOs(purchases || [], goodsReceipts || [], supplierPayments || [], suppliers || []);
      setResult(res);
      setLoading(false);
    }, 300);
  };

  return (
    <div className="h-full flex flex-col p-6 bg-slate-50/50 overflow-y-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/smart-operations/ai')} className="p-2 rounded-lg hover:bg-white transition-colors"><ArrowLeft size={20} /></button>
        <FileSearch className="text-violet-500" size={28} />
        <div><h1 className="text-xl font-bold text-slate-800">PO Matcher</h1><p className="text-xs text-slate-500">3-way: PO ↔ Goods Receipt ↔ Invoice</p></div>
      </div>

      {!result && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <FileSearch size={48} className="mx-auto text-violet-300 mb-4" />
            <h2 className="text-lg font-semibold text-slate-700 mb-2">Match Purchase Orders</h2>
            <p className="text-sm text-slate-500 mb-2">{(purchases || []).length} POs, {(goodsReceipts || []).length} receipts, {(suppliers || []).length} suppliers</p>
            <button onClick={runMatch} className="mt-4 px-6 py-2.5 bg-violet-500 text-white rounded-xl font-medium hover:bg-violet-600 transition-colors">Run Matching</button>
          </div>
        </div>
      )}

      {loading && <div className="flex-1 flex items-center justify-center"><Loader2 size={40} className="animate-spin text-violet-500 mx-auto" /></div>}

      {result && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200"><div className="text-xs text-slate-500">Total POs</div><div className="text-2xl font-bold text-slate-800">{result.summary.total}</div></div>
            <div className="bg-white rounded-xl p-4 border border-emerald-200"><div className="text-xs text-emerald-500">Matched</div><div className="text-2xl font-bold text-emerald-600">{result.summary.fullyMatched}</div></div>
            <div className="bg-white rounded-xl p-4 border border-amber-200"><div className="text-xs text-amber-500">Partial</div><div className="text-2xl font-bold text-amber-600">{result.summary.partialMatch}</div></div>
            <div className="bg-white rounded-xl p-4 border border-red-200"><div className="text-xs text-red-500">Unmatched</div><div className="text-2xl font-bold text-red-600">{result.summary.unmatched}</div></div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-3 border-b border-slate-100 font-semibold text-sm text-slate-700">Results</div>
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {result.matches?.map((m: any, i: number) => (
                <div key={i} className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {m.matchLevel === 'full' ? <CheckCircle2 size={16} className="text-emerald-400" /> : <AlertTriangle size={16} className="text-amber-400" />}
                      <span className="text-sm font-medium text-slate-700">{m.poNumber}</span>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${m.matchLevel === 'full' ? 'bg-emerald-50 text-emerald-600' : m.matchLevel === 'partial' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>{m.matchStatus}</span>
                  </div>
                  <div className="text-xs text-slate-500 ml-6">{m.supplierName} · {'$' + (m.poTotal || 0).toLocaleString()} · {m.grCount} receipts</div>
                  {m.discrepancies?.map((d: any, j: number) => (
                    <div key={j} className="ml-6 text-xs text-red-500 mt-0.5">⚠ {d.description}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <button onClick={runMatch} className="text-sm text-violet-500 hover:text-violet-700 font-medium">Re-run</button>
        </div>
      )}
    </div>
  );
};

export default POMatcher;
