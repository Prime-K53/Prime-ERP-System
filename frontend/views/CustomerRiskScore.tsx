import React, { useState, useMemo } from 'react';
import { logger } from '@/services/logger';
import {
  Users, Shield, AlertTriangle, ChevronDown, ChevronUp,
  Loader2, DollarSign, Calendar, ShoppingCart, TrendingUp,
  TrendingDown, CreditCard, RotateCcw, Search, X,
  BarChart3, Activity, Clock, Star
} from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { useFinance } from '../context/FinanceContext';
import {
  calculateCustomerRiskScore, classifyRiskCategory,
  getCustomerPaymentHistory, getCustomerPurchaseFrequency,
  getCustomerAverageOrderValue, getCustomerCreditUsage, getCustomerReturnRate
} from '../services/customerRiskService';
import { formatCurrency } from '../services/reportSummaryService';

const toSafeNumber = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const CustomerRiskScore: React.FC = () => {
  const { sales, customers } = useSales();
  const { invoices, customerPayments: payments } = useFinance();
  const [loading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  const customerScores = useMemo(() => {
    return (customers || []).map((customer) => {
      const id = customer.id || customer.customerId || '';
      return calculateCustomerRiskScore(
        customer,
        (invoices || []).filter((i: any) => (i.customerId || i.customer_id) === id),
        (payments || []).filter((p: any) => (p.customerId || p.customer_id) === id),
        (sales || []).filter((s: any) => (s.customerId || s.customer_id) === id)
      );
    });
  }, [customers, invoices, payments, sales]);

  const filteredScores = useMemo(() => {
    let result = customerScores;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => s.customerName.toLowerCase().includes(q));
    }
    if (categoryFilter !== 'All') {
      result = result.filter((s) => s.category === categoryFilter);
    }
    return result;
  }, [customerScores, searchQuery, categoryFilter]);

  const categoryCounts = useMemo(() => {
    const counts = { Low: 0, Medium: 0, High: 0 };
    customerScores.forEach((s) => {
      if (s.category === 'Low') counts.Low++;
      else if (s.category === 'Medium') counts.Medium++;
      else if (s.category === 'High') counts.High++;
    });
    return counts;
  }, [customerScores]);

  const getScoreColor = (score: number) => {
    if (score >= 71) return '#16a34a';
    if (score >= 41) return '#f59e0b';
    return '#dc2626';
  };

  const getCategoryBadge = (category: string) => {
    const styles: Record<string, { bg: string; text: string }> = {
      Low: { bg: '#dcfce7', text: '#16a34a' },
      Medium: { bg: '#fef3c7', text: '#f59e0b' },
      High: { bg: '#fce4ec', text: '#dc2626' },
    };
    const s = styles[category] || styles.Medium;
    return (
      <span style={{ display: 'inline-flex', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: s.bg, color: s.text }}>
        {category}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 40 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#6366f1' }} />
          <p style={{ color: '#64748b', fontSize: 14, fontWeight: 500 }}>Analyzing customer risk profiles...</p>
        </div>
      </div>
    );
  }

  const detail = selectedCustomer ? customerScores.find(
    (s) => (s.customerId || '') === (selectedCustomer.id || selectedCustomer.customerId || '')
  ) : null;

  return (
    <div style={{ padding: 24, background: '#f0f4f8', minHeight: '100vh' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Customer Risk Score</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Analyze customer payment behavior and risk profiles</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14, borderLeft: '3px solid #16a34a' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Shield size={18} color="#16a34a" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: 2 }}>Low Risk</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{categoryCounts.Low}</div>
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14, borderLeft: '3px solid #f59e0b' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle size={18} color="#f59e0b" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: 2 }}>Medium Risk</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{categoryCounts.Medium}</div>
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14, borderLeft: '3px solid #dc2626' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fce4ec', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle size={18} color="#dc2626" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: 2 }}>High Risk</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#dc2626', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{categoryCounts.High}</div>
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14, borderLeft: '3px solid #6366f1' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users size={18} color="#6366f1" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: 2 }}>Total Customers</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{customers.length}</div>
          </div>
        </div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid rgba(255,255,255,0.6)', overflow: 'hidden' }}>
        <div style={{ padding: 16, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={14} />
              </button>
            )}
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', background: 'white' }}
          >
            <option value="All">All Categories</option>
            <option value="Low">Low Risk</option>
            <option value="Medium">Medium Risk</option>
            <option value="High">High Risk</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #f1f5f9' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Risk Score</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Spent</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Outstanding</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', color: '#64748b', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredScores.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No customers found</td></tr>
              )}
              {filteredScores.map((score) => (
                <tr
                  key={score.customerId}
                  onClick={() => setSelectedCustomer(customers.find((c: any) => (c.id || c.customerId) === score.customerId))}
                  style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: selectedCustomer?.id === score.customerId ? '#f0f9ff' : undefined }}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>{score.customerName}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, maxWidth: 100, height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${score.score}%`, background: getScoreColor(score.score), borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: getScoreColor(score.score) }}>{score.score}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>{getCategoryBadge(score.category)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                    {formatCurrency(score.factors?.find((f) => f.name === 'Average Order Value')?.impact || 0)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>
                    {formatCurrency(score.factors?.find((f) => f.name === 'Credit Usage')?.impact || 0)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCustomer(selectedCustomer?.id === score.customerId ? null : customers.find((c: any) => (c.id || c.customerId) === score.customerId));
                      }}
                      style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', fontSize: 11, fontWeight: 600, color: '#6366f1', cursor: 'pointer' }}
                    >
                      {selectedCustomer?.id === score.customerId ? 'Close' : 'Details'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCustomer && detail && (() => {
        const cId = selectedCustomer.id || selectedCustomer.customerId || '';
        const paymentHistory = getCustomerPaymentHistory(cId, invoices, payments);
        const purchaseFrequency = getCustomerPurchaseFrequency(cId, sales);
        const avgOrderValue = getCustomerAverageOrderValue(cId, sales, invoices);
        const creditUsage = getCustomerCreditUsage(cId, invoices);
        const returnRate = getCustomerReturnRate(cId, sales);

        return (
          <div style={{ marginTop: 24, background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid rgba(255,255,255,0.6)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{detail.customerName} — Risk Detail</h2>
              <span style={{ fontSize: 36, fontWeight: 900, color: getScoreColor(detail.score) }}>{detail.score}<span style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8' }}>/100</span></span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 20 }}>
              <div style={{ padding: 16, borderRadius: 12, background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Clock size={14} color="#6366f1" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Payment History</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div><span style={{ fontSize: 11, color: '#94a3b8' }}>On Time</span><p style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>{paymentHistory.onTime}</p></div>
                  <div><span style={{ fontSize: 11, color: '#94a3b8' }}>Late</span><p style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b' }}>{paymentHistory.late}</p></div>
                  <div><span style={{ fontSize: 11, color: '#94a3b8' }}>Missed</span><p style={{ fontSize: 18, fontWeight: 800, color: '#dc2626' }}>{paymentHistory.missed}</p></div>
                </div>
                <p style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>Avg payment: {paymentHistory.averagePaymentDays} days</p>
              </div>

              <div style={{ padding: 16, borderRadius: 12, background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <ShoppingCart size={14} color="#6366f1" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Purchase Frequency</span>
                </div>
                <p style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{purchaseFrequency.totalOrders} <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>orders</span></p>
                <p style={{ fontSize: 12, color: '#64748b' }}>Every {purchaseFrequency.frequencyDays} days</p>
                <p style={{ fontSize: 12, color: purchaseFrequency.trend === 'increasing' ? '#16a34a' : purchaseFrequency.trend === 'declining' ? '#dc2626' : '#64748b' }}>
                  Trend: {purchaseFrequency.trend}
                </p>
              </div>

              <div style={{ padding: 16, borderRadius: 12, background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <DollarSign size={14} color="#6366f1" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Avg Order Value</span>
                </div>
                <p style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{formatCurrency(avgOrderValue.averageValue)}</p>
                <p style={{ fontSize: 12, color: avgOrderValue.trend === 'rising' ? '#16a34a' : avgOrderValue.trend === 'falling' ? '#dc2626' : '#64748b' }}>
                  <TrendingUp size={12} style={{ display: 'inline' }} /> {avgOrderValue.trend}
                </p>
              </div>

              <div style={{ padding: 16, borderRadius: 12, background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <CreditCard size={14} color="#6366f1" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Credit Usage</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(creditUsage.utilizationPercent, 100)}%`, background: creditUsage.utilizationPercent > 80 ? '#dc2626' : creditUsage.utilizationPercent > 50 ? '#f59e0b' : '#16a34a', borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{creditUsage.utilizationPercent.toFixed(0)}%</span>
                </div>
                <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{formatCurrency(creditUsage.overdueAmount)} overdue</p>
              </div>

              <div style={{ padding: 16, borderRadius: 12, background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <RotateCcw size={14} color="#6366f1" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Return Rate</span>
                </div>
                <p style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{returnRate.totalReturns} <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>returns</span></p>
                <p style={{ fontSize: 12, color: '#64748b' }}>{returnRate.returnRate.toFixed(1)}% rate</p>
              </div>
            </div>

            {detail.factors && detail.factors.length > 0 && (
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Risk Factors Breakdown</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {detail.factors.map((factor, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderRadius: 10, background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: factor.impact > 0 ? '#dcfce7' : '#fce4ec', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {factor.impact > 0 ? <TrendingUp size={14} color="#16a34a" /> : <TrendingDown size={14} color="#dc2626" />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{factor.name}</p>
                        <p style={{ fontSize: 11, color: '#64748b' }}>{factor.detail}</p>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: factor.impact > 0 ? '#16a34a' : '#dc2626' }}>
                        {factor.impact > 0 ? '+' : ''}{factor.impact}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default CustomerRiskScore;
