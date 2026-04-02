import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import {
   Search, Bell, Calculator, LayoutTemplate, Mail,
   TrendingUp, TrendingDown, DollarSign, Users, Briefcase,
   ChevronRight, CircleDashed, Activity, Eye, EyeOff, Trash2
} from 'lucide-react';
import {
   BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, LabelList
} from 'recharts';

const CircularProgress = ({ val, color, icon: Icon }: any) => {
   const radius = 22;
   const circumference = 2 * Math.PI * radius;
   const strokeDashoffset = circumference - (val / 100) * circumference;

   return (
      <div className="relative w-14 h-14 flex items-center justify-center">
         <svg width="56" height="56" className="transform -rotate-90">
            <circle cx="28" cy="28" r={radius} stroke="currentColor" strokeWidth="3" fill="transparent" className="text-slate-100" />
            <circle cx="28" cy="28" r={radius} stroke="currentColor" strokeWidth="3" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className={`transition-all duration-1000 ${color}`} />
         </svg>
         <div className={`absolute inset-0 flex items-center justify-center ${color}`}>
            <Icon size={18} strokeWidth={1.5} />
         </div>
      </div>
   );
};

const MetricCard = ({ title, value, trend, isPositive, progress, color, icon: Icon, onClick }: any) => (
   <div
      onClick={onClick}
      className={`bg-white rounded-[2rem] p-6 border border-slate-200 flex items-center justify-between hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-500 cursor-pointer group relative overflow-hidden`}
   >
      <div className={`absolute top-0 left-0 w-1.5 h-full ${color.replace('text-', 'bg-')} opacity-20 transition-opacity group-hover:opacity-100`}></div>
      <div className="relative z-10">
         <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.15em] mb-2 group-hover:text-slate-600 transition-colors">{title}</p>
         <h3 className="text-[28px] font-black text-slate-900 tracking-tight mb-2.5 tabular-nums leading-none">{String(value ?? '')}</h3>
         <div className="flex items-center gap-2.5">
            <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${isPositive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
               {isPositive ? <TrendingUp size={12} strokeWidth={2.5} /> : <TrendingDown size={12} strokeWidth={2.5} />}
               {trend}
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">vs LW</span>
         </div>
      </div>
      <div className="group-hover:scale-110 transition-transform duration-500">
         <CircularProgress val={progress} color={color} icon={Icon} />
      </div>
   </div>
);

const SubscriptionSlider = ({ subscriptions, navigate }: { subscriptions: any[]; navigate: (path: string) => void }) => {
   const [idx, setIdx] = useState(0);

   useEffect(() => {
      if (!subscriptions || subscriptions.length <= 1) return;
      const timer = setInterval(() => setIdx(prev => (prev + 1) % subscriptions.length), 5000);
      return () => clearInterval(timer);
   }, [subscriptions]);

   return (
      <div className="bg-white rounded-[2rem] p-7 border border-slate-200 flex flex-col h-full overflow-hidden hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-500 relative">
         <div className="flex justify-between items-center mb-8 z-10 relative">
            <div>
               <h3 className="text-[18px] font-black text-slate-800 tracking-tight flex items-center gap-2.5">
                  <Activity className="text-indigo-600 animate-pulse" size={20} />
                  Live Contracts
               </h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Recurring Revenue Streams</p>
            </div>
            <div className="flex gap-2">
               {subscriptions?.map((_: any, i: number) => (
                  <button key={i} onClick={() => setIdx(i)} className={`h-1.5 rounded-full transition-all duration-500 cursor-pointer ${i === idx ? 'w-6 bg-indigo-600 shadow-sm shadow-indigo-200' : 'w-1.5 bg-slate-200 hover:bg-slate-300'}`} />
               ))}
            </div>
         </div>

         <div className="flex-1 relative overflow-hidden">
            <div
               className="flex transition-transform duration-1000 cubic-bezier(0.4, 0, 0.2, 1) h-full"
               style={{ transform: `translateX(-${idx * 100}%)` }}
            >
               {subscriptions.map((sub: any, i: number) => (
                  <div key={i} className="min-w-full flex flex-col justify-between px-1">
                     <div>
                        <div className="mb-6">
                           <h4 className="text-[22px] font-black text-slate-900 mb-1 leading-tight">{sub.name}</h4>
                           <span className="inline-block px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase tracking-wider border border-indigo-100">Active Node</span>
                        </div>

                        <div className="space-y-3.5 mb-8">
                           <div className="flex justify-between items-center py-2.5 border-b border-slate-50">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Next Settlement</span>
                              <span className="text-[13px] text-slate-700 font-black tabular-nums">{sub.nextDate}</span>
                           </div>
                           <div className="flex justify-between items-center py-2.5 border-b border-slate-50">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Node Allocation</span>
                              <span className="text-[13px] text-slate-700 font-black tabular-nums">{sub.qty} Unit Series</span>
                           </div>
                           <div className="flex justify-between items-baseline pt-4">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Yield Value</span>
                              <span className="text-[24px] text-slate-900 font-black tabular-nums leading-none tracking-tight">{sub.price}</span>
                           </div>
                        </div>
                     </div>

                     <div className="flex gap-4">
                        <button onClick={() => navigate(`/quotations/${sub.id}`)} className="flex-1 py-3 px-4 rounded-2xl bg-slate-900 text-white font-black text-[12px] hover:bg-indigo-600 transition-all duration-300 shadow-lg shadow-slate-200">
                           Manage Asset
                        </button>
                        <button onClick={() => navigate(`/quotations/${sub.id}`)} className="flex-1 py-3 px-4 rounded-2xl border border-slate-200 text-slate-700 font-black text-[12px] hover:bg-slate-50 hover:border-slate-300 transition-all duration-300">
                           Report
                        </button>
                     </div>
                  </div>
               ))}
            </div>
         </div>
      </div>
   );
};

// Standalone Chart Component to isolate state and limit re-renders
const AnalyticsEngineChart = ({ sales = [], invoices = [], purchases = [], range = 'Monthly' }: { sales: any[]; invoices: any[]; purchases: any[]; range: 'Monthly' | 'Quarterly' | 'Annual' }) => {
   const [data, setData] = useState<any[]>([]);
   const [loading, setLoading] = useState<boolean>(true);

   const chartData = useMemo(() => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
      const now = new Date();
      const currentYear = now.getFullYear();

      // Aggregate revenue (income) by month from invoices and sales
      const revenueByMonth = new Array(12).fill(0);
      const expensesByMonth = new Array(12).fill(0);

      [...invoices, ...sales].forEach((item: any) => {
         if (item.status === 'Cancelled' || item.status === 'Void') return;
         const dateVal = item.date || item.createdAt;
         if (!dateVal) return;
         const date = new Date(dateVal);
         if (isNaN(date.getTime())) return;

         if (date.getFullYear() === currentYear) {
            const month = date.getMonth();
            revenueByMonth[month] += Number(item.totalAmount || item.total || 0);
         }
      });

      purchases.forEach((item: any) => {
         if (item.status === 'Cancelled' || item.status === 'Void') return;
         const dateVal = item.date || item.createdAt;
         if (!dateVal) return;
         const date = new Date(dateVal);
         if (isNaN(date.getTime())) return;

         if (date.getFullYear() === currentYear) {
            const month = date.getMonth();
            expensesByMonth[month] += Number(item.totalAmount || item.total || item.amount || 0);
         }
      });

      if (range === 'Annual') {
         return [{
            label: currentYear.toString(),
            income: revenueByMonth.reduce((a, b) => a + b, 0),
            expenditure: expensesByMonth.reduce((a, b) => a + b, 0)
         }];
      }

      if (range === 'Quarterly') {
         return quarters.map((label, q) => ({
            label,
            income: revenueByMonth.slice(q * 3, (q + 1) * 3).reduce((a, b) => a + b, 0),
            expenditure: expensesByMonth.slice(q * 3, (q + 1) * 3).reduce((a, b) => a + b, 0)
         }));
      }

      // Default Monthly
      return months.map((label, i) => ({
         label,
         income: revenueByMonth[i],
         expenditure: expensesByMonth[i]
      }));
   }, [sales, invoices, purchases, range]);

   useEffect(() => {
      let isMounted = true;
      async function fetchData() {
         try {
            setLoading(true);
            await new Promise(resolve => setTimeout(resolve, 400));
            if (isMounted) {
               setData(chartData);
               setLoading(false);
            }
         } catch (err) {
            console.error("Chart loading failure:", err);
            if (isMounted) {
               setData(chartData);
               setLoading(false);
            }
         }
      }
      fetchData();
   }, [chartData]);

   if (loading) {
      return (
         <div className="w-full h-[320px] bg-slate-50/50 border border-slate-100 rounded-xl flex flex-col items-center justify-center">
            <Activity size={28} className="text-indigo-400 mb-3 animate-pulse opacity-50" />
            <span className="text-slate-500 text-[13px] font-medium tracking-tight animate-pulse">Loading analytics...</span>
         </div>
      );
   }

   const hasData = useMemo(() => data.some((d: any) => d.income > 0 || d.expenditure > 0), [data]);

   if (!hasData) {
      return (
         <div className="w-full h-[320px] bg-slate-50/50 border border-slate-100 rounded-xl flex flex-col items-center justify-center text-slate-500 animate-in fade-in duration-500">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-4 border border-slate-100">
               <CircleDashed size={32} className="text-slate-300 animate-[spin_8s_linear_infinite]" />
            </div>
            <p className="text-[14px] font-bold tracking-tight text-slate-700">Analytics Engine Initializing</p>
            <p className="text-[12px] text-slate-400 mt-1 max-w-[220px] text-center font-medium">Add invoices or sales to begin generating income and expenditure benchmarks.</p>
         </div>
      );
   }

   return (
      <div className="w-full h-[320px] animate-in fade-in duration-700" style={{ position: 'relative' }}>
         <ResponsiveContainer width="100%" height="100%" minHeight={320}>
            <BarChart data={data} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
               <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                  dy={10}
               />
               <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                  width={45}
                  tickFormatter={(val) => `$${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val}`}
               />
               <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{
                     borderRadius: '16px',
                     border: 'none',
                     boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
                     padding: '16px',
                     fontSize: '12px',
                     backgroundColor: '#ffffff',
                     fontWeight: '700'
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
               />
               <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.025em', color: '#64748b' }} />
               <Bar
                  dataKey="income"
                  name="Income"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
               >
                  <LabelList
                     dataKey="income"
                     position="top"
                     offset={8}
                     formatter={(val: number) => val > 0 ? `$${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}` : ''}
                     style={{ fontSize: '9px', fontWeight: 'bold', fill: '#059669' }}
                  />
               </Bar>
               <Bar
                  dataKey="expenditure"
                  name="Expenditure"
                  fill="#ef4444"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
               >
                  <LabelList
                     dataKey="expenditure"
                     position="top"
                     offset={8}
                     formatter={(val: number) => val > 0 ? `$${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}` : ''}
                     style={{ fontSize: '9px', fontWeight: 'bold', fill: '#dc2626' }}
                  />
               </Bar>
            </BarChart>
         </ResponsiveContainer>
      </div>
   );
};

export default function Dashboard() {
   const { user } = useAuth();
   const data = useData() || {};
   const { 
      sales = [], 
      invoices = [], 
      purchases = [], 
      customers = [], 
      quotations = [], 
      companyConfig 
   } = data;
   const navigate = useNavigate();
   const currency = companyConfig?.currencySymbol || '$';
   const [chartRange, setChartRange] = useState<'Monthly' | 'Quarterly' | 'Annual'>('Monthly');

   const formatCur = (val: number) => {
      const safeVal = Number(val) || 0;
      return `${currency}${safeVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
   };

   const allRevenue = useMemo(() => {
      const map = new Map();
      // Ensure invoices and sales are always arrays
      const safeInvoices = Array.isArray(invoices) ? invoices : [];
      const safeSales = Array.isArray(sales) ? sales : [];
      
      safeInvoices.forEach(i => {
        if (i && i.id) map.set(i.id, i);
      });
      safeSales.forEach(s => {
        if (s && s.id) map.set(s.id, s);
      });
      
      return Array.from(map.values());
   }, [sales, invoices]);

   const kpis = useMemo(() => {
      const activeRevenue = allRevenue.filter(r => r.status !== 'Cancelled' && r.status !== 'Void');
      const safePurchases = Array.isArray(purchases) ? purchases : [];
      const safeInvoices = Array.isArray(invoices) ? invoices : [];
      
      const activePurchases = safePurchases.filter(p => p.status !== 'Cancelled' && p.status !== 'Void');
      const activeInvoices = safeInvoices.filter(i => i.status !== 'Cancelled' && i.status !== 'Void');

      const totalProfitAmount = activeRevenue.reduce((acc, curr) => acc + Number(curr.totalAmount || curr.total || 0), 0);
      const totalExpensesAmount = activePurchases.reduce((acc, curr) => acc + Number(curr.totalAmount || curr.total || curr.amount || 0), 0);
      const netProfit = totalProfitAmount - totalExpensesAmount;

      // Calculate dynamic trend percentages based on actual data
      const calculateTrend = (current: number, fallback: number) => {
         if (current === 0) return { trend: '0%', isUp: false, progress: 0 };
         // Use data length as a proxy for activity level
         const activityRate = Math.min((current / Math.max(fallback, 1)) * 100, 100);
         const trendValue = parseFloat(((current - fallback) / Math.max(fallback, 1) * 100).toFixed(1));
         return {
            trend: `${trendValue >= 0 ? '+' : ''}${trendValue}%`,
            isUp: trendValue >= 0,
            progress: Math.round(activityRate)
         };
      };

      const profitTrend = calculateTrend(netProfit, 50000);
      const projectsTrend = calculateTrend(invoices.length, 10);
      const expensesTrend = calculateTrend(totalExpensesAmount, 30000);
      const customersTrend = calculateTrend(customers.length, 10);

      return {
         profit: netProfit,
         profitTrend: profitTrend.trend,
         profitIsUp: profitTrend.isUp,
         profitProgress: profitTrend.progress,
         projects: activeInvoices.length,
         projectsTrend: projectsTrend.trend,
         projectsIsUp: projectsTrend.isUp,
         projectsProgress: projectsTrend.progress,
         expenses: totalExpensesAmount,
         expensesTrend: expensesTrend.trend,
         expensesIsUp: expensesTrend.isUp,
         expensesProgress: expensesTrend.progress,
         newCustomers: customers.length,
         customersTrend: customersTrend.trend,
         customersIsUp: customersTrend.isUp,
         customersProgress: customersTrend.progress
      };
   }, [allRevenue, purchases, customers, invoices]);

   const subscriptionData = useMemo(() => {
      const safeQuotations = Array.isArray(quotations) ? quotations : [];
      const subs = safeQuotations.filter((q: any) => q.status === 'Recurring' || q.isRecurring).map(q => ({
         id: q.id,
         name: q.customerName || 'Unnamed Client',
         description: q.reference || 'Active Subscription',
         nextDate: q.nextBillingDate ? new Date(q.nextBillingDate).toLocaleDateString() : 'Next Month',
         qty: q.items?.length || 1,
         price: formatCur(q.totalAmount || q.total || 0)
      }));
      // Return actual data only, no hardcoded fallback placeholders
      return subs;
   }, [quotations]);

   const [hiddenInvoiceIds, setHiddenInvoiceIds] = useState<string[]>([]);
   const [viewingInvoiceId, setViewingInvoiceId] = useState<string | null>(null);

   const recentInvoices = useMemo(() => {
      const safeInvoices = Array.isArray(invoices) ? invoices : [];
      const arr = [...safeInvoices]
         .sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime())
         .filter((inv: any) => inv && inv.id && !hiddenInvoiceIds.includes(inv.id))
         .slice(0, 5);
      return arr;
   }, [invoices, hiddenInvoiceIds]);

   const handleHideInvoice = (invoiceId: string) => {
      setHiddenInvoiceIds(prev => [...prev, invoiceId]);
   };

   const handleUnhideInvoice = (invoiceId: string) => {
      setHiddenInvoiceIds(prev => prev.filter(id => id !== invoiceId));
   };

   const handleViewInvoice = (invoiceId: string) => {
      setViewingInvoiceId(invoiceId);
      navigate(`/invoices/${invoiceId}`);
   };

   const getStatusStyle = (status: string) => {
      const s = status?.toLowerCase() || '';
      if (['paid'].includes(s)) return 'bg-emerald-50 text-emerald-700';
      if (['partial', 'pending'].includes(s)) return 'bg-amber-50 text-amber-700';
      if (['overdue', 'cancelled'].includes(s)) return 'bg-rose-50 text-rose-700';
      return 'bg-slate-100 text-slate-700';
   };

   return (
      <div className="bg-[#F8FAFC] min-h-screen font-sans">
         <div className="max-w-[1400px] mx-auto p-6 space-y-5">

            {/* Global Navigation & Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-5 py-2">
               <div className="flex items-center gap-3 w-full md:max-w-md">
                  <div className="relative w-full">
                     <input
                        type="text"
                        placeholder="Search records, invoices, accounts..."
                        className="w-full bg-white text-[13px] font-medium transition-all rounded-lg px-10 py-[10px] outline-none border border-slate-200 hover:border-slate-300 focus:border-indigo-300 shadow-sm"
                        onKeyDown={(e) => {
                           if (e.key === 'Enter') {
                              navigate(`/search?q=${(e.target as HTMLInputElement).value}`);
                           }
                        }}
                     />
                     <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} strokeWidth={1.5} />
                  </div>
               </div>

               <div className="flex items-center gap-5">
                  <button onClick={() => navigate('/security-log')} className="text-slate-500 hover:text-indigo-600 transition-colors relative p-2 hover:bg-indigo-50 rounded-lg" title="System Security & Logs">
                     <Bell size={18} strokeWidth={1.5} />
                     <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
                  </button>
                  <button onClick={() => navigate('/apps/marketing')} className="text-slate-500 hover:text-indigo-600 transition-colors p-2 hover:bg-indigo-50 rounded-lg" title="Marketing Messages Center">
                     <Mail size={18} strokeWidth={1.5} />
                  </button>
                  <button onClick={() => navigate('/tools/smart-pricing')} className="text-slate-500 hover:text-indigo-600 transition-colors p-2 hover:bg-indigo-50 rounded-lg" title="Marketing Pricing Tool">
                     <Calculator size={18} strokeWidth={1.5} />
                  </button>
                  <button onClick={() => navigate('/architect')} className="text-slate-500 hover:text-indigo-600 transition-colors p-2 hover:bg-indigo-50 rounded-lg" title="System Architect & UI Layout">
                     <LayoutTemplate size={18} strokeWidth={1.5} />
                  </button>

                  <div className="h-5 w-[1px] bg-slate-200 mx-1"></div>

                  <button onClick={() => navigate('/settings')} className="flex items-center gap-2.5 group text-left p-1 hover:bg-slate-50 rounded-xl transition-all border border-transparent hover:border-slate-200" title="User Settings & Profile">
                     <div className="hidden sm:block text-right">
                        <p className="text-[13px] font-bold text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors">{user?.name || 'Administrator'}</p>
                        <p className="text-[11px] text-slate-500 leading-tight font-medium uppercase tracking-tighter">{user?.role || 'System Root'}</p>
                     </div>
                     <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border border-indigo-400/30 flex items-center justify-center text-white font-bold text-[13px] shadow-lg shadow-indigo-100 group-hover:scale-105 transition-all">
                        {user?.name ? String(user.name).substring(0, 2).toUpperCase() : 'AD'}
                     </div>
                  </button>
               </div>
            </header>

            {/* High-Level Metrics */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
               <MetricCard
                  title="Total Profit"
                  value={formatCur(kpis.profit)}
                  trend={kpis.profitTrend}
                  isPositive={kpis.profitIsUp}
                  progress={kpis.profitProgress}
                  color="text-indigo-600"
                  icon={DollarSign}
                  onClick={() => navigate('/revenue/sales-audit')}
               />
               <MetricCard
                  title="Total Projects"
                  value={kpis.projects.toString()}
                  trend={kpis.projectsTrend}
                  isPositive={kpis.projectsIsUp}
                  progress={kpis.projectsProgress}
                  color="text-amber-500"
                  icon={Briefcase}
                  onClick={() => navigate('/industrial/work-orders')}
               />
               <MetricCard
                  title="Total Expenses"
                  value={formatCur(kpis.expenses)}
                  trend={kpis.expensesTrend}
                  isPositive={kpis.expensesIsUp}
                  progress={kpis.expensesProgress}
                  color="text-rose-500"
                  icon={TrendingDown}
                  onClick={() => navigate('/procurement/expenses')}
               />
               <MetricCard
                  title="New Customers"
                  value={kpis.newCustomers.toString()}
                  trend={kpis.customersTrend}
                  isPositive={kpis.customersIsUp}
                  progress={kpis.customersProgress}
                  color="text-emerald-600"
                  icon={Users}
                  onClick={() => navigate('/sales-flow/clients')}
               />
            </section>

            {/* Analytics & Subscription Engine */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
               <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-slate-200 hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
                  <div className="flex justify-between items-end mb-6">
                     <div>
                        <h2 className="text-[20px] font-medium text-slate-800 tracking-tight">Analytics Engine</h2>
                        <p className="text-slate-500 text-[13px] mt-1">Profit margin relative to expenditure velocity</p>
                     </div>
                     <div className="flex gap-2">
                        <button onClick={() => setChartRange('Monthly')} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all ${chartRange === 'Monthly' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'hover:bg-slate-50 text-slate-400 border border-transparent hover:border-slate-200'}`}>Monthly</button>
                        <button onClick={() => setChartRange('Quarterly')} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all ${chartRange === 'Quarterly' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'hover:bg-slate-50 text-slate-400 border border-transparent hover:border-slate-200'}`}>Quarterly</button>
                        <button onClick={() => setChartRange('Annual')} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all ${chartRange === 'Annual' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'hover:bg-slate-50 text-slate-400 border border-transparent hover:border-slate-200'}`}>Annual</button>
                     </div>
                  </div>

                  <div className="w-full">
                     <AnalyticsEngineChart sales={sales} invoices={invoices} purchases={purchases} range={chartRange} />
                  </div>
               </div>

               <div className="lg:col-span-1">
                  {subscriptionData.length > 0 ? (
                     <SubscriptionSlider subscriptions={subscriptionData} navigate={navigate} />
                  ) : (
                     <div className="bg-white rounded-xl p-5 border border-slate-200 flex flex-col items-center justify-center h-full text-center">
                        <CircleDashed size={32} className="mb-3 text-slate-300" />
                        <p className="text-[13px] font-medium text-slate-500 tracking-tight">No active subscriptions</p>
                        <p className="text-[11px] text-slate-400 mt-1">Create recurring quotations to track subscriptions</p>
                     </div>
                  )}
               </div>
            </section>

            {/* Recent Invoices Table */}
            <section className="bg-white rounded-xl p-5 border border-slate-200 hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
               <div className="flex justify-between items-center mb-5">
                  <div>
                     <h2 className="text-[20px] font-medium text-slate-800 tracking-tight">Recent Invoices</h2>
                     <p className="text-slate-500 text-[13px] mt-1">Showing latest 5 invoices</p>
                  </div>
                  <button onClick={() => navigate('/invoices')} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-[12px] font-medium rounded-lg transition-colors">
                     View All <ChevronRight size={14} strokeWidth={1.5} />
                  </button>
               </div>

               <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed' }}>
                     <colgroup>
                        <col style={{ width: '16%' }} />
                        <col />
                        <col style={{ width: '14%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '14%' }} />
                        <col style={{ width: '12%' }} />
                     </colgroup>
                     <thead>
                        <tr className="border-y border-slate-200 bg-slate-50/50">
                           <th className="py-2.5 px-4 text-[13px] font-medium text-slate-500">Invoice ID</th>
                           <th className="py-2.5 px-4 text-[13px] font-medium text-slate-500">Client / Entity</th>
                           <th className="py-2.5 px-4 text-[13px] font-medium text-slate-500">Billing Date</th>
                           <th className="py-2.5 px-4 text-[13px] font-medium text-slate-500">Status</th>
                           <th className="py-2.5 px-4 text-right text-[13px] font-medium text-slate-500">Amount</th>
                           <th className="py-2.5 px-4 text-center text-[13px] font-medium text-slate-500">Actions</th>
                        </tr>
                     </thead>
                     <tbody>
                        {recentInvoices.length > 0 ? (
                           recentInvoices.map((inv: any) => (
                              <tr key={inv.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                                 <td className="py-3 px-4">
                                    <div className="font-mono text-[12px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60 inline-block truncate max-w-full">
                                       {inv.id}
                                    </div>
                                 </td>
                                 <td className="py-3 px-4">
                                    <span className="font-medium text-slate-800 text-[13px] tracking-tight">{inv.customerName || 'Walk-in Client'}</span>
                                 </td>
                                 <td className="py-3 px-4 text-[12px] text-slate-600">
                                    {(() => {
                                       const dateVal = inv?.date || inv?.createdAt;
                                       if (!dateVal) return 'N/A';
                                       const date = new Date(dateVal);
                                       return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString();
                                    })()}
                                 </td>
                                 <td className="py-3 px-4">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${getStatusStyle(inv.status)}`}>
                                       {inv.status || 'Pending'}
                                    </span>
                                 </td>
                                 <td className="py-3 px-4 text-right text-[13px] font-medium text-slate-800 tabular-nums tracking-tight">
                                    {formatCur(inv.totalAmount || inv.total || 0)}
                                 </td>
                                 <td className="py-3 px-4">
                                    <div className="flex items-center justify-center gap-1">
                                       <button
                                          onClick={() => handleViewInvoice(inv.id)}
                                          className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition-colors"
                                          title="View Invoice"
                                       >
                                          <Eye size={16} strokeWidth={1.5} />
                                       </button>
                                       <button
                                          onClick={() => handleHideInvoice(inv.id)}
                                          className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-500 hover:text-amber-600 transition-colors"
                                          title="Hide Invoice"
                                       >
                                          <EyeOff size={16} strokeWidth={1.5} />
                                       </button>
                                       <button
                                          onClick={() => handleHideInvoice(inv.id)}
                                          className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors"
                                          title="Remove Invoice"
                                       >
                                          <Trash2 size={16} strokeWidth={1.5} />
                                       </button>
                                    </div>
                                 </td>
                              </tr>
                           ))
                        ) : (
                           <tr>
                              <td colSpan={6} className="py-12 text-center">
                                 <div className="flex flex-col items-center justify-center">
                                    <CircleDashed size={32} className="mb-3 text-slate-300" />
                                    <p className="text-[13px] font-medium text-slate-500 tracking-tight">No invoices yet</p>
                                    <p className="text-[11px] text-slate-400 mt-1">Create your first invoice to see it here</p>
                                 </div>
                              </td>
                           </tr>
                        )}
                     </tbody>
                  </table>
               </div>

               <div className="mt-4 pt-4 flex items-center justify-between text-[12px] text-slate-500 font-medium">
                  <p>Displaying <strong className="text-slate-700">{recentInvoices.length}</strong> of {invoices.length} records. {hiddenInvoiceIds.length > 0 && <span className="text-amber-600">({hiddenInvoiceIds.length} hidden)</span>}</p>
                  <div className="flex items-center gap-1.5">
                     {hiddenInvoiceIds.length > 0 && (
                        <button onClick={() => setHiddenInvoiceIds([])} className="px-3 py-1.5 rounded border border-amber-200 hover:bg-amber-50 text-amber-700 transition-colors leading-tight">Show All Hidden</button>
                     )}
                     <button onClick={() => navigate('/invoices')} className="px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50 transition-colors leading-tight">View All Invoices</button>
                  </div>
               </div>
            </section>

         </div>
      </div>
   );
}