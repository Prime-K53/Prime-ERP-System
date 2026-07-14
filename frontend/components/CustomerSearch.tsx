import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, UserPlus, Save } from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';
import { referralService } from '../services/referralService';

interface CustomerSearchProps {
  open: boolean;
  onSelect: (customer: { id: string; name: string } | null) => void;
  onClose: () => void;
  title?: string;
  excludeIds?: string[];
  showQuickAdd?: boolean;
  mode?: 'customer' | 'referrer';
}

export const CustomerSearch: React.FC<CustomerSearchProps> = ({
  open, onSelect, onClose, title = 'Select Customer',
  excludeIds = [], showQuickAdd = true, mode = 'customer'
}) => {
  const { companyConfig, notify } = useAuth();
  const { customers, addCustomer } = useSales();
  const { invoices } = useFinance();
  const inputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContact, setNewContact] = useState('');

  const currency = companyConfig?.currencySymbol || '$';

  useEffect(() => {
    if (open) {
      setSearchTerm('');
      setQuickAddOpen(false);
      setNewName('');
      setNewContact('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const customerList = useMemo(() => {
    return (customers || []).filter((c: any) => !excludeIds.includes(c.id));
  }, [customers, excludeIds]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return customerList;
    const q = searchTerm.trim().toLowerCase();
    return customerList.filter((c: any) =>
      c.name?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      (c.customerCode || '').toLowerCase().includes(q) ||
      (c.company || '').toLowerCase().includes(q)
    );
  }, [customerList, searchTerm]);

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    onSelect({ id: '', name: newName });
    onClose();
  };

  const handleSelect = (c: any) => {
    onSelect({ id: c.id, name: c.name });
    onClose();
  };

  const getOutstanding = (customerId: string, customerName: string) => {
    return (invoices || [])
      .filter((i: any) => (i.customerId === customerId || i.customerName === customerName) && i.status !== 'Paid' && i.status !== 'Cancelled')
      .reduce((sum: number, i: any) => sum + ((i.totalAmount || 0) - (i.paidAmount || 0)), 0);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4 backdrop-blur-[2px]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-2 bg-white border-b border-slate-200 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input ref={inputRef} type="text" placeholder="Search by name, phone, email, code..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white" />
          </div>
        </div>

        <div className="px-4 py-2 bg-white border-b border-slate-200 flex justify-between items-center shrink-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {filtered.length} customer{filtered.length !== 1 ? 's' : ''}
          </p>
          {showQuickAdd && mode === 'customer' && (
            <button onClick={() => setQuickAddOpen(!quickAddOpen)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${quickAddOpen ? 'bg-slate-100 text-slate-700 border border-slate-200' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
              {quickAddOpen ? <X size={14} /> : <UserPlus size={14} />}
              {quickAddOpen ? 'Cancel' : 'New Customer'}
            </button>
          )}
        </div>

        {quickAddOpen && (
          <form onSubmit={handleQuickAdd} className="p-4 bg-slate-50 border-b border-slate-200 shrink-0">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Full Name *</label>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                  placeholder="e.g. Acme Printing" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Contact</label>
                <input value={newContact} onChange={e => setNewContact(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                  placeholder="Phone or Email" />
              </div>
            </div>
            <button type="submit" disabled={!newName}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 transition-colors">
              <Save size={14} /> Save and Select
            </button>
          </form>
        )}

        <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-400">
              {searchTerm ? `No customers matching "${searchTerm}"` : 'No customers found'}
            </div>
          ) : filtered.map((c: any) => {
            const debt = getOutstanding(c.id, c.name);
            return (
              <button key={c.id} onClick={() => handleSelect(c)}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex justify-between items-center transition-colors group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-semibold text-sm group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                    {(c.name || '?').charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 text-sm leading-snug truncate">{c.name}</div>
                    <div className="text-xs text-slate-400 truncate">{c.phone || c.email || c.customerCode || ''}</div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <div className={`font-medium text-xs tabular-nums ${debt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {currency}{debt.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
                    {debt > 0 ? 'Due' : 'Clear'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
