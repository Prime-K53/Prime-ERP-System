import React, { useState, useEffect, useMemo } from 'react';
import { Award, Users, DollarSign, TrendingUp, Search, ExternalLink, CheckCircle, Clock, XCircle, Filter, RefreshCw, Download, FileText, CreditCard, Wallet, Shield } from 'lucide-react';
import { referralService } from '../../services/referralService';
import { dbService } from '../../services/db';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import type { Referral, ReferralCommission } from '../../types/referral';

export default function ReferralsPage() {
  const navigate = useNavigate();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [commissions, setCommissions] = useState<ReferralCommission[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'commissions' | 'referrals'>('overview');
  const [expandedAudit, setExpandedAudit] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [refs, cm, cust, inv] = await Promise.all([
        dbService.getAll<Referral>('referrals'),
        dbService.getAll<ReferralCommission>('referralCommissions'),
        dbService.getAll<any>('customers'),
        dbService.getAll<any>('invoices'),
      ]);
      setReferrals(refs);
      setCommissions(cm);
      setCustomers(cust);
      setInvoices(inv);
    } catch (err) {
      console.error('Failed to load referral data', err);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const stats = useMemo(() => {
    const active = referrals.filter(r => r.status === 'Active').length;
    const totalCommissionAmount = commissions.reduce((s, c) => s + c.commissionAmount, 0);
    const pendingAmount = commissions.filter(c => c.status === 'Pending').reduce((s, c) => s + c.commissionAmount, 0);
    const approvedAmount = commissions.filter(c => c.status === 'Approved').reduce((s, c) => s + c.commissionAmount, 0);
    const paidAmount = commissions.filter(c => c.status === 'Paid').reduce((s, c) => s + c.commissionAmount, 0);
    const referralInvoiceIds = [...new Set(commissions.map(c => c.invoiceId))];
    const referralSales = invoices.filter(inv => referralInvoiceIds.includes(inv.id)).reduce((s, inv) => s + (inv.totalAmount || 0), 0);
    return { totalReferrals: referrals.length, active, totalCommissionAmount, pendingAmount, approvedAmount, paidAmount, referralSales };
  }, [referrals, commissions, invoices]);

  const filteredCommissions = useMemo(() => {
    let list = [...commissions];
    if (statusFilter !== 'all') list = list.filter(c => c.status.toLowerCase() === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => {
        const cust = customers.find(cu => cu.id === c.referrerId);
        return cust?.name?.toLowerCase().includes(q) || c.invoiceId.toLowerCase().includes(q);
      });
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [commissions, statusFilter, search, customers]);

  const topReferrers = useMemo(() => {
    const map: Record<string, { count: number; sales: number; commission: number }> = {};
    for (const ref of referrals) {
      if (!map[ref.referrerId]) map[ref.referrerId] = { count: 0, sales: 0, commission: 0 };
      map[ref.referrerId].count++;
      const refComs = commissions.filter(c => c.referralId === ref.id);
      for (const c of refComs) {
        map[ref.referrerId].commission += c.commissionAmount;
        const inv = invoices.find(i => i.id === c.invoiceId);
        map[ref.referrerId].sales += inv?.totalAmount || 0;
      }
    }
    return Object.entries(map)
      .map(([customerId, data]) => {
        const cust = customers.find(c => c.id === customerId);
        return { customerId, customerName: cust?.name || 'Unknown', ...data };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [referrals, commissions, invoices, customers]);

  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name || id?.slice(0, 12);

  if (loading) return <div className="p-12 text-center text-slate-400 italic">Loading referral module...</div>;

  return (
    <div className="h-full flex flex-col bg-[#F4F5F8] overflow-hidden font-sans">
      <div className="bg-white border-b border-[#D4D7DC] px-8 py-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Award size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900">Referral Commissions</h1>
            <p className="text-xs text-slate-500">Manage customer referrals, commissions, and payouts</p>
          </div>
        </div>
        <button onClick={loadData} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 px-8 py-4">
        <StatCard icon={Users} label="Total Referrals" value={stats.totalReferrals.toString()} color="blue" />
        <StatCard icon={CheckCircle} label="Active" value={stats.active.toString()} color="emerald" />
        <StatCard icon={DollarSign} label="Total Commission" value={`$${stats.totalCommissionAmount.toLocaleString()}`} color="indigo" />
        <StatCard icon={Clock} label="Pending" value={`$${stats.pendingAmount.toLocaleString()}`} color="amber" />
        <StatCard icon={CheckCircle} label="Approved" value={`$${stats.approvedAmount.toLocaleString()}`} color="blue" />
        <StatCard icon={Award} label="Paid" value={`$${stats.paidAmount.toLocaleString()}`} color="emerald" />
        <StatCard icon={TrendingUp} label="Sales" value={`$${stats.referralSales.toLocaleString()}`} color="purple" />
      </div>

      {/* Tabs */}
      <div className="px-8 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-8">
          {(['overview', 'commissions', 'referrals'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`py-3 text-[13px] font-bold transition-all border-b-2 capitalize ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {tab === 'overview' ? 'Overview' : tab === 'commissions' ? 'Commission History' : 'Top Referrers'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Top Referrers */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 flex items-center gap-2"><Award size={18} className="text-blue-600" /> Top Referrers</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Referrer</th>
                      <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Referred</th>
                      <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Sales Generated</th>
                      <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Commission Earned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {topReferrers.map((r, i) => (
                      <tr key={r.customerId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">{i + 1}</div>
                            <span className="font-semibold text-slate-800">{r.customerName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-700">{r.count}</td>
                        <td className="px-6 py-4 font-medium text-slate-700">${r.sales.toLocaleString()}</td>
                        <td className="px-6 py-4 font-bold text-emerald-600">${r.commission.toLocaleString()}</td>
                      </tr>
                    ))}
                    {topReferrers.length === 0 && (
                      <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">No referrals yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'commissions' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4 flex-wrap">
              <h3 className="font-bold text-slate-900 flex items-center gap-2"><DollarSign size={18} className="text-blue-600" /> All Commissions</h3>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-[12px] outline-none focus:ring-2 focus:ring-blue-500/20 w-48" />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-[12px] font-medium outline-none">
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="paid">Paid</option>
                  <option value="reversed">Reversed</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Date</th>
                    <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Referrer</th>
                    <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Invoice</th>
                    <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Sale Amount</th>
                    <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Rate</th>
                    <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Commission</th>
                    <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Status</th>
                    <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredCommissions.map(c => (
                    <React.Fragment key={c.id}>
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-slate-500 text-sm">{format(parseISO(c.createdAt), 'MMM dd, yyyy')}</td>
                        <td className="px-6 py-4 font-medium text-slate-800">{getCustomerName(c.referrerId)}</td>
                        <td className="px-6 py-4">
                          <button onClick={() => navigate('/sales-flow/invoices', { state: { invoiceId: c.invoiceId } })}
                            className="font-mono text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2 hover:no-underline transition-all">
                            {c.invoiceId.slice(0, 12)}...
                          </button>
                        </td>
                        <td className="px-6 py-4 text-slate-700">${c.invoiceAmount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-slate-700">{c.commissionRate}%</td>
                        <td className="px-6 py-4 font-bold text-emerald-600">${c.commissionAmount.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                            c.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            c.status === 'Approved' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                            c.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                            'bg-rose-50 text-rose-700 border-rose-100'
                          }`}>{c.status}</span>
                        </td>
                        <td className="px-6 py-4">
                          <button onClick={() => setExpandedAudit(expandedAudit === c.id ? null : c.id)}
                            className={`p-1.5 rounded-lg transition-all ${expandedAudit === c.id ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                            title="View audit trail">
                            <ExternalLink size={14} />
                          </button>
                        </td>
                      </tr>
                      {expandedAudit === c.id && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="flex items-center gap-6 flex-wrap">
                              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Audit Chain:</span>
                              <AuditLink
                                icon={FileText}
                                label="Invoice"
                                id={c.invoiceId}
                                onClick={() => navigate('/sales-flow/invoices', { state: { invoiceId: c.invoiceId } })}
                              />
                              {c.paymentId && (
                                <AuditLink
                                  icon={CreditCard}
                                  label="Payment"
                                  id={c.paymentId}
                                  onClick={() => navigate('/sales-flow/payments', { state: { paymentId: c.paymentId } })}
                                />
                              )}
                              {c.walletTxId && (
                                <AuditLink
                                  icon={Wallet}
                                  label="Wallet Tx"
                                  id={c.walletTxId}
                                  onClick={() => navigate('/sales-flow/payments', { state: { action: 'create', customerId: c.referrerId } })}
                                />
                              )}
                              <AuditLink
                                icon={Shield}
                                label="Audit Log"
                                id={c.id}
                                onClick={() => navigate('/audit')}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {filteredCommissions.length === 0 && (
                    <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-400 italic">No commissions found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'referrals' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2"><Users size={18} className="text-blue-600" /> All Referrals</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Referrer</th>
                    <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Referred Customer</th>
                    <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Date</th>
                    <th className="px-6 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {referrals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800">{getCustomerName(r.referrerId)}</td>
                      <td className="px-6 py-4 text-slate-700">{getCustomerName(r.referredCustomerId)}</td>
                      <td className="px-6 py-4 text-slate-500 text-sm">{format(parseISO(r.createdAt), 'MMM dd, yyyy')}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${r.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                  {referrals.length === 0 && (
                    <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">No referrals recorded</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const StatCard: React.FC<{ icon: any; label: string; value: string; color: string }> = ({ icon: Icon, label, value, color }) => {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
  };
  return (
    <div className={`${colorMap[color] || colorMap.blue} border rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} />
        <span className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</span>
      </div>
      <div className="text-lg font-black">{value}</div>
    </div>
  );
};

const AuditLink: React.FC<{ icon: any; label: string; id: string; onClick: () => void }> = ({ icon: Icon, label, id, onClick }) => (
  <button onClick={onClick}
    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-all shadow-sm">
    <Icon size={12} className="shrink-0" />
    <span className="font-bold">{label}</span>
    <span className="font-mono text-[10px] text-slate-400">{id.slice(0, 12)}...</span>
  </button>
);
