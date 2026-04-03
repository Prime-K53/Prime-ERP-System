import React, { memo, useMemo, useState, useEffect, useRef } from 'react';
import { Search, Bell, ChevronDown, MoreHorizontal, ShoppingCart, Calculator, User, MessageSquare, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { formatNumber } from '../utils/helpers';
import { useNavigate } from 'react-router-dom';

const CircularProgress = memo(({ value, color, bgColor = '#f1f5f9' }: { value: number; color: string; bgColor?: string }) => {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <svg width="56" height="56" className="transform -rotate-90">
      <circle cx="28" cy="28" r={radius} stroke={bgColor} strokeWidth="5" fill="transparent" />
      <circle 
        cx="28" 
        cy="28" 
        r={radius} 
        stroke={color} 
        strokeWidth="5" 
        fill="transparent" 
        strokeDasharray={circumference} 
        strokeDashoffset={strokeDashoffset} 
        strokeLinecap="round"
        className="transition-all duration-1000"
      />
    </svg>
  );
});

const StatCard = memo(({ title, value, percentage, isPositive, progress, color }: {
  title: string;
  value: string;
  percentage: string;
  isPositive: boolean;
  progress: number;
  color: string;
}) => (
  <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-slate-500 text-sm font-medium mb-2">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 mb-3">{value}</h3>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-1 rounded-md ${isPositive ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
            {percentage}
          </span>
          <span className="text-slate-500 text-xs">From last Week</span>
        </div>
      </div>
      <CircularProgress value={progress} color={color} />
    </div>
  </div>
));

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-100">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-violet-600"></div>
          <span className="font-semibold text-slate-800">${payload[0].value.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          <span className="font-semibold text-slate-800">${payload[1].value.toLocaleString()}</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showPOSModal, setShowPOSModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);

  // Refs for one-time warning logging
  const warnedInvoices = useRef(false);
  const warnedExpenses = useRef(false);
  const warnedCustomers = useRef(false);
  const warnedOrders = useRef(false);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Finished': return 'bg-emerald-500';
      case 'Pending': return 'bg-amber-400';
      case 'Cancel': return 'bg-red-500';
      default: return 'bg-slate-400';
    }
  };

  // Pull aggregated data from the global data context
  const data = useData();
  const { companyConfig } = useAuth();

  const invoices = Array.isArray(data.invoices) ? data.invoices : [];
  const expenses = Array.isArray(data.expenses) ? data.expenses : [];
  const customers = Array.isArray(data.customers) ? data.customers : [];
  const orders = Array.isArray(data.orders) ? data.orders : [];

  // Debug: Log empty data warnings (run once on mount only)
  useEffect(() => {
    const checkData = () => {
      if (!warnedInvoices.current && (!data.invoices || data.invoices.length === 0)) {
        console.warn("⚠️ Empty data received for invoices");
        warnedInvoices.current = true;
      }
      if (!warnedExpenses.current && (!data.expenses || data.expenses.length === 0)) {
        console.warn("⚠️ Empty data received for expenses");
        warnedExpenses.current = true;
      }
      if (!warnedCustomers.current && (!data.customers || data.customers.length === 0)) {
        console.warn("⚠️ Empty data received for customers");
        warnedCustomers.current = true;
      }
      if (!warnedOrders.current && (!data.orders || data.orders.length === 0)) {
        console.warn("⚠️ Empty data received for orders");
        warnedOrders.current = true;
      }
    };
    
    // Only check once after a short delay to avoid render-time warnings
    const timeoutId = setTimeout(checkData, 100);
    return () => clearTimeout(timeoutId);
  }, []); // Empty dependency array - only run on mount

  // Get current long date
  const currentLongDate = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }, []);

  // Chart data (last 7 days) - aggregate income and expenditures by day
  const weeklyChartData = useMemo(() => {
    const days: Date[] = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0,0,0,0);
      return d;
    });

    const revByKey: Record<string, number> = {};
    const expByKey: Record<string, number> = {};

    invoices.forEach((inv: any) => {
      const d = new Date(inv.date || inv.createdAt || Date.now());
      d.setHours(0,0,0,0);
      const key = d.toLocaleDateString();
      revByKey[key] = (revByKey[key] || 0) + Number(inv.totalAmount ?? inv.amount ?? 0);
    });

    expenses.forEach((ex: any) => {
      const d = new Date(ex.date || ex.createdAt || Date.now());
      d.setHours(0,0,0,0);
      const key = d.toLocaleDateString();
      expByKey[key] = (expByKey[key] || 0) + Number(ex.amount ?? 0);
    });

    return days.map(d => {
      const key = d.toLocaleDateString();
      const income = revByKey[key] || 0;
      const expenditure = expByKey[key] || 0;
      return {
        name: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        income: Math.round(income * 100) / 100,
        expenditure: Math.round(expenditure * 100) / 100,
      };
    });
  }, [invoices, expenses]);

  // Top customers by invoice total
  const topCustomers = useMemo(() => {
    const totals: Record<string, number> = {};
    invoices.forEach((inv: any) => {
      const name = inv.customerName || inv.customer || inv.billTo || 'Unknown';
      totals[name] = (totals[name] || 0) + Number(inv.totalAmount ?? inv.amount ?? 0);
    });
    const arr = Object.keys(totals).map((name, idx) => ({ id: idx, name, role: '', color: '#' + (Math.abs(hashCode(name)) % 0xFFFFFF).toString(16).padStart(6, '0'), total: totals[name] }));
    arr.sort((a, b) => b.total - a.total);
    return arr.slice(0, 5);
  }, [invoices]);

  // Utility hash for consistent colors
  function hashCode(str: string) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i) | 0;
    return Math.abs(h);
  }

  // Recent invoice rows
  const invoiceData = useMemo(() => {
    return invoices.slice().reverse().slice(0, 10).map((inv: any) => ({
      location: inv.location || inv.warehouse || 'Main',
      role: inv.type || inv.role || 'Sale',
      date: new Date(inv.date || inv.createdAt || Date.now()).toLocaleDateString(),
      name: inv.customerName || inv.customer || 'N/A',
      status: inv.status || 'Pending',
      amount: `${companyConfig?.currencySymbol || ''}${Number(inv.totalAmount ?? inv.amount ?? 0).toLocaleString()}`
    }));
  }, [invoices, companyConfig]);

  // Summary stats
  const totalRevenue = invoices.reduce((s: number, inv: any) => s + Number(inv.totalAmount ?? inv.amount ?? 0), 0);
  const totalExpense = expenses.reduce((s: number, ex: any) => s + Number(ex.amount ?? 0), 0);
  const totalProfit = totalRevenue - totalExpense;
  const totalProjects = orders.length || 0;
  const newCustomers = customers.filter((c: any) => {
    if (!c.createdAt) return false;
    return (Date.now() - new Date(c.createdAt).getTime()) < 1000 * 60 * 60 * 24 * 30;
  }).length || customers.length;

  // Weekly vs previous week comparison for percentage badges
  const { weeklyProfit, prevWeekProfit, profitChangePercent, profitIsPositive, profitProgress } = useMemo(() => {
    const endLast = new Date(); endLast.setHours(23,59,59,999);
    const startLast = new Date(); startLast.setHours(0,0,0,0); startLast.setDate(startLast.getDate() - 6);
    const endPrev = new Date(); endPrev.setHours(23,59,59,999); endPrev.setDate(endPrev.getDate() - 7);
    const startPrev = new Date(); startPrev.setHours(0,0,0,0); startPrev.setDate(startPrev.getDate() - 13);

    let wProfit = 0; let pProfit = 0;
    invoices.forEach((inv: any) => {
      const d = new Date(inv.date || inv.createdAt || Date.now());
      if (d >= startLast && d <= endLast) wProfit += Number(inv.totalAmount ?? inv.amount ?? 0) - 0;
      if (d >= startPrev && d <= endPrev) pProfit += Number(inv.totalAmount ?? inv.amount ?? 0) - 0;
    });

    const diff = wProfit - pProfit;
    const pct = pProfit !== 0 ? Math.round((diff / Math.abs(pProfit)) * 100) : (wProfit !== 0 ? 100 : 0);
    const isPos = diff >= 0;
    const prog = Math.min(100, Math.abs(pct));
    return { weeklyProfit: wProfit, prevWeekProfit: pProfit, profitChangePercent: (isNaN(pct) ? '0%' : `${isPos ? '+' : ''}${pct}%`), profitIsPositive: isPos, profitProgress: prog };
  }, [invoices]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 font-sans">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header Navigation Bar */}
        <header className="rounded-2xl p-4 mb-6 flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Search here..." 
              className="w-full pl-10 pr-4 py-3 rounded-full bg-white/80 backdrop-blur-sm border border-slate-200 focus:outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100 transition-all"
            />
          </div>
          
          <div className="flex items-center gap-4 ml-6">
            <button 
              onClick={() => setShowPOSModal(true)}
              className="p-3 rounded-full border-2 border-violet-600 text-violet-600 hover:bg-violet-50 transition-colors"
              title="Point of Sale"
            >
              <ShoppingCart size={20} />
            </button>
            
            <button 
              onClick={() => setShowPricingModal(true)}
              className="p-3 rounded-full border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50 transition-colors"
              title="Pricing Calculator"
            >
              <Calculator size={20} />
            </button>
            
            <button 
              onClick={() => setShowMessagesModal(true)}
              className="p-3 rounded-full border-2 border-blue-600 text-blue-600 hover:bg-blue-50 transition-colors"
              title="Messages"
            >
              <MessageSquare size={20} />
            </button>
            
            <button 
              onClick={() => setShowNotificationsPanel(!showNotificationsPanel)}
              className="p-3 rounded-full border-2 border-slate-600 text-slate-600 hover:bg-slate-50 transition-colors relative"
              title="Notifications"
            >
              <Bell size={20} />
            </button>
            
            <button className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/80 transition-colors">
              {user?.profilePic ? (
                <img 
                  src={user.profilePic} 
                  alt="User Avatar" 
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-white font-semibold">
                  <User size={20} />
                </div>
              )}
              <div className="text-left">
                <p className="font-semibold text-slate-800">{user?.role || 'User'}</p>
              </div>
              <ChevronDown size={16} className="text-slate-400" />
            </button>
          </div>
        </header>

        {/* Dashboard Title & Current Date */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-bold text-slate-900">Dashboard</h1>
          
          <div className="text-lg font-medium text-slate-600">
            {currentLongDate}
          </div>
        </div>

        {/* Statistics Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
          <StatCard
            title="Total Profit"
            value={`${companyConfig?.currencySymbol || '$'}${formatNumber(totalProfit)}`}
            percentage={profitChangePercent}
            isPositive={profitIsPositive}
            progress={profitProgress}
            color="#6366f1"
          />
          <StatCard
            title="Total Projects"
            value={`${totalProjects}`}
            percentage={totalProjects > 0 ? '+0%' : '0%'}
            isPositive={true}
            progress={Math.min(100, Math.round((totalProjects / Math.max(1, totalProjects)) * 100))}
            color="#10b981"
          />
          <StatCard
            title="Total Expenses"
            value={`${companyConfig?.currencySymbol || '$'}${formatNumber(totalExpense)}`}
            percentage={totalExpense > 0 ? `${Math.round((totalExpense / Math.max(1, totalRevenue || 1)) * 100)}%` : '0%'}
            isPositive={false}
            progress={Math.min(100, Math.round((totalExpense / Math.max(1, totalRevenue || 1)) * 100))}
            color="#facc15"
          />
          <StatCard
            title="New Customer"
            value={`${newCustomers}`}
            percentage={customers.length > 0 ? `${Math.round((newCustomers / customers.length) * 100)}%` : '0%'}
            isPositive={newCustomers >= 0}
            progress={Math.min(100, Math.round((newCustomers / Math.max(1, customers.length)) * 100))}
            color="#ef4444"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
          {/* Overview Chart Section */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Overview</h2>
              
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-500"></div>
                  <span className="text-slate-700 font-medium">Income</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-red-500"></div>
                  <span className="text-slate-700 font-medium">Expenditure</span>
                </div>
                <button className="p-2 rounded-lg hover:bg-slate-100">
                  <MoreHorizontal size={20} className="text-slate-500" />
                </button>
              </div>
            </div>

            {weeklyChartData.length === 0 || (invoices.length === 0 && expenses.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-[280px] text-slate-400">
                <p className="text-lg font-medium">No data available</p>
                <p className="text-sm mt-1">0 records loaded</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={weeklyChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 14, fontWeight: 500 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 14, fontWeight: 500 }} 
                    tickFormatter={(value) => `${value >= 1000 ? `${value / 1000}k` : value}`}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.1)' }} />
                  <Legend />
                  
                  <Bar 
                    dataKey="income" 
                    name="Income"
                    fill="#10b981" 
                    radius={[4, 4, 0, 0]}
                  />
                  
                  <Bar 
                    dataKey="expenditure" 
                    name="Expenditure"
                    fill="#ef4444" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top Customers Section */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Top Customer</h2>
              <button className="p-2 rounded-lg hover:bg-slate-100">
                <MoreHorizontal size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              {topCustomers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                  <p className="text-sm font-medium">No data available</p>
                  <p className="text-xs mt-1">0 records loaded</p>
                </div>
              ) : (
                topCustomers.map((customer) => (
                  <div key={customer.id} className="flex items-center gap-4 p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold"
                      style={{ backgroundColor: customer.color }}
                    >
                      {customer.name.substring(0, 2)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{customer.name}</p>
                      <p className="text-sm text-slate-500">{customer.role}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Invoice Table Section */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Invoice</h2>
            <button className="p-2 rounded-lg hover:bg-slate-100">
              <MoreHorizontal size={20} className="text-slate-500" />
            </button>
          </div>

          {invoiceData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <p className="text-lg font-medium">No data available</p>
              <p className="text-sm mt-1">0 records loaded</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-4 px-4 text-slate-500 font-medium">Location</th>
                    <th className="text-left py-4 px-4 text-slate-500 font-medium">Role</th>
                    <th className="text-left py-4 px-4 text-slate-500 font-medium">Date</th>
                    <th className="text-left py-4 px-4 text-slate-500 font-medium">Name</th>
                    <th className="text-left py-4 px-4 text-slate-500 font-medium">Status</th>
                    <th className="text-left py-4 px-4 text-slate-500 font-medium">Amount</th>
                    <th className="text-left py-4 px-4 text-slate-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceData.map((invoice, index) => (
                    <tr key={index} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4 text-slate-700">{invoice.location}</td>
                      <td className="py-4 px-4 text-slate-700">{invoice.role}</td>
                      <td className="py-4 px-4 text-slate-700">{invoice.date}</td>
                      <td className="py-4 px-4 text-slate-700">{invoice.name}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(invoice.status)}`}></div>
                          <span className="text-slate-700">{invoice.status}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-medium text-slate-800">{invoice.amount}</td>
                      <td className="py-4 px-4">
                        <button className="p-1 hover:bg-slate-100 rounded">
                          <MoreHorizontal size={18} className="text-slate-500" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
