import React, { useState, useEffect } from 'react';
import { X, DollarSign, Wallet, CreditCard, Smartphone, Banknote, Package, User, Hash, Calendar } from 'lucide-react';
import { Order } from '../../../types';
import { DEFAULT_ACCOUNTS, ACCOUNT_IDS } from '../../../constants';
import { currencyService } from '../../../services/currencyService';
import { useAuth } from '../../../context/AuthContext';

interface OrderPaymentModalProps {
    order: Order;
    onClose: () => void;
    onRecord: (orderId: string, payment: {
        amountPaid: number;
        paymentMethod: string;
        reference: string;
    }) => Promise<void>;
}

const FINANCE_FONT = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";
const COLORS = {
    ink: '#0F172A',
    inkSecondary: '#475569',
    inkMuted: '#64748B',
    line: '#E2E8F0',
    lineSoft: '#F1F5F9',
    paper: '#FFFFFF',
    surface: '#F8FAFC',
    accent: '#4F46E5',
    accentSoft: '#EEF2FF',
    accentRing: '#C7D2FE',
    danger: '#DC2626',
    dangerSoft: '#FEF2F2',
    success: '#059669',
    successSoft: '#ECFDF5',
};

export const OrderPaymentModal: React.FC<OrderPaymentModalProps> = ({ order, onClose, onRecord }) => {
    const { companyConfig, notify } = useAuth();
    const remainingBalance = Math.max(0, (order.totalAmount || 0) - (order.paidAmount || 0));
    const currency = companyConfig?.currencySymbol || currencyService.getCurrency(currencyService.getBaseCurrency())?.symbol || '$';
    const fmt = (n: number) => currency + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const [amount, setAmount] = useState(remainingBalance > 0 ? remainingBalance.toFixed(2) : '');
    const [selectedAccountId, setSelectedAccountId] = useState(ACCOUNT_IDS.CASH_DRAWER);
    const [reference, setReference] = useState(`Payment for Order #${order.orderNumber || order.id}`);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (remainingBalance > 0) setAmount(remainingBalance.toFixed(2));
    }, [remainingBalance]);

    const paymentAmount = parseFloat(amount);
    const isAmountValid = !isNaN(paymentAmount) && paymentAmount > 0;
    const exceedsBalance = isAmountValid && paymentAmount > remainingBalance + 0.01;
    const canSubmit = isAmountValid && !exceedsBalance && !isSubmitting;
    const isFullyPaid = remainingBalance <= 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAmountValid) {
            notify('Please enter a valid positive amount.', 'error');
            return;
        }
        if (exceedsBalance) {
            notify(`Amount exceeds remaining balance of ${fmt(remainingBalance)}`, 'error');
            return;
        }

        const selectedAccount = DEFAULT_ACCOUNTS.find(a => a.id === selectedAccountId);
        const paymentMethod = selectedAccount?.name.includes('Cash') ? 'Cash' :
            selectedAccount?.name.includes('Mobile') ? 'Mobile Money' : 'Bank Transfer';

        setIsSubmitting(true);
        try {
            await onRecord(order.id, {
                amountPaid: paymentAmount,
                paymentMethod,
                reference
            });
            onClose();
        } catch (error: any) {
            notify(`Payment failed: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getIcon = (accountId: string) => {
        if (accountId === ACCOUNT_IDS.CASH_DRAWER) return <Banknote size={18} />;
        if (accountId === ACCOUNT_IDS.BANK) return <CreditCard size={18} />;
        if (accountId === ACCOUNT_IDS.MOBILE_MONEY) return <Smartphone size={18} />;
        return <Wallet size={18} />;
    };

    const paymentAccounts = DEFAULT_ACCOUNTS.filter(a => [ACCOUNT_IDS.CASH_DRAWER, ACCOUNT_IDS.BANK, ACCOUNT_IDS.MOBILE_MONEY].includes(a.id));

    const labelClass = "block text-[11px] font-bold uppercase tracking-wider mb-[6px]";
    const inputRest = `w-full rounded-xl border bg-white text-[#0F172A] border-[#E2E8F0] placeholder:text-[#94A3B8] focus:border-[#4F46E5] focus:ring-4 focus:ring-[#EEF2FF] outline-none transition-all text-[13.5px] font-medium`;

    const InfoRow = ({ icon: Icon, label, value, accent = false }: any) => (
        <div className="flex items-center justify-between py-[7px]">
            <div className="flex items-center gap-2 text-[#64748B]">
                <Icon size={13} />
                <span className="text-[12px] font-medium">{label}</span>
            </div>
            <span className={`text-[13px] font-semibold tabular-nums ${accent ? 'text-[#4F46E5]' : 'text-[#0F172A]'}`} style={{ fontFamily: FINANCE_FONT }}>
                {value}
            </span>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[80] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-[0_25px_60px_rgba(15,23,42,0.18)] w-full max-w-[860px] overflow-hidden border border-[#F1F5F9] flex">
                {/* Left Panel - Order Summary */}
                <div className="w-[260px] bg-[#FAFBFF] border-r border-[#F1F5F9] p-5 flex flex-col shrink-0">
                    <div className="flex items-center gap-2.5 mb-5">
                        <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center">
                            <Package size={18} />
                        </div>
                        <div>
                            <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Order</div>
                            <div className="text-[15px] font-bold text-[#0F172A] leading-tight">#{order.orderNumber || order.id}</div>
                        </div>
                    </div>

                    <div className="space-y-0 flex-1">
                        <InfoRow icon={User} label="Customer" value={order.customerName || 'N/A'} />
                        <InfoRow icon={Calendar} label="Order Date" value={new Date(order.orderDate || order.date).toLocaleDateString()} />
                        <InfoRow icon={Hash} label="Status" value={order.status} accent={order.status === 'Completed' || order.status === 'Paid'} />
                    </div>

                    <div className="mt-5 pt-4 border-t border-[#E2E8F0] space-y-0">
                        <InfoRow icon={DollarSign} label="Total Amount" value={fmt(order.totalAmount || 0)} />
                        <InfoRow icon={DollarSign} label="Paid Amount" value={fmt(order.paidAmount || 0)} accent={order.paidAmount > 0} />
                        <div className="flex items-center justify-between py-[7px]">
                            <div className="flex items-center gap-2 text-[#64748B]">
                                <DollarSign size={13} />
                                <span className="text-[12px] font-bold uppercase tracking-wider">Balance Due</span>
                            </div>
                            <span className="text-[15px] font-bold tabular-nums text-[#DC2626]" style={{ fontFamily: FINANCE_FONT }}>
                                {fmt(remainingBalance)}
                            </span>
                        </div>
                    </div>

                    {isFullyPaid && (
                        <div className="mt-4 p-3 rounded-xl bg-[#ECFDF5] border border-[#059669]/20">
                            <p className="text-[11px] font-bold text-[#059669] uppercase tracking-wider text-center">Fully Paid</p>
                        </div>
                    )}
                </div>

                {/* Right Panel - Payment Form */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="px-6 py-4 border-b border-[#F1F5F9] flex justify-between items-center bg-white">
                        <div>
                            <h2 className="text-[20px] font-semibold text-[#0F172A] tracking-tight leading-snug">Record Payment</h2>
                            <p className="text-[12px] text-[#64748B] mt-0.5 font-medium">
                                Receive payment against this order
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] transition-colors" aria-label="Close">
                            <X size={18} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-5 flex-1 overflow-y-auto">
                        {isFullyPaid ? (
                            <div className="flex items-center justify-center h-full min-h-[200px]">
                                <div className="text-center">
                                    <div className="w-12 h-12 rounded-full bg-[#ECFDF5] text-[#059669] flex items-center justify-center mx-auto mb-3">
                                        <DollarSign size={24} />
                                    </div>
                                    <p className="text-[14px] font-semibold text-[#0F172A]">Order is fully settled</p>
                                    <p className="text-[12px] text-[#64748B] mt-1">No further payment is required.</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className={labelClass} style={{ color: '#475569' }}>Payment Amount</label>
                                    <div className="relative">
                                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none">
                                            <DollarSign size={16} />
                                        </div>
                                        <input
                                            autoFocus
                                            type="number"
                                            step="0.01"
                                            className={`${inputRest} pl-10 pr-4 py-[10px]`}
                                            style={{ fontFamily: FINANCE_FONT, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    {exceedsBalance && (
                                        <p className="text-[11px] font-medium text-[#DC2626] mt-1.5 flex items-center gap-1">
                                            <span className="w-1 h-1 rounded-full bg-[#DC2626]" />
                                            Cannot exceed remaining balance
                                        </p>
                                    )}
                                    <div className="flex gap-2 mt-2.5">
                                        <button type="button" onClick={() => setAmount(remainingBalance.toFixed(2))} className="flex-1 py-[7px] text-[11px] font-semibold uppercase tracking-wide border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors text-[#475569]">Exact</button>
                                        <button type="button" onClick={() => setAmount((paymentAmount + 5000).toFixed(2))} className="flex-1 py-[7px] text-[11px] font-semibold uppercase tracking-wide border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors text-[#475569]">+{currency}5k</button>
                                        <button type="button" onClick={() => setAmount((paymentAmount + 10000).toFixed(2))} className="flex-1 py-[7px] text-[11px] font-semibold uppercase tracking-wide border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors text-[#475569]">+{currency}10k</button>
                                    </div>
                                </div>

                                <div>
                                    <label className={labelClass} style={{ color: '#475569' }}>Payment Method</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {paymentAccounts.map(account => {
                                            const active = selectedAccountId === account.id;
                                            return (
                                                <button
                                                    key={account.id}
                                                    type="button"
                                                    onClick={() => setSelectedAccountId(account.id)}
                                                    className={`flex items-center gap-3.5 p-3.5 rounded-xl border-2 transition-all ${active ? 'border-[#4F46E5] bg-[#EEF2FF] shadow-[0_0_0_3px_rgba(79,70,229,0.08)]' : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'}`}
                                                >
                                                    <div className={`p-2 rounded-lg ${active ? 'bg-[#4F46E5]/10 text-[#4F46E5]' : 'bg-[#F1F5F9] text-[#64748B]'}`}>
                                                        {getIcon(account.id)}
                                                    </div>
                                                    <div className="text-left flex-1 min-w-0">
                                                        <div className={`text-[13px] font-semibold leading-tight ${active ? 'text-[#4F46E5]' : 'text-[#0F172A]'}`}>{account.name}</div>
                                                        <div className="text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider mt-0.5">{account.code}</div>
                                                    </div>
                                                    {active && (
                                                        <div className="w-[18px] h-[18px] rounded-full bg-[#4F46E5] flex items-center justify-center shrink-0">
                                                            <div className="w-[7px] h-[7px] bg-white rounded-full" />
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <label className={labelClass} style={{ color: '#475569' }}>Reference</label>
                                    <input
                                        type="text"
                                        className={inputRest}
                                        value={reference}
                                        onChange={(e) => setReference(e.target.value)}
                                        placeholder="e.g., Payment reference"
                                    />
                                </div>

                                <div className="flex gap-3 pt-1">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="flex-1 px-5 py-[8px] rounded-xl font-semibold text-[13px] text-[#475569] bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!canSubmit}
                                        className="flex-[2] px-5 py-[8px] rounded-xl font-semibold text-[13px] text-white bg-[#4F46E5] hover:bg-[#4338CA] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] transition-all active:scale-[0.98] disabled:active:scale-100"
                                    >
                                        {isSubmitting ? 'Recording…' : 'Record Payment'}
                                    </button>
                                </div>
                            </>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
};
