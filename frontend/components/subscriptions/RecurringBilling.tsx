import React from 'react';
import { RefreshCw, Calendar, DollarSign, Clock, CheckCircle, XCircle } from 'lucide-react';

interface SubscriptionPlan {
  id: string;
  name: string;
  customerId: string;
  customerName: string;
  amount: number;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  nextBilling: string;
  status: 'active' | 'paused' | 'cancelled';
  items: { name: string; quantity: number; price: number }[];
}

const SubscriptionsView: React.FC = () => {
  const plans: SubscriptionPlan[] = [];

  const totalMonthly = plans.reduce((s, p) => {
    if (p.status !== 'active') return s;
    const perMonth = p.frequency === 'weekly' ? p.amount * 4.33 : p.frequency === 'monthly' ? p.amount : p.frequency === 'quarterly' ? p.amount / 3 : p.amount / 12;
    return s + perMonth;
  }, 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-slate-900">Recurring Billing</h1><p className="text-sm text-slate-500 mt-1">Manage subscription orders and recurring invoices</p></div>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-slate-200"><p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Active Subscriptions</p><p className="text-2xl font-bold text-slate-900 mt-1">{plans.filter(p => p.status === 'active').length}</p></div>
        <div className="bg-white rounded-xl p-4 border border-slate-200"><p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Monthly Recurring Revenue</p><p className="text-2xl font-bold text-emerald-600 mt-1">K {totalMonthly.toFixed(2)}</p></div>
        <div className="bg-white rounded-xl p-4 border border-slate-200"><p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Due This Week</p><p className="text-2xl font-bold text-amber-600 mt-1">{plans.filter(p => p.status === 'active' && new Date(p.nextBilling) <= new Date(Date.now() + 7 * 86400000)).length}</p></div>
      </div>
      {plans.length === 0 ? (
        <div className="text-center py-12 text-slate-400"><RefreshCw size={40} className="mx-auto mb-3 text-slate-300" /><p className="font-medium">No subscriptions yet</p><p className="text-sm mt-1">Convert one-time orders into recurring subscriptions.</p></div>
      ) : plans.map(p => (
        <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4 mb-3">
          <div className="flex items-center justify-between"><div><p className="font-semibold text-slate-900">{p.name}</p><p className="text-xs text-slate-500">{p.customerName}</p></div>
            <div className="flex items-center gap-3"><span className="font-bold text-lg">K {p.amount.toFixed(2)}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${p.status === 'active' ? 'bg-emerald-100 text-emerald-700' : p.status === 'paused' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{p.status}</span></div></div>
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-400"><span className="flex items-center gap-1"><RefreshCw size={12} /> {p.frequency}</span><span className="flex items-center gap-1"><Calendar size={12} /> Next: {new Date(p.nextBilling).toLocaleDateString()}</span></div>
        </div>
      ))}
    </div>
  );
};

export default SubscriptionsView;
