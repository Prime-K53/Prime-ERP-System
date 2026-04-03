import React, { memo } from 'react';
import { networkDebug } from '../services/api';

interface DebugPanelProps {
  label?: string;
  count?: number;
  lastUpdated?: Date | null;
  position?: 'top-right' | 'footer';
  className?: string;
}

const DebugPanel: React.FC<DebugPanelProps> = memo(({
  label = 'Data',
  count,
  lastUpdated,
  position = 'top-right',
  className,
}) => {
  const containerClasses =
    position === 'top-right'
      ? 'absolute top-2 right-2'
      : 'w-full';

  return (
    <div
      className={
        (position === 'top-right'
          ? 'pointer-events-none'
          : '') +
        ' ' +
        containerClasses +
        ' ' +
        (className || '')
      }
      aria-label="Debug panel"
    >
      <div className="inline-flex items-center gap-3 px-3 py-1.5 rounded-lg border border-slate-200 bg-white/80 backdrop-blur text-[10px] text-slate-600 shadow-sm">
        <span className="font-bold uppercase tracking-wider">{label}</span>
        {typeof count === 'number' ? (
          <span className="text-slate-700">• {count} records loaded</span>
        ) : null}
        {lastUpdated ? (
          <span>• Updated {new Date(lastUpdated).toLocaleTimeString()}</span>
        ) : null}
        <span className="text-slate-500">• Active API: {networkDebug.activeRequests}</span>
        <span className="text-slate-500">
          • Last fetch: {networkDebug.lastFetchAt ? new Date(networkDebug.lastFetchAt).toLocaleTimeString() : '—'}
        </span>
      </div>
    </div>
  );
});

DebugPanel.displayName = 'DebugPanel';

export default DebugPanel;
