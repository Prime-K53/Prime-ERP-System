import React, { useState } from 'react';
import { Activity, AlertTriangle, Clock, Server, Key, Users, BarChart3 } from 'lucide-react';

interface APIEndpoint {
  path: string;
  method: string;
  calls24h: number;
  avgLatency: number;
  errorRate: number;
  lastCalled: string;
}

const APIUsageDashboard: React.FC = () => {
  const [endpoints, setEndpoints] = useState<APIEndpoint[]>([]);
  const [rateLimit, setRateLimit] = useState(120);
  const [currentUsage, setCurrentUsage] = useState(0);

  const usagePct = rateLimit > 0 ? (currentUsage / rateLimit) * 100 : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-slate-900">API Usage & Rate Limiting</h1><p className="text-sm text-slate-500 mt-1">Monitor API consumption, latency, and error rates</p></div>
      </div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-slate-200"><p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Requests (24h)</p><p className="text-2xl font-bold text-slate-900 mt-1">{endpoints.reduce((s, e) => s + e.calls24h, 0) || 0}</p></div>
        <div className="bg-white rounded-xl p-4 border border-slate-200"><p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Avg Latency</p><p className="text-2xl font-bold text-slate-900 mt-1">{endpoints.length > 0 ? (endpoints.reduce((s, e) => s + e.avgLatency, 0) / endpoints.length).toFixed(0) : '0'}ms</p></div>
        <div className="bg-white rounded-xl p-4 border border-slate-200"><p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Error Rate</p><p className={`text-2xl font-bold mt-1 ${endpoints.some(e => e.errorRate > 5) ? 'text-red-600' : 'text-emerald-600'}`}>{endpoints.length > 0 ? (endpoints.reduce((s, e) => s + e.errorRate, 0) / endpoints.length).toFixed(1) : '0'}%</p></div>
        <div className="bg-white rounded-xl p-4 border border-slate-200"><p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Rate Limit</p><p className={`text-2xl font-bold mt-1 ${usagePct > 80 ? 'text-red-600' : usagePct > 50 ? 'text-amber-600' : 'text-emerald-600'}`}>{currentUsage}/{rateLimit}</p></div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><BarChart3 size={16} className="text-indigo-600" />Rate Limit Configuration</h3>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-xs font-semibold text-slate-700 mb-1">Max Requests Per Minute</label>
            <input type="number" value={rateLimit} onChange={e => setRateLimit(parseInt(e.target.value) || 120)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" /></div>
          <div><label className="block text-xs font-semibold text-slate-700 mb-1">Current Usage (this window)</label>
            <div className="w-full bg-slate-100 rounded-full h-3 mt-2"><div className="bg-gradient-to-r from-indigo-500 to-purple-600 h-3 rounded-full transition-all" style={{ width: `${Math.min(usagePct, 100)}%` }} /></div>
            <p className="text-xs text-slate-400 mt-1">{currentUsage} of {rateLimit} requests used ({usagePct.toFixed(0)}%)</p></div>
        </div>
      </div>
      {endpoints.length === 0 ? (
        <div className="text-center py-12 text-slate-400"><Activity size={40} className="mx-auto mb-3 text-slate-300" /><p className="font-medium">No API activity recorded yet</p><p className="text-sm mt-1">Endpoint usage data will appear here as requests are made.</p></div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50"><th className="text-left p-3 text-xs font-semibold text-slate-500">Endpoint</th><th className="text-left p-3 text-xs font-semibold text-slate-500">Method</th><th className="text-right p-3 text-xs font-semibold text-slate-500">Calls (24h)</th><th className="text-right p-3 text-xs font-semibold text-slate-500">Avg Latency</th><th className="text-right p-3 text-xs font-semibold text-slate-500">Error Rate</th><th className="text-right p-3 text-xs font-semibold text-slate-500">Last Called</th></tr></thead>
            <tbody>{endpoints.map(e => <tr key={e.path} className="border-b border-slate-100 hover:bg-slate-50"><td className="p-3 font-mono text-xs">{e.path}</td><td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-mono ${e.method === 'GET' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{e.method}</span></td><td className="p-3 text-right">{e.calls24h}</td><td className="p-3 text-right">{e.avgLatency}ms</td><td className={`p-3 text-right ${e.errorRate > 5 ? 'text-red-600' : 'text-slate-600'}`}>{e.errorRate}%</td><td className="p-3 text-right text-xs text-slate-400">{e.lastCalled ? new Date(e.lastCalled).toLocaleString() : '—'}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default APIUsageDashboard;
