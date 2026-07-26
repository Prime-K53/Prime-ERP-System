import React, { useState, useEffect } from 'react';
import { X, MapPin, CreditCard, FileText, Building, Plus, Trash2, AlertTriangle, Search } from 'lucide-react';
import { Customer } from '../../../types';
import { getDefaultPaymentTermsForSegment } from '../../../utils/helpers';
import { useAuth } from '../../../context/AuthContext';
import { useFinance } from '../../../context/FinanceContext';
import { getPlaceholder } from '../../../constants/placeholders';
import { currencyService } from '../../../services/currencyService';
import { CustomerSearch } from '../../../components/CustomerSearch';
import { Dialog } from '../../../components/Dialog';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customer: Customer) => Promise<void>;
  customer?: Customer;
  initialSegment?: string;
}

export const ClientModal: React.FC<ClientModalProps> = ({ isOpen, onClose, onSave, customer, initialSegment }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    city: '',
    billingAddress: '',
    shippingAddress: '',
    balance: 0,
    walletBalance: 0,
    creditLimit: 0,
    notes: '',
    subAccounts: [],
    segment: initialSegment || 'Individual',
    paymentTerms: getDefaultPaymentTermsForSegment(initialSegment || 'Individual'),
    assignedSalesperson: '',
    creditHold: false,
    tags: [],
    avgPaymentDays: 0,
    leadSource: '',
    pipelineStage: 'New',
    leadScore: 0,
    nextFollowUpDate: '',
    estimatedDealValue: 0,
    referredById: '',
    referredByName: ''
  });

  const [useBillingForShipping, setUseBillingForShipping] = useState(true);
  const [activeTab, setActiveTab] = useState<'Address' | 'Payment' | 'Additional' | 'Branches'>('Address');
  const [referrerSearchOpen, setReferrerSearchOpen] = useState(false);

  const { invoices } = useFinance(); const { companyConfig } = useAuth();
  const { customers: allCustomers } = useFinance();

  useEffect(() => {
    if (customer) {
      setFormData({
        ...customer,
        name: customer.name || '',
        phone: customer.phone || '',
        address: customer.address || '',
        city: customer.city || '',
        billingAddress: customer.billingAddress || '',
        shippingAddress: customer.shippingAddress || '',
        balance: customer.balance ?? 0,
        walletBalance: customer.walletBalance ?? 0,
        creditLimit: customer.creditLimit ?? 0,
        notes: customer.notes || '',
        subAccounts: customer.subAccounts || [],
        segment: (customer.segment as string) || 'Individual',
        paymentTerms: customer.paymentTerms || getDefaultPaymentTermsForSegment(customer.segment || 'Individual'),
        assignedSalesperson: customer.assignedSalesperson || '',
        creditHold: Boolean(customer.creditHold),
        tags: customer.tags || [],
        avgPaymentDays: customer.avgPaymentDays ?? 0,
        leadSource: (customer as Customer & Record<string, unknown>).leadSource || '',
        pipelineStage: (customer as Customer & Record<string, unknown>).pipelineStage || 'New',
        leadScore: (customer as Customer & Record<string, unknown>).leadScore ?? 0,
        nextFollowUpDate: (customer as Customer & Record<string, unknown>).nextFollowUpDate || '',
        estimatedDealValue: (customer as Customer & Record<string, unknown>).estimatedDealValue ?? 0,
        referredById: (customer as Customer & Record<string, unknown>).referredById || '',
        referredByName: (customer as Customer & Record<string, unknown>).referredByName || '',
      });
      setUseBillingForShipping(customer.billingAddress === customer.shippingAddress);
    } else {
      setFormData({
        name: '', phone: '', address: '', city: '', billingAddress: '', shippingAddress: '',
        balance: 0, walletBalance: 0, creditLimit: 0, notes: '',
        paymentTerms: getDefaultPaymentTermsForSegment('Individual'), subAccounts: [], segment: 'Individual', assignedSalesperson: '',
        creditHold: false, tags: [], avgPaymentDays: 0, leadSource: '', pipelineStage: 'New', leadScore: 0, nextFollowUpDate: '', estimatedDealValue: 0, referredById: '', referredByName: ''
      });
      setUseBillingForShipping(true);
    }
  }, [customer, isOpen]);

  useEffect(() => {
    if (useBillingForShipping) {
      setFormData(prev => ({ ...prev, shippingAddress: prev.billingAddress }));
    }
  }, [useBillingForShipping, formData.billingAddress]);

  const calcOutstanding = (custId: string | undefined) => {
    if (!custId) return 0;
    const invs = (invoices || []).filter((inv: any) => (inv.customerId === custId || inv.customerName === formData.name) && inv.status !== 'Paid' && inv.status !== 'Cancelled');
    const outstanding = invs.reduce((sum: number, inv: any) => sum + ((inv.totalAmount || 0) - (inv.paidAmount || 0)), 0);
    return outstanding;
  };

  const outstandingBalance = calcOutstanding(customer?.id || formData.id);
  const currency = companyConfig?.currencySymbol || currencyService.getCurrency(currencyService.getBaseCurrency())?.symbol || '$';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSave = { ...formData };
    if (useBillingForShipping) dataToSave.shippingAddress = dataToSave.billingAddress;
    
    if (!dataToSave.paymentTerms) {
      dataToSave.paymentTerms = getDefaultPaymentTermsForSegment(dataToSave.segment || 'Individual');
    }
    
    await onSave(dataToSave as Customer);

    onClose();
  };

  const handleAddSubAccount = () => {
    setFormData(prev => ({
      ...prev,
      subAccounts: [...(prev.subAccounts || []), { id: `SUB-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, name: '', balance: 0, walletBalance: 0, status: 'Active' }]
    }));
  };

  const handleRemoveSubAccount = (id: string) => {
    setFormData(prev => ({ ...prev, subAccounts: (prev.subAccounts || []).filter(s => s.id !== id) }));
  };

  const handleSubAccountChange = (id: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      subAccounts: (prev.subAccounts || []).map(s => s.id === id ? { ...s, [field]: value } : s)
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      if (name === 'segment') {
        const newSegment = value as 'Individual' | 'School Account' | 'Institution' | 'Government';
        const newPaymentTerms = getDefaultPaymentTermsForSegment(newSegment);

        setFormData(prev => ({
          ...prev,
          [name]: newSegment,
          paymentTerms: newPaymentTerms
        }));
      } else {
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) : value }));
      }
    }
  };

  const SidebarItem = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all border-l-4 ${
        activeTab === id 
          ? 'bg-blue-50 text-blue-700 border-l-blue-500 font-medium' 
          : 'bg-white text-slate-500 border-l-transparent hover:bg-slate-50 hover:text-slate-700'
      }`}
    >
      <Icon size={18} />
      {label}
    </button>
  );

  return (
    <Dialog open={isOpen} onClose={onClose} className="max-w-5xl" noPadding hideHeader ariaLabel={customer ? `Edit Customer: ${customer.name}` : 'Add New Customer'}>
      <div className="flex flex-col h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 shrink-0">
          <h2 className="text-lg font-semibold text-slate-900">
            {customer ? `Edit Customer: ${customer.name}` : 'Add New Customer'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Desktop Sidebar */}
          <div className="hidden md:flex w-44 bg-white border-r border-slate-200 py-3 shrink-0 flex-col">
            <nav className="space-y-0.5" aria-label="Customer form sections">
              <SidebarItem id="Address" label="Address Info" icon={MapPin} />
              <SidebarItem id="Payment" label="Payment & Billing" icon={CreditCard} />
              <SidebarItem id="Additional" label="Additional Info" icon={FileText} />
              <SidebarItem id="Branches" label="Branches" icon={Building} />
            </nav>
          </div>

          {/* Mobile Tabs */}
          <div className="md:hidden flex items-center gap-1 px-4 py-2 bg-white border-b border-slate-200 overflow-x-auto shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('Address')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === 'Address' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <MapPin size={14} className="inline mr-1" />
              Address
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('Payment')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === 'Payment' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <CreditCard size={14} className="inline mr-1" />
              Payment
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('Additional')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === 'Additional' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <FileText size={14} className="inline mr-1" />
              Additional
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('Branches')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === 'Branches' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Building size={14} className="inline mr-1" />
              Branches
            </button>
          </div>

          {/* Form Area */}
          <div className="flex-1 overflow-y-auto bg-white">
            <form id="client-form" onSubmit={handleSubmit} className="p-5 space-y-5">
              {/* Basic Info Section */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Customer Name / Company <span className="text-rose-500">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full h-11 bg-white border border-slate-200 rounded-lg px-4 text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder={getPlaceholder.company()}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Phone Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full h-11 bg-white border border-slate-200 rounded-lg px-4 text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder={getPlaceholder.phone()}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Segment</label>
                    <select
                      name="segment"
                      value={formData.segment}
                      onChange={handleChange}
                      className="w-full h-11 bg-white border border-slate-200 rounded-lg px-4 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                    >
                      <option value="Individual">Individual</option>
                      <option value="School Account">School Account</option>
                      <option value="Institution">Institution</option>
                      <option value="Government">Government</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Address Section */}
              {activeTab === 'Address' && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Billing Address</label>
                      <textarea
                        name="billingAddress"
                        value={formData.billingAddress}
                        onChange={handleChange}
                        rows={3}
                        className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                        placeholder={getPlaceholder.address()}
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-sm font-medium text-slate-700">Shipping Address</label>
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={useBillingForShipping}
                            onChange={(e) => setUseBillingForShipping(e.target.checked)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          Same as Billing
                        </label>
                      </div>
                      <div className="relative">
                        <textarea
                          name="shippingAddress"
                          value={formData.shippingAddress}
                          onChange={handleChange}
                          rows={3}
                          disabled={useBillingForShipping}
                          className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium outline-none transition-all resize-none ${
                            useBillingForShipping
                              ? 'bg-slate-50 border border-slate-200 text-slate-400 cursor-not-allowed'
                              : 'bg-white border border-slate-200 text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                          }`}
                          placeholder={`${getPlaceholder.addressLine2()}, ${getPlaceholder.city()}`}
                        />
                        {useBillingForShipping && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-xs font-medium text-slate-400 bg-slate-50/80 px-2 py-1 rounded">
                              Inherited from Billing Address
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">City / Region</label>
                        <input
                          type="text"
                          name="city"
                          value={formData.city}
                          onChange={handleChange}
                          className="w-full h-11 bg-white border border-slate-200 rounded-lg px-4 text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          placeholder={getPlaceholder.city()}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Section */}
              {activeTab === 'Payment' && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Opening Balance</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                        <input
                          type="number"
                          name="balance"
                          value={formData.balance}
                          onChange={handleChange}
                          className="w-full h-11 bg-white border border-slate-200 rounded-lg pl-8 pr-4 text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          placeholder={getPlaceholder.price()}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Wallet Balance</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-bold text-sm">$</span>
                        <input
                          type="number"
                          name="walletBalance"
                          value={formData.walletBalance}
                          onChange={handleChange}
                          className="w-full h-11 bg-emerald-50/30 border border-emerald-100 rounded-lg pl-8 pr-4 text-sm font-medium text-emerald-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          placeholder={getPlaceholder.price()}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Terms</label>
                      <select
                        name="paymentTerms"
                        value={formData.paymentTerms}
                        onChange={handleChange}
                        className="w-full h-11 bg-white border border-slate-200 rounded-lg px-4 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                      >
                        <option value="Net 7">Net 7 Days</option>
                        <option value="Net 30">Net 30 Days</option>
                        <option value="Net 365">Net 365 Days</option>
                        <option value="Due on Receipt">Due on Receipt</option>
                        <option value="Net 15">Net 15 Days</option>
                        <option value="Net 60">Net 60 Days</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Credit Limit</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                        <input
                          type="number"
                          name="creditLimit"
                          value={formData.creditLimit}
                          onChange={handleChange}
                          className="w-full h-11 bg-white border border-slate-200 rounded-lg pl-8 pr-4 text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${formData.creditHold ? 'bg-rose-100 text-rose-600' : 'bg-slate-200 text-slate-500'}`}>
                        <AlertTriangle size={18} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-700">Credit Hold</div>
                        <div className="text-[10px] text-slate-500 font-medium tracking-tight">Temporarily suspend all credit transactions for this client</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" name="creditHold" checked={formData.creditHold} onChange={handleChange} className="sr-only peer" />
                        <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
                      </label>

                      <div className="text-right">
                        <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Outstanding</div>
                        <div className="text-sm font-bold">{currency}{outstandingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          const dataToSave = { ...formData, creditHold: !formData.creditHold };
                          try {
                            await onSave(dataToSave as Customer);
                            onClose();
                          } catch (err: any) {
                            alert('Failed to apply hold: ' + (err?.message || err));
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${formData.creditHold ? 'bg-rose-500 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                      >
                        {formData.creditHold ? 'Release Hold' : 'Place Hold'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Additional Info Section */}
              {activeTab === 'Additional' && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Lead Source</label>
                      <select
                        name="leadSource"
                        value={formData.leadSource || ''}
                        onChange={handleChange}
                        className="w-full h-11 bg-white border border-slate-200 rounded-lg px-4 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                      >
                        <option value="">Not Set</option>
                        <option value="Website">Website</option>
                        <option value="Walk-in">Walk-in</option>
                        <option value="Social Media">Social Media</option>
                        <option value="Field Sales">Field Sales</option>
                        <option value="Email Campaign">Email Campaign</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Referred By</label>
                      <div className="flex gap-2">
                        <input
                          value={formData.referredByName || formData.referredById || ''}
                          onChange={() => {}}
                          placeholder="Search referrer customer..."
                          onClick={() => setReferrerSearchOpen(true)}
                          readOnly
                          className="flex-1 w-full h-11 bg-white border border-slate-200 rounded-lg px-4 text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => setReferrerSearchOpen(true)}
                          className="px-3 h-11 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all"
                        >
                          <Search size={16} />
                        </button>
                        {formData.referredById && (
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, referredById: '', referredByName: '' }))}
                            className="px-3 h-11 bg-white border border-slate-200 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-all"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Pipeline Stage</label>
                      <select
                        name="pipelineStage"
                        value={formData.pipelineStage || 'New'}
                        onChange={handleChange}
                        className="w-full h-11 bg-white border border-slate-200 rounded-lg px-4 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                      >
                        <option value="New">New</option>
                        <option value="Qualified">Qualified</option>
                        <option value="Proposal">Proposal</option>
                        <option value="Negotiation">Negotiation</option>
                        <option value="Won">Won</option>
                        <option value="Lost">Lost</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Lead Score</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        name="leadScore"
                        value={formData.leadScore ?? 0}
                        onChange={handleChange}
                        className="w-full h-11 bg-white border border-slate-200 rounded-lg px-4 text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        placeholder="e.g. 85"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Next Follow-Up</label>
                      <input
                        type="date"
                        name="nextFollowUpDate"
                        value={formData.nextFollowUpDate || ''}
                        onChange={handleChange}
                        className="w-full h-11 bg-white border border-slate-200 rounded-lg px-4 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Estimated Deal Value</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                        <input
                          type="number"
                          min={0}
                          name="estimatedDealValue"
                          value={formData.estimatedDealValue ?? 0}
                          onChange={handleChange}
                          className="w-full h-11 bg-white border border-slate-200 rounded-lg pl-8 pr-4 text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Tags</label>
                    <input
                      type="text"
                      name="tags"
                      value={(formData.tags || []).join(', ')}
                      onChange={(e) => setFormData(p => ({ ...p, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))}
                      className="w-full h-11 bg-white border border-slate-200 rounded-lg px-4 text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="e.g. VIP, Retail"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Internal Notes</label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleChange}
                      rows={4}
                      className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                      placeholder="e.g. Prefers morning deliveries"
                    />
                  </div>
                </div>
              )}

              {/* Branches Section */}
              {activeTab === 'Branches' && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-700">Branch Accounts</h3>
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5 tracking-tight">Manage multiple locations or sub-entities</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddSubAccount}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-xs font-bold border border-blue-100"
                    >
                      <Plus size={16} />
                      Add Branch
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {(formData.subAccounts || []).length === 0 ? (
                      <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                        <Building size={32} className="mx-auto text-slate-300 mb-3" />
                        <p className="text-sm font-bold text-slate-400">No branch accounts added yet</p>
                      </div>
                    ) : (
                      (formData.subAccounts || []).map((sub) => (
                        <div key={sub.id} className="p-4 bg-white border border-slate-200 rounded-xl group hover:border-blue-200 transition-all relative shadow-sm">
                          <button
                            type="button"
                            onClick={() => handleRemoveSubAccount(sub.id)}
                            className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={16} />
                          </button>
                          <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-12 md:col-span-6">
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Branch Name</label>
                              <input
                                type="text"
                                value={sub.name}
                                onChange={(e) => handleSubAccountChange(sub.id, 'name', e.target.value)}
                                className="w-full h-10 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                                placeholder="e.g. Blantyre Branch"
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-3 bg-white border-t border-slate-200 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="client-form"
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm h-11"
          >
            {customer ? 'Update Customer' : 'Save Customer'}
          </button>
        </div>
      </div>

      <CustomerSearch
        open={referrerSearchOpen}
        mode="referrer"
        onSelect={(customer) => {
          setFormData(prev => ({
            ...prev,
            referredById: customer?.id || '',
            referredByName: customer?.name || ''
          }))
          setReferrerSearchOpen(false)
        }}
        onClose={() => setReferrerSearchOpen(false)}
      />
    </Dialog>
  );
};

export default ClientModal;