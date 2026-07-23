import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2, Sparkles, TrendingUp, Hash, DollarSign, Calendar } from 'lucide-react';
import { interpretQuery, executeQuery, generateQuerySuggestions, type QueryResult, type QuerySuggestion } from '../services/naturalLanguageReportingService';
import { useApp } from '../context/AppContext';
import { useSales } from '../context/SalesContext';
import { useFinance } from '../context/FinanceContext';
import { useInventory } from '../context/InventoryContext';
import { useProcurement } from '../context/ProcurementContext';

const typeIconMap: Record<string, React.ReactNode> = {
  string: <Hash size={14} />,
  number: <Hash size={14} />,
  date: <Calendar size={14} />,
  currency: <DollarSign size={14} />,
};

const formatCellValue = (value: any, type: string): string => {
  if (value === null || value === undefined) return '-';
  if (type === 'currency') {
    const num = Number(value);
    if (isNaN(num)) return String(value);
    return `MWK ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (type === 'number') {
    const num = Number(value);
    if (isNaN(num)) return String(value);
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  if (type === 'date') {
    try {
      return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const NaturalLanguageReporting: React.FC = () => {
  const { companyConfig, notify } = useApp();
  const { sales, customers } = useSales();
  const { invoices, expenses } = useFinance();
  const { inventory } = useInventory();
  const { purchases } = useProcurement();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [suggestions, setSuggestions] = useState<QuerySuggestion[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const allData = { sales, invoices, expenses, customers, inventory: inventory || [], purchases };

  useEffect(() => {
    setSuggestions(generateQuerySuggestions());
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setResult(null);
    try {
      const queryResult = executeQuery(trimmed, allData);
      await new Promise(resolve => setTimeout(resolve, 300));
      setResult(queryResult);
    } catch {
      notify('Failed to process query', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [query, allData, notify]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmit();
  }, [handleSubmit]);

  const handleSuggestionClick = useCallback((suggestion: QuerySuggestion) => {
    setQuery(suggestion.query);
    inputRef.current?.focus();
  }, []);

  const handleClear = useCallback(() => {
    setQuery('');
    setResult(null);
  }, []);

  const currencySymbol = companyConfig?.currencySymbol || 'MWK';

  const isNumericColumn = (col: any) => col.type === 'number' || col.type === 'currency';

  const getColumnTotals = () => {
    if (!result || !result.data.length) return null;
    const totals: Record<string, number> = {};
    result.columns.forEach(col => {
      if (isNumericColumn(col)) {
        totals[col.key] = result.data.reduce((sum: number, row: any) => {
          const val = Number(row[col.key]);
          return sum + (isNaN(val) ? 0 : val);
        }, 0);
      }
    });
    return totals;
  };

  const columnTotals = getColumnTotals();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100%',
      backgroundColor: '#f8fafc',
      fontFamily: "'Inter', sans-serif",
      fontSize: 13,
      lineHeight: 1.5,
      color: '#334155',
      overflow: 'hidden',
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderBottom: '1px solid #e2e8f0',
        flexShrink: 0,
        padding: '20px 32px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <Sparkles size={22} color="#6366f1" />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
            Natural Language Reporting
          </h1>
        </div>
        <p style={{ fontSize: 13, color: '#64748b', margin: 0, marginLeft: 34 }}>
          Ask questions about your business data in plain English
        </p>
      </div>

      <div style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        padding: '24px 32px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{
            display: 'flex',
            gap: 12,
            marginBottom: 20,
          }}>
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 16,
              padding: '4px 4px 4px 20px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              transition: 'box-shadow 0.15s, border-color 0.15s',
            }}>
              <Search size={18} color="#94a3b8" style={{ flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question about your business... (e.g., 'Show unpaid invoices')"
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#0f172a',
                  backgroundColor: 'transparent',
                  padding: '14px 12px',
                  fontFamily: "'Inter', sans-serif",
                }}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  style={{
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: 8,
                  }}
                >
                  <X size={16} />
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={isLoading || !query.trim()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 20px',
                  borderRadius: 12,
                  border: 'none',
                  backgroundColor: !query.trim() ? '#e2e8f0' : '#6366f1',
                  color: !query.trim() ? '#94a3b8' : '#fff',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: !query.trim() ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.15s',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {isLoading ? 'Thinking...' : 'Ask'}
              </button>
            </div>
          </div>

          {suggestions.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, marginTop: 0 }}>
                Suggested Queries
              </p>
              <div style={{
                display: 'flex',
                gap: 8,
                overflowX: 'auto',
                paddingBottom: 8,
                scrollbarWidth: 'thin',
              }}>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(s)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 16px',
                      borderRadius: 20,
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#fff',
                      color: '#475569',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      transition: 'all 0.15s',
                      fontFamily: "'Inter', sans-serif",
                    }}
                    title={s.description}
                  >
                    <Sparkles size={12} color="#a5b4fc" />
                    {s.query}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!result && !isLoading && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '80px 20px',
              color: '#94a3b8',
            }}>
              <Search size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
              <p style={{ fontSize: 16, fontWeight: 600, color: '#64748b', margin: 0 }}>
                Ask a question to get started
              </p>
              <p style={{ fontSize: 13, margin: '8px 0 0', color: '#94a3b8' }}>
                Try clicking a suggested query above or type your own
              </p>
            </div>
          )}

          {isLoading && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '20px 24px',
              backgroundColor: '#eef2ff',
              borderRadius: 16,
              border: '1px solid #e0e7ff',
              marginBottom: 20,
            }}>
              <Loader2 size={20} className="animate-spin" color="#6366f1" />
              <div>
                <p style={{ fontWeight: 600, color: '#4338ca', margin: 0, fontSize: 13 }}>
                  Processing your query...
                </p>
                <p style={{ color: '#6366f1', margin: '2px 0 0', fontSize: 12 }}>
                  Analyzing business data for "{query}"
                </p>
              </div>
            </div>
          )}

          {result && (
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 20,
              }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
                    {result.title}
                  </h2>
                  <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                    {result.description}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleClear}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 16px',
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#fff',
                      color: '#64748b',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    <X size={14} />
                    Clear
                  </button>
                </div>
              </div>

              {result.summary && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '14px 20px',
                  backgroundColor: '#f0fdf4',
                  borderRadius: 12,
                  border: '1px solid #bbf7d0',
                  marginBottom: 20,
                }}>
                  <TrendingUp size={18} color="#16a34a" />
                  <p style={{ color: '#166534', fontWeight: 500, margin: 0, fontSize: 13 }}>
                    {result.summary}
                  </p>
                </div>
              )}

              {result.columns.length > 0 && result.data.length > 0 && (
                <div style={{
                  backgroundColor: '#fff',
                  borderRadius: 16,
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: 13,
                    }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          {result.columns.map(col => (
                            <th
                              key={col.key}
                              style={{
                                textAlign: isNumericColumn(col) ? 'right' : 'left',
                                padding: '12px 16px',
                                fontWeight: 700,
                                fontSize: 11,
                                color: '#64748b',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: isNumericColumn(col) ? 'flex-end' : 'flex-start' }}>
                                {typeIconMap[col.type] || null}
                                {col.label}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.data.map((row: any, i: number) => (
                          <tr
                            key={i}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              backgroundColor: i % 2 === 0 ? '#fff' : '#fafbfc',
                              transition: 'background-color 0.1s',
                            }}
                          >
                            {result.columns.map(col => (
                              <td
                                key={col.key}
                                style={{
                                  textAlign: isNumericColumn(col) ? 'right' : 'left',
                                  padding: '10px 16px',
                                  fontWeight: isNumericColumn(col) ? 600 : 400,
                                  color: '#0f172a',
                                  fontVariantNumeric: isNumericColumn(col) ? 'tabular-nums' : 'normal',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {formatCellValue(row[col.key], col.type)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                      {columnTotals && (
                        <tfoot>
                          <tr style={{ borderTop: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                            {result.columns.map(col => (
                              <td
                                key={col.key}
                                style={{
                                  textAlign: isNumericColumn(col) ? 'right' : 'left',
                                  padding: '12px 16px',
                                  fontWeight: 700,
                                  color: '#0f172a',
                                  fontSize: 13,
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                {isNumericColumn(col) ? formatCellValue(columnTotals[col.key], col.type) : col.key === result.columns[0].key ? 'Total' : ''}
                              </td>
                            ))}
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                  <div style={{
                    padding: '10px 16px',
                    borderTop: '1px solid #f1f5f9',
                    fontSize: 11,
                    color: '#94a3b8',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}>
                    <span>{result.data.length} row(s)</span>
                    <span>{result.type.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              )}

              {result.data.length === 0 && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '60px 20px',
                  backgroundColor: '#fff',
                  borderRadius: 16,
                  border: '1px solid #e2e8f0',
                  color: '#94a3b8',
                }}>
                  <Search size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                  <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: '#64748b' }}>
                    No results found
                  </p>
                  <p style={{ fontSize: 12, margin: '4px 0 0' }}>
                    {result.summary}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NaturalLanguageReporting;
