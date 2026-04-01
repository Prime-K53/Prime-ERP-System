import React, { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Bell,
  BriefcaseBusiness,
  Calculator,
  CircleDollarSign,
  CreditCard,
  FileText,
  RefreshCw,
  Search,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { differenceInCalendarDays, formatDistanceToNowStrict, isSameDay, startOfMonth, subDays, subMonths } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { DashboardSkeleton } from '../components/Skeleton';
import {
  ChartCard,
  IncomeVsExpenditureChart,
  KpiCard,
  SubscriptionCard,
} from '../components/dashboard';
import type {
  DashboardActivityRow,
  DashboardChartPoint,
  DashboardInvoiceRow,
  DashboardPaymentRow,
  DashboardRange,
  DashboardSubscription,
} from '../components/dashboard';
import { useData } from '../context/DataContext';
import { usePricingCalculator } from '../context/PricingCalculatorContext';
import { api } from '../services/api';
import { roundFinancial } from '../utils/helpers';
import './dashboard.css';

type DataRecord = Record<string, unknown>;

interface DashboardApiState {
  revenue: number;
  todaySales: number;
  sales: DataRecord[];
  invoices: DataRecord[];
}

const EMPTY_DASHBOARD_STATE: DashboardApiState = {
  revenue: 0,
  todaySales: 0,
  sales: [],
  invoices: [],
};

const RANGE_DAY_COUNT: Record<DashboardRange, number> = {
  weekly: 7,
  monthly: 30,
  yearly: 365,
};

const RANGE_OPTIONS: Array<{ value: DashboardRange; label: string }> = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const WEEKDAY_LABEL = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const MONTH_LABEL = new Intl.DateTimeFormat('en-US', { month: 'short' });
const LONG_DATE_LABEL = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const SHORT_DATE_LABEL = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const TIME_LABEL = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

const CLOSED_INVOICE_STATUSES = new Set(['paid', 'draft', 'cancelled', 'canceled', 'void']);
const CLOSED_JOB_STATUSES = new Set(['completed', 'closed', 'delivered', 'cancelled', 'canceled']);

const FALLBACK_SUBSCRIPTIONS: DashboardSubscription[] = [
  {
    id: 'sub-enterprise',
    companyName: 'Northwind Holdings',
    planName: 'Enterprise ERP',
    price: 2500,
    status: 'Active',
    nextBillingDate: LONG_DATE_LABEL.format(new Date(Date.now() + (9 * 24 * 60 * 60 * 1000))),
    frequencyLabel: '/mo',
    cycleLabel: 'Monthly cycle',
    daysUntilBilling: 9,
    cycleProgress: 0.64,
    notes: 'Multi-branch billing, approval workflows, and unified invoicing.',
  },
  {
    id: 'sub-growth',
    companyName: 'Atlas Printworks',
    planName: 'Growth Billing Suite',
    price: 1800,
    status: 'Active',
    nextBillingDate: LONG_DATE_LABEL.format(new Date(Date.now() + (14 * 24 * 60 * 60 * 1000))),
    frequencyLabel: '/mo',
    cycleLabel: 'Monthly cycle',
    daysUntilBilling: 14,
    cycleProgress: 0.52,
    notes: 'Automated recurring billing with consolidated payment collection.',
  },
  {
    id: 'sub-starter',
    companyName: 'Prime Labs',
    planName: 'Starter Finance Cloud',
    price: 950,
    status: 'Paused',
    nextBillingDate: LONG_DATE_LABEL.format(new Date(Date.now() + (21 * 24 * 60 * 60 * 1000))),
    frequencyLabel: '/mo',
    cycleLabel: 'Monthly cycle',
    daysUntilBilling: 21,
    cycleProgress: 0.31,
    notes: 'Invoice automation remains ready the moment the plan resumes.',
  },
];

const isRecord = (value: unknown): value is DataRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const toRecordArray = (value: unknown): DataRecord[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

const toSafeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toSafeString = (value: unknown, fallback = ''): string => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const parseDateValue = (value: unknown): Date | null => {
  const normalized = toSafeString(value);
  if (!normalized) return null;

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatCurrency = (currencySymbol: string, value: number): string =>
  `${currencySymbol}${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value: unknown, fallback = 'TBD'): string => {
  const parsedDate = parseDateValue(value);
  return parsedDate ? LONG_DATE_LABEL.format(parsedDate) : fallback;
};

const formatShortDate = (value: unknown, fallback = 'Unknown date'): string => {
  const parsedDate = parseDateValue(value);
  return parsedDate ? SHORT_DATE_LABEL.format(parsedDate) : fallback;
};

const formatRelativeTime = (value: unknown): string => {
  const parsedDate = parseDateValue(value);
  if (!parsedDate) return 'Unknown';
  return formatDistanceToNowStrict(parsedDate, { addSuffix: true });
};

const getInvoiceOutstandingAmount = (invoice: DataRecord): number => {
  const totalAmount = toSafeNumber(invoice.totalAmount ?? invoice.total ?? invoice.amount);
  const paidAmount = toSafeNumber(invoice.paidAmount ?? invoice.paid_amount ?? invoice.amountPaid);
  return roundFinancial(Math.max(0, totalAmount - paidAmount));
};

const getSalesAmount = (sale: DataRecord) =>
  toSafeNumber(sale.totalAmount ?? sale.total ?? sale.amount);

const getSalesExpense = (sale: DataRecord) =>
  toSafeNumber(sale.cost ?? sale.expense ?? sale.totalExpense);

const getPaymentAmount = (payment: DataRecord) =>
  toSafeNumber(payment.amount ?? payment.amountReceived ?? payment.totalAmount);

const getRecordDate = (record: DataRecord): Date | null =>
  parseDateValue(record.date ?? record.createdAt ?? record.updatedAt ?? record.nextRunDate ?? record.nextBillingDate);

const normalizeSubscriptionStatus = (status: unknown): DashboardSubscription['status'] => {
  switch (toSafeString(status).toLowerCase()) {
    case 'active':
      return 'Active';
    case 'paused':
      return 'Paused';
    case 'cancelled':
    case 'canceled':
      return 'Cancelled';
    default:
      return 'Draft';
  }
};

const joinClassNames = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(' ');

const EmptyState = memo(({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) => (
  <div className="dashboard-empty">
    <Icon size={28} />
    <h3>{title}</h3>
    <p>{description}</p>
  </div>
));

EmptyState.displayName = 'EmptyState';

const useDebouncedValue = <T,>(value: T, delayMs: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timerId = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timerId);
  }, [delayMs, value]);

  return debouncedValue;
};

const getFrequencyDetails = (frequency: unknown) => {
  switch (toSafeString(frequency).toLowerCase()) {
    case 'weekly':
      return { cycleDays: 7, frequencyLabel: '/wk', cycleLabel: 'Weekly cycle' };
    case 'quarterly':
      return { cycleDays: 90, frequencyLabel: '/qtr', cycleLabel: 'Quarterly cycle' };
    case 'annually':
    case 'yearly':
      return { cycleDays: 365, frequencyLabel: '/yr', cycleLabel: 'Annual cycle' };
    default:
      return { cycleDays: 30, frequencyLabel: '/mo', cycleLabel: 'Monthly cycle' };
  }
};

const getPlanName = (record: DataRecord, amount: number): string => {
  const description = toSafeString(record.planName ?? record.description ?? record.notes);
  if (description) return description;
  if (amount >= 2500) return 'Enterprise ERP';
  if (amount >= 1500) return 'Growth Billing Suite';
  return 'Starter Finance Cloud';
};

const buildChartData = (sales: DataRecord[], range: DashboardRange): DashboardChartPoint[] => {
  const now = new Date();

  if (range === 'yearly') {
    const monthBuckets = Array.from({ length: 12 }, (_, index) => {
      const date = subMonths(now, 11 - index);
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: MONTH_LABEL.format(date),
        income: 0,
        expenditure: 0,
      };
    });

    const bucketMap = new Map(monthBuckets.map((bucket) => [bucket.key, bucket]));

    sales.forEach((sale) => {
      const saleDate = getRecordDate(sale);
      if (!saleDate) return;

      const bucketKey = `${saleDate.getFullYear()}-${saleDate.getMonth()}`;
      const bucket = bucketMap.get(bucketKey);
      if (!bucket) return;

      bucket.income = roundFinancial(bucket.income + getSalesAmount(sale));
      bucket.expenditure = roundFinancial(bucket.expenditure + getSalesExpense(sale));
    });

    return monthBuckets.map(({ label, income, expenditure }) => ({ label, income, expenditure }));
  }

  const totalDays = range === 'weekly' ? 7 : 30;
  const dailyBuckets = Array.from({ length: totalDays }, (_, index) => {
    const date = subDays(now, totalDays - index - 1);
    const key = date.toISOString().split('T')[0];

    return {
      key,
      label: range === 'weekly'
        ? WEEKDAY_LABEL.format(date)
        : `${date.getDate()}`.padStart(2, '0'),
      income: 0,
      expenditure: 0,
    };
  });

  const bucketMap = new Map(dailyBuckets.map((bucket) => [bucket.key, bucket]));

  sales.forEach((sale) => {
    const saleDate = getRecordDate(sale);
    if (!saleDate) return;

    const key = saleDate.toISOString().split('T')[0];
    const bucket = bucketMap.get(key);
    if (!bucket) return;

    bucket.income = roundFinancial(bucket.income + getSalesAmount(sale));
    bucket.expenditure = roundFinancial(bucket.expenditure + getSalesExpense(sale));
  });

  return dailyBuckets.map(({ label, income, expenditure }) => ({ label, income, expenditure }));
};

const getRevenueThisMonth = (sales: DataRecord[], fallbackRevenue: number) => {
  if (sales.length === 0) return roundFinancial(fallbackRevenue);

  const monthStart = startOfMonth(new Date());
  const revenue = sales.reduce((sum, sale) => {
    const saleDate = getRecordDate(sale);
    if (!saleDate || saleDate < monthStart) return sum;
    return sum + getSalesAmount(sale);
  }, 0);

  return roundFinancial(revenue);
};

const getTodayCollection = (payments: DataRecord[], sales: DataRecord[], fallbackValue: number) => {
  const today = new Date();

  if (payments.length > 0) {
    const paymentTotal = payments.reduce((sum, payment) => {
      const paymentDate = getRecordDate(payment);
      if (!paymentDate || !isSameDay(paymentDate, today)) return sum;
      return sum + getPaymentAmount(payment);
    }, 0);

    if (paymentTotal > 0) {
      return roundFinancial(paymentTotal);
    }
  }

  const salesTotal = sales.reduce((sum, sale) => {
    const saleDate = getRecordDate(sale);
    if (!saleDate || !isSameDay(saleDate, today)) return sum;
    return sum + getSalesAmount(sale);
  }, 0);

  if (salesTotal > 0) {
    return roundFinancial(salesTotal);
  }

  return roundFinancial(fallbackValue);
};

const isOpenInvoice = (invoice: DataRecord) => {
  const status = toSafeString(invoice.status).toLowerCase();
  return !CLOSED_INVOICE_STATUSES.has(status) && getInvoiceOutstandingAmount(invoice) > 0;
};

const isActiveJob = (job: DataRecord) => {
  const status = toSafeString(job.status).toLowerCase();
  if (!status) return true;
  return !CLOSED_JOB_STATUSES.has(status);
};

const deriveSubscriptions = (
  recurringInvoices: DataRecord[],
  invoices: DataRecord[],
): DashboardSubscription[] => {
  const today = new Date();

  const normalizedRecurring = recurringInvoices.map((record, index) => {
    const amount = toSafeNumber(record.total ?? record.totalAmount ?? record.amount);
    const nextBilling = parseDateValue(record.nextRunDate ?? record.nextBillingDate ?? record.dueDate ?? record.date);
    const { cycleDays, frequencyLabel, cycleLabel } = getFrequencyDetails(record.frequency);
    const daysUntilBilling = nextBilling ? Math.max(0, differenceInCalendarDays(nextBilling, today)) : cycleDays;
    const cycleProgress = Math.max(0.1, Math.min(1, 1 - (daysUntilBilling / cycleDays)));

    return {
      id: toSafeString(record.id, `sub-${index + 1}`),
      companyName: toSafeString(record.customerName ?? record.customer_name, 'Unknown company'),
      planName: getPlanName(record, amount),
      price: amount,
      status: normalizeSubscriptionStatus(record.status),
      nextBillingDate: formatDate(record.nextRunDate ?? record.nextBillingDate ?? record.dueDate ?? record.date),
      frequencyLabel,
      cycleLabel,
      daysUntilBilling,
      cycleProgress,
      notes: toSafeString(record.description ?? record.notes, 'Recurring billing plan with automated invoice generation.'),
    } satisfies DashboardSubscription;
  }).filter((subscription) => subscription.companyName !== 'Unknown company');

  if (normalizedRecurring.length > 0) {
    return normalizedRecurring.slice(0, 6);
  }

  const derivedInvoices = invoices
    .filter((invoice) => {
      const type = toSafeString(invoice.type).toLowerCase();
      const recurringFlag = toSafeString(invoice.recurring).toLowerCase();
      return type === 'recurring' || recurringFlag === 'true';
    })
    .map((invoice, index) => {
      const amount = toSafeNumber(invoice.totalAmount ?? invoice.total ?? invoice.amount);
      const { cycleDays, frequencyLabel, cycleLabel } = getFrequencyDetails(invoice.frequency);
      const nextBilling = parseDateValue(invoice.nextBillingDate ?? invoice.dueDate ?? invoice.date);
      const daysUntilBilling = nextBilling ? Math.max(0, differenceInCalendarDays(nextBilling, today)) : cycleDays;

      return {
        id: toSafeString(invoice.id, `invoice-sub-${index + 1}`),
        companyName: toSafeString(invoice.customerName ?? invoice.clientName, 'Unknown company'),
        planName: getPlanName(invoice, amount),
        price: amount,
        status: normalizeSubscriptionStatus(invoice.status || 'Active'),
        nextBillingDate: formatDate(invoice.nextBillingDate ?? invoice.dueDate ?? invoice.date),
        frequencyLabel,
        cycleLabel,
        daysUntilBilling,
        cycleProgress: Math.max(0.15, Math.min(1, 1 - (daysUntilBilling / cycleDays))),
        notes: toSafeString(invoice.description ?? invoice.notes, 'Invoice-backed recurring billing plan.'),
      } satisfies DashboardSubscription;
    });

  if (derivedInvoices.length > 0) {
    return derivedInvoices.slice(0, 6);
  }

  return FALLBACK_SUBSCRIPTIONS;
};

const deriveRecentInvoices = (invoices: DataRecord[]): DashboardInvoiceRow[] =>
  [...invoices]
    .sort((left, right) => {
      const leftDate = getRecordDate(left)?.getTime() || 0;
      const rightDate = getRecordDate(right)?.getTime() || 0;
      return rightDate - leftDate;
    })
    .slice(0, 6)
    .map((invoice) => ({
      id: toSafeString(invoice.id, 'INV'),
      customerName: toSafeString(invoice.customerName ?? invoice.clientName, 'Unnamed customer'),
      status: toSafeString(invoice.status, 'Unpaid'),
      issueDate: formatDate(invoice.date, 'Pending'),
      dueDate: formatDate(invoice.dueDate ?? invoice.nextBillingDate, 'TBD'),
      totalAmount: toSafeNumber(invoice.totalAmount ?? invoice.total ?? invoice.amount),
      outstandingAmount: getInvoiceOutstandingAmount(invoice),
    }));

const deriveRecentPayments = (payments: DataRecord[]): DashboardPaymentRow[] =>
  [...payments]
    .sort((left, right) => {
      const leftDate = getRecordDate(left)?.getTime() || 0;
      const rightDate = getRecordDate(right)?.getTime() || 0;
      return rightDate - leftDate;
    })
    .slice(0, 6)
    .map((payment) => ({
      id: toSafeString(payment.id, 'PAY'),
      customerName: toSafeString(payment.customerName, 'Unnamed customer'),
      status: toSafeString(payment.status, 'Cleared'),
      paymentDate: formatDate(payment.date, 'Pending'),
      method: toSafeString(payment.paymentMethod ?? payment.method, 'Account credit'),
      amount: getPaymentAmount(payment),
      reference: toSafeString(payment.reference ?? payment.narrative, 'No reference'),
    }));

const getActivityTone = (action: string) => {
  const normalized = action.toLowerCase();
  if (normalized.includes('delete') || normalized.includes('void') || normalized.includes('fail')) {
    return 'danger';
  }
  if (normalized.includes('payment') || normalized.includes('paid') || normalized.includes('cleared')) {
    return 'success';
  }
  if (normalized.includes('approve') || normalized.includes('update')) {
    return 'warning';
  }
  if (normalized.includes('create') || normalized.includes('invoice')) {
    return 'primary';
  }
  return 'neutral';
};

const deriveActivityRows = (logs: DataRecord[]): DashboardActivityRow[] =>
  [...logs]
    .sort((left, right) => {
      const leftDate = getRecordDate(left)?.getTime() || 0;
      const rightDate = getRecordDate(right)?.getTime() || 0;
      return rightDate - leftDate;
    })
    .slice(0, 7)
    .map((log, index) => ({
      id: toSafeString(log.id, `log-${index + 1}`),
      title: toSafeString(log.action, 'System activity'),
      detail: toSafeString(log.details, 'An update was recorded in the audit trail.'),
      timestamp: toSafeString(log.date ?? log.createdAt ?? log.updatedAt),
      actor: toSafeString(log.userId ?? log.user ?? log.userName, 'System'),
      tone: getActivityTone(toSafeString(log.action)),
    }));

const getInvoiceTone = (invoice: DashboardInvoiceRow) => {
  const normalizedStatus = invoice.status.toLowerCase();
  if (normalizedStatus === 'paid' || invoice.outstandingAmount <= 0) return 'success';
  if (normalizedStatus === 'overdue') return 'danger';
  if (normalizedStatus === 'pending' || normalizedStatus === 'unpaid') return 'warning';
  return 'neutral';
};

const getPaymentTone = (payment: DashboardPaymentRow) => {
  const normalizedStatus = payment.status.toLowerCase();
  if (normalizedStatus === 'cleared' || normalizedStatus === 'posted') return 'success';
  if (normalizedStatus === 'pending') return 'warning';
  if (normalizedStatus === 'voided' || normalizedStatus === 'bounced') return 'danger';
  return 'neutral';
};

const Dashboard: React.FC = () => {
  const {
    isInitialized,
    user,
    companyConfig,
    invoices: rawInvoices = [],
    sales: rawSales = [],
    customerPayments: rawCustomerPayments = [],
    recurringInvoices: rawRecurringInvoices = [],
    auditLogs: rawAuditLogs = [],
    jobOrders: rawJobOrders = [],
    workOrders: rawWorkOrders = [],
  } = useData();
  const navigate = useNavigate();
  const { setIsOpen } = usePricingCalculator();

  const [selectedRange, setSelectedRange] = useState<DashboardRange>('monthly');
  const [searchQuery, setSearchQuery] = useState('');
  const [remoteDashboard, setRemoteDashboard] = useState<DashboardApiState>(EMPTY_DASHBOARD_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const debouncedRange = useDebouncedValue(selectedRange, 220);
  const currencySymbol = companyConfig?.currencySymbol || '$';

  const invoices = useMemo(() => toRecordArray(rawInvoices), [rawInvoices]);
  const sales = useMemo(() => toRecordArray(rawSales), [rawSales]);
  const customerPayments = useMemo(() => toRecordArray(rawCustomerPayments), [rawCustomerPayments]);
  const recurringInvoices = useMemo(() => toRecordArray(rawRecurringInvoices), [rawRecurringInvoices]);
  const auditLogs = useMemo(() => toRecordArray(rawAuditLogs), [rawAuditLogs]);
  const jobOrders = useMemo(() => toRecordArray(rawJobOrders), [rawJobOrders]);
  const workOrders = useMemo(() => toRecordArray(rawWorkOrders), [rawWorkOrders]);

  const hasLocalData = sales.length > 0
    || invoices.length > 0
    || customerPayments.length > 0
    || recurringInvoices.length > 0
    || auditLogs.length > 0;

  const loadDashboard = useCallback(async (initialLoad: boolean) => {
    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;

    if (initialLoad && !hasLocalData) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    setDashboardError(null);

    try {
      const response = await api.dashboard.getDashboard(RANGE_DAY_COUNT[debouncedRange]);

      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      setRemoteDashboard({
        revenue: toSafeNumber(response?.revenue),
        todaySales: toSafeNumber(response?.todaySales),
        sales: toRecordArray(response?.sales),
        invoices: toRecordArray(response?.invoices),
      });
      setLastUpdated(new Date().toISOString());
    } catch (error) {
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      setDashboardError('Dashboard data is currently unavailable. Showing the latest local activity instead.');
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [debouncedRange, hasLocalData]);

  useEffect(() => {
    if (!isInitialized) return;
    void loadDashboard(!hasLocalData);
  }, [hasLocalData, isInitialized, loadDashboard]);

  useEffect(() => {
    const handleDashboardRefresh = () => {
      void loadDashboard(false);
    };

    window.addEventListener('primeerp:dashboard-refresh', handleDashboardRefresh);
    return () => window.removeEventListener('primeerp:dashboard-refresh', handleDashboardRefresh);
  }, [loadDashboard]);

  const effectiveSales = useMemo(() => (
    sales.length > 0 ? sales : remoteDashboard.sales
  ), [remoteDashboard.sales, sales]);

  const effectiveInvoices = useMemo(() => (
    invoices.length > 0 ? invoices : remoteDashboard.invoices
  ), [invoices, remoteDashboard.invoices]);

  const revenueThisMonth = useMemo(() => (
    getRevenueThisMonth(effectiveSales, remoteDashboard.revenue)
  ), [effectiveSales, remoteDashboard.revenue]);

  const todayCollection = useMemo(() => (
    getTodayCollection(customerPayments, effectiveSales, remoteDashboard.todaySales)
  ), [customerPayments, effectiveSales, remoteDashboard.todaySales]);

  const activeJobsAndInvoices = useMemo(() => {
    const openInvoices = effectiveInvoices.filter(isOpenInvoice).length;
    const activeJobs = [...jobOrders, ...workOrders].filter(isActiveJob).length;
    return {
      total: openInvoices + activeJobs,
      openInvoices,
      activeJobs,
    };
  }, [effectiveInvoices, jobOrders, workOrders]);

  const chartData = useMemo(() => buildChartData(effectiveSales, debouncedRange), [debouncedRange, effectiveSales]);
  const subscriptions = useMemo(() => deriveSubscriptions(recurringInvoices, effectiveInvoices), [effectiveInvoices, recurringInvoices]);
  const recentInvoices = useMemo(() => deriveRecentInvoices(effectiveInvoices), [effectiveInvoices]);
  const recentPayments = useMemo(() => deriveRecentPayments(customerPayments), [customerPayments]);
  const activityRows = useMemo(() => deriveActivityRows(auditLogs), [auditLogs]);

  const chartHasLiveData = useMemo(() => (
    chartData.some((point) => point.income > 0 || point.expenditure > 0)
  ), [chartData]);

  const kpiCards = useMemo(() => ([
    {
      id: 'revenue',
      title: 'Revenue (This Month)',
      value: revenueThisMonth,
      helperText: revenueThisMonth > 0
        ? 'Recognized revenue across current billing activity.'
        : 'Awaiting billed revenue for the current month.',
      icon: CircleDollarSign,
      tone: 'primary' as const,
      format: 'currency' as const,
    },
    {
      id: 'collection',
      title: "Today's Collection",
      value: todayCollection,
      helperText: todayCollection > 0
        ? `${recentPayments.length} recent payments feeding today's cash position.`
        : 'No payment receipts have been posted today.',
      icon: CreditCard,
      tone: 'success' as const,
      format: 'currency' as const,
    },
    {
      id: 'active',
      title: 'Active Jobs / Invoices',
      value: activeJobsAndInvoices.total,
      helperText: activeJobsAndInvoices.total > 0
        ? `${activeJobsAndInvoices.activeJobs} live jobs and ${activeJobsAndInvoices.openInvoices} open invoices need attention.`
        : 'New jobs and open invoices will surface here automatically.',
      icon: BriefcaseBusiness,
      tone: 'warning' as const,
      format: 'count' as const,
      emptyLabel: 'No active jobs',
    },
  ]), [activeJobsAndInvoices.activeJobs, activeJobsAndInvoices.openInvoices, activeJobsAndInvoices.total, recentPayments.length, revenueThisMonth, todayCollection]);

  const chartHeaderMeta = useMemo(() => (
    <div className="dashboard-legend">
      <span className="dashboard-legend__item">
        <span className="dashboard-legend__swatch dashboard-legend__swatch--income" />
        Income
      </span>
      <span className="dashboard-legend__item">
        <span className="dashboard-legend__swatch dashboard-legend__swatch--expense" />
        Expenditure
      </span>
      {!chartHasLiveData ? <span className="dashboard-chip">Preview data</span> : null}
    </div>
  ), [chartHasLiveData]);

  const invoiceHeaderMeta = useMemo(() => (
    <span className="dashboard-chip">{recentInvoices.length} latest</span>
  ), [recentInvoices.length]);

  const paymentHeaderMeta = useMemo(() => (
    <span className="dashboard-chip">{recentPayments.length} latest</span>
  ), [recentPayments.length]);

  const activityHeaderMeta = useMemo(() => (
    <span className="dashboard-chip">{activityRows.length} events</span>
  ), [activityRows.length]);

  const syncLabel = useMemo(() => {
    if (isRefreshing) {
      return 'Refreshing live billing data...';
    }

    if (!lastUpdated) {
      return 'Waiting for dashboard sync';
    }

    const updatedAt = parseDateValue(lastUpdated);
    if (!updatedAt) {
      return 'Waiting for dashboard sync';
    }

    return `Updated ${TIME_LABEL.format(updatedAt)}`;
  }, [isRefreshing, lastUpdated]);

  const userInitial = useMemo(() => {
    const fullName = toSafeString(user?.name ?? user?.fullName ?? user?.username, 'U');
    return fullName.charAt(0).toUpperCase();
  }, [user?.fullName, user?.name, user?.username]);

  const dashboardHasUsableData = effectiveSales.length > 0
    || effectiveInvoices.length > 0
    || customerPayments.length > 0
    || recurringInvoices.length > 0
    || auditLogs.length > 0;

  const handleRangeChange = useCallback((nextRange: DashboardRange) => {
    startTransition(() => {
      setSelectedRange(nextRange);
    });
  }, []);

  const handleSearchSubmit = useCallback(() => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return;
    navigate(`/search?q=${encodeURIComponent(trimmedQuery)}`);
  }, [navigate, searchQuery]);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  }, []);

  const handleSearchKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSearchSubmit();
    }
  }, [handleSearchSubmit]);

  const handleRetry = useCallback(() => {
    void loadDashboard(false);
  }, [loadDashboard]);

  const handleOpenCalculator = useCallback(() => {
    setIsOpen(true);
  }, [setIsOpen]);

  const handleManageSubscriptions = useCallback((_subscriptionId: string) => {
    navigate('/sales-flow/subscriptions');
  }, [navigate]);

  const handleRangeButtonClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const nextRange = event.currentTarget.dataset.range as DashboardRange | undefined;
    if (!nextRange) return;
    handleRangeChange(nextRange);
  }, [handleRangeChange]);

  if (!isInitialized || (isLoading && !dashboardHasUsableData)) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="dashboard-shell">
      <div className="dashboard-shell__inner">
        <section className="dashboard-toolbar">
          <div className="dashboard-toolbar__search">
            <Search size={16} className="dashboard-toolbar__search-icon" />
            <input
              className="dashboard-toolbar__search-input"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search invoices, clients, receipts..."
            />
          </div>

          <div className="dashboard-toolbar__actions">
            <button type="button" className="dashboard-icon-button" onClick={handleOpenCalculator} aria-label="Open pricing calculator">
              <Calculator size={16} />
            </button>
            <button type="button" className="dashboard-icon-button" aria-label="Notifications">
              <Bell size={16} />
            </button>
            <button type="button" className="dashboard-button dashboard-button--ghost" onClick={handleRetry}>
              <RefreshCw size={15} className={isRefreshing ? 'dashboard-spin' : ''} />
              <span>Refresh</span>
            </button>
            <div className="dashboard-user-pill">
              <span className="dashboard-user-pill__avatar">{userInitial}</span>
              <div>
                <p className="dashboard-user-pill__label">{toSafeString(user?.name ?? user?.fullName, 'Prime user')}</p>
                <p className="dashboard-user-pill__meta">{syncLabel}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="dashboard-hero">
          <div>
            <p className="dashboard-hero__eyebrow">Billing cockpit</p>
            <h1 className="dashboard-hero__title">Premium SaaS billing and invoice control.</h1>
            <p className="dashboard-hero__subtitle">
              A cleaner operating view for collections, recurring billing, invoice throughput, and finance activity.
            </p>
          </div>

          <div className="dashboard-hero__controls">
            <div className="dashboard-range-switcher" role="tablist" aria-label="Dashboard range">
              {RANGE_OPTIONS.map((rangeOption) => (
                <button
                  key={rangeOption.value}
                  type="button"
                  data-range={rangeOption.value}
                  className={rangeOption.value === selectedRange ? 'dashboard-range-pill dashboard-range-pill--active' : 'dashboard-range-pill'}
                  onClick={handleRangeButtonClick}
                >
                  {rangeOption.label}
                </button>
              ))}
            </div>

            <div className="dashboard-sync-chip">
              <Activity size={15} />
              <span>{syncLabel}</span>
            </div>
          </div>
        </section>

        {dashboardError ? (
          <div className="dashboard-alert">
            <div>
              <strong>Heads up:</strong> {dashboardError}
            </div>
            <button type="button" className="dashboard-button dashboard-button--ghost" onClick={handleRetry}>
              Retry
            </button>
          </div>
        ) : null}

        <section className="dashboard-kpi-grid">
          {kpiCards.map((card) => (
            <KpiCard
              key={card.id}
              title={card.title}
              value={card.value}
              helperText={card.helperText}
              icon={card.icon}
              tone={card.tone}
              format={card.format}
              currencySymbol={currencySymbol}
              emptyLabel={card.emptyLabel}
            />
          ))}
        </section>

        <section className="dashboard-main-grid">
          <ChartCard
            title="Income vs Expenditure"
            subtitle={chartHasLiveData
              ? `Smooth ${debouncedRange} cashflow tracking across the latest billing activity.`
              : 'Preview mode stays visible until live billing activity lands.'}
            headerMeta={chartHeaderMeta}
            className={joinClassNames('dashboard-chart-card', isRefreshing && 'dashboard-card--refreshing')}
            loading={isRefreshing}
          >
            <IncomeVsExpenditureChart
              data={chartData}
              currencySymbol={currencySymbol}
              range={debouncedRange}
            />
          </ChartCard>

          <SubscriptionCard
            subscriptions={subscriptions}
            currencySymbol={currencySymbol}
            onManage={handleManageSubscriptions}
            isLoading={isRefreshing}
          />
        </section>

        <section className="dashboard-secondary-grid">
          <ChartCard
            title="Recent Invoices"
            subtitle="Fresh billing documents and the balances still open."
            headerMeta={invoiceHeaderMeta}
          >
            {recentInvoices.length > 0 ? (
              <div className="dashboard-table-wrap">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th>Due</th>
                      <th className="dashboard-table__numeric">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentInvoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td>
                          <div className="dashboard-table__primary">{invoice.id}</div>
                          <div className="dashboard-table__secondary">Issued {invoice.issueDate}</div>
                        </td>
                        <td>{invoice.customerName}</td>
                        <td>
                          <span className={`dashboard-status-badge dashboard-status-badge--${getInvoiceTone(invoice)}`}>
                            {invoice.status}
                          </span>
                        </td>
                        <td>{invoice.dueDate}</td>
                        <td className="dashboard-table__numeric">
                          <div className="dashboard-table__primary">{formatCurrency(currencySymbol, invoice.totalAmount)}</div>
                          <div className="dashboard-table__secondary">
                            {invoice.outstandingAmount > 0
                              ? `${formatCurrency(currencySymbol, invoice.outstandingAmount)} open`
                              : 'Settled'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={FileText}
                title="No recent invoices"
                description="The billing table will populate as soon as invoices are posted."
              />
            )}
          </ChartCard>

          <ChartCard
            title="Recent Payments"
            subtitle="Collections arriving through the latest receipt activity."
            headerMeta={paymentHeaderMeta}
          >
            {recentPayments.length > 0 ? (
              <div className="dashboard-list">
                {recentPayments.map((payment) => (
                  <article key={payment.id} className="dashboard-list-row">
                    <div className="dashboard-list-row__leading">
                      <div className="dashboard-list-row__icon">
                        <CreditCard size={16} />
                      </div>
                      <div>
                        <div className="dashboard-list-row__title">{payment.customerName}</div>
                        <div className="dashboard-list-row__subtitle">
                          {payment.id} - {payment.method}
                        </div>
                        <div className="dashboard-list-row__meta">{payment.reference}</div>
                      </div>
                    </div>

                    <div className="dashboard-list-row__trailing">
                      <div className="dashboard-list-row__amount">{formatCurrency(currencySymbol, payment.amount)}</div>
                      <span className={`dashboard-status-badge dashboard-status-badge--${getPaymentTone(payment)}`}>
                        {payment.status}
                      </span>
                      <div className="dashboard-list-row__meta">{payment.paymentDate}</div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={CreditCard}
                title="No recent payments"
                description="Customer receipts will appear here when collections are recorded."
              />
            )}
          </ChartCard>

          <ChartCard
            title="Activity Timeline"
            subtitle="Audit events across invoices, updates, and payment operations."
            headerMeta={activityHeaderMeta}
          >
            {activityRows.length > 0 ? (
              <div className="dashboard-timeline">
                {activityRows.map((activity) => (
                  <article key={activity.id} className="dashboard-timeline__item">
                    <span className={`dashboard-timeline__dot dashboard-timeline__dot--${activity.tone}`} aria-hidden="true" />
                    <div className="dashboard-timeline__content">
                      <div className="dashboard-timeline__title-row">
                        <h3 className="dashboard-timeline__title">{activity.title}</h3>
                        <span className="dashboard-timeline__time">{formatRelativeTime(activity.timestamp)}</span>
                      </div>
                      <p className="dashboard-timeline__detail">{activity.detail}</p>
                      <p className="dashboard-timeline__meta">
                        {activity.actor} - {formatShortDate(activity.timestamp)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Activity}
                title="No activity yet"
                description="Once users create, approve, or collect against invoices, the timeline will show it here."
              />
            )}
          </ChartCard>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
