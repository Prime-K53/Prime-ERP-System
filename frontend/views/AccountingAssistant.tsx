import React, { useState, useMemo } from 'react';
import {
  Tags, Banknote, FilePen, HeartPulse, CheckCircle2, XCircle,
  Sparkles, ArrowRight, AlertTriangle, Loader2, RefreshCw,
  ChevronRight, AlertCircle, BrainCircuit
} from 'lucide-react';
import {
  autoCategorizeExpense, matchBankTransaction, suggestJournalEntry,
  detectAccountingInconsistencies, suggestCorrection
} from '../services/accountingAssistantService';
import { useApp } from '../context/AppContext';
import { useSales } from '../context/SalesContext';
import { useFinance } from '../context/FinanceContext';
import { format } from 'date-fns';

type Tab = 'expense' | 'reconciliation' | 'journal' | 'health';

interface TabConfig {
  key: Tab;
  label: string;
  icon: React.FC<{ size?: number }>;
  desc: string;
  color: string;
}

const TABS: TabConfig[] = [
  { key: 'expense', label: 'Expense Categorizer', icon: Tags, desc: 'Auto-classify uncategorized expenses', color: '#8b5cf6' },
  { key: 'reconciliation', label: 'Bank Reconciliation', icon: Banknote, desc: 'Match transactions to records', color: '#06b6d4' },
  { key: 'journal', label: 'Journal Suggestions', icon: FilePen, desc: 'AI-powered entry suggestions', color: '#f59e0b' },
  { key: 'health', label: 'Accounting Health', icon: HeartPulse, desc: 'Detect ledger inconsistencies', color: '#10b981' },
];

const AccountingAssistant: React.FC = () => {
  const { notify } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('expense');
  const [loading, setLoading] = useState(false);

  const { sales, fetchSalesData } = useSales();
  const { invoices, expenses: allExpenses, ledger, accounts, fetchFinanceData } = useFinance();
  const [payments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);

  const [journalDesc, setJournalDesc] = useState('');
  const [journalAmount, setJournalAmount] = useState('');
  const [journalSuggestions, setJournalSuggestions] = useState<any[]>([]);
  const [inconsistencies, setInconsistencies] = useState<any[]>([]);

  React.useEffect(() => {
    if (allExpenses?.length > 0) setExpenses(allExpenses);
  }, [allExpenses]);

  React.useEffect(() => {
    if (ledger.length > 0 || accounts.length > 0) {
      setInconsistencies(detectAccountingInconsistencies(ledger, accounts));
    }
  }, [ledger, accounts]);

  const uncategorizedExpenses = useMemo(() => {
    return expenses.filter(e => !e.category || e.category === 'Uncategorized' || e.category === 'General');
  }, [expenses]);

  const categorizedExpenses = useMemo(() => {
    return uncategorizedExpenses.map(exp => {
      const suggestion = autoCategorizeExpense(exp);
      return { ...exp, suggestion };
    });
  }, [uncategorizedExpenses]);

  const bankTransactions = useMemo(() => {
    const txns: any[] = [];
    for (const p of payments.slice(0, 30)) {
      txns.push({
        id: `bank-${p.id}`,
        description: p.reference || p.description || `Payment ${p.id}`,
        amount: p.amount || 0,
        date: p.date || new Date().toISOString(),
      });
    }
    for (const s of sales.slice(0, 30)) {
      if (txns.length >= 60) break;
      txns.push({
        id: `bank-sale-${s.id}`,
        description: `Sale: ${s.customerName || s.id}`,
        amount: s.totalAmount || s.total || 0,
        date: s.date || s.saleDate || new Date().toISOString(),
      });
    }
    return txns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 50);
  }, [payments, sales]);

  const matchedTransactions = useMemo(() => {
    return bankTransactions.map(tx => {
      const result = matchBankTransaction(tx, { invoices, expenses, payments, sales });
      return { ...tx, matchResult: result };
    });
  }, [bankTransactions, invoices, expenses, payments, sales]);

  const handleAcceptCategory = (expenseId: string) => {
    setExpenses(prev => prev.map(e =>
      e.id === expenseId ? { ...e, category: e.suggestion?.category || e.category } : e
    ));
    notify('Category accepted', 'success');
  };

  const handleRejectCategory = (expenseId: string) => {
    setExpenses(prev => prev.map(e =>
      e.id === expenseId ? { ...e, category: 'Uncategorized' } : e
    ));
  };

  const handleSuggestJournal = () => {
    const amount = parseFloat(journalAmount);
    if (!journalDesc.trim() || isNaN(amount) || amount <= 0) {
      notify('Enter a valid description and amount', 'warning');
      return;
    }
    setJournalSuggestions(suggestJournalEntry(journalDesc, amount));
  };

  const handleApplyJournal = (suggestion: any) => {
    notify(`Applied: ${suggestion.description}`, 'success');
    setJournalSuggestions(prev => prev.filter(s => s !== suggestion));
  };

  const handleFixInconsistency = (issue: any) => {
    const correction = suggestCorrection(issue);
    notify(correction.description, 'info');
  };

  const matchedCount = matchedTransactions.filter(t => t.matchResult?.match).length;
  const highSeverityCount = inconsistencies.filter(i => i.severity === 'high').length;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f0f4f8' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={36} className="animate-spin" style={{ color: '#6366f1' }} />
          <p style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: '#64748b' }}>Loading Accounting Assistant...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0f4f8 0%, #eef2ff 100%)',
      padding: '20px',
      fontFamily: "'Inter', -apple-system, sans-serif",
      color: '#1e293b',
    }}>
      <div style={{
        maxWidth: 1520,
        width: '100%',
        margin: '0 auto',
        display: 'flex',
        gap: 16,
        alignItems: 'stretch',
      }}>
        <div style={{
          width: 280,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
            borderRadius: 16,
            padding: '20px 18px',
            color: '#fff',
            boxShadow: '0 8px 32px rgba(15,23,42,0.12)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
              }}>
                <BrainCircuit size={18} />
              </div>
              <div>
                <h1 style={{ fontSize: 15, fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>Accounting</h1>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', margin: 0, letterSpacing: '0.05em', textTransform: 'uppercase' }}>AI Assistant</p>
              </div>
            </div>
            <button
              onClick={() => { fetchSalesData(); fetchFinanceData(); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%',
                padding: '8px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.06)', color: '#cbd5e1', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            >
              <RefreshCw size={13} /> Refresh Data
            </button>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.75)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.6)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            padding: '10px',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}>
            {TABS.map(tab => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: isActive ? '#fff' : 'transparent',
                    boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'all 0.15s',
                    marginBottom: 2,
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: isActive ? `${tab.color}15` : '#f1f5f9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <tab.icon size={15} color={isActive ? tab.color : '#94a3b8'} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: isActive ? 700 : 600,
                      color: isActive ? '#0f172a' : '#475569',
                    }}>{tab.label}</div>
                    <div style={{
                      fontSize: 10, color: '#94a3b8', marginTop: 1,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{tab.desc}</div>
                  </div>
                  {isActive && <ChevronRight size={14} color={tab.color} />}
                </button>
              );
            })}
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
          }}>
            <div style={{
              background: 'rgba(255,255,255,0.75)',
              backdropFilter: 'blur(12px)',
              borderRadius: 12, padding: '12px',
              border: '1px solid rgba(255,255,255,0.6)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#8b5cf6', marginTop: 4 }}>{categorizedExpenses.length}</div>
              <div style={{ fontSize: 9, color: '#94a3b8' }}>categories</div>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.75)',
              backdropFilter: 'blur(12px)',
              borderRadius: 12, padding: '12px',
              border: '1px solid rgba(255,255,255,0.6)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Matched</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#06b6d4', marginTop: 4 }}>{matchedCount}</div>
              <div style={{ fontSize: 9, color: '#94a3b8' }}>transactions</div>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.75)',
              backdropFilter: 'blur(12px)',
              borderRadius: 12, padding: '12px',
              border: '1px solid rgba(255,255,255,0.6)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Issues</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: highSeverityCount > 0 ? '#dc2626' : '#10b981', marginTop: 4 }}>{inconsistencies.length}</div>
              <div style={{ fontSize: 9, color: '#94a3b8' }}>{highSeverityCount > 0 ? `${highSeverityCount} critical` : 'all clear'}</div>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.75)',
              backdropFilter: 'blur(12px)',
              borderRadius: 12, padding: '12px',
              border: '1px solid rgba(255,255,255,0.6)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unmatched</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>{bankTransactions.length - matchedCount}</div>
              <div style={{ fontSize: 9, color: '#94a3b8' }}>to reconcile</div>
            </div>
          </div>
        </div>

        <div style={{
          flex: 1,
          minWidth: 0,
          background: 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.6)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          padding: '24px',
          overflow: 'auto',
        }}>
          {activeTab === 'expense' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>Expense Categorizer</h2>
                  <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                    Auto-classify {categorizedExpenses.length} uncategorized expense{categorizedExpenses.length !== 1 ? 's' : ''}
                  </p>
                </div>
                {categorizedExpenses.length > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', backgroundColor: '#f5f3ff', padding: '4px 12px', borderRadius: 8 }}>
                    {categorizedExpenses.length} pending
                  </span>
                )}
              </div>
              {categorizedExpenses.length > 0 ? (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Description</th>
                          <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Amount</th>
                          <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Suggested Category</th>
                          <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Confidence</th>
                          <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categorizedExpenses.map(exp => (
                          <tr key={exp.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.1s' }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fafbfc'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {exp.description || exp.name || `Expense ${exp.id}`}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                              ${(exp.amount || 0).toFixed(2)}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#7c3aed', backgroundColor: '#f5f3ff', padding: '3px 10px', borderRadius: 6 }}>
                                {exp.suggestion?.category || 'General'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <span style={{
                                fontSize: 12, fontWeight: 700,
                                color: (exp.suggestion?.confidence || 0) >= 0.7 ? '#16a34a' : (exp.suggestion?.confidence || 0) >= 0.4 ? '#b45309' : '#dc2626',
                              }}>
                                {((exp.suggestion?.confidence || 0) * 100).toFixed(0)}%
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                                <button onClick={() => handleAcceptCategory(exp.id)} style={{
                                  padding: '5px 10px', borderRadius: 8, border: 'none', backgroundColor: '#f0fdf4', color: '#16a34a',
                                  cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4,
                                  transition: 'all 0.1s',
                                }}
                                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#dcfce7'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f0fdf4'; e.currentTarget.style.transform = 'scale(1)'; }}
                                >
                                  <CheckCircle2 size={12} /> Accept
                                </button>
                                <button onClick={() => handleRejectCategory(exp.id)} style={{
                                  padding: '5px 10px', borderRadius: 8, border: 'none', backgroundColor: '#fef2f2', color: '#dc2626',
                                  cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4,
                                  transition: 'all 0.1s',
                                }}
                                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fee2e2'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#fef2f2'; e.currentTarget.style.transform = 'scale(1)'; }}
                                >
                                  <XCircle size={12} /> Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '60px 0', textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <CheckCircle2 size={28} color="#16a34a" />
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>All expenses are categorized</p>
                  <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>No uncategorized expenses found.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'reconciliation' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>Bank Reconciliation</h2>
                  <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                    {matchedCount} matched, {bankTransactions.length - matchedCount} unmatched out of {bankTransactions.length} transactions
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', backgroundColor: '#f0fdf4', padding: '4px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={12} /> {matchedCount} matched
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', backgroundColor: '#fef2f2', padding: '4px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertCircle size={12} /> {bankTransactions.length - matchedCount} unmatched
                  </span>
                </div>
              </div>
              {matchedTransactions.length > 0 ? (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Description</th>
                          <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Amount</th>
                          <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date</th>
                          <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                          <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Match Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matchedTransactions.map(tx => (
                          <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fafbfc'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {tx.description}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                              ${(tx.amount || 0).toFixed(2)}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 12, color: '#64748b' }}>
                              {tx.date ? format(new Date(tx.date), 'MMM dd, yyyy') : '-'}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              {tx.matchResult?.match ? (
                                <span style={{ fontSize: 10, fontWeight: 700, backgroundColor: '#f0fdf4', color: '#16a34a', padding: '3px 10px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <CheckCircle2 size={10} /> Matched
                                </span>
                              ) : (
                                <span style={{ fontSize: 10, fontWeight: 700, backgroundColor: '#fef2f2', color: '#dc2626', padding: '3px 10px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <XCircle size={10} /> Unmatched
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 12, color: '#475569' }}>
                              {tx.matchResult?.match ? (
                                <span style={{ fontWeight: 600, color: '#16a34a' }}>
                                  {tx.matchResult.matchedTo?.type}: {tx.matchResult.matchedTo?.name || tx.matchResult.matchedTo?.id}
                                  {' '}({(tx.matchResult.confidence * 100).toFixed(0)}%)
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>{tx.matchResult?.reason || 'No match found'}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '60px 0', textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <Banknote size={28} color="#94a3b8" />
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>No bank transactions available</p>
                  <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Add payments or sales to see reconciliation suggestions.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'journal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px' }}>
                  Describe Your Journal Entry
                </h3>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 2, minWidth: 200 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6, display: 'block' }}>Description</label>
                    <input
                      type="text"
                      value={journalDesc}
                      onChange={e => setJournalDesc(e.target.value)}
                      placeholder="e.g. Paid salary for March, Purchased equipment..."
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0',
                        fontSize: 13, fontWeight: 500, color: '#1e293b', outline: 'none',
                        backgroundColor: '#fff', boxSizing: 'border-box',
                        transition: 'border-color 0.15s',
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = '#6366f1'}
                      onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6, display: 'block' }}>Amount</label>
                    <input
                      type="number"
                      value={journalAmount}
                      onChange={e => setJournalAmount(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0',
                        fontSize: 13, fontWeight: 500, color: '#1e293b', outline: 'none',
                        backgroundColor: '#fff', boxSizing: 'border-box',
                        transition: 'border-color 0.15s',
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = '#6366f1'}
                      onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                    />
                  </div>
                  <button
                    onClick={handleSuggestJournal}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px',
                      borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(99,102,241,0.25)',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(99,102,241,0.35)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(99,102,241,0.25)'; }}
                  >
                    <Sparkles size={16} /> Get Suggestions
                  </button>
                </div>
              </div>

              {journalSuggestions.length > 0 && (
                <div style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                      Suggested Journal Entries
                    </h3>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', backgroundColor: '#fffbeb', padding: '3px 10px', borderRadius: 6 }}>
                      {journalSuggestions.length} suggestions
                    </span>
                  </div>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Account</th>
                          <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Type</th>
                          <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Amount</th>
                          <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Confidence</th>
                          <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {journalSuggestions.map((s, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>{s.description}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', backgroundColor: '#eef2ff', padding: '3px 10px', borderRadius: 6 }}>
                                Dr: {s.debitAccountId} / Cr: {s.creditAccountId}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                              ${parseFloat(journalAmount || '0').toFixed(2)}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <span style={{
                                fontSize: 12, fontWeight: 700,
                                color: s.confidence >= 0.7 ? '#16a34a' : s.confidence >= 0.4 ? '#b45309' : '#dc2626',
                              }}>
                                {(s.confidence * 100).toFixed(0)}%
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <button
                                onClick={() => handleApplyJournal(s)}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  padding: '5px 12px', borderRadius: 8, border: 'none',
                                  backgroundColor: '#f0fdf4', color: '#16a34a',
                                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                  transition: 'all 0.1s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#dcfce7'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f0fdf4'; e.currentTarget.style.transform = 'scale(1)'; }}
                              >
                                <CheckCircle2 size={12} /> Apply
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {journalSuggestions.length === 0 && journalDesc.trim() && (
                <div style={{ padding: '60px 0', textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <FilePen size={28} color="#94a3b8" />
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>Enter details and get suggestions</p>
                  <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Provide a description and amount, then click Get Suggestions.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'health' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>Accounting Health</h2>
                  <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                    {inconsistencies.length > 0
                      ? `${inconsistencies.length} issue${inconsistencies.length !== 1 ? 's' : ''} detected in your ledger`
                      : 'Your books are healthy — no inconsistencies found'}
                  </p>
                </div>
                {inconsistencies.length > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: highSeverityCount > 0 ? '#dc2626' : '#b45309', backgroundColor: highSeverityCount > 0 ? '#fef2f2' : '#fffbeb', padding: '4px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={12} /> {inconsistencies.length} issues
                  </span>
                )}
              </div>
              {inconsistencies.length > 0 ? (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Issue</th>
                          <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Severity</th>
                          <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Detail</th>
                          <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Recommendation</th>
                          <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inconsistencies.map((issue, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fafbfc'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a', textTransform: 'capitalize' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                                  backgroundColor: issue.severity === 'high' ? '#dc2626' : issue.severity === 'medium' ? '#b45309' : '#16a34a',
                                }} />
                                {issue.type.replace(/_/g, ' ')}
                              </div>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              {(() => {
                                const styles: Record<string, { bg: string; color: string; label: string }> = {
                                  high: { bg: '#fef2f2', color: '#dc2626', label: 'High' },
                                  medium: { bg: '#fffbeb', color: '#b45309', label: 'Medium' },
                                  low: { bg: '#f0fdf4', color: '#16a34a', label: 'Low' },
                                };
                                const s = styles[issue.severity] || styles.low;
                                return (
                                  <span style={{ fontSize: 10, fontWeight: 700, backgroundColor: s.bg, color: s.color, padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                    {s.label}
                                  </span>
                                );
                              })()}
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 12, color: '#475569', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {issue.detail}
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 12, color: '#475569', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {issue.recommendation}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <button
                                onClick={() => handleFixInconsistency(issue)}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  padding: '5px 12px', borderRadius: 8, border: 'none',
                                  backgroundColor: '#eef2ff', color: '#4f46e5',
                                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                  transition: 'all 0.1s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#e0e7ff'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#eef2ff'; e.currentTarget.style.transform = 'scale(1)'; }}
                              >
                                <ArrowRight size={12} /> Fix
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '60px 0', textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <HeartPulse size={28} color="#16a34a" />
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>No inconsistencies detected</p>
                  <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Your books are healthy and balanced.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountingAssistant;
