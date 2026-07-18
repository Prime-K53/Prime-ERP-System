import React, { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { useSales } from '../../context/SalesContext';
import { subMonths } from 'date-fns';
import {
  Wallet, Printer, Filter, X, Search,
  TrendingUp, Plus, ArrowUpRight
} from 'lucide-react';
import { currencyService } from '../../services/currencyService';
import StatementLedger from '../../components/StatementLedger';

const WalletStatement: React.FC = () => {
  const { companyConfig } = useAuth();
  const { walletTransactions = [] } = useFinance();
  const { customers = [] } = useSales();
  const currency = companyConfig?.currencySymbol || currencyService.getCurrency(currencyService.getBaseCurrency())?.symbol || '$';

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [dateRange, setDateRange] = useState<'all' | '3m' | '6m' | '12m'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const dateCutoff = useMemo(() => {
    if (dateRange === 'all') return null;
    const months = { '3m': 3, '6m': 6, '12m': 12 }[dateRange];
    return subMonths(new Date(), months);
  }, [dateRange]);

  const customerWalletTx = useMemo(() => {
    if (!selectedCustomerId) return [];
    return (walletTransactions || []).filter(tx => tx.customerId === selectedCustomerId);
  }, [walletTransactions, selectedCustomerId]);

  const filteredTx = useMemo(() => {
    let txs = [...customerWalletTx].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    if (dateCutoff) {
      txs = txs.filter(tx => new Date(tx.date) >= dateCutoff);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      txs = txs.filter(tx =>
        (tx.reference || '').toLowerCase().includes(q) ||
        (tx.description || '').toLowerCase().includes(q) ||
        (tx.id || '').toLowerCase().includes(q)
      );
    }

    return txs;
  }, [customerWalletTx, dateCutoff, searchQuery]);

  const prePeriodTx = useMemo(() => {
    if (!selectedCustomerId || !dateCutoff) return [];
    return (walletTransactions || [])
      .filter(tx => tx.customerId === selectedCustomerId && new Date(tx.date) < dateCutoff)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [walletTransactions, selectedCustomerId, dateCutoff]);

  const openingBalance = useMemo(() => {
    let balance = 0;
    prePeriodTx.forEach(tx => {
      if (tx.type === 'Deposit' || tx.type === 'Credit') balance += tx.amount;
      else if (tx.type === 'Deduction' || tx.type === 'Debit') balance -= tx.amount;
    });
    return balance;
  }, [prePeriodTx]);

  const ledgerEntries = useMemo(() => {
    let runningBalance = openingBalance;
    const entries = filteredTx.map(tx => {
      const isCredit = tx.type === 'Deposit' || tx.type === 'Credit';
      const isDebit = tx.type === 'Deduction' || tx.type === 'Debit';
      if (isCredit) runningBalance += tx.amount;
      if (isDebit) runningBalance -= tx.amount;
      return {
        date: tx.date,
        description: tx.description || tx.type,
        reference: tx.reference || tx.id,
        debit: isDebit ? tx.amount : undefined,
        credit: isCredit ? tx.amount : undefined,
        balance: runningBalance,
      };
    });
    return entries;
  }, [filteredTx, openingBalance]);

  const closingBalance = useMemo(() => {
    if (ledgerEntries.length === 0) return openingBalance;
    return ledgerEntries[ledgerEntries.length - 1].balance;
  }, [ledgerEntries, openingBalance]);

  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  const formatCurrency = (val: number) =>
    `${currency}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (!selectedCustomerId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
        <Wallet size={48} className="text-slate-300" />
        <p className="text-lg font-semibold">Select a customer to view wallet statement</p>
        <select
          value=""
          onChange={e => setSelectedCustomerId(e.target.value)}
          className="mt-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:border-blue-500 transition-colors shadow-sm min-w-[250px]"
        >
          <option value="">Choose a customer...</option>
          {customers.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
    );
  }

  const totalDeposits = customerWalletTx.filter(t => t.type === 'Deposit' || t.type === 'Credit').reduce((s, t) => s + t.amount, 0);
  const totalDeductions = customerWalletTx.filter(t => t.type === 'Deduction' || t.type === 'Debit').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 rounded-2xl shadow-lg shadow-emerald-100 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-lg"><Wallet size={20} /></div>
            <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Current Balance</span>
          </div>
          <div className="text-2xl font-black finance-nums">
            {formatCurrency(selectedCustomer?.walletBalance || 0)}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Opening Balance</span>
            <ArrowUpRight size={16} className="text-slate-400" />
          </div>
          <div className="text-xl font-black text-slate-900 finance-nums">
            {formatCurrency(openingBalance)}
          </div>
          <p className="text-[10px] text-slate-500 font-medium mt-1">
            {dateRange === 'all' ? 'Since inception' : `Before ${dateCutoff?.toLocaleDateString()}`}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Deposits</span>
            <Plus size={16} className="text-emerald-500" />
          </div>
          <div className="text-xl font-black text-emerald-600 finance-nums">
            {formatCurrency(totalDeposits)}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Deductions</span>
            <TrendingUp size={16} className="text-rose-500" />
          </div>
          <div className="text-xl font-black text-rose-600 finance-nums">
            {formatCurrency(totalDeductions)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {(['all', '3m', '6m', '12m'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  dateRange === range ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {range === 'all' ? 'All Time' : range}
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => {
                const select = document.getElementById('customer-select');
                if (select) {
                  const modal = select.closest('.relative')?.querySelector('.customer-dropdown');
                  if (modal) (modal as HTMLElement).classList.toggle('hidden');
                }
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold bg-white hover:bg-slate-50 transition-all shadow-sm"
            >
              <Filter size={14} />
              {selectedCustomer?.name || 'Customer'}
              <X
                size={14}
                className="ml-1 hover:text-rose-500 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCustomerId('');
                  setSearchQuery('');
                }}
              />
            </button>
          </div>

          <button
            onClick={() => window.print()}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
            title="Print statement"
          >
            <Printer size={18} />
          </button>
        </div>
      </div>

      {/* Statement Ledger */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-none">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between print:hidden">
          <div>
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Wallet size={18} className="text-emerald-600" />
              Wallet Statement
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {selectedCustomer?.name}
              {dateCutoff && ` — from ${dateCutoff.toLocaleDateString()} to ${new Date().toLocaleDateString()}`}
              {!dateCutoff && ' — Full history'}
            </p>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">{ledgerEntries.length} transaction(s)</span>
        </div>
        <div className="p-6">
          {ledgerEntries.length > 0 ? (
            <StatementLedger
              entries={ledgerEntries}
              currencySymbol={currency}
              openingBalance={openingBalance}
              closingBalance={closingBalance}
            />
          ) : (
            <div className="text-center py-12">
              <Wallet size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-400 font-medium">No wallet transactions found for this period.</p>
              <p className="text-xs text-slate-300 mt-1">Try a different date range or customer.</p>
            </div>
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
