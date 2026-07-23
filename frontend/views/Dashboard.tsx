import React, { useState, useMemo } from 'react';
import { format, subDays, parseISO, isAfter, isBefore } from 'date-fns';
import { motion } from 'framer-motion';
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle, Users,
  ShoppingCart, FileText, ArrowUpRight, ArrowDownRight,
  Sparkles, Clock, Package, CreditCard, Activity,
} from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';
import KPICard from '../components/ui/KPICard';
import AIInsights from '../components/ai/AIInsights';
import AreaChartWidget from '../components/charts/AreaChartWidget';

const currency = (c?: string) => c || '$';

const toN = (v: unknown): number => {
  if (v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const halfSplit = (items: any[], dateKey: string): { first: number; second: number } => {
  const sorted = [...items].sort(
    (a, b) => new Date(a[dateKey] || a.createdAt || 0).getTime() - new Date(b[dateKey] || b.createdAt || 0).getTime()
  );
  if (sorted.length < 2) return { first: 0, second: 0 };
  const mid = Math.floor(sorted.length / 2);
  const first = sorted.slice(0, mid).reduce((s, x) => s + toN(x.amount ?? x.totalAmount ?? 0), 0);
  const second = sorted.slice(mid).reduce((s, x) => s + toN(x.amount ?? x.totalAmount ?? 0), 0);
  return { first, second };
};

const trendPct = (first: number, second: number): number | null => {
  if (first === 0 && second === 0) return null;
  if (first === 0) return 100;
  return parseFloat((((second - first) / first) * 100).toFixed(1));
};

const last7Daily = (items: any[], dateKey: string, valKey: string): number[] => {
  const days: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
    const total = items
      .filter((x: any) => {
        const dt = x[dateKey] || x.createdAt || '';
        return String(dt).startsWith(d);
      })
      .reduce((s: number, x: any) => s + toN(x[valKey] ?? x.totalAmount ?? 0), 0);
    days.push(total);
  }
  return days;
};

const containerVariants: any = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
};

const S = {
  page: {
    fontFamily: "'Inter', system-ui, sans-serif",
    background: '#f8fafc',
    minHeight: '100vh',
    padding: '24px 32px',
  } as React.CSSProperties,
  card: {
    background: '#ffffff',
    borderRadius: 16,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    padding: 24,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#0f172a',
    letterSpacing: '-0.02em',
    margin: 0,
  } as React.CSSProperties,
  grid: (cols: string) => ({
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fit, minmax(${cols}, 1fr))`,
    gap: 16,
  } as React.CSSProperties),
  flexCenter: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  } as React.CSSProperties,
};

const Dashboard: React.FC = () => {
  const { sales, customers } = useSales();
  const { invoices, expenses, income, ledger, customerPayments } = useFinance();
  const { companyConfig, user } = useAuth();

  const compCurrency = currency(companyConfig?.currencySymbol || '$');

  const [chartPeriod, setChartPeriod] = useState<'7D' | '30D' | '90D' | '12M'>('30D');

  // ── Computed KPIs ──────────────────────────────────────────────────────────

  const data = useMemo(() => {
    const paidStatuses = new Set(['paid', 'completed', 'Paid', 'Completed']);
    const unpaidStatuses = new Set(['unpaid', 'overdue', 'due', 'Unpaid', 'Overdue', 'Due']);

    const revenue = [...sales, ...invoices]
      .filter((x: any) => {
        const s = String(x.status || '').trim().toLowerCase();
        return paidStatuses.has(s) || s === 'paid';
      })
      .reduce((sum: number, x: any) => sum + toN(x.totalAmount), 0);

    const expenseTotal = expenses.reduce((sum: number, e: any) => sum + toN(e.amount), 0);
    const netProfit = revenue - expenseTotal;

    const cashFlow = income.reduce((sum: number, i: any) => sum + toN(i.amount), 0) - expenseTotal;

    const outstanding = invoices
      .filter((inv: any) => {
        const s = String(inv.status || '').trim();
        return unpaidStatuses.has(s);
      })
      .reduce((sum: number, inv: any) => sum + toN(inv.totalAmount), 0);

    const totalCustomers = customers.length;

    // Trends: half split
    const revHalf = halfSplit(
      [...sales, ...invoices].filter((x: any) => {
        const s = String(x.status || '').trim().toLowerCase();
        return paidStatuses.has(s);
      }),
      'date',
    );
    const expHalf = halfSplit(expenses, 'date');
    const incHalf = halfSplit(income, 'date');

    const revenueTrend = trendPct(revHalf.first, revHalf.second);
    const expTrend = trendPct(expHalf.first, expHalf.second);
    const profitTrend = revenueTrend !== null && expTrend !== null
      ? parseFloat((revenueTrend - expTrend).toFixed(1))
      : null;
    const cashFlowTrend = trendPct(incHalf.first - expHalf.first, incHalf.second - expHalf.second);

    // Sparkline
    const revSpark = last7Daily(
      [...sales, ...invoices].filter((x: any) => {
        const s = String(x.status || '').trim().toLowerCase();
        return paidStatuses.has(s);
      }),
      'date',
      'totalAmount',
    );
    const expSpark = last7Daily(expenses, 'date', 'amount');
    const incSpark = last7Daily(income, 'date', 'amount');
    const outSpark = last7Daily(
      invoices.filter((inv: any) => {
        const s = String(inv.status || '').trim();
        return unpaidStatuses.has(s);
      }),
      'date',
      'totalAmount',
    );

    return {
      revenue,
      expenseTotal,
      netProfit,
      cashFlow,
      outstanding,
      totalCustomers,
      revenueTrend,
      expTrend,
      profitTrend,
      cashFlowTrend,
      revSpark,
      expSpark,
      incSpark,
      outSpark,
    };
  }, [sales, invoices, expenses, income, customers]);

  // ── AI Insights ────────────────────────────────────────────────────────────

  const insights = useMemo(() => {
    const result: any[] = [];
    const paidStatuses = new Set(['paid', 'completed', 'Paid', 'Completed']);
    const unpaidStatuses = new Set(['unpaid', 'overdue', 'due', 'Unpaid', 'Overdue', 'Due']);

    const revenue = [...sales, ...invoices]
      .filter((x: any) => paidStatuses.has(String(x.status || '').trim()))
      .reduce((sum: number, x: any) => sum + toN(x.totalAmount), 0);

    const expenseTotal = expenses.reduce((sum: number, e: any) => sum + toN(e.amount), 0);

    const revHalf = halfSplit(
      [...sales, ...invoices].filter((x: any) => paidStatuses.has(String(x.status || '').trim())),
      'date',
    );
    const revTrend = trendPct(revHalf.first, revHalf.second) || 0;

    const unpaidCount = invoices.filter((inv: any) => unpaidStatuses.has(String(inv.status || '').trim())).length;
    const unpaidTotal = invoices
      .filter((inv: any) => unpaidStatuses.has(String(inv.status || '').trim()))
      .reduce((sum: number, inv: any) => sum + toN(inv.totalAmount), 0);

    const netProfit = revenue - expenseTotal;
    const customersCount = customers.length;

    // 1. Revenue growth
    if (revTrend > 5) {
      result.push({
        id: 'rev-growth',
        type: 'positive',
        title: 'Strong Revenue Growth',
        description: `Revenue increased ${revTrend.toFixed(1)}% vs prior period. Current revenue: ${compCurrency}${revenue.toLocaleString()}.`,
        confidence: 92,
        date: format(new Date(), 'MMM d'),
      });
    }

    // 2. Net profit warning
    if (netProfit < 0) {
      result.push({
        id: 'net-loss',
        type: 'warning',
        title: 'Net Loss Detected',
        description: `Net profit is negative (${compCurrency}${Math.abs(netProfit).toLocaleString()}). Expenses (${compCurrency}${expenseTotal.toLocaleString()}) exceed revenue.`,
        confidence: 88,
        date: format(new Date(), 'MMM d'),
      });
    }

    // 3. Unpaid invoices
    if (unpaidCount > 0) {
      result.push({
        id: 'unpaid-inv',
        type: 'critical',
        title: `${unpaidCount} Outstanding Invoice${unpaidCount > 1 ? 's' : ''}`,
        description: `Total outstanding: ${compCurrency}${unpaidTotal.toLocaleString()}. Follow up with customers to improve cash flow.`,
        confidence: 95,
        date: format(new Date(), 'MMM d'),
      });
    }

    // 4. Customer base insight
    if (customersCount > 0) {
      result.push({
        id: 'customers',
        type: 'info',
        title: `${customersCount} Active Customers`,
        description: `Your customer base is ${customersCount} strong. Consider loyalty programs or targeted campaigns to improve retention.`,
        confidence: 76,
        date: format(new Date(), 'MMM d'),
      });
    }

    // 5. Anomaly detection
    const anomalies: string[] = [];
    const avgExpense = expenseTotal / (expenses.length || 1);
    expenses.forEach((e: any) => {
      if (toN(e.amount) > avgExpense * 5 && toN(e.amount) > 0) {
        anomalies.push(`${e.category || 'Expense'} (${compCurrency}${toN(e.amount).toLocaleString()})`);
      }
    });
    if (anomalies.length > 0) {
      result.push({
        id: 'anomaly',
        type: 'warning',
        title: `Unusual Expense${anomalies.length > 1 ? 's' : ''} Detected`,
        description: anomalies.slice(0, 2).join(', ') + (anomalies.length > 2 ? ` and ${anomalies.length - 2} more` : ''),
        confidence: 72,
        date: format(new Date(), 'MMM d'),
      });
    }

    // 6. Cash flow insight
    if (data.cashFlow < 0) {
      result.push({
        id: 'cashflow-warn',
        type: 'warning',
        title: 'Negative Cash Flow',
        description: `Cash flow is negative (${compCurrency}${Math.abs(data.cashFlow).toLocaleString()}). Review outgoing payments and accelerate receivables.`,
        confidence: 84,
        date: format(new Date(), 'MMM d'),
      });
    } else if (data.cashFlow > 0) {
      result.push({
        id: 'cashflow-pos',
        type: 'positive',
        title: 'Positive Cash Flow',
        description: `Cash flow is healthy at ${compCurrency}${data.cashFlow.toLocaleString()}. Consider investing surplus into growth initiatives.`,
        confidence: 81,
        date: format(new Date(), 'MMM d'),
      });
    }

    return result;
  }, [sales, invoices, expenses, income, customers, data, compCurrency]);

  // ── Chart Data ─────────────────────────────────────────────────────────────

  const chartData = useMemo(() => {
    const days = chartPeriod === '7D' ? 7 : chartPeriod === '30D' ? 30 : chartPeriod === '90D' ? 90 : 365;
    const paidStatuses = new Set(['paid', 'completed', 'Paid', 'Completed']);
    const map: Record<string, { date: string; revenue: number; expenses: number }> = {};

    for (let i = days - 1; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, 'yyyy-MM-dd');
      map[key] = { date: format(d, 'MMM d'), revenue: 0, expenses: 0 };
    }

    [...sales, ...invoices]
      .filter((x: any) => paidStatuses.has(String(x.status || '').trim()))
      .forEach((x: any) => {
        const raw = x.date || x.createdAt || '';
        const key = String(raw).split('T')[0];
        if (map[key]) map[key].revenue += toN(x.totalAmount);
      });

    expenses.forEach((e: any) => {
      const raw = e.date || e.createdAt || '';
      const key = String(raw).split('T')[0];
      if (map[key]) map[key].expenses += toN(e.amount);
    });

    return Object.values(map);
  }, [chartPeriod, sales, invoices, expenses]);

  // ── Activity Timeline ──────────────────────────────────────────────────────

  const activities = useMemo(() => {
    const items: { id: string; type: string; desc: string; amount: number; date: Date }[] = [];

    sales.slice(0, 10).forEach((s: any) => {
      items.push({
        id: `s-${s.id}`,
        type: 'sale',
        desc: `Sale: ${s.customerName || s.customer || 'Walk-in'}`,
        amount: toN(s.totalAmount),
        date: new Date(s.date || s.createdAt || Date.now()),
      });
    });
    invoices.slice(0, 10).forEach((inv: any) => {
      items.push({
        id: `i-${inv.id}`,
        type: inv.status === 'Paid' || inv.status === 'paid' ? 'invoice-paid' : 'invoice',
        desc: `Invoice #${inv.invoiceNumber || inv.id?.slice(0, 8) || ''} — ${inv.customerName || inv.clientName || ''}`,
        amount: toN(inv.totalAmount),
        date: new Date(inv.date || inv.createdAt || Date.now()),
      });
    });
    expenses.slice(0, 10).forEach((e: any) => {
      items.push({
        id: `e-${e.id}`,
        type: 'expense',
        desc: `Expense: ${e.category || e.description || e.name || 'General'}`,
        amount: toN(e.amount),
        date: new Date(e.date || e.createdAt || Date.now()),
      });
    });

    items.sort((a, b) => b.date.getTime() - a.date.getTime());
    return items.slice(0, 10);
  }, [sales, invoices, expenses]);

  // ── Top Products ───────────────────────────────────────────────────────────

  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; qty: number; total: number }> = {};
    sales.forEach((s: any) => {
      const items = s.items || s.lineItems || [];
      (Array.isArray(items) ? items : []).forEach((li: any) => {
        const name = li.productName || li.name || li.description || 'Product';
        if (!map[name]) map[name] = { name, qty: 0, total: 0 };
        map[name].qty += toN(li.quantity || 1);
        map[name].total += toN(li.total || li.totalAmount || li.price || 0);
      });
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [sales]);

  // ── Recent Invoices ────────────────────────────────────────────────────────

  const recentInvoices = useMemo(() => {
    return [...invoices]
      .sort((a: any, b: any) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime())
      .slice(0, 5);
  }, [invoices]);

  const periodBtn = (label: string, style: React.CSSProperties = {}) => ({
    padding: '6px 14px',
    borderRadius: 8,
    border: 'none',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    background: chartPeriod === label ? '#6366f1' : '#f1f5f9',
    color: chartPeriod === label ? '#fff' : '#475569',
    transition: 'all 0.15s',
    ...style,
  });

  const activityIcon = (type: string) => {
    switch (type) {
      case 'sale': return <ShoppingCart size={14} color="#6366f1" />;
      case 'invoice-paid': return <DollarSign size={14} color="#16a34a" />;
      case 'invoice': return <FileText size={14} color="#f59e0b" />;
      case 'expense': return <TrendingDown size={14} color="#dc2626" />;
      default: return <Activity size={14} color="#64748b" />;
    }
  };

  const activityBg = (type: string) => {
    switch (type) {
      case 'sale': return '#eef2ff';
      case 'invoice-paid': return '#f0fdf4';
      case 'invoice': return '#fffbeb';
      case 'expense': return '#fef2f2';
      default: return '#f8fafc';
    }
  };

  const relTime = (d: Date): string => {
    const now = Date.now();
    const diff = now - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return format(d, 'MMM d');
  };

  return (
    <div style={S.page}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.03em' }}>
              Dashboard
            </h1>
            <p style={{ fontSize: 14, color: '#64748b', margin: '4px 0 0', fontWeight: 500 }}>
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px 4px 8px', borderRadius: 999, background: '#f1f5f9', fontSize: 13, fontWeight: 600, color: '#475569' }}>
              <Clock size={14} color="#6366f1" />
              {format(new Date(), 'h:mm a')}
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #a78bfa)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: 14,
            }}>
              {(user?.fullName || user?.name || 'U').charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </motion.div>

      {/* KPI Cards Row */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <motion.div variants={itemVariants}>
          <KPICard
            title="Revenue"
            value={data.revenue}
            prefix={compCurrency}
            icon={<DollarSign size={18} />}
            variant="success"
            trend={data.revenueTrend !== null ? { value: data.revenueTrend, direction: data.revenueTrend >= 0 ? 'up' : 'down', label: 'vs prior' } : undefined}
            sparklineData={data.revSpark.length >= 2 ? data.revSpark : undefined}
            insight={data.revenueTrend && data.revenueTrend > 5 ? `${data.revenueTrend.toFixed(0)}% growth` : undefined}
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <KPICard
            title="Expenses"
            value={data.expenseTotal}
            prefix={compCurrency}
            icon={<TrendingDown size={18} />}
            variant="danger"
            trend={data.expTrend !== null ? { value: data.expTrend, direction: data.expTrend >= 0 ? 'up' : 'down', label: 'vs prior' } : undefined}
            sparklineData={data.expSpark.length >= 2 ? data.expSpark : undefined}
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <KPICard
            title="Net Profit"
            value={data.netProfit}
            prefix={compCurrency}
            icon={<TrendingUp size={18} />}
            variant={data.netProfit >= 0 ? 'success' : 'danger'}
            trend={data.profitTrend !== null ? { value: data.profitTrend, direction: data.profitTrend >= 0 ? 'up' : 'down', label: 'margin' } : undefined}
            sparklineData={data.revSpark.length >= 2 && data.expSpark.length >= 2
              ? data.revSpark.map((v, i) => v - (data.expSpark[i] || 0))
              : undefined}
            insight={data.netProfit >= 0 ? 'Profitable' : 'Loss'}
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <KPICard
            title="Cash Flow"
            value={data.cashFlow}
            prefix={compCurrency}
            icon={<CreditCard size={18} />}
            variant={data.cashFlow >= 0 ? 'success' : 'danger'}
            trend={data.cashFlowTrend !== null ? { value: data.cashFlowTrend, direction: data.cashFlowTrend >= 0 ? 'up' : 'down' } : undefined}
            sparklineData={data.incSpark.length >= 2 && data.expSpark.length >= 2
              ? data.incSpark.map((v, i) => v - (data.expSpark[i] || 0))
              : undefined}
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <KPICard
            title="Outstanding"
            value={data.outstanding}
            prefix={compCurrency}
            icon={<FileText size={18} />}
            variant="warning"
            sparklineData={data.outSpark.length >= 2 ? data.outSpark : undefined}
            insight={data.outstanding > 0 ? 'Follow up' : 'All clear'}
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <KPICard
            title="Total Customers"
            value={data.totalCustomers}
            icon={<Users size={18} />}
            variant="default"
          />
        </motion.div>
      </motion.div>

      {/* Middle Row: AI Insights + Chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, marginBottom: 24 }}>
        {/* AI Insights */}
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
          <AIInsights insights={insights} title="AI Analysis" maxHeight="540px" />
        </motion.div>

        {/* Revenue + Expense Chart */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          style={S.card}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h3 style={{ ...S.sectionTitle, fontSize: 16 }}>Revenue & Expenses</h3>
              <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0', fontWeight: 500 }}>
                Daily performance overview
              </p>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['7D', '30D', '90D', '12M'] as const).map((p) => (
                <button key={p} onClick={() => setChartPeriod(p)} style={periodBtn(p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <AreaChartWidget
            data={chartData}
            dataKey="revenue"
            xKey="date"
            color="#6366f1"
            height={300}
            additionalLines={[
              { key: 'expenses', color: '#dc2626', name: 'Expenses' },
            ]}
          />
          <div style={{ display: 'flex', gap: 24, marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Revenue</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                {compCurrency}{chartData.reduce((s, r) => s + r.revenue, 0).toLocaleString()}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Expenses</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                {compCurrency}{chartData.reduce((s, r) => s + r.expenses, 0).toLocaleString()}
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Activity Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        style={{ ...S.card, marginBottom: 24 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Activity size={16} color="#6366f1" />
          <h3 style={{ ...S.sectionTitle, fontSize: 16 }}>Activity Timeline</h3>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 20 }}>
            {activities.length} events
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {activities.map((a, i) => (
            <div
              key={a.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 10,
                background: i % 2 === 0 ? '#f8fafc' : 'transparent',
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 10, background: activityBg(a.type), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {activityIcon(a.type)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.desc}
                </p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {compCurrency}{a.amount.toLocaleString()}
              </span>
              <span style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8', minWidth: 52, textAlign: 'right' }}>
                {relTime(a.date)}
              </span>
            </div>
          ))}
          {activities.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>
              No recent activity
            </div>
          )}
        </div>
      </motion.div>

      {/* Bottom Row: Top Products + Recent Invoices */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Top Products */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          style={S.card}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Package size={16} color="#6366f1" />
            <h3 style={{ ...S.sectionTitle, fontSize: 16 }}>Top Products</h3>
          </div>
          {topProducts.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <th style={{ textAlign: 'left', padding: '8px 4px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Product</th>
                  <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p, i) => (
                  <tr key={p.name} style={{ borderBottom: i < topProducts.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                    <td style={{ padding: '10px 4px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{p.name}</td>
                    <td style={{ padding: '10px 4px', fontSize: 13, fontWeight: 600, color: '#64748b', textAlign: 'right' }}>{p.qty}</td>
                    <td style={{ padding: '10px 4px', fontSize: 13, fontWeight: 700, color: '#0f172a', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {compCurrency}{p.total.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>
              No product data available
            </div>
          )}
        </motion.div>

        {/* Recent Invoices */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          style={S.card}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <FileText size={16} color="#6366f1" />
            <h3 style={{ ...S.sectionTitle, fontSize: 16 }}>Recent Invoices</h3>
          </div>
          {recentInvoices.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <th style={{ textAlign: 'left', padding: '8px 4px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Invoice</th>
                  <th style={{ textAlign: 'left', padding: '8px 4px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Customer</th>
                  <th style={{ textAlign: 'right', padding: '8px 4px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Amount</th>
                  <th style={{ textAlign: 'center', padding: '8px 4px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((inv: any, i: number) => {
                  const s = String(inv.status || '').trim().toLowerCase();
                  const statusColor = s === 'paid' || s === 'completed' ? '#16a34a' : s === 'unpaid' || s === 'overdue' || s === 'due' ? '#dc2626' : s === 'partial' ? '#f59e0b' : '#64748b';
                  const statusBg = s === 'paid' || s === 'completed' ? '#f0fdf4' : s === 'unpaid' || s === 'overdue' || s === 'due' ? '#fef2f2' : s === 'partial' ? '#fffbeb' : '#f1f5f9';
                  return (
                    <tr key={inv.id || i} style={{ borderBottom: i < recentInvoices.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                      <td style={{ padding: '10px 4px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                        {inv.invoiceNumber || inv.id?.slice(0, 8) || `#${i + 1}`}
                      </td>
                      <td style={{ padding: '10px 4px', fontSize: 13, fontWeight: 500, color: '#64748b' }}>
                        {inv.customerName || inv.clientName || '—'}
                      </td>
                      <td style={{ padding: '10px 4px', fontSize: 13, fontWeight: 700, color: '#0f172a', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {compCurrency}{toN(inv.totalAmount).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontSize: 10,
                          fontWeight: 700,
                          background: statusBg,
                          color: statusColor,
                          textTransform: 'capitalize',
                        }}>
                          {inv.status || '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>
              No invoices available
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
