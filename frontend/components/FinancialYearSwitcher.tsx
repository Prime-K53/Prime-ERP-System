import React, { useState, useRef, useEffect } from 'react';
import { CalendarDays, ChevronDown, AlertCircle } from 'lucide-react';
import { useFinancialYear } from '../context/FinancialYearContext';

const FinancialYearSwitcher: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { selectedFinancialYear, availableFinancialYears, setFinancialYear, isLoading } = useFinancialYear();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', opacity: 0.6 }}>
        <CalendarDays size={14} color="#94a3b8" />
        <span style={{ fontSize: 12, color: '#94a3b8' }}>Loading...</span>
      </div>
    );
  }

  if (!selectedFinancialYear) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 12 }}>
        <AlertCircle size={14} />
        No FY configured
      </div>
    );
  }

  const startYear = selectedFinancialYear.start_date?.slice(0, 4);
  const endYear = selectedFinancialYear.end_date?.slice(0, 4);
  const label = startYear !== endYear ? `FY ${startYear}/${endYear?.slice(2)}` : `FY ${startYear}`;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        title={selectedFinancialYear.is_closed ? 'Closed Financial Year' : `Financial Year: ${selectedFinancialYear.name}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: compact ? 4 : 8,
          padding: compact ? '4px 8px' : '6px 12px',
          borderRadius: 8,
          border: `1px solid ${selectedFinancialYear.is_closed ? '#fecaca' : '#e2e8f0'}`,
          backgroundColor: selectedFinancialYear.is_closed ? '#fef2f2' : '#f8fafc',
          color: selectedFinancialYear.is_closed ? '#dc2626' : '#475569',
          cursor: 'pointer',
          fontSize: compact ? 11 : 12,
          fontWeight: 600,
          fontFamily: "'Inter', sans-serif",
          whiteSpace: 'nowrap',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#cbd5e1'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = selectedFinancialYear.is_closed ? '#fecaca' : '#e2e8f0'; }}
      >
        <CalendarDays size={compact ? 12 : 14} />
        <span>{label}</span>
        {selectedFinancialYear.is_closed && <AlertCircle size={12} />}
        <ChevronDown size={compact ? 10 : 12} style={{ opacity: 0.5 }} />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 4,
          minWidth: 220,
          backgroundColor: '#fff',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          zIndex: 9999,
          padding: '6px',
          maxHeight: 300,
          overflowY: 'auto',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 10px 4px' }}>
            Financial Years
          </div>
          {availableFinancialYears.length === 0 ? (
            <div style={{ padding: '12px 10px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
              No financial years configured
            </div>
          ) : (
            availableFinancialYears.map(fy => {
              const sy = fy.start_date?.slice(0, 4);
              const ey = fy.end_date?.slice(0, 4);
              const fyLabel = sy !== ey ? `FY ${sy}/${ey?.slice(2)}` : `FY ${sy}`;
              const isActive = selectedFinancialYear?.id === fy.id;
              return (
                <button
                  key={fy.id}
                  onClick={() => { setFinancialYear(fy); setIsOpen(false); }}
                  disabled={fy.status !== 'Active'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: isActive ? '#eef2ff' : 'transparent',
                    color: isActive ? '#4338ca' : (fy.status !== 'Active' ? '#94a3b8' : '#334155'),
                    cursor: fy.status === 'Active' ? 'pointer' : 'not-allowed',
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 500,
                    textAlign: 'left',
                    fontFamily: "'Inter', sans-serif",
                    gap: 8,
                    opacity: fy.status !== 'Active' ? 0.5 : 1,
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <span>{fyLabel}</span>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {fy.is_closed ? (
                      <span style={{ fontSize: 9, color: '#dc2626', fontWeight: 600, backgroundColor: '#fef2f2', padding: '1px 6px', borderRadius: 4 }}>Closed</span>
                    ) : fy.is_default ? (
                      <span style={{ fontSize: 9, color: '#6366f1', fontWeight: 600 }}>Default</span>
                    ) : null}
                    {isActive && <span style={{ fontSize: 9, color: '#6366f1', fontWeight: 600 }}>Active</span>}
                  </div>
                </button>
              );
            })
          )}
          {!compact && (
            <div style={{ padding: '8px 10px 4px', borderTop: '1px solid #f1f5f9', marginTop: 4 }}>
              <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.4 }}>
                <div>{selectedFinancialYear.start_date} – {selectedFinancialYear.end_date}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FinancialYearSwitcher;