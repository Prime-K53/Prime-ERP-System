import React, { useState, useMemo } from 'react';
import {
  Tags, Banknote, FilePen, HeartPulse, CheckCircle2, XCircle,
  Sparkles, ArrowRight, AlertTriangle, Loader2, RefreshCw,
  ChevronDown, Search, Calendar, DollarSign, FileText, Building2
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

const TABS: { key: Tab; label: string; icon: React.FC<{ size?: number }> }[] = [
  { key: 'expense', label: 'Expense Categorizer', icon: Tags },
  { key: 'reconciliation', label: 'Bank Reconciliation', icon: Banknote },
  { key: 'journal', label: 'Journal Entry Suggestions', icon: FilePen },
  { key: 'health', label: 'Accounting Health', icon: HeartPulse },
];

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: 12,
  padding: '20px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  border: '1px solid #e2e8f0',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const cardHeaderStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#64748b',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  marginBottom: 4,
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  fontWeight: 700,
  color: '#64748b',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '1px solid #f1f5f9',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid #f1f5f9',
  color: '#1e293b',
  fontWeight: 500,
  fontSize: 12,
};

const AccountingAssistant: React.FC = () => {
  const { notify } = useApp();

  const [activeTab, setActiveTab] = useState<Tab>('expense');
  const [loading, setLoading] = useState(false);

  const { sales, fetchSalesData } = useSales();
  const { invoices, expenses: allExpenses, ledger, accounts, fetchFinanceData } = useFinance();
  const [payments, setPayments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);

  const [journalDesc, setJournalDesc] = useState('');
  const [journalAmount, setJournalAmount] = useState('');
  const [journalSuggestions, setJournalSuggestions] = useState<any[]>([]);
  const [inconsistencies, setInconsistencies] = useState<any[]>([]);

  React.useEffect(() => {
    if (allExpenses?.length > 0) {
      setExpenses(allExpenses);
    }
  }, [allExpenses]);

  React.useEffect(() => {
    if (ledger.length > 0 || accounts.length > 0) {
      const issues = detectAccountingInconsistencies(ledger, accounts);
      setInconsistencies(issues);
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
    const suggestions = suggestJournalEntry(journalDesc, amount);
    setJournalSuggestions(suggestions);
  };

  const handleApplyJournal = (suggestion: any) => {
    notify(`Applied: ${suggestion.description}`, 'success');
    setJournalSuggestions(prev => prev.filter(s => s !== suggestion));
  };

  const handleFixInconsistency = (issue: any) => {
    const correction = suggestCorrection(issue);
    notify(correction.description, 'info');
  };

  const severityBadge = (severity: string) => {
    const styles: Record<string, { bg: string; color: string; label: string }> = {
      high: { bg: '#fef2f2', color: '#dc2626', label: 'High' },
      medium: { bg: '#fffbeb', color: '#b45309', label: 'Medium' },
      low: { bg: '#f0fdf4', color: '#16a34a', label: 'Low' },
    };
    const s = styles[severity] || styles.low;
    return (
      <span style={{ fontSize: 10, fontWeight: 700, backgroundColor: s.bg, color: s.color, padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {s.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: '#6366f1' }} />
      </div>
    );
  }

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-4 duration-700"
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        padding: '24px',
        fontFamily: "'Inter', -apple-system, sans-serif",
        color: '#1e293b',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          border: '1px solid #e2e8f0',
          maxWidth: 1520,
          width: '100%',
          margin: '0 auto',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 24px',
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>
              Accounting Assistant
            </h1>
          </div>
          <button
            onClick={() => { fetchSalesData(); fetchFinanceData(); }}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8,
              border: '1px solid #E2E8F0', backgroundColor: '#fff',
              fontSize: 12, fontWeight: 600, color: '#475569',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div
          style={{
            display: 'flex', gap: 0, padding: '0 24px',
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff',
          }}
        >
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '12px 20px',
                fontSize: 13, fontWeight: 700,
                color: activeTab === tab.key ? '#4f46e5' : '#64748b',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid #4f46e5' : '2px solid transparent',
                cursor: 'pointer', transition: 'all 0.15s',
                marginBottom: -1,
              }}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '24px 32px' }}>
          {activeTab === 'expense' && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={cardHeaderStyle}>Uncategorized Expenses</div>
                {categorizedExpenses.length > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', backgroundColor: '#eef2ff', padding: '2px 8px', borderRadius: 6 }}>
                    {categorizedExpenses.length} pending
                  </span>
                )}
              </div>
              {categorizedExpenses.length > 0 ? (
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Description</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Suggested Category</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Confidence</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categorizedExpenses.map(exp => (
                      <tr key={exp.id} style={{ transition: 'background-color 0.1s' }}>
                        <td style={{ ...tdStyle, fontWeight: 600, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {exp.description || exp.name || `Expense ${exp.id}`}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>${(exp.amount || 0).toFixed(2)}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#4f46e5', backgroundColor: '#eef2ff', padding: '2px 8px', borderRadius: 4 }}>
                            {exp.suggestion?.category || 'General'}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700,
                            color: (exp.suggestion?.confidence || 0) >= 0.7 ? '#16a34a' : (exp.suggestion?.confidence || 0) >= 0.4 ? '#b45309' : '#dc2626',
                          }}>
                            {((exp.suggestion?.confidence || 0) * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                            <button
                              onClick={() => handleAcceptCategory(exp.id)}
                              style={{ padding: '4px 8px', borderRadius: 6, border: 'none', backgroundColor: '#ecfdf5', color: '#16a34a', cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              <CheckCircle2 size={12} /> Accept
                            </button>
                            <button
                              onClick={() => handleRejectCategory(exp.id)}
                              style={{ padding: '4px 8px', borderRadius: 6, border: 'none', backgroundColor: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              <XCircle size={12} /> Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>
                  <Tags size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                  <p style={{ margin: 0 }}>All expenses are categorized.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'reconciliation' && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={cardHeaderStyle}>Bank Transactions</div>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', backgroundColor: '#eef2ff', padding: '2px 8px', borderRadius: 6 }}>
                  {matchedTransactions.length} transactions
                </span>
              </div>
              {matchedTransactions.length > 0 ? (
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Description</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Date</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
                      <th style={thStyle}>Match Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchedTransactions.map(tx => (
                      <tr key={tx.id} style={{ transition: 'background-color 0.1s' }}>
                        <td style={{ ...tdStyle, fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tx.description}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>${(tx.amount || 0).toFixed(2)}</td>
                        <td style={{ ...tdStyle, textAlign: 'center', fontSize: 11, color: '#64748b' }}>
                          {tx.date ? format(new Date(tx.date), 'MMM dd, yyyy') : '-'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {tx.matchResult?.match ? (
                            <span style={{ fontSize: 10, fontWeight: 700, backgroundColor: '#ecfdf5', color: '#16a34a', padding: '2px 8px', borderRadius: 6 }}>
                              Matched
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, fontWeight: 700, backgroundColor: '#fef2f2', color: '#dc2626', padding: '2px 8px', borderRadius: 6 }}>
                              Unmatched
                            </span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, fontSize: 11, color: '#475569' }}>
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
              ) : (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>
                  <Banknote size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                  <p style={{ margin: 0 }}>No bank transactions available.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'journal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={cardStyle}>
                <div style={cardHeaderStyle}>Describe Your Journal Entry</div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 2, minWidth: 200 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, display: 'block' }}>Description</label>
                    <input
                      type="text"
                      value={journalDesc}
                      onChange={e => setJournalDesc(e.target.value)}
                      placeholder="e.g. Paid salary for March, Purchased equipment..."
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid #E2E8F0',
                        fontSize: 13, fontWeight: 500, color: '#1e293b', outline: 'none',
                        backgroundColor: '#fff', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, display: 'block' }}>Amount</label>
                    <input
                      type="number"
                      value={journalAmount}
                      onChange={e => setJournalAmount(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid #E2E8F0',
                        fontSize: 13, fontWeight: 500, color: '#1e293b', outline: 'none',
                        backgroundColor: '#fff', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <button
                    onClick={handleSuggestJournal}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px',
                      borderRadius: 12, border: 'none', backgroundColor: '#4f46e5', color: '#fff',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Sparkles size={16} /> Get Suggestions
                  </button>
                </div>
              </div>

              {journalSuggestions.length > 0 && (
                <div style={cardStyle}>
                  <div style={cardHeaderStyle}>Suggested Journal Entries</div>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Account</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>Type</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>Confidence</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {journalSuggestions.map((s, i) => (
                        <tr key={i}>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{s.description}</td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#6366f1' }}>
                              Dr: {s.debitAccountId} / Cr: {s.creditAccountId}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>
                            ${parseFloat(journalAmount || '0').toFixed(2)}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <span style={{
                              fontSize: 11, fontWeight: 700,
                              color: s.confidence >= 0.7 ? '#16a34a' : s.confidence >= 0.4 ? '#b45309' : '#dc2626',
                            }}>
                              {(s.confidence * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <button
                              onClick={() => handleApplyJournal(s)}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '4px 12px', borderRadius: 6, border: 'none',
                                backgroundColor: '#ecfdf5', color: '#16a34a',
                                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                              }}
                            >
                              <CheckCircle2 size={12} /> Apply
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {journalSuggestions.length === 0 && journalDesc.trim() && (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: 13, fontWeight: 600, ...cardStyle }}>
                  <FilePen size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                  <p style={{ margin: 0 }}>Enter a description and amount, then click Get Suggestions.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'health' && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={cardHeaderStyle}>Detected Inconsistencies</div>
                {inconsistencies.length > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', backgroundColor: '#fef2f2', padding: '2px 8px', borderRadius: 6 }}>
                    {inconsistencies.length} issues
                  </span>
                )}
              </div>
              {inconsistencies.length > 0 ? (
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Issue</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Severity</th>
                      <th style={thStyle}>Detail</th>
                      <th style={thStyle}>Recommendation</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inconsistencies.map((issue, i) => (
                      <tr key={i}>
                        <td style={{ ...tdStyle, fontWeight: 600, textTransform: 'capitalize' }}>
                          {issue.type.replace(/_/g, ' ')}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{severityBadge(issue.severity)}</td>
                        <td style={{ ...tdStyle, fontSize: 11, color: '#475569', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {issue.detail}
                        </td>
                        <td style={{ ...tdStyle, fontSize: 11, color: '#475569', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {issue.recommendation}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <button
                            onClick={() => handleFixInconsistency(issue)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '4px 10px', borderRadius: 6, border: 'none',
                              backgroundColor: '#eef2ff', color: '#4f46e5',
                              fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            }}
                          >
                            <ArrowRight size={12} /> Fix
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>
                  <HeartPulse size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                  <p style={{ margin: 0 }}>No inconsistencies detected. Your books are healthy!</p>
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
