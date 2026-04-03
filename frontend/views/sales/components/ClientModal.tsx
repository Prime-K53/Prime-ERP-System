import React, { useState, useEffect } from 'react';
import { 
  X, Save, User, MapPin, CreditCard, FileText, Building, 
  Plus, Trash2, AlertTriangle, CheckCircle2, Phone, Mail, 
  Globe, Tag, Info, UserCheck, Briefcase, DollarSign,
  ChevronRight, ArrowRight, ShieldCheck, PieChart, Landmark, Target
} from 'lucide-react';
import { Customer } from '../../../types';
import { getDefaultPaymentTermsForSegment } from '../../../utils/helpers';
import { useData } from '../../../context/DataContext';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customer: Customer) => Promise<void>;
  customer?: Customer;
}

export const ClientModal: React.FC<ClientModalProps> = ({ isOpen, onClose, onSave, customer }) => {
  const { companyConfig } = useData();
  const currency = companyConfig?.currencySymbol || '$';

  const [formData, setFormData] = useState<any>({
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    billingAddress: '',
    shippingAddress: '',
    balance: 0,
    walletBalance: 0,
    creditLimit: 0,
    notes: '',
    subAccounts: [],
    segment: 'Individual',
    paymentTerms: getDefaultPaymentTermsForSegment('Individual'),
    assignedSalesperson: '',
    creditHold: false,
    tags: [],
    avgPaymentDays: 0,
    leadSource: '',
    pipelineStage: 'New',
    leadScore: 0,
    nextFollowUpDate: '',
    estimatedDealValue: 0,
    status: 'Active'
  });

  const [useBillingForShipping, setUseBillingForShipping] = useState(true);
  const [activeTab, setActiveTab] = useState<'basic' | 'address' | 'finance' | 'crm' | 'branches'>('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (customer && isOpen) {
      setFormData({
        ...customer,
        name: customer.name || '',
        phone: customer.phone || '',
        email: (customer as any).email || '',
        address: customer.address || '',
        city: customer.city || '',
        billingAddress: customer.billingAddress || '',
        shippingAddress: customer.shippingAddress || '',
        balance: customer.balance ?? 0,
        walletBalance: customer.walletBalance ?? 0,
        creditLimit: customer.creditLimit ?? 0,
        notes: customer.notes || '',
        subAccounts: customer.subAccounts || [],
        segment: (customer.segment as any) || 'Individual',
        paymentTerms: customer.paymentTerms || getDefaultPaymentTermsForSegment(customer.segment || 'Individual'),
        assignedSalesperson: customer.assignedSalesperson || '',
        creditHold: Boolean(customer.creditHold),
        tags: customer.tags || [],
        avgPaymentDays: customer.avgPaymentDays ?? 0,
        leadSource: (customer as any).leadSource || '',
        pipelineStage: (customer as any).pipelineStage || 'New',
        leadScore: (customer as any).leadScore ?? 0,
        nextFollowUpDate: (customer as any).nextFollowUpDate || '',
        estimatedDealValue: (customer as any).estimatedDealValue ?? 0,
        status: customer.status || 'Active'
      });
      setUseBillingForShipping(customer.billingAddress === customer.shippingAddress);
    } else if (isOpen) {
      setFormData({
        name: '', phone: '', email: '', address: '', city: '', billingAddress: '', shippingAddress: '',
        balance: 0, walletBalance: 0, creditLimit: 0, notes: '', status: 'Active',
        paymentTerms: getDefaultPaymentTermsForSegment('Individual'), subAccounts: [], segment: 'Individual', assignedSalesperson: '',
        creditHold: false, tags: [], avgPaymentDays: 0, leadSource: '', pipelineStage: 'New', leadScore: 0, nextFollowUpDate: '', estimatedDealValue: 0
      });
      setUseBillingForShipping(true);
    }
  }, [customer, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const dataToSave = { ...formData };
      if (useBillingForShipping) dataToSave.shippingAddress = dataToSave.billingAddress;
      
      if (!dataToSave.paymentTerms) {
        dataToSave.paymentTerms = getDefaultPaymentTermsForSegment(dataToSave.segment || 'Individual');
      }
      
      await onSave(dataToSave as Customer);
      onClose();
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData((prev: any) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData((prev: any) => ({ 
        ...prev, 
        [name]: type === 'number' ? parseFloat(value) : value 
      }));
    }
  };

  const TabButton = ({ id, label, icon: Icon, desc }: { id: typeof activeTab, label: string, icon: any, desc: string }) => (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      className={`flex flex-col items-start p-3 rounded-xl transition-all duration-300 border-2 text-left group ${
        activeTab === id 
          ? 'border-indigo-600 bg-white shadow-lg shadow-indigo-100/50' 
          : 'border-transparent text-slate-500 hover:bg-white hover:border-slate-100 hover:shadow-md'
      }`}
    >
      <div className={`p-2 rounded-lg mb-2 transition-all duration-300 ${activeTab === id ? 'bg-indigo-600 text-white scale-105' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'}`}>
        <Icon size={18} strokeWidth={2.5} />
      </div>
      <span className={`text-[13.5px] font-semibold tracking-tight mb-0.5 ${activeTab === id ? 'text-indigo-900' : 'text-slate-600'}`}>{label}</span>
      <span className="text-[11px] font-medium text-slate-400 line-clamp-1">{desc}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-slate-50 rounded-[2.5rem] shadow-2xl w-full max-w-6xl h-[90vh] flex overflow-hidden ring-1 ring-white/20 animate-in zoom-in-95 duration-300">
        
        {/* Sidebar Navigation */}
        <div className="w-64 bg-slate-50 border-r border-slate-200 p-5 flex flex-col gap-1.5 shrink-0 overflow-y-auto custom-scrollbar">
          <div className="mb-6 px-1">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 mb-3 ring-2 ring-white">
              <User size={24} strokeWidth={2.5} />
            </div>
            <h2 className="text-[20px] font-semibold text-slate-800 tracking-tight leading-snug">
              {customer ? 'Account Settings' : 'Onboard Client'}
            </h2>
            <p className="text-[12px] text-slate-500 font-medium tracking-wide mt-0.5 opacity-70">Customer Profile V2</p>
          </div>

          <TabButton id="basic" label="Basic Profile" icon={Info} desc="Core entity information" />
          <TabButton id="address" label="Logistics" icon={MapPin} desc="Physical & shipping sites" />
          <TabButton id="finance" label="Financial Config" icon={Landmark} desc="Credit limits & GL mapping" />
          <TabButton id="crm" label="Relationships" icon={Briefcase} desc="Lead status & Pipeline" />
          <TabButton id="branches" label="Subsidiaries" icon={Building} desc="Linked sub-accounts" />

          <div className="mt-auto pt-6">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Security Active</span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium leading-relaxed">Changes are logged to the global security trail for compliance.</p>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          {/* Top Bar */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
             <div>
                <h3 className="text-[15px] font-semibold text-slate-700 flex items-center gap-2">
                    {activeTab === 'basic' && 'Core Identity Details'}
                    {activeTab === 'address' && 'Geospatial & Delivery Info'}
                    {activeTab === 'finance' && 'Fiscal Policy Settings'}
                    {activeTab === 'crm' && 'Lifecycle Management'}
                    {activeTab === 'branches' && 'Organization Hierarchy'}
                    <ChevronRight size={14} className="text-slate-300" />
                    <span className="text-slate-400 font-medium text-[13.5px]">{customer?.name || 'New Entity'}</span>
                </h3>
             </div>
             <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                <X size={18} strokeWidth={2.5} />
             </button>
          </div>

          <form id="client-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/30">
            
            {activeTab === 'basic' && (
              <div className="max-w-3xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-[13.5px] font-medium text-slate-600 mb-2">Legal Name / Business Entity</label>
                    <div className="relative group">
                       <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-indigo-500" size={16} />
                       <input required type="text" name="name" value={formData.name} onChange={handleChange}
                        className="w-full bg-white border border-slate-200 rounded-lg pl-11 pr-4 py-2.5 text-[13.5px] font-normal text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all shadow-sm"
                        placeholder="e.g. Acme Corporation Ltd" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[13.5px] font-medium text-slate-600 mb-2">Contact Number</label>
                    <div className="relative group">
                       <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-indigo-500" size={16} />
                       <input type="tel" name="phone" value={formData.phone} onChange={handleChange}
                        className="w-full bg-white border border-slate-200 rounded-lg pl-11 pr-4 py-2.5 text-[13.5px] font-normal text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all shadow-sm"
                        placeholder="+263 7..." />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[13.5px] font-medium text-slate-600 mb-2">Primary Email</label>
                    <div className="relative group">
                       <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-indigo-500" size={16} />
                       <input type="email" name="email" value={formData.email} onChange={handleChange}
                        className="w-full bg-white border border-slate-200 rounded-lg pl-11 pr-4 py-2.5 text-[13.5px] font-normal text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all shadow-sm"
                        placeholder="billing@example.com" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[13.5px] font-medium text-slate-600 mb-2">Market Segment</label>
                    <select name="segment" value={formData.segment} onChange={handleChange}
                      className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-[13.5px] font-normal text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all shadow-sm cursor-pointer appearance-none">
                      <option value="Individual">Direct Consumer</option>
                      <option value="School Account">Educational Institution</option>
                      <option value="Institution">Corporate / NGO</option>
                      <option value="Government">Government / Public Sector</option>
                    </select>
                  </div>

                  <div>
                     <label className="block text-[13.5px] font-medium text-slate-600 mb-2">Entity Status</label>
                     <div className="flex gap-2">
                        {['Active', 'Inactive', 'VIP', 'Lead'].map(status => (
                            <button
                                key={status}
                                type="button"
                                onClick={() => setFormData((p: any) => ({ ...p, status }))}
                                className={`flex-1 py-2.5 px-2 rounded-lg text-[12px] font-semibold transition-all border ${
                                    formData.status === status 
                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-600'
                                }`}
                            >
                                {status}
                            </button>
                        ))}
                     </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[13.5px] font-medium text-slate-600 mb-2">Internal Relationship Memo</label>
                    <div className="relative group">
                       <FileText className="absolute left-4 top-3.5 text-slate-300 transition-colors group-focus-within:text-indigo-500" size={16} />
                       <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-11 pr-4 py-3 text-[13.5px] font-normal text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all shadow-sm resize-none"
                        placeholder="Historical context, billing quirks, or contact preferences..." />
                    </div>
                  </div>
                </div>

                <div className="p-8 bg-gradient-to-br from-amber-50 to-orange-50 rounded-[2rem] border border-amber-100 flex items-start gap-6 shadow-sm">
                  <div className="p-4 bg-white text-amber-600 rounded-2xl shadow-xl shadow-amber-200/50">
                    <ShieldCheck size={28} />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-amber-900 leading-tight">Entity Compliance Verification</h4>
                    <p className="text-xs text-amber-700 mt-2 font-medium leading-relaxed">
                      Cross-reference the <strong>Legal Name</strong> with the tax registration portal to ensure ZIMRA compliance for invoices above $50.00. Incorrect naming may lead to VAT reclamation rejection.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'address' && (
              <div className="max-w-3xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 gap-10">
                  <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/20">
                    <div className="flex items-center justify-between mb-6 px-1">
                       <div>
                           <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">Corporate HQ / Billing Suite</label>
                           <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter opacity-70 italic">Default for digital distribution</span>
                       </div>
                       <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
                          <Globe size={20} />
                       </div>
                    </div>
                    <textarea name="billingAddress" value={formData.billingAddress} onChange={handleChange} rows={3}
                      className="w-full bg-slate-50/50 border border-slate-100 rounded-[1.5rem] p-6 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all shadow-inner"
                      placeholder="e.g. 1st Floor, Trust Towers, 56 Samora Machel Ave, Harare" />
                  </div>

                  <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/20 relative overflow-hidden">
                    {!useBillingForShipping && <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -translate-y-12 translate-x-12" />}
                    <div className="flex items-center justify-between mb-6 px-1">
                       <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Fulfillment / Shipping Destination</label>
                       <div className="flex items-center gap-3 bg-slate-100 p-1 rounded-xl">
                           <button type="button" onClick={() => setUseBillingForShipping(true)} 
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${useBillingForShipping ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Same as HQ</button>
                           <button type="button" onClick={() => setUseBillingForShipping(false)}
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${!useBillingForShipping ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Separate</button>
                       </div>
                    </div>
                    
                    {useBillingForShipping ? (
                        <div className="h-24 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-[1.5rem] bg-indigo-50/30">
                            <p className="text-[11px] text-indigo-400 font-bold uppercase tracking-widest flex items-center gap-2">
                                <CheckCircle2 size={16} /> Mirroring Billing Address
                            </p>
                        </div>
                    ) : (
                        <textarea name="shippingAddress" value={formData.shippingAddress} onChange={handleChange} rows={3}
                        className="w-full bg-white border border-slate-200 rounded-[1.5rem] p-6 text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all shadow-sm"
                        placeholder="Warehouse, Loading Dock, or Satellite Office..." />
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'finance' && (
              <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-2 gap-8">
                  <div className="p-8 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/20">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-200">
                            <PieChart size={24} />
                        </div>
                        <div>
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Asset Exposure</label>
                            <h4 className="text-base font-bold text-slate-800">Balance Integrity</h4>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 mb-2.5 uppercase tracking-widest ml-1">Historical Arrears</p>
                        <div className="relative group">
                          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-rose-500 font-black text-lg">{currency}</span>
                          <input type="number" name="balance" value={formData.balance} onChange={handleChange}
                            className="w-full bg-rose-50/20 border border-rose-100 rounded-[1.5rem] pl-16 pr-6 py-5 text-2xl font-black text-rose-700 outline-none focus:ring-8 focus:ring-rose-500/5 focus:border-rose-300 transition-all shadow-inner"
                            placeholder="0.00" />
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 mb-2.5 uppercase tracking-widest ml-1">Prepayment / Wallet</p>
                        <div className="relative group">
                          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-500 font-black text-lg">{currency}</span>
                          <input type="number" name="walletBalance" value={formData.walletBalance} onChange={handleChange}
                            className="w-full bg-emerald-50/20 border border-emerald-100 rounded-[1.5rem] pl-16 pr-6 py-5 text-2xl font-black text-emerald-700 outline-none focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-300 transition-all shadow-inner"
                            placeholder="0.00" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/20">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100">
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Risk Controls</label>
                            <h4 className="text-base font-bold text-slate-800">Credit Velocity</h4>
                        </div>
                    </div>
                    <div className="space-y-6">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 mb-2.5 uppercase tracking-widest ml-1">Authorized Credit Limit</p>
                        <div className="relative group">
                           <span className="absolute left-6 top-1/2 -translate-y-1/2 text-indigo-500 font-black text-lg">{currency}</span>
                           <input type="number" name="creditLimit" value={formData.creditLimit} onChange={handleChange}
                            className="w-full bg-slate-50 border border-slate-100 rounded-[1.5rem] pl-16 pr-6 py-5 text-2xl font-black text-slate-800 outline-none focus:bg-white focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all shadow-inner"
                            placeholder="0.00" />
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 mb-2.5 uppercase tracking-widest ml-1">Lifecycle Aging Policy</p>
                        <div className="relative group">
                            <select name="paymentTerms" value={formData.paymentTerms} onChange={handleChange}
                            className="w-full bg-slate-50 border border-slate-100 rounded-[1.5rem] px-8 py-5 text-sm font-black text-slate-700 outline-none focus:bg-white focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all shadow-inner appearance-none cursor-pointer">
                            <option value="Net 7">Net 7 Billing Cycle</option>
                            <option value="Net 15">Net 15 Billing Cycle</option>
                            <option value="Net 30">Net 30 Standard</option>
                            <option value="Net 60">Net 60 Institutional</option>
                            <option value="Net 365">Annual (Academic)</option>
                            <option value="Due on Receipt">Upfront Only (Cash)</option>
                            </select>
                            <ChevronRight size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 rotate-90" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`col-span-2 p-10 rounded-[3rem] border-2 transition-all duration-500 flex items-center justify-between shadow-2xl ${
                    formData.creditHold 
                        ? 'bg-rose-500 border-rose-600 text-white shadow-rose-200' 
                        : 'bg-slate-900 border-slate-950 text-white shadow-slate-200'
                  }`}>
                    <div className="flex items-center gap-8">
                      <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center transition-all duration-500 ${
                        formData.creditHold ? 'bg-white text-rose-600 rotate-12 scale-110' : 'bg-white/10 text-white/40'
                      }`}>
                        <AlertTriangle size={40} strokeWidth={2.5} />
                      </div>
                      <div>
                        <div className="text-2xl font-black tracking-tight leading-none mb-2">Entity Suspension Mode</div>
                        <div className="text-[13px] text-white/60 font-bold max-w-sm leading-relaxed">
                          Applying a credit hold will instantly block all non-prepaid sale approvals. Automated recurring invoices will pause until hold is released.
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-4">
                       <button 
                        type="button" 
                        onClick={() => setFormData((p: any) => ({ ...p, creditHold: !p.creditHold }))}
                        className={`px-12 py-5 rounded-[1.5rem] font-black uppercase tracking-widest text-xs transition-all duration-300 ${
                          formData.creditHold 
                            ? 'bg-white text-rose-600 hover:scale-105 active:scale-95 shadow-xl shadow-rose-900/20' 
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 hover:scale-105 active:scale-95'
                        }`}
                       >
                        {formData.creditHold ? 'Restore Account' : 'Suspend Account'}
                       </button>
                       {formData.creditHold && (
                        <div className="flex items-center gap-2 px-4 py-1.5 bg-rose-900/30 rounded-full">
                            <span className="text-[10px] text-white font-black uppercase tracking-widest animate-pulse">Account Locked</span>
                        </div>
                       )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'crm' && (
              <div className="max-w-4xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-2 gap-10">
                  <div className="p-10 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/20">
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-8">Pipeline Growth Engine</label>
                    <div className="space-y-10">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Inbound Acquisition Channel</label>
                        <div className="grid grid-cols-2 gap-3">
                            {['Referral', 'Website', 'Field Sales', 'Social Media', 'Event', 'Legacy'].map(source => (
                                <button
                                    key={source}
                                    type="button"
                                    onClick={() => setFormData((p: any) => ({ ...p, leadSource: source }))}
                                    className={`py-3.5 px-3 rounded-2xl text-[11px] font-bold border-2 transition-all ${
                                        formData.leadSource === source 
                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                                            : 'bg-white border-slate-50 text-slate-400 hover:border-slate-100'
                                    }`}
                                >
                                    {source}
                                </button>
                            ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Growth Velocity Stage</label>
                        <div className="flex flex-wrap gap-3">
                          {['New', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'].map(stage => (
                            <button
                              key={stage}
                              type="button"
                              onClick={() => setFormData((p: any) => ({ ...p, pipelineStage: stage }))}
                              className={`py-3 px-6 text-[10px] font-black rounded-2xl transition-all border-2 uppercase tracking-wide ${
                                formData.pipelineStage === stage 
                                  ? 'bg-slate-900 text-white border-slate-900 shadow-xl shadow-slate-200 scale-110' 
                                  : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'
                              }`}
                            >
                              {stage}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-10 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/20 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 text-indigo-50 opacity-20">
                        <Target size={120} strokeWidth={1} />
                    </div>
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-8">Relationship Analytics</label>
                    <div className="space-y-8 relative z-10">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-3 ml-1">Intent Score</label>
                          <div className="flex items-center gap-4">
                              <input type="range" min={0} max={100} name="leadScore" value={formData.leadScore ?? 0} onChange={handleChange}
                                className="flex-1 accent-indigo-600 h-2 bg-slate-100 rounded-full appearance-none cursor-pointer" />
                              <span className="text-xl font-black text-indigo-600 tabular-nums">{(formData.leadScore ?? 0)}%</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-3 ml-1">Next Touchpoint</label>
                          <input type="date" name="nextFollowUpDate" value={formData.nextFollowUpDate || ''} onChange={handleChange}
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-3.5 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-indigo-100" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Est. Gross Annual Value</label>
                        <div className="relative group">
                          <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-xl text-indigo-400">{currency}</span>
                          <input type="number" name="estimatedDealValue" value={formData.estimatedDealValue ?? 0} onChange={handleChange}
                            className="w-full bg-indigo-50/30 border border-indigo-100 rounded-[1.5rem] pl-16 pr-6 py-5 text-2xl font-black text-indigo-700 outline-none focus:bg-white focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all shadow-inner" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2 p-10 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/20">
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">Customer Classification Tags</label>
                    <div className="flex flex-wrap gap-3">
                       {(formData.tags || []).map((tag: string, i: number) => (
                         <span key={i} className="pl-5 pr-3 py-3 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-4 animate-in zoom-in-75 shadow-lg shadow-indigo-200">
                            {tag}
                            <button type="button" onClick={() => setFormData((p: any) => ({ ...p, tags: p.tags.filter((_: any, idx: number) => idx !== i) }))} 
                                className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center hover:bg-rose-500 transition-colors">
                                <X size={14} strokeWidth={3} />
                            </button>
                         </span>
                       ))}
                       <div className="relative">
                           <input 
                            type="text" 
                            onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                const val = (e.target as HTMLInputElement).value.trim();
                                if (val && !formData.tags.includes(val)) {
                                setFormData((p: any) => ({ ...p, tags: [...p.tags, val] }));
                                (e.target as HTMLInputElement).value = '';
                                }
                            }
                            }}
                            className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl pl-6 pr-12 py-3 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all min-w-[240px]"
                            placeholder="Add classification & press Enter"
                           />
                           <Plus size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" />
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'branches' && (
              <div className="max-w-5xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl">
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tight">Organization Network</h3>
                    <p className="text-[13px] text-white/50 font-bold mt-1">Satellite branches share parent's credit pool & fiscal policy</p>
                  </div>
                  <button type="button" onClick={() => setFormData((prev: any) => ({ ...prev, subAccounts: [...(prev.subAccounts || []), { id: `SUB-${Date.now()}`, name: '', balance: 0, walletBalance: 0, status: 'Active' }] }))}
                    className="flex items-center gap-3 px-10 py-5 bg-white text-slate-950 rounded-[1.5rem] hover:bg-indigo-50 transition-all font-black text-xs shadow-xl uppercase tracking-widest active:scale-95">
                    <Plus size={20} strokeWidth={3} />
                    Link New Branch
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {(formData.subAccounts || []).length === 0 ? (
                    <div className="col-span-2 text-center py-24 bg-white rounded-[3rem] border-2 border-dashed border-slate-100 shadow-inner flex flex-col items-center justify-center">
                      <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-6 text-slate-200 border border-slate-100">
                         <Building size={48} strokeWidth={1} />
                      </div>
                      <p className="text-slate-400 font-bold text-lg">No Linked Sub-Entities</p>
                      <p className="text-[11px] text-slate-300 font-black uppercase tracking-widest mt-2 px-8 py-2 bg-slate-50 rounded-full">Hierarchical Billing Inactive</p>
                    </div>
                  ) : (
                    formData.subAccounts.map((sub: any, idx: number) => (
                      <div key={sub.id} className="p-8 bg-white border border-slate-100 rounded-[2.5rem] hover:shadow-2xl hover:shadow-indigo-500/10 hover:border-indigo-100 transition-all group relative animate-in zoom-in-95">
                        <div className="absolute top-0 right-0 w-2 h-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <button type="button" onClick={() => setFormData((p: any) => ({ ...p, subAccounts: p.subAccounts.filter((s: any) => s.id !== sub.id) }))}
                          className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center text-slate-300 hover:text-white hover:bg-rose-500 rounded-xl transition-all shadow-sm">
                          <Trash2 size={18} />
                        </button>
                        <div className="space-y-6">
                           <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-1">Branch Operating Name</label>
                              <input type="text" value={sub.name} onChange={(e) => {
                                const newSubs = [...formData.subAccounts];
                                newSubs[idx].name = e.target.value;
                                setFormData((p: any) => ({ ...p, subAccounts: newSubs }));
                              }}
                              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black text-slate-800 outline-none focus:bg-white focus:ring-8 focus:ring-indigo-100/30"
                              placeholder="e.g. Acme - Bulawayo Branch" />
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                              <div className="p-5 bg-emerald-50/50 rounded-[1.5rem] border border-emerald-100 shadow-inner">
                                 <p className="text-[9px] font-black text-emerald-600 uppercase mb-2 tracking-widest">In-Pocket</p>
                                 <p className="text-lg font-black text-emerald-700 tabular-nums leading-none">{currency}{sub.walletBalance?.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                              </div>
                              <div className="p-5 bg-rose-50/50 rounded-[1.5rem] border border-rose-100 shadow-inner">
                                 <p className="text-[9px] font-black text-rose-600 uppercase mb-2 tracking-widest">Exposure</p>
                                 <p className="text-lg font-black text-rose-700 tabular-nums leading-none">{currency}{sub.balance?.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                              </div>
                           </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

          </form>

          {/* Master Footer */}
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-white shrink-0 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.03)]">
            <div className="flex flex-col">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-[pulse_2s_infinite]" />
                    <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Cloud Sync Ready</span>
                </div>
                <p className="text-[9px] text-slate-400 font-medium mt-0.5">Last synced: Just now</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-slate-500 font-medium hover:text-slate-700 transition-all text-[13px] rounded-lg hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                form="client-form"
                type="submit"
                disabled={isSubmitting}
                className="group relative flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-all shadow-sm text-[13px] disabled:opacity-50 overflow-hidden active:scale-[0.98]"
              >
                {isSubmitting ? (
                   <div className="w-4 h-4 border-[2px] border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                   <Save size={16} strokeWidth={2} />
                )}
                <span>{customer ? 'Update' : 'Create'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
