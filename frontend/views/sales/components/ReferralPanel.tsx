import React, { useState, useEffect, useMemo } from 'react';
import { Award, Users, DollarSign, TrendingUp, History, CheckCircle, Clock, ExternalLink } from 'lucide-react';
import { referralService } from '../../../services/referralService';
import { dbService } from '../../../services/db';
import { format, parseISO } from 'date-fns';
import type { Referral, ReferralCommission, ReferralTransaction } from '../../../types/referral';
import type { WalletTransaction } from '../../../types';

interface Props {
  customer: any;
  currency?: string;
}

export const ReferralPanel: React.FC<Props> = ({ customer, currency = '$' }) => {
  const [referral, setReferral] = useState<Referral | null>(null);
  const [referredCount, setReferredCount] = useState(0);
  const [commissions, setCommissions] = useState<ReferralCommission[]>([]);
  const [transactions, setTransactions] = useState<ReferralTransaction[]>([]);
  const [walletTxns, setWalletTxns] = useState<WalletTransaction[]>([]);
  const [salesBreakdown, setSalesBreakdown] = useState<any[]>([]);
  const [referrer, setReferrer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [customer.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ref, refList, cm, tx, breakdown, allWalletTxns] = await Promise.all([
        referralService.getReferrerForCustomer(customer.id),
        referralService.getReferredCustomers(customer.id),
        referralService.getCommissionHistory(customer.id),
        referralService.getReferralTransactions(customer.id),
        referralService.getReferralSalesBreakdown(customer.id),
        dbService.getAll<WalletTransaction>('walletTransactions'),
      ]);
      setReferral(ref);
      setReferredCount(refList.length);
      setCommissions(cm);
      setTransactions(tx);
      setSalesBreakdown(breakdown);
      setWalletTxns(allWalletTxns.filter(w => w.customerId === customer.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

      if (ref) {
        const allCustomers = await dbService.getAll<any>('customers');
        const referrerCust = allCustomers.find((c: any) => c.id === ref.referrerId);
        setReferrer(referrerCust);
      }
    } catch (err) {
      console.error('Failed to load referral data', err);
    }
    setLoading(false);
  };

  const stats = useMemo(() => ({
    totalCommissions: commissions.reduce((s, c) => s + c.commissionAmount, 0),
    pendingCommissions: commissions.filter(c => c.status === 'Pending').reduce((s, c) => s + c.commissionAmount, 0),
    paidCommissions: commissions.filter(c => c.status === 'Paid').reduce((s, c) => s + c.commissionAmount, 0),
    totalSales: salesBreakdown.reduce((s, b) => s + b.totalSales, 0),
  }), [commissions, salesBreakdown]);

  const conversionRate = referredCount > 0
    ? `${((commissions.filter(c => c.status === 'Paid' || c.status === 'Approved').length / Math.max(commissions.length, 1)) * 100).toFixed(1)}%`
    : '0%';

  const referralWalletTxns = useMemo(() => {
    return walletTxns.filter(w => w.description?.toLowerCase().includes('referral'));
  }, [walletTxns]);

  if (loading) return <div className="p-8 text-slate-400 italic">Loading referral data...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 p-6">
      {/* Referrer Info */}
      {referral && referrer && (
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl shadow-lg shadow-blue-100 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Users size={20} className="opacity-80" />
            <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Referred By</span>
          </div>
          <div className="text-xl font-bold">{referrer.name}</div>
          <p className="text-sm opacity-80 mt-1">Phone: {referrer.phone || 'N/A'} | Email: {referrer.email || 'N/A'}</p>
        </div>
      )}

      {!referral && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 text-slate-400">
            <Award size={24} />
            <p className="text-sm font-medium">No referral record found for this customer.</p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Referred Customers" value={referredCount.toString()} color="blue" />
        <StatCard icon={DollarSign} label="Total Commission" value={`${currency}${stats.totalCommissions.toLocaleString()}`} color="emerald" />
        <StatCard icon={Clock} label="Pending" value={`${currency}${stats.pendingCommissions.toLocaleString()}`} color="amber" />
        <StatCard icon={CheckCircle} label="Paid" value={`${currency}${stats.paidCommissions.toLocaleString()}`} color="green" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={TrendingUp} label="Referral Sales" value={`${currency}${stats.totalSales.toLocaleString()}`} color="indigo" />
        <StatCard icon={Award} label="Conversion Rate" value={conversionRate} color="purple" />
        <StatCard icon={DollarSign} label="Wallet Balance" value={`${currency}${(customer.walletBalance || 0).toLocaleString()}`} color="blue" />
      </div>

      {/* Commission History */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 flex items-center gap-2"><History size={18} className="text-blue-600" /> Commission History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Date</th>
                <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Invoice</th>
                <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Amount</th>
                <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Rate</th>
                <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Commission</th>
                <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {commissions.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-slate-500 font-medium text-sm">{format(parseISO(c.createdAt), 'MMM dd, yyyy')}</td>
                  <td className="px-6 py-4 font-mono text-sm text-slate-700">{c.invoiceId.slice(0, 12)}...</td>
                  <td className="px-6 py-4 font-medium text-sm">{currency}{c.invoiceAmount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm">{c.commissionRate}%</td>
                  <td className="px-6 py-4 font-bold text-emerald-600 text-sm">{currency}{c.commissionAmount.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                      c.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      c.status === 'Approved' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                      c.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                      'bg-rose-50 text-rose-700 border-rose-100'
                    }`}>{c.status}</span>
                  </td>
                </tr>
              ))}
              {commissions.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">No commission history</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Referral Sales Breakdown */}
      {salesBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-900 flex items-center gap-2"><ExternalLink size={18} className="text-blue-600" /> Referral Sales Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Referred Customer</th>
                  <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Invoices</th>
                  <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Total Sales</th>
                  <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Commission Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {salesBreakdown.map((b, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-800">{b.customerName}</td>
                    <td className="px-6 py-4 text-slate-600">{b.invoiceCount}</td>
                    <td className="px-6 py-4 font-medium text-slate-700">{currency}{b.totalSales.toLocaleString()}</td>
                    <td className="px-6 py-4 font-bold text-emerald-600">{currency}{b.totalCommission.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Wallet Transactions Related to Referrals */}
      {referralWalletTxns.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-900 flex items-center gap-2"><History size={18} className="text-blue-600" /> Referral Wallet Activity</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Date</th>
                  <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Type</th>
                  <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Description</th>
                  <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {referralWalletTxns.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-slate-500 font-medium text-sm">{format(parseISO(t.date), 'MMM dd, yyyy')}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                        t.type === 'Credit' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        'bg-rose-50 text-rose-700 border-rose-100'
                      }`}>{t.type}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{t.description}</td>
                    <td className={`px-6 py-4 text-right font-bold text-sm ${t.type === 'Credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {t.type === 'Credit' ? '+' : ''}{currency}{Math.abs(t.amount || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Referral Transaction Audit */}
      {transactions.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-900 flex items-center gap-2"><History size={18} className="text-blue-600" /> Referral Activity Log</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Date</th>
                  <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Type</th>
                  <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Description</th>
                  <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {transactions.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-slate-500 font-medium text-sm">{format(parseISO(t.createdAt), 'MMM dd, yyyy')}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                        t.type === 'Commission' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        t.type === 'Reversal' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                        'bg-blue-50 text-blue-700 border-blue-100'
                      }`}>{t.type}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{t.description}</td>
                    <td className={`px-6 py-4 text-right font-bold text-sm ${t.type === 'Commission' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {t.type === 'Commission' ? '+' : '-'}{currency}{t.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{ icon: any; label: string; value: string; color: string }> = ({ icon: Icon, label, value, color }) => {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600',
    emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
    green: 'from-green-500 to-green-600',
    indigo: 'from-indigo-500 to-indigo-600',
    purple: 'from-purple-500 to-purple-600',
  };
  return (
    <div className={`bg-gradient-to-br ${colorMap[color] || colorMap.blue} p-5 rounded-2xl shadow-lg text-white`}>
      <div className="flex items-center justify-between mb-3">
        <Icon size={18} className="opacity-80" />
      </div>
      <div className="text-2xl font-black">{value}</div>
      <p className="text-[11px] font-bold mt-1 opacity-80 uppercase tracking-tight">{label}</p>
    </div>
  );
};
