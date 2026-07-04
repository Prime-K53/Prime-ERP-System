import React, { useState } from 'react';
import { Loader2, Calendar, ArrowLeft, Clock, AlertTriangle, Cpu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProduction } from '../../context/ProductionContext';
import { optimizeSchedule } from '../../services/aiAnalyticsUtils';

const SmartScheduler: React.FC = () => {
  const navigate = useNavigate();
  const { workOrders, workCenters, resources } = useProduction();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runSchedule = () => {
    setLoading(true);
    setTimeout(() => {
      const res = optimizeSchedule(workOrders || [], workCenters || [], resources || []);
      setResult(res);
      setLoading(false);
    }, 300);
  };

  return (
    <div className="h-full flex flex-col p-6 bg-slate-50/50 overflow-y-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/smart-operations/ai')} className="p-2 rounded-lg hover:bg-white transition-colors"><ArrowLeft size={20} /></button>
        <Calendar className="text-indigo-500" size={28} />
        <div><h1 className="text-xl font-bold text-slate-800">Smart Scheduler</h1><p className="text-xs text-slate-500">Constraint-based production scheduling</p></div>
      </div>

      {!result && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <Calendar size={48} className="mx-auto text-indigo-300 mb-4" />
            <h2 className="text-lg font-semibold text-slate-700 mb-2">Optimize Production Schedule</h2>
            <p className="text-sm text-slate-500 mb-2">{(workOrders || []).length} work orders, {(workCenters || []).length} work centers, {(resources || []).length} resources</p>
            <button onClick={runSchedule} className="mt-4 px-6 py-2.5 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors">Run Scheduler</button>
          </div>
        </div>
      )}

      {loading && <div className="flex-1 flex items-center justify-center"><Loader2 size={40} className="animate-spin text-indigo-500 mx-auto" /></div>}

      {result && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200"><div className="text-xs text-slate-500">Scheduled</div><div className="text-2xl font-bold text-slate-800">{result.metrics.totalScheduled}</div></div>
            <div className="bg-white rounded-xl p-4 border border-amber-200"><div className="text-xs text-amber-500">Unscheduled</div><div className="text-2xl font-bold text-amber-600">{result.metrics.totalUnscheduled}</div></div>
            <div className="bg-white rounded-xl p-4 border border-red-200"><div className="text-xs text-red-500">Overdue</div><div className="text-2xl font-bold text-red-600">{result.metrics.overdueJobs}</div></div>
            <div className="bg-white rounded-xl p-4 border border-slate-200"><div className="text-xs text-slate-500">Est. Hours</div><div className="text-2xl font-bold text-slate-800">{result.metrics.totalEstimatedHours}</div></div>
          </div>

          {result.bottlenecks?.length > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2"><Cpu className="text-red-500" size={18} /><span className="font-medium text-red-800 text-sm">Bottlenecks</span></div>
              {result.bottlenecks.map((b: any, i: number) => (
                <div key={i} className="text-xs text-red-600 ml-7">{b.workCenter}: {b.scheduledJobs} jobs ({b.totalHours}h) — score: {b.bottleneckScore}%</div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-3 border-b border-slate-100 font-semibold text-sm text-slate-700">Schedule</div>
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {result.schedule?.filter((s: any) => s.status === 'scheduled').map((job: any, i: number) => (
                <div key={i} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><Clock size={14} className="text-indigo-400" /><span className="text-sm font-medium text-slate-700">{job.workOrderName}</span></div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${job.priority === 'High' ? 'bg-red-50 text-red-600' : job.priority === 'Medium' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-500'}`}>{job.priority}</span>
                      <span className="text-slate-400">{job.estimatedHours}h</span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 ml-7 mt-1">{job.workCenter} · {job.suggestedStartDate} → {job.suggestedEndDate}</div>
                </div>
              ))}
            </div>
          </div>

          {result.recommendations?.length > 0 && (
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="font-semibold text-sm text-slate-700 mb-2">Recommendations</div>
              {result.recommendations.map((r: string, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm text-slate-600 mb-1"><AlertTriangle size={14} className="text-amber-400" />{r}</div>
              ))}
            </div>
          )}
          <button onClick={runSchedule} className="text-sm text-indigo-500 hover:text-indigo-700 font-medium">Re-run</button>
        </div>
      )}
    </div>
  );
};

export default SmartScheduler;
