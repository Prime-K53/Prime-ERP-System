import React, { useState } from 'react';
import { Loader2, Layers, ArrowLeft, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProduction } from '../../context/ProductionContext';
import { optimizeGangRun } from '../../services/aiAnalyticsUtils';

const GangRunOptimizer: React.FC = () => {
  const navigate = useNavigate();
  const { workOrders, boms, workCenters } = useProduction();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runOptimization = () => {
    setLoading(true);
    setTimeout(() => {
      const res = optimizeGangRun(workOrders, boms, workCenters);
      setResult(res);
      setLoading(false);
    }, 300);
  };

  return (
    <div className="h-full flex flex-col p-6 bg-slate-50/50 overflow-y-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/smart-operations/ai')} className="p-2 rounded-lg hover:bg-white transition-colors"><ArrowLeft size={20} /></button>
        <Layers className="text-blue-500" size={28} />
        <div><h1 className="text-xl font-bold text-slate-800">Gang Run Optimizer</h1><p className="text-xs text-slate-500">Group similar print jobs to reduce setup waste</p></div>
      </div>

      {!result && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <Layers size={48} className="mx-auto text-blue-300 mb-4" />
            <h2 className="text-lg font-semibold text-slate-700 mb-2">Optimize Print Job Grouping</h2>
            <p className="text-sm text-slate-500 mb-2">{workOrders.length} work orders, {boms.length} BOMs, {workCenters.length} work centers loaded</p>
            <button onClick={runOptimization} className="mt-4 px-6 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors">Run Optimization</button>
          </div>
        </div>
      )}

      {loading && <div className="flex-1 flex items-center justify-center"><Loader2 size={40} className="animate-spin text-blue-500 mx-auto" /></div>}

      {result && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-slate-500 hover:bg-slate-50 transition-all duration-200">
              <div className="p-2.5 bg-slate-50 text-slate-600 rounded-lg shrink-0"><Layers size={20} /></div>
              <div className="min-w-0"><p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">Total Jobs</p><p className="text-lg md:text-xl font-semibold text-slate-900">{result.metrics.totalJobs}</p></div>
            </div>
            <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-emerald-500 hover:bg-slate-50 transition-all duration-200">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0"><CheckCircle2 size={20} /></div>
              <div className="min-w-0"><p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">Ganged Jobs</p><p className="text-lg md:text-xl font-semibold text-slate-900">{result.metrics.gangedJobs}</p></div>
            </div>
            <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-blue-500 hover:bg-slate-50 transition-all duration-200">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg shrink-0"><Clock size={20} /></div>
              <div className="min-w-0"><p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">Setup Savings</p><p className="text-lg md:text-xl font-semibold text-slate-900">{result.metrics.setupHoursSaved}h</p></div>
            </div>
            <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-violet-500 hover:bg-slate-50 transition-all duration-200">
              <div className="p-2.5 bg-violet-50 text-violet-600 rounded-lg shrink-0"><TrendingUp size={20} /></div>
              <div className="min-w-0"><p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">Utilization</p><p className="text-lg md:text-xl font-semibold text-slate-900">{result.metrics.utilizationRate}%</p></div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-4 border-b border-slate-100 font-semibold text-slate-700">Groups ({result.groups.length})</div>
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {result.groups.map((group: any, i: number) => (
                <div key={i} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-slate-700">Group {i + 1} ({group.jobs.length} jobs)</span>
                    {group.totalSetupSavings > 0 && <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">Save {group.totalSetupSavings}min</span>}
                  </div>
                  {group.jobs.map((job: any, j: number) => (
                    <div key={j} className="flex items-center gap-2 text-sm text-slate-600"><CheckCircle2 size={14} className="text-emerald-400" /><span>{job.product_name || job.customer_name || `Job ${job.id}`}</span></div>
                  ))}
                  {group.sharedWorkCenter && <div className="mt-1 text-xs text-slate-400">Center: {group.sharedWorkCenter}</div>}
                </div>
              ))}
            </div>
          </div>
          <button onClick={runOptimization} className="text-sm text-blue-500 hover:text-blue-700 font-medium">Re-run</button>
        </div>
      )}
    </div>
  );
};

export default GangRunOptimizer;
