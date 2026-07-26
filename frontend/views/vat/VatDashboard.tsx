import React, { useEffect, useMemo } from 'react';
import { useVatStore } from '../../stores/vatStore';
import { useAuth } from '../../context/AuthContext';
import { currencyService } from '../../services/currencyService';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
    TrendingUp, TrendingDown, DollarSign, Activity,
    ArrowUpRight, ArrowDownRight, FileText
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';

export const VatDashboard: React.FC = () => {
    const { transactions, returns, fetchVatData, isLoading } = useVatStore();
    const { companyConfig } = useAuth();
    const currency = currencyService.getCurrency(currencyService.getBaseCurrency())?.symbol || '$';

    useEffect(() => {
        fetchVatData();
    }, []);

    const stats = useMemo(() => {
        const currentMonth = new Date();
        const start = startOfMonth(currentMonth).toISOString();
        const end = endOfMonth(currentMonth).toISOString();

        const currentTx = transactions.filter(t => t.date >= start && t.date <= end);

        const inputTax = currentTx
            .filter(t => t.type === 'Input')
            .reduce((sum, t) => sum + t.amount, 0);

        const outputTax = currentTx
            .filter(t => t.type === 'Output')
            .reduce((sum, t) => sum + t.amount, 0);

        const net = outputTax - inputTax;

        return {
            inputTax,
            outputTax,
            net,
            count: currentTx.length
        };
    }, [transactions]);

    const chartData = useMemo(() => {
        const end = new Date();
        const start = subMonths(end, 6);
        const months = eachMonthOfInterval({ start, end });

        return months.map(date => {
            const monthStart = startOfMonth(date).toISOString();
            const monthEnd = endOfMonth(date).toISOString();

            const monthTx = transactions.filter(t =>
                t.date >= monthStart && t.date <= monthEnd
            );

            const input = monthTx
                .filter(t => t.type === 'Input')
                .reduce((sum, t) => sum + t.amount, 0);

            const output = monthTx
                .filter(t => t.type === 'Output')
                .reduce((sum, t) => sum + t.amount, 0);

            return {
                name: format(date, 'MMM'),
                Input: input,
                Output: output,
                Net: output - input
            };
        });
    }, [transactions]);

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-emerald-500 hover:bg-slate-50 transition-all">
                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                        <ArrowUpRight size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">Output tax (sales)</p>
                        <p className="text-lg md:text-xl font-semibold text-slate-900 finance-nums">{currency} {stats.outputTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        <p className="text-[10px] text-emerald-600 mt-0.5">Current month</p>
                    </div>
                </div>
                <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-rose-500 hover:bg-slate-50 transition-all">
                    <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
                        <ArrowDownRight size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">Input tax (purchases)</p>
                        <p className="text-lg md:text-xl font-semibold text-slate-900 finance-nums">{currency} {stats.inputTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        <p className="text-[10px] text-rose-600 mt-0.5">Current month</p>
                    </div>
                </div>
                <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-blue-500 hover:bg-slate-50 transition-all">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                        <DollarSign size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">Net payable</p>
                        <p className={`text-lg md:text-xl font-semibold finance-nums ${stats.net >= 0 ? 'text-slate-900' : 'text-emerald-600'}`}>{currency} {Math.abs(stats.net).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        <p className={`text-[10px] mt-0.5 ${stats.net >= 0 ? 'text-slate-500' : 'text-emerald-600'}`}>{stats.net >= 0 ? 'To pay' : 'Refundable'}</p>
                    </div>
                </div>
            </div>

            {/* Charts & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 tablet-auto-fit-280 tablet-auto-fit-reset gap-6">
                <div className="lg:col-span-2 bg-white p-[24px] rounded-[1.5rem] border border-slate-200 shadow-sm">
                    <h3 className="font-semibold text-slate-800 tracking-tighter text-[16px] mb-4 flex items-center">
                        <Activity className="mr-2 text-slate-500" size={20} />
                        VAT liability trend (6 months)
                    </h3>
                    <div style={{ width: '100%', height: 320, minHeight: 150 }}>
                        {/* console.log("Chart container mounted", chartData) */}
                        <ResponsiveContainer width="100%" height="100%" minHeight={150} minWidth={0}>
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip
                                    formatter={(value: number) => [`${currency} ${value.toLocaleString()}`, '']}
                                />
                                <Legend />
                                <Bar dataKey="Output" fill="#10B981" name="Output tax" />
                                <Bar dataKey="Input" fill="#EF4444" name="Input tax" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-[24px] rounded-[1.5rem] border border-slate-200 shadow-sm">
                    <h3 className="font-semibold text-slate-800 tracking-tighter text-[16px] mb-4 flex items-center">
                        <FileText className="mr-2 text-slate-500" size={20} />
                        Recent returns
                    </h3>
                    <div className="space-y-4">
                        {returns.length === 0 ? (
                            <div className="text-center py-8 text-slate-400">
                                No returns generated yet
                            </div>
                        ) : (
                            returns.slice(0, 5).map(ret => (
                                <div key={ret.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50">
                                    <div>
                                        <p className="font-medium text-slate-800">
                                            {format(parseISO(ret.periodStart), 'MMM yyyy')}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {ret.status} - {format(parseISO(ret.periodEnd), 'dd MMM')}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-sm">
                                            {currency} {ret.netPayable.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
