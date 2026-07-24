import React, { useState, useEffect, useRef } from 'react';
import { logger } from '@/services/logger';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, DollarSign, Clock,
  Users, ChevronDown, BarChart3, Target, ShoppingBag,
  Award, TrendingUp as TrendUp, Sparkles, AlertCircle,
  ChevronRight, Calendar, ArrowUp, ArrowDown, Building2
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { format } from 'date-fns';
import {
  getRealTimeSalesOverview, getTopSellingProducts, getBestPerformingCustomers,
  getSalesTrends, getBranchPerformance, getSalesTargetProgress, predictEndOfMonthRevenue
} from '../services/smartSalesDashboardService';
import { generateExecutiveSummary, formatCurrency } from '../services/reportSummaryService';
import { formatNumber } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import { useSales } from '../context/SalesContext';
import { useFinance } from '../context/FinanceContext';

const PERIODS = ['Today', 'This Week', 'This Month', 'This Quarter', 'This Year', 'All Time'] as const;
type Period = typeof PERIODS[number];

const getDateRange = (period: Period): { start: string; end: string } => {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  let start: Date;
  switch (period) {
    case 'Today':
      start = now;
      break;
    case 'This Week': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(now.getFullYear(), now.getMonth(), diff);
      break;
    }
    case 'This Month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'This Quarter': {
      const q = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), q, 1);
      break;
    }
    case 'This Year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = new Date(2000, 0, 1);
  }
  return { start: start.toISOString().split('T')[0], end };
};

const getTrendPeriod = (period: Period): 'daily' | 'weekly' | 'monthly' => {
  if (period === 'Today' || period === 'This Week') return 'daily';
  if (period === 'This Month' || period === 'This Quarter') return 'weekly';
  return 'monthly';
};

const toSafeNumber = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatShortCurrency = (value: number): string => {
  if (value >= 1_000_000) {
    const mVal = value / 1_000_000;
    return `${mVal % 1 === 0 ? mVal : mVal.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    const kVal = value / 1_000;
    return `${kVal % 1 === 0 ? kVal : kVal.toFixed(1)}k`;
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const SegmentBadge = ({ segment }: { segment: 'vip' | 'regular' | 'occasional' }) => {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    vip: { bg: '#fef3c7', color: '#b45309', label: 'VIP' },
    regular: { bg: '#e0f2fe', color: '#0369a1', label: 'Regular' },
    occasional: { bg: '#f1f5f9', color: '#64748b', label: 'Occasional' },
  };
  const s = styles[segment];
  return (
    <span style={{ fontSize: 10, fontWeight: 700, backgroundColor: s.bg, color: s.color, padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
      {s.label}
    </span>
  );
};

const TrendIndicator = ({ trend }: { trend: 'rising' | 'stable' | 'falling' }) => {
  if (trend === 'rising') return <span style={{ color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 700 }}><ArrowUp size={12} />Rising</span>;
  if (trend === 'falling') return <span style={{ color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 700 }}><ArrowDown size={12} />Falling</span>;
  return <span style={{ color: '#64748b', fontSize: 11, fontWeight: 600 }}>Stable</span>;
};

const PeriodSelector = ({ value, onChange }: { value: Period; onChange: (v: Period) => void }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 12px', borderRadius: 20,
          border: '1px solid #E2E8F0', backgroundColor: '#fff',
          fontSize: 13, fontWeight: 600, color: '#334155',
          cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          transition: 'box-shadow 0.15s',
        }}
      >
        {value}
        <ChevronDown size={14} style={{ transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
            backgroundColor: '#fff', border: '1px solid #E2E8F0',
            borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
            zIndex: 50, overflow: 'hidden', minWidth: 140,
          }}
        >
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => { onChange(p); setOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 16px', fontSize: 13,
                fontWeight: value === p ? 700 : 500,
                color: value === p ? '#4F46E5' : '#475569',
                backgroundColor: value === p ? '#EEF2FF' : 'transparent',
                border: 'none', cursor: 'pointer',
                transition: 'background-color 0.1s',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const SmartSalesDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { companyConfig } = useAuth();
  const { sales, customers } = useSales();
  const { invoices } = useFinance();

  const [period, setPeriod] = useState<Period>('This Month');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [bestCustomers, setBestCustomers] = useState<any[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [branchPerf, setBranchPerf] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any>(null);
  const [targetProgress, setTargetProgress] = useState<any>(null);
  const [execSummary, setExecSummary] = useState<any>(null);

  const currencySymbol = companyConfig?.currencySymbol || '$';

  const fetchData = async () => {
    setLoading(true);
    try {
      const dateRange = getDateRange(period);

      const allSales = sales || [];
      const allInvoices = invoices || [];
      const allCustomers = customers || [];

      const overviewData = getRealTimeSalesOverview(allSales, allInvoices, dateRange);
      setOverview(overviewData);

      const products = getTopSellingProducts(allSales, allInvoices, dateRange, 10);
      setTopProducts(products);

      const customersList = getBestPerformingCustomers(allSales, allInvoices, dateRange, 10);
      setBestCustomers(customersList);

      const trendPeriod = getTrendPeriod(period);
      const trendsData = getSalesTrends(allSales, allInvoices, trendPeriod);
      setTrends(trendsData);

      const branches = getBranchPerformance(allSales, allInvoices);
      setBranchPerf(branches);

      const forecastData = predictEndOfMonthRevenue(allSales, allInvoices);
      setForecast(forecastData);

      const targetData = getSalesTargetProgress(
        (companyConfig as any)?.monthlyTargets || { revenue: 100000, transactions: 100 },
        { revenue: overviewData.totalRevenue, transactions: overviewData.totalTransactions }
      );
      setTargetProgress(targetData);

      try {
        const summary = generateExecutiveSummary({
          sales: allSales, invoices: allInvoices,
          expenses: [], inventory: [],
          dateRange: getDateRange(period)
        });
        setExecSummary(summary);
      } catch {
        setExecSummary(null);
      }
    } catch (err) {
      logger.error('SmartSalesDashboard fetch error', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [period]);

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.75)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderRadius: 16,
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    border: '1px solid rgba(255,255,255,0.6)',
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

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc' }}>
        <div style={{ width: 36, height: 36, border: '4px solid #e2e8f0', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-4 duration-700"
      style={{
        minHeight: '100vh',
        background: '#f0f4f8',
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
              Smart Sales Dashboard
            </h1>
            <PeriodSelector value={period} onChange={setPeriod} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </span>
          </div>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {overview && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14, borderLeft: '3px solid #6366f1' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', flexShrink: 0 }}>
                  <DollarSign size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: 2 }}>Total Revenue</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{currencySymbol}{formatShortCurrency(overview.totalRevenue)}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <TrendingUp size={10} color="#16a34a" />
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>{overview.growthPercent >= 0 ? '+' : ''}{overview.growthPercent.toFixed(1)}%</span>
                    <span>vs yesterday</span>
                  </div>
                </div>
              </div>

              <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14, borderLeft: '3px solid #10b981' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', flexShrink: 0 }}>
                  <Clock size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: 2 }}>Today's Revenue</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#059669', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{currencySymbol}{formatShortCurrency(overview.todayRevenue)}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{overview.todayTransactions} transactions today</div>
                </div>
              </div>

              <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14, borderLeft: '3px solid '#f59e0b' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', flexShrink: 0 }}>
                  <BarChart3 size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: 2 }}>Revenue Growth</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {overview.growthPercent >= 0 ? <TrendingUp size={16} color="#16a34a" /> : <TrendingDown size={16} color="#dc2626" />}
                    <span style={{ color: overview.growthPercent >= 0 ? '#16a34a' : '#dc2626' }}>{overview.growthPercent >= 0 ? '+' : ''}{overview.growthPercent.toFixed(1)}%</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{overview.yesterdayRevenue > 0 ? `Yesterday: ${currencySymbol}${formatShortCurrency(overview.yesterdayRevenue)}` : 'No yesterday data'}</div>
                </div>
              </div>

              <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14, borderLeft: '3px solid #7c3aed' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed', flexShrink: 0 }}>
                  <ShoppingBag size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: 2 }}>Transactions</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{formatNumber(overview.totalTransactions)}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>POS: {formatNumber(overview.posRevenue > 0 ? 1 : 0)} · Invoice: {formatNumber(overview.invoiceRevenue > 0 ? 1 : 0)}</div>
                </div>
              </div>

              <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14, borderLeft: '3px solid #f59e0b' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', flexShrink: 0 }}>
                  <Target size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: 2 }}>Avg Transaction</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{currencySymbol}{formatShortCurrency(overview.averageTransactionValue)}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>Per transaction average</div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 24 }}>
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={cardHeaderStyle}>Revenue Trend</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#4f46e5' }} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#5b578c' }}>Revenue</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#5b578c' }}>Transactions</span>
                  </div>
                </div>
              </div>
              <div style={{ width: '100%', height: 280, minWidth: 0 }}>
                {trends.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={trends} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="trendRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(148,163,184,0.18)" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }} dy={8} interval="preserveStartEnd" />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#cbd5e1', fontSize: 10, fontWeight: 500 }} dx={-4} width={48} tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val)} />
                      <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#cbd5e1', fontSize: 10, fontWeight: 500 }} dx={4} width={36} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 32px rgba(31,38,135,0.25)', fontSize: 12, padding: '10px 14px', background: '#5b578c', color: '#ffffff' }}
                        labelStyle={{ fontWeight: 600, color: '#e0e7ff', marginBottom: 4, fontSize: 11 }}
                        itemStyle={{ fontWeight: 800, color: '#ffffff', fontVariantNumeric: 'tabular-nums', padding: '2px 0' }}
                      />
                      <Area yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke="#4f46e5" strokeWidth={2} fill="url(#trendRevenue)" dot={false} activeDot={{ r: 5, fill: '#ffffff', stroke: '#4f46e5', strokeWidth: 2 }} />
                      <Area yAxisId="right" type="monotone" dataKey="transactions" name="Transactions" stroke="#10b981" strokeWidth={2} fillOpacity={0} dot={false} activeDot={{ r: 5, fill: '#ffffff', stroke: '#10b981', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: '100%', minHeight: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#94a3b8', fontSize: 13, fontWeight: 600, border: '1px dashed rgba(148,163,184,0.28)', borderRadius: 18, background: 'rgba(248,250,252,0.7)', padding: '16px 20px' }}>
                    No revenue data available for this period.
                  </div>
                )}
              </div>
            </div>

            <div style={cardStyle}>
              <div style={cardHeaderStyle}>Sales Forecast</div>
              {forecast ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1 }}>
                      {currencySymbol}{formatShortCurrency(forecast.predictedRevenue)}
                    </div>
                    <div style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                      backgroundColor: forecast.confidence === 'high' ? '#ecfdf5' : forecast.confidence === 'medium' ? '#fffbeb' : '#fef2f2',
                      color: forecast.confidence === 'high' ? '#059669' : forecast.confidence === 'medium' ? '#b45309' : '#dc2626',
                      textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4,
                    }}>
                      {forecast.confidence} confidence
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                    <span>Low: {currencySymbol}{formatShortCurrency(forecast.lowEstimate)}</span>
                    <span>High: {currencySymbol}{formatShortCurrency(forecast.highEstimate)}</span>
                  </div>
                  <div style={{ height: 6, backgroundColor: '#f1f5f9', borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      width: `${Math.min(100, (forecast.predictedRevenue / (forecast.highEstimate || forecast.predictedRevenue)) * 100)}%`,
                      height: '100%', backgroundColor: '#4f46e5', borderRadius: 999,
                      transition: 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>
                    Based on {forecast.basedOn} data points this month
                  </div>
                  {targetProgress && (
                    <div style={{ marginTop: 8, padding: '12px', borderRadius: 12, backgroundColor: targetProgress.onTrack ? '#f0fdf4' : '#fffbeb' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Target Progress</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: targetProgress.onTrack ? '#16a34a' : '#b45309' }}>
                          {targetProgress.revenuePercent.toFixed(0)}%
                        </span>
                      </div>
                      <div style={{ height: 6, backgroundColor: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.min(100, targetProgress.revenuePercent)}%`,
                          height: '100%', backgroundColor: targetProgress.onTrack ? '#16a34a' : '#f59e0b', borderRadius: 999,
                          transition: 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        }} />
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{currencySymbol}{formatShortCurrency(targetProgress.revenueAchieved)} of {currencySymbol}{formatShortCurrency(targetProgress.revenueTarget)}</span>
                        <span>{targetProgress.onTrack ? 'On Track' : 'Behind'}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>
                  No forecast data available.
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={cardHeaderStyle}>Top Selling Products</div>
                {topProducts.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', backgroundColor: '#eef2ff', padding: '2px 8px', borderRadius: 6 }}>{topProducts.length} items</span>}
              </div>
              {topProducts.length > 0 ? (
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Product</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Qty Sold</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Revenue</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Avg Price</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p, i) => (
                      <tr key={p.itemId || i} style={{ transition: 'background-color 0.1s' }}>
                        <td style={{ ...tdStyle, fontWeight: 600, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.itemName}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{formatNumber(p.quantitySold)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{currencySymbol}{formatShortCurrency(p.revenue)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{currencySymbol}{formatShortCurrency(p.averagePrice)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}><TrendIndicator trend={p.trend} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>
                  <ShoppingBag size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                  <p style={{ margin: 0 }}>No product data for this period.</p>
                </div>
              )}
            </div>

            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={cardHeaderStyle}>Best Customers</div>
                {bestCustomers.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', backgroundColor: '#f5f3ff', padding: '2px 8px', borderRadius: 6 }}>{bestCustomers.length} customers</span>}
              </div>
              {bestCustomers.length > 0 ? (
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Customer</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Spent</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Orders</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>AOV</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Segment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bestCustomers.map((c, i) => (
                      <tr key={c.customerId || i}>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{c.customerName}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{currencySymbol}{formatShortCurrency(c.totalSpent)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{c.orderCount}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{currencySymbol}{formatShortCurrency(c.averageOrderValue)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}><SegmentBadge segment={c.segment} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>
                  <Users size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                  <p style={{ margin: 0 }}>No customer data for this period.</p>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>Branch Performance</div>
              {branchPerf.length > 0 ? (
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Branch</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Revenue</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Transactions</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Avg Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branchPerf.map((b, i) => (
                      <tr key={b.branch || i}>
                        <td style={{ ...tdStyle, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Building2 size={14} color="#94a3b8" />
                          {b.branch}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{currencySymbol}{formatShortCurrency(b.revenue)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{b.transactions}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{currencySymbol}{formatShortCurrency(b.averageValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>
                  <Building2 size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                  <p style={{ margin: 0 }}>No branch data available.</p>
                </div>
              )}
            </div>

            <div style={cardStyle}>
              <div style={cardHeaderStyle}>Executive Summary</div>
              {execSummary ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {execSummary.keyHighlights && execSummary.keyHighlights.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#2e2a5d', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sparkles size={14} color="#f59e0b" /> Key Highlights
                      </div>
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                        {execSummary.keyHighlights.slice(0, 4).map((h: string, i: number) => (
                          <li key={i} style={{ fontSize: 12, color: '#475569', padding: '4px 0', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                            <span style={{ color: '#4f46e5', flexShrink: 0 }}>•</span>
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {execSummary.recommendations && execSummary.recommendations.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#2e2a5d', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Award size={14} color="#4f46e5" /> Recommendations
                      </div>
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                        {execSummary.recommendations.slice(0, 3).map((r: string, i: number) => (
                          <li key={i} style={{ fontSize: 12, color: '#475569', padding: '4px 0', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                            <span style={{ color: '#10b981', flexShrink: 0 }}>→</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>
                  <Sparkles size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                  <p style={{ margin: 0 }}>Generate an executive summary to see insights.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SmartSalesDashboard;
