import React, { useState } from 'react';
import { Loader2, Users, ArrowLeft, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSales } from '../../context/SalesContext';
import { useAuth } from '../../context/AuthContext';
import { predictChurn } from '../../services/aiAnalyticsUtils';
import { currencyService } from '../../services/currencyService';

const ChurnPredictor: React.FC = () => {
  const navigate = useNavigate();
  const { companyConfig } = useAuth();
  const currency = companyConfig?.currencySymbol || currencyService.getCurrency(currencyService.getBaseCurrency())?.symbol || 'K';
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-slate-500 hover:bg-slate-50 transition-all duration-200">
              <div className="p-2.5 bg-slate-50 text-slate-600 rounded-lg shrink-0"><Users size={20} /></div>
              <div className="min-w-0"><p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">Total</p><p className="text-lg md:text-xl font-semibold text-slate-900">{result.totalCustomers}</p></div>
            </div>
            <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-red-500 hover:bg-slate-50 transition-all duration-200">
              <div className="p-2.5 bg-red-50 text-red-600 rounded-lg shrink-0"><AlertTriangle size={20} /></div>
              <div className="min-w-0"><p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">At Risk</p><p className="text-lg md:text-xl font-semibold text-slate-900">{result.atRiskCount}</p></div>
            </div>
            <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-amber-500 hover:bg-slate-50 transition-all duration-200">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg shrink-0"><AlertCircle size={20} /></div>
              <div className="min-w-0"><p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">Moderate</p><p className="text-lg md:text-xl font-semibold text-slate-900">{result.moderateRiskCount}</p></div>
            </div>
            <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-emerald-500 hover:bg-slate-50 transition-all duration-200">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0"><CheckCircle2 size={20} /></div>
              <div className="min-w-0"><p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">Healthy</p><p className="text-lg md:text-xl font-semibold text-slate-900">{result.healthyCount}</p></div>
            </div>
          </div>

          {result.summary?.highValueAtRisk > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertTriangle className="text-red-500" size={20} />
              <div><div className="font-medium text-red-800 text-sm">{result.summary.highValueAtRisk} high-value customers at risk</div><div className="text-xs text-red-600">Estimated revenue at risk: {currency}{(result.summary.estimatedRevenueAtRisk || 0).toLocaleString()}</div></div>
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
