import React, { useMemo, useState } from 'react';
import { Award, DollarSign, Users, CheckCircle, Clock, Percent, Search, CheckSquare, X, Filter } from 'lucide-react';
import { useSales } from '../../context/SalesContext';
import { useAuth } from '../../context/AuthContext';
import { formatNumber } from '../../utils/helpers';
import { currencyService } from '../../services/currencyService';

type CommissionStatus = 'pending' | 'approved' | 'paid';
type PeriodFilter = 'all' | 'this-month' | 'last-month' | 'this-quarter' | 'this-year';

const periodLabel: Record<PeriodFilter, string> = {
  'all': 'All Time',
  'this-month': 'This Month',
  'last-month': 'Last Month',
  'this-quarter': 'This Quarter',
  'this-year': 'This Year',
};

const statusBadge: Record<CommissionStatus, { label: string; classes: string }> = {
  pending: { label: 'Pending', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Approved', classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  paid: { label: 'Paid', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const Commissions: React.FC = () => {
  const { salesOrders = [], sales = [], customers = [], isLoading } = useSales();
  const { companyConfig, allUsers = [], notify } = useAuth();
  const currency = companyConfig?.currencySymbol || currencyService.getCurrency(currencyService.getBaseCurrency())?.symbol || '$';

  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('this-month');
  const [defaultRate, setDefaultRate] = useState(5);
  const [personRates, setPersonRates] = useState<Record<string, number>>({});
  const [commissionStatuses, setCommissionStatuses] = useState<Record<string, CommissionStatus>>({});
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [rateInput, setRateInput] = useState('');

  const periodStart = useMemo(() => {
    const now = new Date();
    switch (periodFilter) {
      case 'this-month': return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'last-month': return new Date(now.getFullYear(), now.getMonth() - 1, 1);
      case 'this-quarter': {
        const q = Math.floor(now.getMonth() / 3) * 3;
        return new Date(now.getFullYear(), q, 1);
      }
      case 'this-year': return new Date(now.getFullYear(), 0, 1);
      default: return null;
    }
  }, [periodFilter]);

  const periodEnd = useMemo(() => {
    if (!periodStart) return null;
    const now = new Date();
    if (periodFilter === 'last-month') {
      return new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    }
    return now;
  }, [periodStart, periodFilter]);

  const salespersons = useMemo(() => {
    const assignedIds = new Set<string>();

    customers.forEach((c: any) => {
      if (c.assignedSalesperson) assignedIds.add(c.assignedSalesperson);
    });
    salesOrders.forEach((o: any) => {
      if (o.salesPersonId) assignedIds.add(o.salesPersonId);
    });
    sales.forEach((s: any) => {
      if (s.cashierId) assignedIds.add(s.cashierId);
    });

    const userMap = new Map(allUsers.map((u: any) => [u.id || u.username, u]));
    const seen = new Set<string>();
    const persons: { id: string; name: string; role: string }[] = [];

    assignedIds.forEach(id => {
      if (seen.has(id)) return;
      seen.add(id);
      const user = userMap.get(id);
      persons.push({
        id,
        name: user?.name || user?.fullName || user?.username || id,
        role: user?.role || 'Sales',
      });
    });

    persons.sort((a, b) => a.name.localeCompare(b.name));
    return persons;
  }, [customers, salesOrders, sales, allUsers]);

  const salesData = useMemo(() => {
    const map = new Map<string, { orderTotal: number; posTotal: number; count: number }>();
    const ps = periodStart;
    const pe = periodEnd;

    salesOrders.forEach((o: any) => {
      if (!o.salesPersonId) return;
      if (ps) {
        const d = new Date(o.orderDate);
        if (d < ps || (pe && d > pe)) return;
      }
      const entry = map.get(o.salesPersonId) || { orderTotal: 0, posTotal: 0, count: 0 };
      entry.orderTotal += Number(o.total || 0);
      entry.count += 1;
      map.set(o.salesPersonId, entry);
    });

    sales.forEach((s: any) => {
      if (!s.cashierId) return;
      if (ps) {
        const d = new Date(s.date || s.created_at);
        if (d < ps || (pe && d > pe)) return;
      }
      const entry = map.get(s.cashierId) || { orderTotal: 0, posTotal: 0, count: 0 };
      entry.posTotal += Number(s.totalAmount || 0);
      entry.count += 1;
      map.set(s.cashierId, entry);
    });

    return map;
  }, [salesOrders, sales, periodStart, periodEnd]);

  const getRate = (personId: string) => personRates[personId] ?? defaultRate;

  const getStatus = (personId: string) => commissionStatuses[personId] || 'pending';

  const personCommissions = useMemo(() => {
    return salespersons.map(p => {
      const data = salesData.get(p.id) || { orderTotal: 0, posTotal: 0, count: 0 };
      const totalSales = data.orderTotal + data.posTotal;
      const rate = getRate(p.id);
      const commission = totalSales * (rate / 100);
      const status = getStatus(p.id);
      return { ...p, ...data, totalSales, rate, commission, status };
    });
  }, [salespersons, salesData, personRates, defaultRate, commissionStatuses]);

  const filteredCommissions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return personCommissions;
    return personCommissions.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.role.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    );
  }, [personCommissions, searchTerm]);

  const totalSalesAll = personCommissions.reduce((s, p) => s + p.totalSales, 0);
  const totalCommissionAll = personCommissions.reduce((s, p) => s + p.commission, 0);
  const pendingCount = personCommissions.filter(p => p.status === 'pending').length;
  const activeCount = salespersons.length;

  const handleRateSave = (personId: string) => {
    const val = parseFloat(rateInput);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      setPersonRates(prev => ({ ...prev, [personId]: val }));
      notify(`Rate updated to ${val}%`, 'success');
    } else {
      notify('Rate must be between 0 and 100', 'error');
    }
    setEditingRate(null);
  };

  const approveAll = () => {
    const updated = { ...commissionStatuses };
    personCommissions.forEach(p => {
      if (p.status === 'pending' && p.totalSales > 0) updated[p.id] = 'approved';
    });
    setCommissionStatuses(updated);
    notify(`Approved ${personCommissions.filter(p => p.status === 'pending' && p.totalSales > 0).length} commissions`, 'success');
  };

  const toggleStatus = (personId: string) => {
    const current = getStatus(personId);
    const next: CommissionStatus = current === 'pending' ? 'approved' : current === 'approved' ? 'paid' : 'pending';
    setCommissionStatuses(prev => ({ ...prev, [personId]: next }));
  };

  return (
    <div className="p-4 md:p-6 bg-slate-50/60 min-h-screen space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900 tracking-tight">Commissions</h1>
          <p className="text-[13px] text-slate-500 font-medium">Track and manage sales team commissions.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 w-full md:w-auto">
          <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-blue-500 hover:bg-slate-50 transition-all duration-200">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg shrink-0">
              <Users size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">Salespeople</p>
              <p className="text-lg md:text-xl font-semibold text-slate-900">{activeCount}</p>
            </div>
          </div>
          <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-emerald-500 hover:bg-slate-50 transition-all duration-200">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
              <DollarSign size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">Total Sales</p>
              <p className="text-lg md:text-xl font-semibold text-slate-900">{currency}{formatNumber(totalSalesAll)}</p>
            </div>
          </div>
          <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-violet-500 hover:bg-slate-50 transition-all duration-200">
            <div className="p-2.5 bg-violet-50 text-violet-600 rounded-lg shrink-0">
              <Award size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">Total Commissions</p>
              <p className="text-lg md:text-xl font-semibold text-slate-900">{currency}{formatNumber(totalCommissionAll)}</p>
            </div>
          </div>
          <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-amber-500 hover:bg-slate-50 transition-all duration-200">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg shrink-0">
              <Clock size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">Pending Approval</p>
              <p className="text-lg md:text-xl font-semibold text-slate-900">{pendingCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search salespeople..."
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-[13px] font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-[13px] font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
          >
            {Object.entries(periodLabel).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Percent size={14} className="text-slate-400" />
          <div className="flex items-center gap-1">
            <span className="text-[12px] text-slate-600 font-medium">Default:</span>
            <input
              type="number"
              value={defaultRate}
              onChange={(e) => setDefaultRate(Math.max(0, Math.min(100, parseFloat(e.target.value || '0'))))}
              className="w-14 px-2 py-1.5 border border-slate-200 rounded-lg text-[13px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center"
              step="0.5"
              min="0"
              max="100"
            />
            <span className="text-[12px] text-slate-500">%</span>
          </div>
        </div>
        <button
          onClick={approveAll}
          disabled={pendingCount === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-[12px] font-bold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          <CheckSquare size={14} /> Approve All
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Salesperson</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="text-right px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Orders</th>
                <th className="text-right px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">POS Sales</th>
                <th className="text-right px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Sales</th>
                <th className="text-center px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rate</th>
                <th className="text-right px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Commission</th>
                <th className="text-center px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-center px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-[13px] text-slate-400 font-medium">Loading commission data...</td>
                </tr>
              ) : filteredCommissions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Award size={32} className="text-slate-300" />
                      <p className="text-[13px] text-slate-500 font-medium">No commission data found</p>
                      <p className="text-[12px] text-slate-400">Sales need to be attributed to a salesperson to appear here.</p>
                    </div>
                  </td>
                </tr>
              ) : filteredCommissions.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-semibold text-[12px] shrink-0">
                        {p.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-slate-900 truncate">{p.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono truncate">{p.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[12px] font-medium text-slate-600">{p.role}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[13px] font-semibold text-slate-900 tabular-nums">{p.count}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[13px] font-semibold text-slate-900 tabular-nums">{currency}{formatNumber(p.posTotal)}</span>
                    {p.orderTotal > 0 && (
                      <div className="text-[10px] text-slate-400 tabular-nums">+{currency}{formatNumber(p.orderTotal)} orders</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[13px] font-bold text-slate-900 tabular-nums">{currency}{formatNumber(p.totalSales)}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editingRate === p.id ? (
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          value={rateInput}
                          onChange={(e) => setRateInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleRateSave(p.id); if (e.key === 'Escape') setEditingRate(null); }}
                          onBlur={() => handleRateSave(p.id)}
                          className="w-14 px-1.5 py-1 border border-blue-400 rounded text-[12px] font-bold text-blue-600 outline-none text-center"
                          step="0.5"
                          min="0"
                          max="100"
                          autoFocus
                        />
                        <span className="text-[11px] text-slate-500">%</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setRateInput(String(p.rate)); setEditingRate(p.id); }}
                        className="text-[13px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer tabular-nums"
                        title="Click to edit rate"
                      >
                        {p.rate}%
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[13px] font-bold text-slate-900 tabular-nums">{currency}{formatNumber(p.commission)}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusBadge[p.status].classes}`}>
                      {statusBadge[p.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.totalSales > 0 && (
                      <button
                        onClick={() => toggleStatus(p.id)}
                        className={`p-1.5 rounded-lg transition-all ${
                          p.status === 'pending'
                            ? 'text-blue-600 hover:bg-blue-50'
                            : p.status === 'approved'
                            ? 'text-emerald-600 hover:bg-emerald-50'
                            : 'text-slate-400 hover:bg-slate-100'
                        }`}
                        title={p.status === 'pending' ? 'Approve' : p.status === 'approved' ? 'Mark as Paid' : 'Reset to Pending'}
                      >
                        {p.status === 'pending' ? <CheckCircle size={16} /> : p.status === 'approved' ? <DollarSign size={16} /> : <X size={16} />}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Commissions;
