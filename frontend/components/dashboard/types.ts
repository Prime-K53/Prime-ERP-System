import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export type DashboardRange = 'weekly' | 'monthly' | 'yearly';

export type DashboardTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

export interface DashboardChartPoint {
  label: string;
  income: number;
  expenditure: number;
}

export interface DashboardSubscription {
  id: string;
  companyName: string;
  planName: string;
  price: number;
  status: 'Active' | 'Paused' | 'Draft' | 'Cancelled';
  nextBillingDate: string;
  frequencyLabel: string;
  cycleLabel: string;
  daysUntilBilling: number;
  cycleProgress: number;
  notes: string;
}

export interface DashboardInvoiceRow {
  id: string;
  customerName: string;
  status: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  outstandingAmount: number;
}

export interface DashboardPaymentRow {
  id: string;
  customerName: string;
  status: string;
  paymentDate: string;
  method: string;
  amount: number;
  reference: string;
}

export interface DashboardActivityRow {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  actor: string;
  tone: DashboardTone;
}

export interface KpiCardProps {
  title: string;
  value: number;
  helperText: string;
  icon: LucideIcon;
  tone?: DashboardTone;
  format?: 'currency' | 'count';
  currencySymbol?: string;
  emptyLabel?: string;
}

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  headerMeta?: ReactNode;
  footer?: ReactNode;
  className?: string;
  loading?: boolean;
  children: ReactNode;
}

export interface IncomeVsExpenditureChartProps {
  data: DashboardChartPoint[];
  currencySymbol?: string;
  range: DashboardRange;
}

export interface SubscriptionCardProps {
  subscriptions: DashboardSubscription[];
  currencySymbol?: string;
  isLoading?: boolean;
  onManage: (subscriptionId: string) => void;
}
