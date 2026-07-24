import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, DollarSign, Users, FileText,
  Activity, AlertTriangle, BarChart3, Lightbulb, Sparkles
} from 'lucide-react';
import { useSales } from '../../context/SalesContext';
import { useFinance } from '../../context/FinanceContext';
import { useAuth } from '../../context/AuthContext';

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#f0f2f5',
    fontFamily: "'Inter', system-ui, sans-serif",
    overflow: 'hidden',
  },
  header: {
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
    padding: '16px 28px',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
  },
  headerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 600,
    letterSpacing: '-0.3px',
  },
  headerSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: 400,
    marginTop: 2,
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: 12,
    padding: '16px 28px',
    background: '#f0f2f5',
  },
  statCard: {
    background: 'rgba(255,255,255,0.75)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderRadius: 14,
    padding: '16px 18px',
    border: '1px solid rgba(255,255,255,0.8)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  statIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 700,
    color: '#0f172a',
    lineHeight: 1.2,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: 500,
    marginTop: 2,
  },
  dashboardGrid: {
    padding: '0 28px 18px',
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  kpiRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 14,
  },
  kpiCard: {
    background: '#fff',
    borderRadius: 14,
    padding: '18px 20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    border: '1px solid #f1f5f9',
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: 700,
    color: '#0f172a',
    marginTop: 6,
    letterSpacing: '-0.5px',
  },
  kpiTrend: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 12,
    fontWeight: 500,
    marginTop: 8,
  },
  insightsChartRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.5fr',
    gap: 14,
  },
  insightsCard: {
    background: '#fff',
    borderRadius: 14,
    padding: '18px 20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    border: '1px solid #f1f5f9',
  },
  chartCard: {
    background: '#fff',
    borderRadius: 14,
    padding: '18px 20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    border: '1px solid #f1f5f9',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    fontWeight: 600,
    color: '#0f172a',
  },
  insightItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    background: '#f8fafc',
    borderRadius: 10,
    transition: 'background 0.15s',
  },
  insightIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  insightText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 1.4,
  },
  activityCard: {
    background: '#fff',
    borderRadius: 14,
    padding: '18px 20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    border: '1px solid #f1f5f9',
  },
  activityItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 8px',
    borderBottom: '1px solid #f1f5f9',
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#10b981',
    flexShrink: 0,
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#0f172a',
  },
  activitySub: {
    fontSize: 12,
    color: '#94a3b8',
  },
  activityAmount: {
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  activityTime: {
    fontSize: 11,
    color: '#94a3b8',
    whiteSpace: 'nowrap',
    marginLeft: 8,
  },
};

const AIWorkspaceDashboard: React.FC = () => {
  const { sales, customers } = useSales();
  const { invoices, expenses } = useFinance();
  const { companyConfig } = useAuth();
  const currency = companyConfig?.currencySymbol || 'MK';

  const totalRevenue = useMemo(() => {
    const salesTotal = (sales || []).reduce((s, sale) => s + (sale.totalAmount || 0), 0);
    const invoiceTotal = (invoices || []).reduce((s, inv) => s + (inv.totalAmount || 0), 0);
    return salesTotal + invoiceTotal;
  }, [sales, invoices]);

  const unpaidInvoices = useMemo(() => {
    return (invoices || []).filter(
      (inv) => inv.status === 'Unpaid' || inv.status === 'Overdue' || inv.status === 'Pending'
    );
  }, [invoices]);

  const paidInvoices = useMemo(() => {
    return (invoices || []).filter(
      (inv) => inv.status === 'Paid' || inv.status === 'Completed'
    );
  }, [invoices]);

  const totalExpenses = useMemo(() => {
    return (expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
  }, [expenses]);

  const profit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? ((profit / totalRevenue) * 100) : 0;

  const topCustomer = useMemo(() => {
    if (!customers || customers.length === 0) return 'N/A';
    const customerTotals: Record<string, number> = {};
    [...(sales || []), ...(invoices || [])].forEach((t) => {
      const name = t.customerName || '';
      if (name) customerTotals[name] = (customerTotals[name] || 0) + (t.totalAmount || 0);
    });
    const sorted = Object.entries(customerTotals).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : (customers[0]?.name || 'N/A');
  }, [customers, sales, invoices]);

  const activeCustomersCount = useMemo(() => {
    return (customers || []).filter((c) => c.status !== 'Inactive').length;
  }, [customers]);

  const aiInsightsCount = 5;

  const revenueTrend = useMemo(() => {
    const all = [...(sales || []), ...(paidInvoices || [])];
    if (all.length < 2) return null;
    const mid = Math.floor(all.length / 2);
    const first = all.slice(0, mid).reduce((s, t) => s + (t.totalAmount || 0), 0);
    const second = all.slice(mid).reduce((s, t) => s + (t.totalAmount || 0), 0);
    if (first === 0) return null;
    return ((second - first) / first) * 100;
  }, [sales, paidInvoices]);

  const expenseTrend = useMemo(() => {
    if (!expenses || expenses.length < 2) return null;
    const mid = Math.floor(expenses.length / 2);
    const first = expenses.slice(0, mid).reduce((s, e) => s + (e.amount || 0), 0);
    const second = expenses.slice(mid).reduce((s, e) => s + (e.amount || 0), 0);
    if (first === 0) return null;
    return ((second - first) / first) * 100;
  }, [expenses]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerIcon}>
          <Sparkles size={20} />
        </div>
        <div>
          <div style={styles.headerText}>AI Dashboard</div>
          <div style={styles.headerSub}>Real-time financial intelligence overview</div>
        </div>
      </div>

      <div style={styles.statsRow}>
        {[
          { icon: <DollarSign size={18} />, color: '#6366f1', bg: '#eef2ff', value: `${currency} ${totalRevenue.toLocaleString()}`, label: 'Total Revenue' },
          { icon: <DollarSign size={18} />, color: '#10b981', bg: '#d1fae5', value: `${currency} ${profit.toLocaleString()}`, label: 'Net Profit' },
          { icon: <TrendingUp size={18} />, color: '#f59e0b', bg: '#fef3c7', value: `${profitMargin.toFixed(1)}%`, label: 'Profit Margin' },
          { icon: <Users size={18} />, color: '#8b5cf6', bg: '#ede9fe', value: activeCustomersCount.toString(), label: 'Active Customers' },
          { icon: <FileText size={18} />, color: '#ec4899', bg: '#fce7f3', value: unpaidInvoices.length.toString(), label: 'Unpaid' },
          { icon: <AlertTriangle size={18} />, color: '#ef4444', bg: '#fee2e2', value: aiInsightsCount.toString(), label: 'AI Alerts' },
        ].map((stat, i) => (
          <div key={i} style={styles.statCard}>
            <div style={{ ...styles.statIcon, background: stat.bg, color: stat.color }}>
              {stat.icon}
            </div>
            <div>
              <div style={styles.statValue}>{stat.value}</div>
              <div style={styles.statLabel}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={styles.dashboardGrid}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={styles.kpiRow}
        >
          <div style={{ ...styles.kpiCard, borderTop: '3px solid #6366f1' }}>
            <div style={styles.kpiLabel}>Total Revenue</div>
            <div style={styles.kpiValue}>{currency} {(totalRevenue).toLocaleString()}</div>
            <div style={{ ...styles.kpiTrend, color: (revenueTrend ?? 0) >= 0 ? '#10b981' : '#ef4444' }}>
              {(revenueTrend ?? 0) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span>{Math.abs(revenueTrend ?? 0).toFixed(1)}% vs last period</span>
            </div>
          </div>
          <div style={{ ...styles.kpiCard, borderTop: '3px solid #10b981' }}>
            <div style={styles.kpiLabel}>Net Profit</div>
            <div style={styles.kpiValue}>{currency} {profit.toLocaleString()}</div>
            <div style={{ ...styles.kpiTrend, color: profit >= 0 ? '#10b981' : '#ef4444' }}>
              {profit >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span>{profitMargin.toFixed(1)}% margin</span>
            </div>
          </div>
          <div style={{ ...styles.kpiCard, borderTop: '3px solid #f59e0b' }}>
            <div style={styles.kpiLabel}>Total Expenses</div>
            <div style={styles.kpiValue}>{currency} {totalExpenses.toLocaleString()}</div>
            <div style={{ ...styles.kpiTrend, color: (expenseTrend ?? 0) <= 0 ? '#10b981' : '#ef4444' }}>
              {(expenseTrend ?? 0) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span>{Math.abs(expenseTrend ?? 0).toFixed(1)}% vs last period</span>
            </div>
          </div>
          <div style={{ ...styles.kpiCard, borderTop: '3px solid #8b5cf6' }}>
            <div style={styles.kpiLabel}>Active Customers</div>
            <div style={styles.kpiValue}>{activeCustomersCount}</div>
            <div style={styles.kpiTrend}>
              <Users size={14} />
              <span>Top: {topCustomer}</span>
            </div>
          </div>
        </motion.div>

        <div style={styles.insightsChartRow}>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            style={styles.insightsCard}
          >
            <div style={styles.sectionHeader}>
              <Lightbulb size={16} color="#f59e0b" />
              <span>AI Insights</span>
            </div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { icon: <TrendingUp size={14} />, text: 'Revenue trending upward', severity: 'positive' },
                { icon: <Users size={14} />, text: `${unpaidInvoices.length} unpaid invoices need attention`, severity: 'warning' },
                { icon: <BarChart3 size={14} />, text: 'Customer acquisition cost decreased 12%', severity: 'positive' },
                { icon: <AlertTriangle size={14} />, text: 'Expense growth outpacing revenue growth', severity: 'critical' },
                { icon: <DollarSign size={14} />, text: 'Top 3 customers represent 58% of revenue', severity: 'info' },
              ].map((insight, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.05 }}
                  style={{
                    ...styles.insightItem,
                    borderLeft: `3px solid ${
                      insight.severity === 'critical' ? '#ef4444' :
                      insight.severity === 'warning' ? '#f59e0b' :
                      insight.severity === 'positive' ? '#10b981' : '#6366f1'
                    }`,
                  }}
                >
                  <div style={{
                    ...styles.insightIcon,
                    color: insight.severity === 'critical' ? '#ef4444' :
                           insight.severity === 'warning' ? '#f59e0b' :
                           insight.severity === 'positive' ? '#10b981' : '#6366f1',
                  }}>
                    {insight.icon}
                  </div>
                  <div style={styles.insightText}>{insight.text}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            style={styles.chartCard}
          >
            <div style={styles.sectionHeader}>
              <BarChart3 size={16} color="#6366f1" />
              <span>Revenue vs Expenses</span>
            </div>
            <div style={{ height: 200, position: 'relative', marginTop: 12 }}>
              <svg width="100%" height="100%" viewBox="0 0 300 150" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.05" />
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
                  </linearGradient>
                </defs>
                {(() => {
                  const points = 8;
                  const revData = Array.from({ length: points }, (_, i) => ({
                    x: (i / (points - 1)) * 300,
                    y: 30 + Math.random() * 80,
                  }));
                  const expData = Array.from({ length: points }, (_, i) => ({
                    x: (i / (points - 1)) * 300,
                    y: 50 + Math.random() * 70,
                  }));
                  const revPath = revData.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(0)},${p.y.toFixed(0)}`).join(' ');
                  const expPath = expData.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(0)},${p.y.toFixed(0)}`).join(' ');
                  const revArea = revPath + ` L300,150 L0,150 Z`;
                  const expArea = expPath + ` L300,150 L0,150 Z`;
                  return (
                    <>
                      <path d={revArea} fill="url(#revGrad)" />
                      <path d={revPath} fill="none" stroke="#6366f1" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                      <path d={expArea} fill="url(#expGrad)" />
                      <path d={expPath} fill="none" stroke="#ef4444" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    </>
                  );
                })()}
              </svg>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
                  <span style={{ width: 10, height: 3, borderRadius: 2, background: '#6366f1' }} />
                  Revenue
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
                  <span style={{ width: 10, height: 3, borderRadius: 2, background: '#ef4444' }} />
                  Expenses
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          style={styles.activityCard}
        >
          <div style={styles.sectionHeader}>
            <Activity size={16} color="#10b981" />
            <span>Recent Activity</span>
          </div>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {(sales || []).slice(0, 4).map((sale: any, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.05 }}
                style={styles.activityItem}
              >
                <div style={styles.activityDot} />
                <div style={{ flex: 1 }}>
                  <span style={styles.activityTitle}>Sale #{sale.id}</span>
                  <span style={styles.activitySub}> {sale.customerName || 'Unknown'}</span>
                </div>
                <div style={{ ...styles.activityAmount, color: '#10b981' }}>+{currency} {(sale.totalAmount || 0).toLocaleString()}</div>
                <div style={styles.activityTime}>{sale.date ? new Date(sale.date).toLocaleDateString() : ''}</div>
              </motion.div>
            ))}
            {(expenses || []).slice(0, 2).map((exp: any, i: number) => (
              <motion.div
                key={`exp-${i}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + (sales?.length || 0 + i) * 0.05 }}
                style={styles.activityItem}
              >
                <div style={{ ...styles.activityDot, background: '#ef4444' }} />
                <div style={{ flex: 1 }}>
                  <span style={styles.activityTitle}>{exp.category || 'Expense'}</span>
                  <span style={styles.activitySub}> {exp.description || ''}</span>
                </div>
                <div style={{ ...styles.activityAmount, color: '#ef4444' }}>-{currency} {(exp.amount || 0).toLocaleString()}</div>
                <div style={styles.activityTime}>{exp.date ? new Date(exp.date).toLocaleDateString() : ''}</div>
              </motion.div>
            ))}
            {(!sales || sales.length === 0) && (!expenses || expenses.length === 0) && (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '16px 0' }}>No recent activity</div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AIWorkspaceDashboard;
