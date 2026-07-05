import React, { useState } from 'react';
import { Loader2, TrendingUp, ArrowLeft, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../../context/FinanceContext';
import { useSales } from '../../context/SalesContext';
import { useAuth } from '../../context/AuthContext';
import { forecastCashFlow } from '../../services/aiAnalyticsUtils';

const CashFlowForecaster: React.FC = () => {
  const navigate = useNavigate();
  const { companyConfig } = useAuth();
  const currency = companyConfig?.currencySymbol || 'K';
  const { invoices, expenses, income, ledger } = useFinance();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [days, setDays] = useState(90);

  const runForecast = () => {
    setLoading(true);
    setTimeout(() => {
      const ar = (invoices || []).filter((i: any) => i.status === 'pending' || i.status === 'overdue');
      const ap = (expenses || []).filter((e: any) => e.status === 'pending');
      const res = forecastCashFlow(invoices || [], expenses || [], ar, ap, ledger || [], days);
      setResult(res);
      setLoading(false);
    }, 300);
  };

  return (
    <div className="h-full flex flex-col p-6 bg-slate-50/50 overflow-y-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/smart-operations/ai')} className="p-2 rounded-lg hover:bg-white transition-colors"><ArrowLeft size={20} /></button>
        <TrendingUp className="text-emerald-500" size={28} />
        <div><h1 className="text-xl font-bold text-slate-800">Cash Flow Forecaster</h1><p className="text-xs text-slate-500">Project future cash position</p></div>
      </div>

      {!result && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <TrendingUp size={48} className="mx-auto text-emerald-300 mb-4" />
            <h2 className="text-lg font-semibold text-slate-700 mb-2">Project Future Cash Position</h2>
            <p className="text-sm text-slate-500 mb-4">{(invoices || []).length} invoices, {(expenses || []).length} expenses, {(ledger || []).length} ledger entries loaded</p>
            <div className="flex items-center justify-center gap-3 mb-6">
              <label className="text-sm text-slate-600">Period:</label>
              <select value={days} onChange={e => setDays(Number(e.target.value))} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm">
                <option value={30}>30 days</option><option value={60}>60 days</option><option value={90}>90 days</option><option value={180}>180 days</option>
              </select>
            </div>
            <button onClick={runForecast} className="px-6 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors">Run Forecast</button>
          </div>
        </div>
      )}

      {loading && <div className="flex-1 flex items-center justify-center"><Loader2 size={40} className="animate-spin text-emerald-500 mx-auto" /></div>}

      {result && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200"><div className="text-xs text-slate-500">Start Balance</div><div className="text-lg font-bold text-slate-800">{currency}{(result.summary.startingBalance || 0).toLocaleString()}</div></div>
            <div className="bg-white rounded-xl p-4 border border-slate-200"><div className="text-xs text-slate-500">Projected ({days}d)</div><div className={`text-lg font-bold ${result.summary.finalProjectedBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{currency}{(result.summary.finalProjectedBalance || 0).toLocaleString()}</div></div>
            <div className="bg-white rounded-xl p-4 border border-slate-200"><div className="text-xs text-slate-500">Min Balance</div><div className={`text-lg font-bold ${result.summary.minimumProjectedBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{currency}{(result.summary.minimumProjectedBalance || 0).toLocaleString()}</div></div>
            <div className="bg-white rounded-xl p-4 border border-slate-200"><div className="text-xs text-slate-500 capitalize">Risk: {result.summary.riskLevel}</div><div className={`text-lg font-bold capitalize ${result.summary.riskLevel === 'low' ? 'text-emerald-600' : result.summary.riskLevel === 'medium' ? 'text-amber-600' : 'text-red-600'}`}>{result.summary.riskLevel}</div></div>
          </div>

          {result.summary.daysUntilNegative >= 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertTriangle className="text-red-500" size={20} />
              <div><div className="font-medium text-red-800 text-sm">Cash depletion warning</div><div className="text-xs text-red-600">Projected negative in {result.summary.daysUntilNegative} days</div></div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-3 border-b border-slate-100 font-semibold text-sm text-slate-700">Daily Projection</div>
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-slate-50 text-slate-500"><th className="text-left p-2">Date</th><th className="text-right p-2">Inflow</th><th className="text-right p-2">Outflow</th><th className="text-right p-2">Net</th><th className="text-right p-2">Balance</th></tr></thead>
                <tbody>{result.projection?.map((p: any, i: number) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="p-2 text-slate-700">{p.date}</td>
                    <td className="p-2 text-right text-emerald-600">{currency}{(p.inflow || 0).toLocaleString()}</td>
                    <td className="p-2 text-right text-red-600">{currency}{(p.outflow || 0).toLocaleString()}</td>
                    <td className={`p-2 text-right font-medium ${(p.netFlow || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{currency}{(p.netFlow || 0).toLocaleString()}</td>
                    <td className={`p-2 text-right font-medium ${(p.balance || 0) >= 0 ? 'text-slate-800' : 'text-red-600'}`}>{currency}{(p.balance || 0).toLocaleString()}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
          <button onClick={runForecast} className="text-sm text-emerald-500 hover:text-emerald-700 font-medium">Re-run</button>
        </div>
      )}
    </div>
  );
};

export default CashFlowForecaster;
