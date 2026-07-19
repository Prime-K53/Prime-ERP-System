import React, { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { useSales } from '../../context/SalesContext';
import { subMonths, format, parseISO } from 'date-fns';
import {
  Wallet, Printer, Filter, X, Search, Download, Eye, FileText,
  TrendingUp, Plus, ArrowUpRight, ArrowDownLeft, RefreshCw,
  AlertCircle, CheckCircle, Clock, CreditCard, Landmark, ChevronDown
} from 'lucide-react';
import { currencyService } from '../../services/currencyService';
import { exportToCSV } from '../../utils/helpers';

const WalletStatement: React.FC = () => {
  const { companyConfig, user } = useAuth();
  const { walletTransactions = [] } = useFinance();
  const { customers = [] } = useSales();
  const currency = companyConfig?.currencySymbol || currencyService.getCurrency(currencyService.getBaseCurrency())?.symbol || 'K';

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [dateRange, setDateRange] = useState<'all' | '1m' | '3m' | '6m' | '12m'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<string>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedTx, setExpandedTx] = useState<string | null>(null);

  const dateCutoff = useMemo(() => {
    if (dateRange === 'all') return null;
    const months = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 }[dateRange];
    return subMonths(new Date(), months);
  }, [dateRange]);

  const selectedCustomer = useMemo(
    () => customers.find((c: any) => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  const customerWalletTx = useMemo(() => {
    if (!selectedCustomerId) return [];
    return (walletTransactions || []).filter((tx: any) => tx.customerId === selectedCustomerId);
  }, [walletTransactions, selectedCustomerId]);

  const getWalletStatus = (balance: number) => {
    if (balance > 0) return { label: 'Active', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (balance === 0) return { label: 'Zero Balance', color: 'bg-slate-50 text-slate-500 border-slate-200' };
    return { label: 'Negative', color: 'bg-rose-50 text-rose-700 border-rose-200' };
  };

  const walletStatus = getWalletStatus(selectedCustomer?.walletBalance || 0);

  const prePeriodTx = useMemo(() => {
    if (!selectedCustomerId || !dateCutoff) return [];
    return (walletTransactions || [])
      .filter((tx: any) => tx.customerId === selectedCustomerId && new Date(tx.date) < dateCutoff)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [walletTransactions, selectedCustomerId, dateCutoff]);

  const openingBalance = useMemo(() => {
    let balance = 0;
    prePeriodTx.forEach((tx: any) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'Deposit' || tx.type === 'Credit' || tx.type === 'Top-up' || tx.type === 'Refund') balance += amt;
      else if (tx.type === 'Deduction' || tx.type === 'Debit' || tx.type === 'Spending' || tx.type === 'Payment') balance -= amt;
    });
    return balance;
  }, [prePeriodTx]);

  const filteredTx = useMemo(() => {
    let txs = [...customerWalletTx].sort(
      (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    if (dateCutoff) {
      txs = txs.filter((tx: any) => new Date(tx.date) >= dateCutoff);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      txs = txs.filter((tx: any) =>
        (tx.reference || '').toLowerCase().includes(q) ||
        (tx.description || '').toLowerCase().includes(q) ||
        (tx.id || '').toLowerCase().includes(q) ||
        (tx.source || '').toLowerCase().includes(q)
      );
    }

    if (txTypeFilter !== 'all') {
      txs = txs.filter((tx: any) => tx.type === txTypeFilter);
    }

    return txs;
  }, [customerWalletTx, dateCutoff, searchQuery, txTypeFilter]);

  const inPeriodTx = useMemo(() => {
    if (!dateCutoff) return customerWalletTx;
    return customerWalletTx.filter((tx: any) => new Date(tx.date) >= dateCutoff);
  }, [customerWalletTx, dateCutoff]);

  const totalTopups = useMemo(() =>
    inPeriodTx.filter((t: any) => t.type === 'Deposit' || t.type === 'Top-up' || t.type === 'Credit')
      .reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0), [inPeriodTx]);

  const totalSpending = useMemo(() =>
    inPeriodTx.filter((t: any) => t.type === 'Deduction' || t.type === 'Spending' || t.type === 'Payment')
      .reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0), [inPeriodTx]);

  const totalRefunds = useMemo(() =>
    inPeriodTx.filter((t: any) => t.type === 'Refund')
      .reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0), [inPeriodTx]);

  const totalAdjustments = useMemo(() =>
    inPeriodTx.filter((t: any) => t.type === 'Adjustment')
      .reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0), [inPeriodTx]);

  const ledgerEntries = useMemo(() => {
    let runningBalance = openingBalance;
    const sorted = [...filteredTx].sort(
      (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    return sorted.map((tx: any) => {
      const amt = Number(tx.amount) || 0;
      const isCredit = tx.type === 'Deposit' || tx.type === 'Credit' || tx.type === 'Top-up' || tx.type === 'Refund';
      const isDebit = tx.type === 'Deduction' || tx.type === 'Debit' || tx.type === 'Spending' || tx.type === 'Payment' || tx.type === 'Adjustment';
      if (isCredit) runningBalance += amt;
      if (isDebit) runningBalance -= amt;
      return {
        ...tx,
        runningBalance,
        isCredit,
        isDebit,
      };
    });
  }, [filteredTx, openingBalance]);

  const closingBalance = useMemo(() => {
    if (ledgerEntries.length === 0) return openingBalance;
    return ledgerEntries[ledgerEntries.length - 1].runningBalance;
  }, [ledgerEntries, openingBalance]);

  const formatCurrency = (val: number) =>
    `${currency}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getTxTypeBadge = (type: string) => {
    const map: Record<string, string> = {
      'Deposit': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'Top-up': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'Credit': 'bg-blue-50 text-blue-700 border-blue-200',
      'Deduction': 'bg-rose-50 text-rose-700 border-rose-200',
      'Debit': 'bg-rose-50 text-rose-700 border-rose-200',
      'Spending': 'bg-amber-50 text-amber-700 border-amber-200',
      'Payment': 'bg-violet-50 text-violet-700 border-violet-200',
      'Refund': 'bg-cyan-50 text-cyan-700 border-cyan-200',
      'Adjustment': 'bg-slate-50 text-slate-700 border-slate-200',
    };
    return map[type] || 'bg-slate-50 text-slate-600 border-slate-200';
  };

  const uniqueTxTypes = useMemo(() => {
    const types = new Set(customerWalletTx.map((t: any) => t.type));
    return Array.from(types);
  }, [customerWalletTx]);

  const handleExportCSV = () => {
    if (ledgerEntries.length === 0) return;
    const data = ledgerEntries.map((tx: any) => ({
      Date: format(new Date(tx.date), 'yyyy-MM-dd HH:mm'),
      'Transaction ID': tx.id,
      Description: tx.description || tx.type,
      Credit: tx.isCredit ? tx.amount : '',
      Debit: tx.isDebit ? tx.amount : '',
      'Running Balance': tx.runningBalance,
      Source: tx.source || '',
      Reference: tx.reference || '',
      Type: tx.type,
    }));
    exportToCSV(data, `wallet_statement_${selectedCustomer?.name || 'customer'}`);
  };

  if (!selectedCustomerId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
        <Landmark size={48} className="text-slate-300" />
        <p className="text-lg font-semibold">Select a customer to view wallet statement</p>
        <select
          value=""
          onChange={e => setSelectedCustomerId(e.target.value)}
          className="mt-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:border-blue-500 transition-colors shadow-sm min-w-[300px]"
        >
          <option value="">Choose a customer...</option>
          {customers.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Wallet Details Header */}
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 rounded-2xl shadow-xl shadow-indigo-200/50 text-white">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/15 rounded-xl backdrop-blur-sm">
              <Wallet size={28} />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Wallet Statement</h2>
              <p className="text-indigo-200 text-sm font-medium mt-0.5">{selectedCustomer?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest">Current Balance</p>
              <p className="text-2xl font-black finance-nums">{formatCurrency(selectedCustomer?.walletBalance || 0)}</p>
            </div>
            <div className={`px-3 py-1 rounded-full text-[10px] font-bold border ${walletStatus.color} text-indigo-900 bg-white/90`}>
              {walletStatus.label}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-6 mt-4 pt-4 border-t border-white/10">
          <div>
            <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest">Wallet ID</p>
            <p className="font-mono text-sm font-bold">{selectedCustomer?.id ? `WLT-${selectedCustomer.id.slice(0, 8)}` : 'N/A'}</p>
          </div>
          <div>
            <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest">Currency</p>
            <p className="font-bold">{currency}</p>
          </div>
          <div>
            <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest">Last Updated</p>
            <p className="font-bold">{walletTransactions.length > 0 ? format(new Date(walletTransactions[0].date), 'MMM dd, yyyy HH:mm') : 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Summary Widgets */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Opening Balance</p>
          <p className="text-lg font-black text-slate-900 finance-nums">{formatCurrency(openingBalance)}</p>
          <p className="text-[9px] text-slate-400 mt-0.5">{dateRange === 'all' ? 'Since inception' : `Before ${dateCutoff?.toLocaleDateString()}`}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Top-ups</p>
          <p className="text-lg font-black text-emerald-600 finance-nums">{formatCurrency(totalTopups)}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <ArrowUpRight size={10} className="text-emerald-500" />
            <span className="text-[9px] text-emerald-500 font-medium">{inPeriodTx.filter((t: any) => t.type === 'Deposit' || t.type === 'Top-up').length} txns</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Spending</p>
          <p className="text-lg font-black text-rose-600 finance-nums">{formatCurrency(totalSpending)}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <ArrowDownLeft size={10} className="text-rose-500" />
            <span className="text-[9px] text-rose-500 font-medium">{inPeriodTx.filter((t: any) => t.type === 'Deduction' || t.type === 'Spending' || t.type === 'Payment').length} txns</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Refunds</p>
          <p className="text-lg font-black text-cyan-600 finance-nums">{formatCurrency(totalRefunds)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Adjustments</p>
          <p className="text-lg font-black text-amber-600 finance-nums">{formatCurrency(totalAdjustments)}</p>
        </div>
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-4 rounded-xl shadow-sm text-white">
          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-1">Closing Balance</p>
          <p className="text-lg font-black finance-nums">{formatCurrency(closingBalance)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
            {(['all', '1m', '3m', '6m', '12m'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                  dateRange === range ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {range === 'all' ? 'All' : range}
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-[160px]">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-xs font-medium outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <select
            value={txTypeFilter}
            onChange={e => setTxTypeFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none focus:border-blue-500"
          >
            <option value="all">All Types</option>
            {uniqueTxTypes.map(t => (
              <option key={String(t)} value={String(t)}>{String(t)}</option>
            ))}
          </select>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-all ${showFilters ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
            title="Advanced filters"
          >
            <Filter size={15} />
          </button>

          <div className="h-5 w-px bg-slate-200" />

          <button
            onClick={() => { setSelectedCustomerId(''); setSearchQuery(''); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold bg-white hover:bg-slate-50 transition-all"
          >
            <RefreshCw size={12} />
            Reset
          </button>

          <button
            onClick={handleExportCSV}
            disabled={ledgerEntries.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold hover:bg-emerald-100 transition-all disabled:opacity-50"
          >
            <Download size={13} />
            Export CSV
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 text-[11px] font-bold hover:bg-slate-100 transition-all"
          >
            <Printer size={13} />
            Print
          </button>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-sm">Transaction History</h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-2 py-0.5 rounded">
            {ledgerEntries.length} transaction{ledgerEntries.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="overflow-x-auto">
          {ledgerEntries.length === 0 ? (
            <div className="text-center py-12">
              <Wallet size={36} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-400 font-medium text-sm">No wallet transactions for this period.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 sticky top-0">
                  <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date & Time</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Transaction ID</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Description</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Credit</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Debit</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Running Balance</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Source</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ref Document</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Created By</th>
                  <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ledgerEntries.map((tx: any, idx: number) => (
                  <React.Fragment key={tx.id || idx}>
                    <tr
                      className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${tx.isDebit ? 'text-rose-600' : ''}`}
                      onClick={() => setExpandedTx(expandedTx === tx.id ? null : tx.id)}
                    >
                      <td className="px-3 py-2.5 text-[11px] text-slate-600 whitespace-nowrap font-medium">
                        <div>{format(new Date(tx.date), 'MMM dd, yyyy')}</div>
                        <div className="text-[9px] text-slate-400">{format(new Date(tx.date), 'HH:mm')}</div>
                      </td>
                      <td className="px-3 py-2.5 text-[11px] font-mono text-slate-500">
                        {(tx.id || '').slice(0, 12)}...
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${getTxTypeBadge(tx.type)}`}>
                            {tx.type}
                          </span>
                          <span className="text-[11px] text-slate-700 font-medium">{tx.description || tx.type}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-[11px] font-bold text-emerald-600 finance-nums">
                        {tx.isCredit ? formatCurrency(tx.amount) : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[11px] font-bold text-rose-600 finance-nums">
                        {tx.isDebit ? formatCurrency(tx.amount) : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[11px] font-bold text-slate-900 finance-nums">
                        {formatCurrency(tx.runningBalance)}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-slate-500">{tx.source || 'Manual'}</td>
                      <td className="px-3 py-2.5 text-[11px] font-mono text-slate-400">{tx.reference || '-'}</td>
                      <td className="px-3 py-2.5 text-[11px] text-slate-500">{tx.createdBy || user?.name || 'System'}</td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all"
                          title="View details"
                        >
                          <Eye size={13} />
                        </button>
                      </td>
                    </tr>
                    {expandedTx === tx.id && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={10} className="px-6 py-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                            <div>
                              <p className="font-bold text-slate-400 uppercase text-[9px] tracking-widest mb-1">Full ID</p>
                              <p className="font-mono text-slate-700">{tx.id}</p>
                            </div>
                            <div>
                              <p className="font-bold text-slate-400 uppercase text-[9px] tracking-widest mb-1">Amount</p>
                              <p className="font-bold text-slate-900">{formatCurrency(tx.amount)}</p>
                            </div>
                            <div>
                              <p className="font-bold text-slate-400 uppercase text-[9px] tracking-widest mb-1">Running Balance</p>
                              <p className="font-bold text-slate-900">{formatCurrency(tx.runningBalance)}</p>
                            </div>
                            <div>
                              <p className="font-bold text-slate-400 uppercase text-[9px] tracking-widest mb-1">Reference</p>
                              <p className="font-mono text-slate-600">{tx.reference || 'N/A'}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          .statement-ledger { page-break-inside: auto; }
        }
      `}</style>
    </div>
  );
};

export default WalletStatement;
