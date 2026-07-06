import React, { useState } from 'react';
import { Loader2, Shield, ArrowLeft, AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../../context/FinanceContext';
import { useSales } from '../../context/SalesContext';
import { generateAIResponse } from '../../services/geminiService';

const AuditInvestigator: React.FC = () => {
  const navigate = useNavigate();
  const { ledger, invoices } = useFinance();
  const { sales } = useSales();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [query, setQuery] = useState('');

  const buildAuditContext = () => {
    const parts: string[] = [];
    parts.push(`Ledger entries: ${(ledger || []).length}`);
    parts.push(`Invoices: ${(invoices || []).length}`);
    parts.push(`Sales: ${(sales || []).length}`);
    const voided = (ledger || []).filter((l: any) => l.status === 'voided' || l.status === 'cancelled');
    if (voided.length > 0) parts.push(`Voided/cancelled entries: ${voided.length}`);
    const highValue = (ledger || []).filter((l: any) => Number(l.amount) > 10000);
    if (highValue.length > 0) parts.push(`High-value entries (>$10K): ${highValue.length}`);
    const overdueInvoices = (invoices || []).filter((i: any) => i.status === 'overdue');
    if (overdueInvoices.length > 0) parts.push(`Overdue invoices: ${overdueInvoices.length}`);
    return parts.join('\n');
  };

  const runInvestigation = async (customQuery?: string) => {
    setLoading(true);
    try {
      const q = customQuery || query || 'Analyze the audit data and highlight any anomalies or concerns.';
      const context = buildAuditContext();
      const systemPrompt = 'You are an AI audit investigator. Analyze the audit trail data, identify anomalies, unusual patterns, and risks. Be concise and specific.';
      const answer = await generateAIResponse(`Audit Data:\n${context}\n\nInvestigation: ${q}`, systemPrompt);

      const voidedCount = (ledger || []).filter((l: any) => l.status === 'voided' || l.status === 'cancelled').length;
      const highValCount = (ledger || []).filter((l: any) => Number(l.amount) > 10000).length;
      const findings = [
        { id: 'f1', type: 'info', title: 'Total Records Reviewed', description: `${(ledger || []).length} ledger entries, ${(invoices || []).length} invoices, ${(sales || []).length} sales`, severity: 0 },
      ];
      if (voidedCount > 5) findings.push({ id: 'f2', type: 'warning', title: 'High Void Rate', description: `${voidedCount} voided/cancelled entries found`, severity: 5 });
      if (highValCount > 0) findings.push({ id: 'f3', type: 'info', title: 'High-Value Transactions', description: `${highValCount} entries over $10K`, severity: 3 });

      setResult({ findings, totalFindings: findings.length, highSeverity: findings.filter(f => f.severity >= 7).length, mediumSeverity: findings.filter(f => f.severity >= 4 && f.severity < 7).length, lowSeverity: findings.filter(f => f.severity < 4 && f.severity > 0).length, answer });
    } catch (err: any) {
      setResult({ findings: [], totalFindings: 0, highSeverity: 0, mediumSeverity: 0, lowSeverity: 0, answer: `Error: ${err.message}` });
    } finally { setLoading(false); }
  };

  return (
    <div className="h-full flex flex-col p-6 bg-slate-50/50 overflow-y-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/smart-operations/ai')} className="p-2 rounded-lg hover:bg-white"><ArrowLeft size={20} /></button>
        <Shield className="text-slate-500" size={28} />
        <div><h1 className="text-xl font-bold text-slate-800">Audit Investigator</h1><p className="text-xs text-slate-500">AI-powered audit trail analysis</p></div>
      </div>
      <div className="flex gap-2 mb-4">
        <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && runInvestigation()} placeholder="Ask about audit data (e.g., 'Any anomalies?')" className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
        <button onClick={() => runInvestigation()} disabled={loading} className="px-4 py-2 bg-slate-600 text-white rounded-xl hover:bg-slate-700 disabled:opacity-50"><Search size={18} /></button>
      </div>

      {!result && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <Shield size={48} className="mx-auto text-slate-300 mb-4" />
            <h2 className="text-lg font-semibold text-slate-700 mb-2">Investigate Audit Trail</h2>
            <p className="text-sm text-slate-500 mb-2">{(ledger || []).length} ledger entries, {(invoices || []).length} invoices loaded</p>
            <button onClick={() => runInvestigation('')} className="mt-4 px-6 py-2.5 bg-slate-600 text-white rounded-xl font-medium hover:bg-slate-700">Run Full Audit Scan</button>
          </div>
        </div>
      )}

      {loading && <div className="flex-1 flex items-center justify-center"><Loader2 size={40} className="animate-spin text-slate-500 mx-auto" /></div>}

      {result && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-slate-500 hover:bg-slate-50 transition-all duration-200">
              <div className="p-2.5 bg-slate-50 text-slate-600 rounded-lg shrink-0"><Search size={20} /></div>
              <div className="min-w-0"><p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">Findings</p><p className="text-lg md:text-xl font-semibold text-slate-900">{result.totalFindings}</p></div>
            </div>
            <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-red-500 hover:bg-slate-50 transition-all duration-200">
              <div className="p-2.5 bg-red-50 text-red-600 rounded-lg shrink-0"><AlertTriangle size={20} /></div>
              <div className="min-w-0"><p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">High</p><p className="text-lg md:text-xl font-semibold text-slate-900">{result.highSeverity}</p></div>
            </div>
            <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-amber-500 hover:bg-slate-50 transition-all duration-200">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg shrink-0"><Shield size={20} /></div>
              <div className="min-w-0"><p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">Medium</p><p className="text-lg md:text-xl font-semibold text-slate-900">{result.mediumSeverity}</p></div>
            </div>
            <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-slate-500 hover:bg-slate-50 transition-all duration-200">
              <div className="p-2.5 bg-slate-50 text-slate-600 rounded-lg shrink-0"><CheckCircle2 size={20} /></div>
              <div className="min-w-0"><p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">Low</p><p className="text-lg md:text-xl font-semibold text-slate-900">{result.lowSeverity}</p></div>
            </div>
          </div>
          {result.answer && <div className="bg-white rounded-xl p-4 border border-slate-200"><div className="text-sm text-slate-700 whitespace-pre-wrap">{result.answer}</div></div>}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-3 border-b border-slate-100 font-semibold text-sm text-slate-700">Findings</div>
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {result.findings?.filter((f: any) => f.severity > 0).map((f: any, i: number) => (
                <div key={i} className="p-3 flex items-start gap-3">
                  {f.severity >= 5 ? <AlertTriangle size={16} className="text-amber-400 mt-0.5" /> : <CheckCircle2 size={16} className="text-slate-400 mt-0.5" />}
                  <div className="flex-1"><div className="text-sm font-medium text-slate-700">{f.title}</div><div className="text-xs text-slate-500">{f.description}</div></div>
                  <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${f.severity >= 7 ? 'bg-red-50 text-red-600' : f.severity >= 4 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-500'}`}>{f.severity}/10</div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => runInvestigation('')} className="text-sm text-slate-500 hover:text-slate-700 font-medium">Re-run</button>
        </div>
      )}
    </div>
  );
};

export default AuditInvestigator;
