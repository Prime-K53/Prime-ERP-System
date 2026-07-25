import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database, Activity, CheckCircle, ArrowLeft,
  Server, Clock, Users, Settings,
} from 'lucide-react';

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; color?: string }> = ({ label, value, icon, color }) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
    <div className="flex items-center gap-3 mb-3">
      <div className={`p-2 rounded-lg ${color || 'bg-blue-100 text-blue-600'}`}>{icon}</div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</p>
    </div>
    <p className="text-2xl font-black text-slate-900">{value}</p>
  </div>
);

const StatusBadge: React.FC<{ healthy: boolean }> = ({ healthy }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${healthy ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
    {healthy ? <CheckCircle size={10} /> : null}
    {healthy ? 'Healthy' : 'Issues'}
  </span>
);

const MigrationHealth: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [serverTime, setServerTime] = useState<string | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setLoading(true);
    const check = async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' }).catch(() => null);
        if (res?.ok) {
          const data = await res.json().catch(() => null);
          setServerTime(data?.serverTime ?? new Date().toISOString());
          setOnline(true);
        } else {
          setOnline(false);
        }
      } catch {
        setOnline(false);
      } finally {
        setLoading(false);
      }
    };
    check();
  }, []);

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-[calc(100vh-4rem)] flex flex-col font-sans">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors border border-slate-200 bg-white">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Database className="text-cyan-600" size={24} /> System Health
            </h1>
            <p className="text-sm text-slate-500 mt-1">Server connectivity and runtime diagnostics</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Activity size={24} className="animate-spin text-cyan-500" />
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading diagnostics...</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-1">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <StatCard label="Server Status" value={online ? 'Online' : 'Offline'} icon={<Server size={16} />} color={online ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'} />
            <StatCard label="Server Time" value={serverTime ? new Date(serverTime).toLocaleTimeString() : 'N/A'} icon={<Clock size={16} />} color="bg-cyan-100 text-cyan-600" />
            <StatCard label="Client Time" value={new Date().toLocaleTimeString()} icon={<Clock size={16} />} color="bg-indigo-100 text-indigo-600" />
            <StatCard label="Online" value={typeof navigator !== 'undefined' ? (navigator.onLine ? 'Yes' : 'No') : 'N/A'} icon={<Activity size={16} />} color="bg-violet-100 text-violet-600" />
            <StatCard label="Users" value="—" icon={<Users size={16} />} color="bg-slate-100 text-slate-600" />
            <StatCard label="Mode" value="Cloud" icon={<Settings size={16} />} color="bg-amber-100 text-amber-600" />
          </div>
        </div>
      )}
    </div>
  );
};

export default MigrationHealth;