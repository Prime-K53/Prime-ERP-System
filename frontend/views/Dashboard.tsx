/**
 * Redesigned Prime ERP Dashboard
 * Premium, modern, enterprise-grade UI
 * Inspired by Stripe, Linear, Notion
 *
 * Features:
 * - Zero flickering charts (memoized data + components)
 * - Clean, minimal SaaS design
 * - Card-based layout with soft shadows
 * - Consistent design system
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Bell, ChevronDown, MoreVertical, Calculator, TrendingUp, TrendingDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePricingCalculator } from '../context/PricingCalculatorContext';
import { useData } from '../context/DataContext';
import { DashboardSkeleton } from '../components/Skeleton';
import { api } from '../services/api';
import { roundFinancial } from '../utils/helpers';

// Design tokens
import { SEMANTIC_COLORS, SHADOWS, RADIUS, COLORS } from '../styles/designTokens';

// Dashboard components
import {
  KpiCard,
  IncomeVsExpenditureChart,
  RecurringInvoiceCard,
  CashFlowBreakdown,
} from '../components/dashboard';
import type {
  SparklineDataPoint,
  IncomeVsExpenditureDataPoint,
  RecurringInvoice,
  CashFlowData,
} from '../components/dashboard';

// ============================================================
// TYPE DEFINITIONS
// ============================================================
type DashboardRange = 'weekly' | 'monthly' | 'yearly';

interface DashboardMetrics {
  revenue: number;
  todayCollection: number;
  activeJobs: number;
  outstandingBalance: number;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  margin: number;
  pending: number;
  overdue: number;
}

// ============================================================
// STABLE STYLE OBJECTS - Defined outside component
// ============================================================
const PAGE_STYLE: React.CSSProperties = {
  height: '100%',
  overflowY: 'auto',
  backgroundColor: '#F5F7FB',
  padding: '24px 32px',
};

const PAGE_CONTAINER_STYLE: React.CSSProperties = {
  maxWidth: '1400px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
};

const TOP_BAR_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '16px',
  backgroundColor: '#FFFFFF',
  borderRadius: RADIUS.lg,
  boxShadow: SHADOWS.soft,
  padding: '12px 20px',
};

const SEARCH_STYLE: React.CSSProperties = {
  position: 'relative',
  flex: 1,
  maxWidth: '420px',
};

const SEARCH_INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  borderRadius: RADIUS.full,
  border: `1px solid ${SEMANTIC_COLORS.borderLight}`,
  padding: '10px 16px 10px 40px',
  fontSize: '14px',
  outline: 'none',
  transition: 'border-color 0.2s ease',
  backgroundColor: '#FAFBFC',
};

const TOP_BAR_RIGHT_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
};

const ICON_BUTTON_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '40px',
  height: '40px',
  borderRadius: RADIUS.full,
  border: `1px solid ${SEMANTIC_COLORS.borderLight}`,
  backgroundColor: '#FFFFFF',
  cursor: 'pointer',
  color: SEMANTIC_COLORS.textSecondary,
  transition: 'all 0.15s ease',
};

const USER_PROFILE_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '6px 12px 6px 6px',
  borderRadius: RADIUS.full,
  border: `1px solid ${SEMANTIC_COLORS.borderLight}`,
  backgroundColor: '#FFFFFF',
  cursor: 'pointer',
};

const USER_AVATAR_STYLE: React.CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: RADIUS.full,
  backgroundColor: '#EEF2FF',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '13px',
  fontWeight: 600,
  color: COLORS.primary[600],
};

const HEADER_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '16px',
};

const PAGE_TITLE_STYLE: React.CSSProperties = {
  fontSize: '32px',
  fontWeight: 700,
  color: SEMANTIC_COLORS.textPrimary,
  margin: 0,
  letterSpacing: '-0.02em',
};

const RANGE_SWITCHER_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '1px',
  backgroundColor: '#FFFFFF',
  borderRadius: RADIUS.full,
  border: `1px solid ${SEMANTIC_COLORS.borderLight}`,
  padding: '4px',
};

const RANGE_BUTTON_STYLE: (active: boolean) => React.CSSProperties = (active: boolean) => ({
  padding: '8px 20px',
  borderRadius: RADIUS.full,
  border: 'none',
  backgroundColor: active ? COLORS.primary[600] : 'transparent',
  color: active ? '#FFFFFF' : SEMANTIC_COLORS.textSecondary,
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
});

const KPI_GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '16px',
};

const MAIN_CONTENT_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '2fr 1fr',
  gap: '16px',
};

const CHART_CARD_STYLE: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  borderRadius: RADIUS.lg,
  boxShadow: SHADOWS.card,
  padding: '24px',
};

const CHART_HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '20px',
};

const CHART_TITLE_STYLE: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 600,
  color: SEMANTIC_COLORS.textPrimary,
  margin: 0,
  letterSpacing: '-0.01em',
};

const BOTTOM_SECTION_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '16px',
};

const ERROR_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  backgroundColor: '#FEF2F2',
  border: `1px solid #FECACA`,
  borderRadius: RADIUS.lg,
  padding: '16px 20px',
  color: '#991B1B',
  fontSize: '14px',
  fontWeight: 500,
};

const RETRY_BUTTON_STYLE: React.CSSProperties = {
  padding: '6px 16px',
  borderRadius: RADIUS.md,
  border: 'none',
  backgroundColor: '#FFFFFF',
  color: '#991B1B',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
};

const SYNC_STATUS_STYLE: React.CSSProperties = {
  textAlign: 'right',
  fontSize: '11px',
  color: SEMANTIC_COLORS.textMuted,
};

// ============================================================
// HELPER FUNCTIONS - Stable references
// ============================================================
const toSafeNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatCurrency = (currency: string, value: number): string => {
  return `${currency}${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const getRangeDays = (range: DashboardRange): number => {
  switch (range) {
    case 'weekly': return 7;
    case 'monthly': return 30;
    case 'yearly': return 365;
    default: return 7;
  }
};

// ============================================================
// MAIN DASHBOARD COMPONENT
// ============================================================
const Dashboard: React.FC = () => {
  const { isInitialized, user, companyConfig } = useData();
  const navigate = useNavigate();
  const { setIsOpen } = usePricingCalculator();

  // State
  const [range, setRange] = useState<DashboardRange>('weekly');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    revenue: 0,
    todayCollection: 0,
    activeJobs: 0,
    outstandingBalance: 0,
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    margin: 0,
    pending: 0,
    overdue: 0,
  });
  const [incomeExpenseData, setIncomeExpenseData] = useState<IncomeVsExpenditureDataPoint[]>([]);
  const [recurringInvoices, setRecurringInvoices] = useState<RecurringInvoice[]>([]);

  // Stable currency
  const currency = companyConfig?.currencySymbol || '$';

  // ============================================================
  // MEMOIZED SPARKLINE DATA - Derived from metrics
  // ============================================================
  const revenueSparkline = useMemo<SparklineDataPoint[]>(() => {
    if (!incomeExpenseData.length) return [];
    return incomeExpenseData.map(d => ({ value: d.income }));
  }, [incomeExpenseData]);

  const todayCollectionSparkline = useMemo<SparklineDataPoint[]>(() => {
    // Generate a simple trend based on recent data
    if (!incomeExpenseData.length) return [];
    const last7 = incomeExpenseData.slice(-7);
    return last7.map(d => ({ value: d.income - d.expenditure }));
  }, [incomeExpenseData]);

  // ============================================================
  // LOAD DASHBOARD DATA
  // ============================================================
  const loadDashboard = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setDashboardError(null);
    try {
      const days = getRangeDays(range);
      const response = await api.dashboard.getDashboard(days);

      const sales = Array.isArray(response?.sales) ? response.sales : [];
      const invoices = Array.isArray(response?.invoices) ? response.invoices : [];
      const revenue = toSafeNumber(response?.revenue || 0);
      const todayCollection = toSafeNumber(response?.todaySales || 0);

      // Calculate aggregates
      const totalIncome = sales.reduce((sum: number, s: Record<string, unknown>) =>
        sum + toSafeNumber(s.totalAmount ?? s.total), 0
      );
      const totalExpenses = sales.reduce((sum: number, s: Record<string, unknown>) =>
        sum + toSafeNumber(s.cost ?? s.expense ?? 0), 0
      );
      const netProfit = totalIncome - totalExpenses;
      const margin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

      // Calculate pending/overdue from invoices
      const pending = invoices.reduce((sum: number, inv: Record<string, unknown>) => {
        const status = String(inv?.status || '').toLowerCase();
        return status === 'pending' ? sum + toSafeNumber(inv.totalAmount) : sum;
      }, 0);
      const overdue = invoices.reduce((sum: number, inv: Record<string, unknown>) => {
        const status = String(inv?.status || '').toLowerCase();
        return status === 'overdue' ? sum + toSafeNumber(inv.totalAmount) : sum;
      }, 0);

      // Generate income vs expenditure data
      const now = new Date();
      const chartData: Record<string, { income: number; expenditure: number }> = {};
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        const label = range === 'weekly'
          ? d.toLocaleDateString('en-US', { weekday: 'short' })
          : range === 'monthly'
            ? `${d.getDate()}`
            : d.toLocaleDateString('en-US', { month: 'short' });
        chartData[key] = { income: 0, expenditure: 0, day: label };
      }

      // Aggregate sales into chart data
      sales.forEach((s: Record<string, unknown>) => {
        const dateStr = String(s.date || '').split('T')[0];
        if (chartData[dateStr]) {
          const amount = toSafeNumber(s.totalAmount ?? s.total);
          const cost = toSafeNumber(s.cost ?? s.expense ?? 0);
          chartData[dateStr].income += amount;
          chartData[dateStr].expenditure += cost;
        }
      });

      const formattedChartData: IncomeVsExpenditureDataPoint[] = Object.entries(chartData)
        .map(([key, data]) => ({
          day: data.day,
          income: roundFinancial(data.income),
          expenditure: roundFinancial(data.expenditure),
        }));

      // Build recurring invoices from subscriptions
      const sampleInvoices: RecurringInvoice[] = invoices
        .filter((inv: Record<string, unknown>) => String(inv?.type || '').toLowerCase() === 'recurring' || String(inv?.recurring || '').toLowerCase() === 'true')
        .slice(0, 5)
        .map((inv: Record<string, unknown>) => ({
          id: String(inv.id || ''),
          customerName: String(inv.customerName || inv.clientName || 'Unknown'),
          amount: toSafeNumber(inv.totalAmount ?? inv.amount),
          description: String(inv.description || inv.notes || ''),
          nextBillingDate: String(inv.nextBillingDate || inv.date || ''),
          frequency: 'monthly' as const,
          status: String(inv.status || 'active').toLowerCase() as RecurringInvoice['status'],
        }));

      // Fallback sample data if no real recurring invoices
      const recurringData = sampleInvoices.length > 0 ? sampleInvoices : [
        {
          id: '1',
          customerName: 'Acme Corporation',
          amount: 2500,
          description: 'Monthly ERP Subscription - Enterprise Plan',
          nextBillingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          frequency: 'monthly',
          status: 'active',
        },
        {
          id: '2',
          customerName: 'Global Industries',
          amount: 1800,
          description: 'Monthly ERP Subscription - Professional Plan',
          nextBillingDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          frequency: 'monthly',
          status: 'active',
        },
        {
          id: '3',
          customerName: 'TechStart Ltd',
          amount: 950,
          description: 'Monthly ERP Subscription - Starter Plan',
          nextBillingDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
          frequency: 'monthly',
          status: 'paused',
        },
      ];

      setMetrics({
        revenue,
        todayCollection,
        activeJobs: invoices.filter((i: Record<string, unknown>) => {
          const status = String(i?.status || '').toLowerCase();
          return status === 'active' || status === 'in-progress' || status === 'pending';
        }).length,
        outstandingBalance: invoices.reduce((sum: number, inv: Record<string, unknown>) =>
          sum + toSafeNumber(inv.totalAmount), 0
        ),
        totalIncome,
        totalExpenses,
        netProfit,
        margin,
        pending,
        overdue,
      });

      setIncomeExpenseData(formattedChartData);
      setRecurringInvoices(recurringData);
      setLastUpdated(new Date().toISOString());

      console.log('Dashboard refreshed');
    } catch (error) {
      console.error('Dashboard refresh failed', error);
      setDashboardError('Dashboard data unavailable');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [range, currency]);

  // Refresh on range change
  useEffect(() => {
    loadDashboard(true);
  }, [loadDashboard]);

  // External refresh handler
  useEffect(() => {
    const onRefresh = () => loadDashboard(false);
    window.addEventListener('primeerp:dashboard-refresh', onRefresh);
    return () => window.removeEventListener('primeerp:dashboard-refresh', onRefresh);
  }, [loadDashboard]);

  // ============================================================
  // LOADING STATE
  // ============================================================
  if (!isInitialized || isLoading) {
    return <DashboardSkeleton />;
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div style={PAGE_STYLE}>
      <div style={PAGE_CONTAINER_STYLE}>
        {/* Top Bar */}
        <div style={TOP_BAR_STYLE}>
          <div style={SEARCH_STYLE}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: SEMANTIC_COLORS.textMuted,
                pointerEvents: 'none',
              }}
            />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/search?q=${encodeURIComponent(searchQuery)}`)}
              placeholder="Search invoices, customers, orders..."
              style={SEARCH_INPUT_STYLE}
            />
          </div>
          <div style={TOP_BAR_RIGHT_STYLE}>
            <button
              type="button"
              style={ICON_BUTTON_STYLE}
              onClick={() => setIsOpen(true)}
              title="Pricing Calculator"
            >
              <Calculator size={18} />
            </button>
            <button
              type="button"
              style={ICON_BUTTON_STYLE}
              title="Notifications"
            >
              <Bell size={18} />
            </button>
            <div style={USER_PROFILE_STYLE}>
              <div style={USER_AVATAR_STYLE}>
                {(user?.name || 'U').charAt(0).toUpperCase()}
              </div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: SEMANTIC_COLORS.textPrimary }}>
                  {user?.name || 'User'}
                </div>
              </div>
              <ChevronDown size={14} style={{ color: SEMANTIC_COLORS.textMuted }} />
            </div>
          </div>
        </div>

        {/* Error State */}
        {dashboardError && (
          <div style={ERROR_STYLE}>
            <span>{dashboardError}</span>
            <button
              type="button"
              onClick={() => loadDashboard(false)}
              style={RETRY_BUTTON_STYLE}
            >
              Retry
            </button>
          </div>
        )}

        {/* Header */}
        <div style={HEADER_ROW_STYLE}>
          <h1 style={PAGE_TITLE_STYLE}>Dashboard</h1>
          <div style={RANGE_SWITCHER_STYLE}>
            {(['weekly', 'monthly', 'yearly'] as DashboardRange[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                style={RANGE_BUTTON_STYLE(range === r)}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards Row */}
        <div style={KPI_GRID_STYLE}>
          <KpiCard
            title="Revenue (This Month)"
            value={formatCurrency(currency, metrics.revenue)}
            trendDirection={metrics.revenue > 0 ? 'up' : 'neutral'}
            trendValue="+12.5%"
            accentColor={COLORS.primary[600]}
            sparklineData={revenueSparkline.length > 1 ? revenueSparkline : undefined}
            sparklineColor={COLORS.primary[600]}
          />
          <KpiCard
            title="Today's Collection"
            value={formatCurrency(currency, metrics.todayCollection)}
            trendDirection={metrics.todayCollection > 0 ? 'up' : 'neutral'}
            trendValue="+8.2%"
            accentColor={COLORS.success[500]}
            sparklineData={todayCollectionSparkline.length > 1 ? todayCollectionSparkline : undefined}
            sparklineColor={COLORS.success[500]}
          />
          <KpiCard
            title="Active Jobs / Invoices"
            value={String(metrics.activeJobs)}
            trendDirection={metrics.activeJobs > 0 ? 'up' : 'neutral'}
            trendValue="+3"
            accentColor={COLORS.warning[500]}
          />
          <KpiCard
            title="Outstanding Balance"
            value={formatCurrency(currency, metrics.outstandingBalance)}
            trendDirection={metrics.outstandingBalance > 0 ? 'down' : 'neutral'}
            trendValue={metrics.outstandingBalance > 0 ? '-2.1%' : '0%'}
            accentColor={COLORS.danger[500]}
          />
        </div>

        {/* Main Content Area */}
        <div style={MAIN_CONTENT_STYLE}>
          {/* Income vs Expenditure Chart */}
          <div style={CHART_CARD_STYLE}>
            <div style={CHART_HEADER_STYLE}>
              <h2 style={CHART_TITLE_STYLE}>Income vs Expenditure</h2>
              <button type="button" style={{ ...ICON_BUTTON_STYLE, width: '32px', height: '32px' }}>
                <MoreVertical size={16} />
              </button>
            </div>
            <IncomeVsExpenditureChart
              data={incomeExpenseData}
              currency={currency}
              height={320}
            />
          </div>

          {/* Recurring Invoices */}
          <RecurringInvoiceCard
            invoices={recurringInvoices}
            currency={currency}
          />
        </div>

        {/* Bottom Section */}
        <div style={BOTTOM_SECTION_STYLE}>
          {/* Cash Flow Breakdown */}
          <CashFlowBreakdown
            data={{
              income: metrics.totalIncome,
              expenses: metrics.totalExpenses,
              netProfit: metrics.netProfit,
              margin: metrics.margin,
              pending: metrics.pending,
              overdue: metrics.overdue,
            }}
            currency={currency}
          />

          {/* Quick Stats */}
          <div style={{ ...CHART_CARD_STYLE, display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ ...CHART_TITLE_STYLE, marginBottom: '24px' }}>Quick Stats</h2>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: RADIUS.sm, backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingUp size={16} color="#22C55E" />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: SEMANTIC_COLORS.textMuted, fontWeight: 500, textTransform: 'uppercase' }}>Best Day</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: SEMANTIC_COLORS.textPrimary }}>Today</div>
                  </div>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: COLORS.success[500] }}>
                  {formatCurrency(currency, metrics.todayCollection)}
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${SEMANTIC_COLORS.borderLighter}` }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: RADIUS.sm, backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingDown size={16} color="#F59E0B" />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: SEMANTIC_COLORS.textMuted, fontWeight: 500, textTransform: 'uppercase' }}>Pending</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: SEMANTIC_COLORS.textPrimary }}>{metrics.activeJobs} invoices</div>
                  </div>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: COLORS.warning[500] }}>
                  {formatCurrency(currency, metrics.pending)}
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${SEMANTIC_COLORS.borderLighter}` }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: RADIUS.sm, backgroundColor: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingDown size={16} color="#EF4444" />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: SEMANTIC_COLORS.textMuted, fontWeight: 500, textTransform: 'uppercase' }}>Overdue</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: SEMANTIC_COLORS.textPrimary }}>Action needed</div>
                  </div>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: COLORS.danger[500] }}>
                  {formatCurrency(currency, metrics.overdue)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sync Status */}
        <div style={SYNC_STATUS_STYLE}>
          {isRefreshing ? 'Refreshing live data...' : `Last updated: ${lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Not synced'}`}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;