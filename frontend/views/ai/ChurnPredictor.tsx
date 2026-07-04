import React, { useState } from 'react';
import { Loader2, Users, ArrowLeft, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSales } from '../../context/SalesContext';
import { predictChurn } from '../../services/aiAnalyticsUtils';

const ChurnPredictor: React.FC = () => {
  const navigate = useNavigate();
  const { sales, customers } = useSales();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runPrediction = () => {
    setLoading(true);
    setTimeout(() => {
      const res = predictChurn(sales || [], customers || []);
      setResult(res);
      setLoading(false);
    }, 300);
  };

  return (
    <div className="h-full flex flex-col p-6 bg-slate-50/50 overflow-y-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/smart-operations/ai')} className="p-2 rounded-lg hover:bg-white transition-colors"><ArrowLeft size={20} /></button>
        <Users className="text-orange-500" size={28} />
        <div><h1 className="text-xl font-bold text-slate-800">Churn Predictor</h1><p className="text-xs text-slate-500">Identify at-risk customers</p></div>
      </div>

      {!result && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <Users size={48} className="mx-auto text-orange-300 mb-4" />
            <h2 className="text-lg font-semibold text-slate-700 mb-2">Predict Customer Churn</h2>
            <p className="text-sm text-slate-500 mb-2">{(customers || []).length} customers, {(sales || []).length} sales loaded</p>
            <button onClick={runPrediction} className="mt-4 px-6 py-2.5 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors">Run Analysis</button>
          </div>
        </div>
      )}

      {loading && <div className="flex-1 flex items-center justify-center"><Loader2 size={40} className="animate-spin text-orange-500 mx-auto" /></div>}

      {result && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200"><div className="text-xs text-slate-500">Total</div><div className="text-2xl font-bold text-slate-800">{result.totalCustomers}</div></div>
            <div className="bg-white rounded-xl p-4 border border-red-200"><div className="text-xs text-red-500">At Risk</div><div className="text-2xl font-bold text-red-600">{result.atRiskCount}</div></div>
            <div className="bg-white rounded-xl p-4 border border-amber-200"><div className="text-xs text-amber-500">Moderate</div><div className="text-2xl font-bold text-amber-600">{result.moderateRiskCount}</div></div>
            <div className="bg-white rounded-xl p-4 border border-emerald-200"><div className="text-xs text-emerald-500">Healthy</div><div className="text-2xl font-bold text-emerald-600">{result.healthyCount}</div></div>
          </div>

          {result.summary?.highValueAtRisk > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertTriangle className="text-red-500" size={20} />
              <div><div className="font-medium text-red-800 text-sm">{result.summary.highValueAtRisk} high-value customers at risk</div><div className="text-xs text-red-600">Estimated revenue at risk: {'$' + (result.summary.estimatedRevenueAtRisk || 0).toLocaleString()}</div></div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-3 border-b border-slate-100 font-semibold text-sm text-slate-700">Customer Risk Scores</div>
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {result.predictions?.map((p: any, i: number) => (
                <div key={i} className="p-3 flex items-center gap-3">
                  {p.riskLevel === 'high' ? <AlertTriangle size={16} className="text-red-400" /> : <CheckCircle2 size={16} className="text-emerald-400" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-700">{p.customerName}</div>
                    <div className="text-xs text-slate-400">{p.totalOrders} orders · {p.daysSinceLastOrder}d since last order</div>
                    {p.keyFactors?.length > 0 && <div className="text-xs text-slate-400 mt-0.5">{p.keyFactors.slice(0, 2).join(' · ')}</div>}
                  </div>
                  <div className="text-right"><div className={`text-sm font-bold ${p.riskLevel === 'high' ? 'text-red-600' : p.riskLevel === 'medium' ? 'text-amber-600' : 'text-emerald-600'}`}>{Math.round(p.riskScore * 100)}%</div><div className="text-xs text-slate-400 capitalize">{p.riskLevel}</div></div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={runPrediction} className="text-sm text-orange-500 hover:text-orange-700 font-medium">Re-run</button>
        </div>
      )}
    </div>
  );
};

export default ChurnPredictor;
