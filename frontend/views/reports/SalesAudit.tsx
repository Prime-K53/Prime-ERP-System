import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { format, parseISO, startOfWeek, startOfMonth, isWithinInterval, isSameDay } from 'date-fns';
import {
    DollarSign, CreditCard, Wallet, Banknote, Smartphone, ArrowDownUp,
    TrendingUp, ChevronDown, ChevronUp, Clock,
    Calendar, Printer, BarChart3, Users,
    Receipt, XCircle, CheckCircle, RefreshCw, Activity
} from 'lucide-react';
import { Sale, CustomerPayment } from '../../types';

type DateRangeFilter = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all';

interface SalesAuditData {
    totalSales: number;
    totalTransactions: number;
    byPaymentMethod: Record<string, { count: number; amount: number }>;
    byStatus: Record<string, { count: number; amount: number }>;
    byCashier: Record<string, { count: number; amount: number }>;
    dailyBreakdown: { date: string; sales: number; count: number; byMethod: Record<string, number> }[];
    voidedAmount: number;
    refundedAmount: number;
    averageTransaction: number;
    topTransactions: Sale[];
    recentPayments: CustomerPayment[];
}

const SalesAudit: React.FC = () => {
    const { sales = [], customerPayments = [], companyConfig, allUsers = [] } = useData();
    const currency = companyConfig?.currencySymbol || '$';
    const [dateRange, setDateRange] = useState<DateRangeFilter>('today');
    const [expandedSection, setExpandedSection] = useState<string | null>('daily');

    const formatCurrency = (val: number) => {
        if (val === undefined || val === null || isNaN(val)) return `${currency}0.00`;
        return `${currency}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const filterByDateRange = (dateStr: string): boolean => {
        if (dateRange === 'all') return true;
        const date = parseISO(dateStr);
        const now = new Date();

        switch (dateRange) {
            case 'today':
                return isSameDay(date, now);
            case 'week': {
                const weekStart = startOfWeek(now, { weekStartsOn: 1 });
                return isWithinInterval(date, { start: weekStart, end: now });
            }
            case 'month':
                return isWithinInterval(date, { start: startOfMonth(now), end: now });
            case 'quarter': {
                const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
                return isWithinInterval(date, { start: quarterStart, end: now });
            }
            case 'year':
                return date.getFullYear() === now.getFullYear();
            default:
                return true;
        }
    };

    const auditData: SalesAuditData = useMemo(() => {
        const filteredSales = (sales || []).filter(s => filterByDateRange(s.date));
        const filteredPayments = (customerPayments || []).filter(p => filterByDateRange(p.date));

        const filteredSalesForRevenue = filteredSales.filter(s => s.status !== 'Cancelled' && s.status !== 'Voided' && s.status !== 'Draft');

        // Total sales and transactions - use the revenue-filtered list
        const totalSales = filteredSalesForRevenue.reduce((sum, s) => sum + (s.totalAmount || s.total || 0), 0);
        const totalTransactions = filteredSalesForRevenue.length;

        // By payment method - use the revenue-filtered list
        const byPaymentMethod: Record<string, { count: number; amount: number }> = {};
        filteredSalesForRevenue.forEach(sale => {
            const total = sale.totalAmount || sale.total || 0;

            // For split payments, allocate to underlying methods only to avoid double-counting.
            if (sale.paymentMethod === 'Split' && sale.payments && sale.payments.length > 0) {
                sale.payments.forEach(p => {
                    const subMethod = p.method || 'Cash';
                    if (!byPaymentMethod[subMethod]) {
                        byPaymentMethod[subMethod] = { count: 0, amount: 0 };
                    }
                    byPaymentMethod[subMethod].count++;
                    byPaymentMethod[subMethod].amount += p.amount || 0;
                });
                return;
            }

            const method = sale.paymentMethod || 'Cash';
            if (!byPaymentMethod[method]) {
                byPaymentMethod[method] = { count: 0, amount: 0 };
            }
            byPaymentMethod[method].count++;
            byPaymentMethod[method].amount += total;
        });

        // By status - keep all filtered sales to show breakdown including Cancelled
        const byStatus: Record<string, { count: number; amount: number }> = {};
        filteredSales.forEach(sale => {
            const status = sale.status || 'Unknown';
            if (!byStatus[status]) {
                byStatus[status] = { count: 0, amount: 0 };
            }
            byStatus[status].count++;
            byStatus[status].amount += (sale.totalAmount || sale.total || 0);
        });

        // By cashier - use the revenue-filtered list
        const byCashier: Record<string, { count: number; amount: number }> = {};
        filteredSalesForRevenue.forEach(sale => {
            const cashierId = sale.cashierId || 'Unknown';
            if (!byCashier[cashierId]) {
                byCashier[cashierId] = { count: 0, amount: 0 };
            }
            byCashier[cashierId].count++;
            byCashier[cashierId].amount += (sale.totalAmount || sale.total || 0);
        });

        // Daily breakdown - use the revenue-filtered list
        const dailyMap = new Map<string, { sales: number; count: number; byMethod: Record<string, number> }>();
        filteredSalesForRevenue.forEach(sale => {
            const dateKey = sale.date.split('T')[0];
            const existing = dailyMap.get(dateKey) || { sales: 0, count: 0, byMethod: {} };
            const total = sale.totalAmount || sale.total || 0;
            existing.sales += total;
            existing.count++;

            if (sale.paymentMethod === 'Split' && sale.payments && sale.payments.length > 0) {
                sale.payments.forEach(p => {
                    const method = p.method || 'Cash';
                    existing.byMethod[method] = (existing.byMethod[method] || 0) + (p.amount || 0);
                });
            } else {
                const method = sale.paymentMethod || 'Cash';
                existing.byMethod[method] = (existing.byMethod[method] || 0) + total;
            }
            dailyMap.set(dateKey, existing);
        });

        const dailyBreakdown = Array.from(dailyMap.entries())
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => b.date.localeCompare(a.date));

        // Voided and refunded amounts
        const voidedAmount = filteredSales
            .filter(s => s.status === 'Cancelled' || s.status === 'Refunded')
            .reduce((sum, s) => sum + (s.totalAmount || s.total || 0), 0);
        const refundedAmount = filteredSales
            .filter(s => s.status === 'Refunded')
            .reduce((sum, s) => sum + (s.totalAmount || s.total || 0), 0);

        // Average transaction
        const averageTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;

        // Top transactions
        const topTransactions = [...filteredSales]
            .sort((a, b) => (b.totalAmount || b.total || 0) - (a.totalAmount || a.total || 0))
            .slice(0, 10);

        // Recent payments
        const recentPayments = [...filteredPayments]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 10);

        return {
            totalSales,
            totalTransactions,
            byPaymentMethod,
            byStatus,
            byCashier,
            dailyBreakdown,
            voidedAmount,
            refundedAmount,
            averageTransaction,
            topTransactions,
            recentPayments
        };
    }, [sales, customerPayments, dateRange]);

    const getPaymentMethodIcon = (method: string) => {
        switch (method) {
            case 'Cash': return <Banknote size={18} className="text-emerald-500" />;
            case 'Card': return <CreditCard size={18} className="text-blue-500" />;
            case 'Mobile Money': return <Smartphone size={18} className="text-purple-500" />;
            case 'Wallet': return <Wallet size={18} className="text-amber-500" />;
            case 'Split': return <ArrowDownUp size={18} className="text-slate-500" />;
            default: return <DollarSign size={18} className="text-slate-400" />;
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Paid': return <CheckCircle size={16} className="text-emerald-500" />;
            case 'Partial': return <Clock size={16} className="text-amber-500" />;
            case 'Cancelled': return <XCircle size={16} className="text-rose-500" />;
            case 'Refunded': return <RefreshCw size={16} className="text-rose-500" />;
            default: return <Clock size={16} className="text-slate-400" />;
        }
    };

    const getCashierName = (cashierId: string) => {
        const user = allUsers.find(u => u.id === cashierId);
        return user?.fullName || user?.name || cashierId;
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header with Date Filter */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 tracking-tight">Sales Audit Report</h2>
                    <p className="text-sm text-slate-500 mt-1">Reconciliation and transaction analysis</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                        {(['today', 'week', 'month', 'quarter', 'year', 'all'] as const).map(range => (
                            <button
                                key={range}
                                onClick={() => setDateRange(range)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${dateRange === range
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                    }`}
                            >
                                {range.charAt(0).toUpperCase() + range.slice(1)}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => window.print()}
                        className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
                    >
                        <Printer size={18} />
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 tracking-[0.15em] uppercase mb-1">Total Revenue</p>
                            <h3 className="text-3xl font-black text-slate-900 tabular-nums leading-none group-hover:text-blue-600 transition-colors">{formatCurrency(auditData.totalSales)}</h3>
                            <p className="text-[11px] text-slate-500 mt-2 font-bold flex items-center gap-1.5">
                                <Activity size={12} className="text-blue-500" />
                                {auditData.totalTransactions} transactions
                            </p>
                        </div>
                        <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-lg shadow-blue-100 group-hover:scale-110 transition-transform">
                            <DollarSign size={28} />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 tracking-[0.15em] uppercase mb-1">Avg Transaction</p>
                            <h3 className="text-3xl font-black text-slate-900 tabular-nums leading-none group-hover:text-emerald-600 transition-colors">{formatCurrency(auditData.averageTransaction)}</h3>
                            <p className="text-[11px] text-slate-500 mt-2 font-bold flex items-center gap-1.5">
                                <TrendingUp size={12} className="text-emerald-500" />
                                Per sale average
                            </p>
                        </div>
                        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shadow-lg shadow-emerald-100 group-hover:scale-110 transition-transform">
                            <BarChart3 size={28} />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 tracking-[0.15em] uppercase mb-1">Voided/Cancelled</p>
                            <h3 className="text-3xl font-black text-rose-600 tabular-nums leading-none transition-colors">{formatCurrency(auditData.voidedAmount)}</h3>
                            <p className="text-[11px] text-slate-500 mt-2 font-bold flex items-center gap-1.5">
                                <XCircle size={12} className="text-rose-400" />
                                Non-collected
                            </p>
                        </div>
                        <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 shadow-lg shadow-rose-100 group-hover:scale-110 transition-transform">
                            <XCircle size={28} />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 tracking-[0.15em] uppercase mb-1">Payments Received</p>
                            <h3 className="text-3xl font-black text-blue-900 tabular-nums leading-none group-hover:text-blue-700 transition-colors">{auditData.recentPayments.length}</h3>
                            <p className="text-[11px] text-slate-500 mt-2 font-bold flex items-center gap-1.5">
                                <Receipt size={12} className="text-amber-500" />
                                Settlement records
                            </p>
                        </div>
                        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 shadow-lg shadow-amber-100 group-hover:scale-110 transition-transform">
                            <Receipt size={28} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Payment Method & Status Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="font-black text-slate-800 text-lg tracking-tight flex items-center gap-2">
                                <Wallet size={20} className="text-blue-500" />
                                Revenue Analysis
                            </h3>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">BY PAYMENT METHOD</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {Object.entries(auditData.byPaymentMethod)
                            .sort((a, b) => b[1].amount - a[1].amount)
                            .map(([method, data]) => (
                                <div key={method} className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-3xl group hover:bg-white hover:shadow-lg hover:border-blue-100 transition-all duration-300">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                                            {getPaymentMethodIcon(method)}
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-800 text-sm">{method}</p>
                                            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-tighter">{data.count} Settlements</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-slate-900 tabular-nums">{formatCurrency(data.amount)}</p>
                                        <div className="flex items-center justify-end gap-1.5 mt-0.5">
                                            <div className="w-12 h-1 bg-slate-200 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-blue-500 transition-all duration-1000" 
                                                    style={{ width: `${auditData.totalSales > 0 ? (data.amount / auditData.totalSales) * 100 : 0}%` }}
                                                />
                                            </div>
                                            <p className="text-[11px] text-blue-600 font-black">
                                                {auditData.totalSales > 0 ? ((data.amount / auditData.totalSales) * 100).toFixed(1) : 0}%
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>

                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="font-black text-slate-800 text-lg tracking-tight flex items-center gap-2">
                                <BarChart3 size={20} className="text-emerald-500" />
                                Execution Status
                            </h3>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">TRANSACTION BREAKDOWN</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {Object.entries(auditData.byStatus)
                            .sort((a, b) => b[1].count - a[1].count)
                            .map(([status, data]) => (
                                <div key={status} className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-3xl group hover:bg-white hover:shadow-lg hover:border-emerald-100 transition-all duration-300">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                                            {getStatusIcon(status)}
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-800 text-sm">{status}</p>
                                            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-tighter">{data.count} Occurrences</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-slate-900 tabular-nums">{formatCurrency(data.amount)}</p>
                                        <span className={`inline-block px-3 py-0.5 mt-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                            status === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                            status === 'Cancelled' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                            'bg-amber-50 text-amber-600 border-amber-100'
                                        }`}>
                                            {status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            </div>

            {/* Cashier Performance */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <button
                    onClick={() => setExpandedSection(expandedSection === 'cashier' ? null : 'cashier')}
                    className="w-full flex items-center justify-between group"
                >
                    <div className="text-left">
                        <h3 className="font-black text-slate-800 text-lg tracking-tight flex items-center gap-2">
                            <Users size={20} className="text-purple-500" />
                            Operator Performance
                        </h3>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 group-hover:text-purple-400 transition-colors">Individual Efficiency Metrics</p>
                    </div>
                    {expandedSection === 'cashier' ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                </button>
                {expandedSection === 'cashier' && (
                    <div className="mt-8 overflow-hidden rounded-3xl border border-slate-100">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead>
                                    <tr className="bg-slate-50/50 text-slate-400 font-black text-[10px] tracking-widest uppercase border-b border-slate-100">
                                        <th className="px-6 py-4">Cashier / Operator</th>
                                        <th className="px-6 py-4 text-right">Transactions</th>
                                        <th className="px-6 py-4 text-right">Total Collection</th>
                                        <th className="px-6 py-4 text-right">Ticket Average</th>
                                        <th className="px-6 py-4 text-right">Share</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {Object.entries(auditData.byCashier)
                                        .sort((a, b) => b[1].amount - a[1].amount)
                                        .map(([cashierId, data]) => (
                                            <tr key={cashierId} className="hover:bg-indigo-50/30 transition-colors group">
                                                <td className="px-6 py-4 font-black text-slate-700 group-hover:text-indigo-600">{getCashierName(cashierId)}</td>
                                                <td className="px-6 py-4 text-right text-slate-600 font-bold tabular-nums">{data.count}</td>
                                                <td className="px-6 py-4 text-right font-black text-slate-900 tabular-nums">{formatCurrency(data.amount)}</td>
                                                <td className="px-6 py-4 text-right text-slate-600 font-bold tabular-nums">{formatCurrency(data.amount / (data.count || 1))}</td>
                                                <td className="px-6 py-4 text-right text-slate-500 tabular-nums">
                                                    <span className="bg-slate-100 px-2.5 py-0.5 rounded-full text-[10px] font-black text-slate-600 border border-slate-200">
                                                        {auditData.totalSales > 0 ? ((data.amount / auditData.totalSales) * 100).toFixed(1) : 0}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Daily Breakdown */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <button
                    onClick={() => setExpandedSection(expandedSection === 'daily' ? null : 'daily')}
                    className="w-full flex items-center justify-between group"
                >
                    <div className="text-left">
                        <h3 className="font-black text-slate-800 text-lg tracking-tight flex items-center gap-2">
                            <Calendar size={20} className="text-blue-500" />
                            Daily Reconciliation
                        </h3>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 group-hover:text-blue-400 transition-colors">Chronological Settlement Ledger</p>
                    </div>
                    {expandedSection === 'daily' ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                </button>
                {expandedSection === 'daily' && (
                    <div className="mt-8 overflow-hidden rounded-3xl border border-slate-100">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead>
                                    <tr className="bg-slate-50/50 text-slate-400 font-black text-[10px] tracking-widest uppercase border-b border-slate-100">
                                        <th className="px-6 py-4">Financial Date</th>
                                        <th className="px-6 py-4 text-right">Transactions</th>
                                        <th className="px-6 py-4 text-right">Volume Total</th>
                                        <th className="px-6 py-4 text-right">Cash</th>
                                        <th className="px-6 py-4 text-right">Card</th>
                                        <th className="px-6 py-4 text-right">Mobile</th>
                                        <th className="px-6 py-4 text-right">Misc</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {auditData.dailyBreakdown.slice(0, 30).map(day => (
                                        <tr key={day.date} className="hover:bg-blue-50/30 transition-colors group">
                                            <td className="px-6 py-4 font-black text-slate-700">
                                                {format(parseISO(day.date), 'EEE, MMM dd, yyyy')}
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-600 font-bold tabular-nums">{day.count}</td>
                                            <td className="px-6 py-4 text-right font-black text-slate-900 tabular-nums">{formatCurrency(day.sales)}</td>
                                            <td className="px-6 py-4 text-right text-emerald-600 font-bold tabular-nums">{formatCurrency(day.byMethod['Cash'] || 0)}</td>
                                            <td className="px-6 py-4 text-right text-blue-600 font-bold tabular-nums">{formatCurrency(day.byMethod['Card'] || 0)}</td>
                                            <td className="px-6 py-4 text-right text-purple-600 font-bold tabular-nums">{formatCurrency(day.byMethod['Mobile Money'] || 0)}</td>
                                            <td className="px-6 py-4 text-right text-slate-500 font-bold tabular-nums">
                                                {formatCurrency((day.byMethod['Wallet'] || 0) + (day.byMethod['Bank Transfer'] || 0) + (day.byMethod['Split'] || 0))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Top Transactions & Recent Payments */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                    <h3 className="font-black text-slate-800 text-lg tracking-tight mb-8 flex items-center gap-2">
                        <TrendingUp size={20} className="text-emerald-500" />
                        Significant Settlements
                    </h3>
                    <div className="overflow-x-auto -mx-2 px-2">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="text-slate-400 font-black text-[10px] tracking-widest uppercase border-b border-slate-100">
                                    <th className="px-4 py-3">REF ID</th>
                                    <th className="px-4 py-3">Customer Entity</th>
                                    <th className="px-4 py-3 text-right">Execution Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {auditData.topTransactions.map(sale => (
                                    <tr key={sale.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-4 py-4">
                                            <span className="font-black text-[10px] text-slate-400 bg-slate-100 px-2 py-1 rounded inline-block">#{sale.id.slice(-6)}</span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-700 text-xs">{sale.customerName || 'Standard Client'}</span>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase">{sale.paymentMethod} SETTLEMENT</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <p className="font-black text-slate-900 tabular-nums">{formatCurrency(sale.totalAmount || sale.total || 0)}</p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                    <h3 className="font-black text-slate-800 text-lg tracking-tight mb-8 flex items-center gap-2">
                        <Receipt size={20} className="text-amber-500" />
                        Live Cashflow Feed
                    </h3>
                    <div className="overflow-x-auto -mx-2 px-2">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="text-slate-400 font-black text-[10px] tracking-widest uppercase border-b border-slate-100">
                                    <th className="px-4 py-3">Timestamp</th>
                                    <th className="px-4 py-3">Entity</th>
                                    <th className="px-4 py-3 text-right">Credit Value</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {auditData.recentPayments.map(payment => (
                                    <tr key={payment.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-4 py-4">
                                            <span className="font-black text-[10px] text-slate-500 uppercase">{format(parseISO(payment.date), 'MMM dd, HH:mm')}</span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-700 text-xs">{payment.customerName}</span>
                                                <span className="text-[10px] text-emerald-500 font-bold uppercase">{payment.paymentMethod}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <p className="font-black text-emerald-600 tabular-nums underline decoration-emerald-100 underline-offset-4">{formatCurrency(payment.amount)}</p>
                                        </td>
                                    </tr>
                                ))}
                                {auditData.recentPayments.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-12 text-center text-slate-400 font-black uppercase text-[10px] tracking-widest lg:py-24">No Active Records Found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SalesAudit;
