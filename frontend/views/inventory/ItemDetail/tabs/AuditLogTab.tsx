import React from 'react';
import { History, User, Monitor, Clock, Activity } from 'lucide-react';
import type { AuditLogEntry } from '../../../../types';

interface Props {
  auditLog: AuditLogEntry[];
}

export const AuditLogTab: React.FC<Props> = ({ auditLog }) => {
  if (auditLog.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <History size={48} className="mb-4 opacity-50" />
        <p className="text-sm font-semibold">No Audit Log Entries</p>
        <p className="text-xs mt-1">No changes have been recorded for this item yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {auditLog.map((entry, i) => {
        const action = entry.action || 'Unknown';
        const actionColor =
          action === 'create' || action === 'created' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
          action === 'update' || action === 'updated' ? 'bg-blue-50 text-blue-700 border-blue-200' :
          action === 'delete' || action === 'deleted' ? 'bg-red-50 text-red-700 border-red-200' :
          'bg-slate-100 text-slate-500 border-slate-200';

        return (
          <div key={entry.id || i} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-sm transition-all">
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-50 rounded-full border border-slate-200 flex-shrink-0 mt-0.5">
                  <Activity size={16} className="text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800 capitalize">{action}</span>
                    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${actionColor}`}>
                      {action}
                    </span>
                  </div>
                  {entry.details && (
                    <p className="text-xs text-slate-500 mt-1.5">{entry.details}</p>
                  )}
                  {entry.details && (
                    <pre className="text-[10px] text-slate-400 mt-2 bg-slate-50 p-3 rounded-lg border border-slate-100 max-h-32 overflow-auto font-mono">
                      {JSON.stringify(entry.details, null, 2)}
                    </pre>
                  )}
                  <div className="flex items-center gap-4 mt-2.5 text-[10px] text-slate-400">
                    {entry.userId && (
                      <span className="flex items-center gap-1">
                        <User size={10} /> {entry.userId}
                      </span>
                    )}
                    {(entry as AuditLogEntry & { ipAddress?: string }).ipAddress && (
                      <span className="flex items-center gap-1">
                        <Monitor size={10} /> {(entry as AuditLogEntry & { ipAddress?: string }).ipAddress}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(entry.date || Date.now()).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
