import React, { useState } from 'react';
import { Loader2, AlertTriangle, ArrowLeft, Shield, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../../context/FinanceContext';
import { useInventory } from '../../context/InventoryContext';
import { useSales } from '../../context/SalesContext';

const AnomalyDetector: React.FC = () => {
  const navigate = useNavigate();
  const { ledger, invoices, expenses } = useFinance();
  const { inventory } = useInventory();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runDetection = () => {
    setLoading(true);
    setTimeout(() => {
      const anomalies: any[] = [];

      const amounts = (ledger || []).map((e: any) => Number(e.amount)).filter((a: number) => a > 0);
      if (amounts.length >= 5) {
        amounts.sort((a, b) => a - b);
        const q1 = amounts[Math.floor(amounts.length * 0.25)];
        const q3 = amounts[Math.floor(amounts.length * 0.75)];
        const iqr = q3 - q1;
        const upper = q3 + 3 * iqr;
        for (const entry of ledger || []) {
          const amt = Number(entry.amount);
          if (amt > upper && amt > 10000) anomalies.push({
            id: `tx-${entry.id}`, category: 'transaction', type: 'unusual_amount', severity: amt > upper * 2 ? 'critical' : 'high',
            risk_score: Math.min(1, amt / (upper * 3)), description: `Unusual ${entry.entry_type} of $${amt.toLocaleString()} in ${entry.account_name || entry.account_code || 'unknown'}`,
            amount: amt, date: entry.entry_date
          });
        }
      }

      for (const item of inventory || []) {
        if (item.quantity < 0) anomalies.push({
          id: `inv-neg-${item.id}`, category: 'inventory', type: 'negative_stock', severity: 'high', risk_score: 0.85,
          description: `Negative stock: "${item.material || item.name}" (qty: ${item.quantity})`, itemName: item.material || item.name, quantity: item.quantity
        });
        if (item.reorder_point > 0 && item.quantity > 0 && item.quantity < item.reorder_point * 0.3) anomalies.push({
          id: `inv-crit-${item.id}`, category: 'inventory', type: 'critical_stock', severity: 'high', risk_score: 0.75,
          description: `Critically low: "${item.material || item.name}" (${item.quantity} vs reorder ${item.reorder_point})`,
          itemName: item.material || item.name, quantity: item.quantity
        });
      }

      const deleteCount = (ledger || []).filter((l: any) => l.status === 'voided' || l.status === 'cancelled').length;
      if (deleteCount > 5) anomalies.push({
        id: 'audit-mass-void', category: 'audit', type: 'mass_voiding', severity: 'medium', risk_score: 0.6,
        description: `${deleteCount} voided/cancelled entries found`
      });

      anomalies.sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0));
      setResult({
        anomalies, totalCount: anomalies.length,
        highRiskCount: anomalies.filter((a: any) => a.risk_score >= 0.7).length,
        mediumRiskCount: anomalies.filter((a: any) => a.risk_score >= 0.4 && a.risk_score < 0.7).length,
        lowRiskCount: anomalies.filter((a: any) => a.risk_score < 0.4).length
      });
      setLoading(false);
    }, 300);
  };

  return (
    <div className="h-full flex flex-col p-6 bg-slate-50/50 overflow-y-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/smart-operations/ai')} className="p-2 rounded-lg hover:bg-white transition-colors"><ArrowLeft size={20} /></button>
        <AlertTriangle className="text-red-500" size={28} />
        <div><h1 className="text-xl font-bold text-slate-800">Anomaly Detector</h1><p className="text-xs text-slate-500">Unusual transactions, stock, and audit events</p></div>
      </div>

      {!result && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <Shield size={48} className="mx-auto text-red-300 mb-4" />
            <h2 className="text-lg font-semibold text-slate-700 mb-2">Detect Anomalies</h2>
            <p className="text-sm text-slate-500 mb-2">{(ledger || []).length} ledger entries, {(inventory || []).length} inventory items loaded</p>
            <button onClick={runDetection} className="mt-4 px-6 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors">Run Detection</button>
          </div>
        </div>
      )}

      {loading && <div className="flex-1 flex items-center justify-center"><Loader2 size={40} className="animate-spin text-red-500 mx-auto" /></div>}

      {result && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200"><div className="text-xs text-slate-500">Total</div><div className="text-2xl font-bold text-slate-800">{result.totalCount}</div></div>
            <div className="bg-white rounded-xl p-4 border border-red-200"><div className="text-xs text-red-500">High</div><div className="text-2xl font-bold text-red-600">{result.highRiskCount}</div></div>
            <div className="bg-white rounded-xl p-4 border border-amber-200"><div className="text-xs text-amber-500">Medium</div><div className="text-2xl font-bold text-amber-600">{result.mediumRiskCount}</div></div>
            <div className="bg-white rounded-xl p-4 border border-slate-200"><div className="text-xs text-slate-500">Low</div><div className="text-2xl font-bold text-slate-500">{result.lowRiskCount}</div></div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-3 border-b border-slate-100 font-semibold text-sm text-slate-700">Details</div>
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {result.anomalies.map((a: any, i: number) => (
                <div key={i} className="p-3 flex items-start gap-3">
                  <div className={`mt-0.5 p-1 rounded-full ${a.severity === 'critical' ? 'bg-red-100 text-red-500' : a.severity === 'high' ? 'bg-orange-100 text-orange-500' : 'bg-amber-100 text-amber-500'}`}><AlertCircle size={14} /></div>
                  <div className="flex-1"><div className="text-sm font-medium text-slate-700">{a.description}</div><div className="text-xs text-slate-400 mt-0.5">{a.category} · {(a.risk_score * 100).toFixed(0)}% risk</div></div>
                  <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${a.severity === 'critical' ? 'bg-red-50 text-red-600' : a.severity === 'high' ? 'bg-orange-50 text-orange-600' : 'bg-amber-50 text-amber-600'}`}>{a.severity}</div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={runDetection} className="text-sm text-red-500 hover:text-red-700 font-medium">Re-run</button>
        </div>
      )}
    </div>
  );
};

export default AnomalyDetector;
