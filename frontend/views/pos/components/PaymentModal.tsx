import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Banknote, CreditCard, Smartphone, Briefcase, X, Wallet, Award, Clock, CheckCircle2, AlertCircle, ArrowLeftRight } from 'lucide-react';
import type { PaymentDetail } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { useFinance } from '../../../context/FinanceContext';
import { useBankingStore } from '../../../context/BankingContext';
import { DEFAULT_ACCOUNTS } from '../../../constants';
import { currencyService } from '../../../services/currencyService';

import { formatNumber } from '../../../utils/helpers';

interface PaymentModalProps {
    total: number;
    onComplete: (paymentMethods: PaymentDetail[], excessHandling?: 'Change' | 'Wallet') => void;
    onCancel: () => void;
    customerName: string | null;
    availableCredit: number;
    walletBalance: number;
    loyaltyPoints?: number;
    subAccountName?: string;
    // TODO: normalise to adjustmentSnapshots — see cleanup tracker
    adjustmentSummary?: { adjustmentId: string; adjustmentName: string; totalAmount: number; itemCount: number; }[];
    roundingAccumulation?: number;
    totalProfitMargin?: number;
    orderNumber: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
    total,
    onComplete,
    onCancel,
    customerName,
    availableCredit: _availableCredit,
    walletBalance,
    loyaltyPoints = 0,
    subAccountName: _subAccountName,
    adjustmentSummary = [],
    roundingAccumulation: _roundingAccumulation = 0,
    totalProfitMargin = 0,
    orderNumber
}) => {
    const { companyConfig, notify } = useAuth(); const { invoices } = useFinance();
    const { accounts: bankAccounts, fetchBankingData } = useBankingStore();
    const currency = companyConfig?.currencySymbol || currencyService.getCurrency(currencyService.getBaseCurrency())?.symbol || '$';
    const [splitPayments, setSplitPayments] = useState<PaymentDetail[]>([]);
    const [remainingDue, setRemainingDue] = useState(total);
    const [currentPaymentAmount, setCurrentPaymentAmount] = useState(() => (Number.isFinite(total) ? total.toFixed(2) : ''));
    const [changeDue, setChangeDue] = useState(0);
    const [activePaymentMethod, setActivePaymentMethod] = useState<string | null>(null);

    const handleCancel = useCallback(() => {
        setActivePaymentMethod(null);
        onCancel();
    }, [onCancel]);

    // Auto-calculate change when amount received changes
    useEffect(() => {
        const val = parseFloat(currentPaymentAmount);
        if (!isNaN(val) && val > total) {
            setChangeDue(val - total);
        } else {
            setChangeDue(0);
        }
    }, [currentPaymentAmount, total]);

    const pointsConversionRate = 0.10;

    useEffect(() => {
        fetchBankingData?.();
    }, [fetchBankingData]);

    useEffect(() => {
        if (!bankAccounts || bankAccounts.length === 0) {
            fetchBankingData?.();
        }
    }, [bankAccounts?.length, fetchBankingData]);

    useEffect(() => {
        if (splitPayments.length === 0 && (currentPaymentAmount === '' || Number(currentPaymentAmount) === 0)) {
            setCurrentPaymentAmount(Number.isFinite(total) ? total.toFixed(2) : '');
            setRemainingDue(total);
        }
    }, [total, splitPayments.length]);

    const typedAmount = useMemo(() => {
        const parsed = parseFloat(currentPaymentAmount);
        return Number.isFinite(parsed) ? parsed : 0;
    }, [currentPaymentAmount]);

    const effectiveRemainingDue = useMemo(() => {
        if (splitPayments.length > 0) return remainingDue;
        return Math.max(0, total - typedAmount);
    }, [splitPayments.length, remainingDue, total, typedAmount]);

const canCompleteSale = useMemo(() => {
  // total paid is sum of split payments plus any typed amount remaining
  const totalPaid = splitPayments.reduce((sum, p) => sum + p.amount, 0) + typedAmount;
  // consider the sale complete if totalPaid covers the total within a small tolerance
  return totalPaid >= total - 0.01;
}, [splitPayments, typedAmount, total]);

    const handleComplete = useCallback(() => {
        const paymentsToSubmit: PaymentDetail[] = splitPayments.length > 0
            ? splitPayments
            : (
                typedAmount > 0
                    ? [{ method: 'Cash', amount: typedAmount, accountId: '1000' }]
                    : []
            );
        const totalPaid = paymentsToSubmit.reduce((sum, p) => sum + p.amount, 0);

        if (paymentsToSubmit.length === 0) {
            notify("Select a payment method or enter amount received.", "error");
            return;
        }

        if (totalPaid < total - 0.01) {
            notify("Amount tendered cannot be less than bill total.", "error");
            return;
        }

        onComplete(paymentsToSubmit, 'Change');
        // Reset active payment method after completing sale
        setActivePaymentMethod(null);
    }, [splitPayments, typedAmount, total, onComplete, notify]);

    const addPaymentMethod = useCallback((accountId: string) => {
        const amountInput = parseFloat(currentPaymentAmount);
        if (isNaN(amountInput) || amountInput <= 0) {
            notify("Please enter a valid positive payment amount.", "error");
            return;
        }

        let method: string;
        if (accountId === 'WALLET') {
            if (amountInput > walletBalance) {
                notify(`Insufficient wallet balance. Available: ${currency}${formatNumber(walletBalance)}`, "error");
                return;
            }
            method = 'Wallet';
        } else if (accountId === 'LOYALTY') {
            const availableValue = loyaltyPoints * pointsConversionRate;
            if (amountInput > availableValue) {
                notify(`Insufficient loyalty points. Max value: ${currency}${formatNumber(availableValue)}`, "error");
                return;
            }
            method = 'Loyalty';
        } else if (accountId === 'CREDIT') {
            if (amountInput > creditStatus.available) {
                notify(`Insufficient credit limit. Available: ${currency}${formatNumber(creditStatus.available)}`, "error");
                return;
            }
            method = 'Credit';
        } else {
            const account = DEFAULT_ACCOUNTS.find(a => a.id === accountId);
            if (!account) return;
            method = account.name.includes('Cash') ? 'Cash' :
                (account.name.includes('Mobile') ? 'Mobile Money' : 'Bank Transfer');
        }

        const newSplit = [...splitPayments, { method, amount: amountInput, accountId }];
        setSplitPayments(newSplit);

        // Set active payment method for highlighting
        setActivePaymentMethod(accountId);

        const newPaid = newSplit.reduce((sum, p) => sum + p.amount, 0);
        const newRemaining = total - newPaid;

        // Update change due based on total paid vs bill total
        if (newPaid > total) {
            setChangeDue(newPaid - total);
        } else {
            setChangeDue(0);
        }

        setRemainingDue(newRemaining > 0.01 ? newRemaining : 0);
        setCurrentPaymentAmount(newRemaining > 0.01 ? newRemaining.toFixed(2) : '');
    }, [currentPaymentAmount, splitPayments, total, notify]);

    // Keyboard Shortcuts Logic
    useEffect(() => {
        const handleGlobalKeys = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleCancel();
            if (e.key === 'Enter' && canCompleteSale) handleComplete();

            // Numerical shortcuts for payment methods (Alt + 1, 2, 3...)
            if (e.altKey) {
                if (e.key === '1') addPaymentMethod('1000');
                if (e.key === '2') addPaymentMethod('1050');
                if (e.key === '3') addPaymentMethod('1060');
            }
        };
        window.addEventListener('keydown', handleGlobalKeys);
        return () => window.removeEventListener('keydown', handleGlobalKeys);
    }, [canCompleteSale, handleComplete, handleCancel, addPaymentMethod]);

    const normalizedBankAccounts = useMemo(() => {
        return (bankAccounts || []).filter(acc => acc.status !== 'Closed');
    }, [bankAccounts]);

    const resolveBankAccount = (
        tokens: string[],
        options?: { allowBankNameMatch?: boolean; excludeNameTokens?: string[] }
    ) => {
        if (normalizedBankAccounts.length === 0) return undefined;
        const loweredTokens = tokens.map(token => token.toLowerCase());
        const exclude = (options?.excludeNameTokens || []).map(token => token.toLowerCase());

        const byAccountNumber = normalizedBankAccounts.find(acc => {
            const accountNumber = (acc.accountNumber || '').toLowerCase();
            return loweredTokens.some(token => accountNumber.includes(token));
        });
        if (byAccountNumber) return byAccountNumber;

        const byName = normalizedBankAccounts.find(acc => {
            const name = (acc.name || '').toLowerCase();
            return loweredTokens.some(token => name.includes(token));
        });
        if (byName) return byName;

        if (!options?.allowBankNameMatch) return undefined;

        return normalizedBankAccounts.find(acc => {
            const name = (acc.name || '').toLowerCase();
            const bank = (acc.bankName || '').toLowerCase();
            if (exclude.some(token => name.includes(token))) return false;
            return loweredTokens.some(token => bank.includes(token));
        });
    };

    const cashBankAccount = useMemo(
        () => resolveBankAccount(['cash'], { allowBankNameMatch: false }),
        [normalizedBankAccounts]
    );
    const bankBankAccount = useMemo(
        () => resolveBankAccount(['bank'], { allowBankNameMatch: true, excludeNameTokens: ['cash', 'mobile', 'momo'] }),
        [normalizedBankAccounts]
    );
    const mobileBankAccount = useMemo(
        () => resolveBankAccount(['mobile', 'momo', 'money'], { allowBankNameMatch: true, excludeNameTokens: ['cash', 'bank'] }),
        [normalizedBankAccounts]
    );

    const cashBalance = cashBankAccount?.availableBalance ?? cashBankAccount?.balance;
    const bankBalance = bankBankAccount?.availableBalance ?? bankBankAccount?.balance;
    const mobileBalance = mobileBankAccount?.availableBalance ?? mobileBankAccount?.balance;
    const formatBalance = (value?: number) => (value === undefined ? '--' : `${currency}${formatNumber(value)}`);

    const hasAdjustments = adjustmentSummary && adjustmentSummary.length > 0;
    const adjustmentTotal = useMemo(() => {
        if (!adjustmentSummary || adjustmentSummary.length === 0) return 0;
        return adjustmentSummary.reduce((sum, adj) => sum + (adj.totalAmount || 0), 0);
    }, [adjustmentSummary]);
    const roundingTotal = Number.isFinite(_roundingAccumulation) ? _roundingAccumulation : 0;

    const creditStatus = useMemo(() => {
        if (!customerName) return { available: 0, blocked: true, reason: 'Walk-in' };
        const subLimit = 0;
        const currentBalance = (invoices || [])
            .filter((i: any) => i.customerName === customerName && i.status !== 'Paid' && i.status !== 'Draft' && i.status !== 'Cancelled')
            .reduce((acc: number, inv: any) => acc + ((inv.totalAmount || 0) - (inv.paidAmount || 0)), 0);
        const available = Math.max(0, subLimit - currentBalance);
        const blocked = true; // Block credit for now
        return { available, blocked, reason: 'Credit Disabled', limit: subLimit };
    }, [customerName, invoices]);

    const ButtonBase = ({ icon: Icon, disabled = false, subText, label, accountId }: any) => (
        <button
            onClick={() => addPaymentMethod(accountId)}
            disabled={disabled}
            className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all h-20
            ${disabled
                    ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
                    : 'bg-white border-slate-200 hover:border-blue-600 hover:bg-blue-50 active:bg-blue-100'}`}
        >
            <Icon size={22} className={`mb-1 ${disabled ? 'text-slate-400' : 'text-blue-600'}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${disabled ? 'text-slate-400' : 'text-slate-800'}`}>{label}</span>
            {subText && <span className="text-[9px] text-slate-500 mt-0.5">{subText}</span>}
        </button>
    );
    return (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div style={{ width: 700, background: '#fff', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,.35)', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #dde5e2' }}>
                    <div>
                        <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 18, color: '#12201d' }}>Payment</span>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, color: '#93a19c', marginLeft: 10 }}>{orderNumber}</span>
                    </div>
                    <button onClick={onCancel} style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, color: '#93a19c', cursor: 'pointer', fontSize: 16, border: 'none', background: 'none' }}>&times;</button>
                </div>

                {/* Body */}
                <div style={{ display: 'flex' }}>
                    {/* Left — Summary */}
                    <div style={{ width: 230, background: '#DBEAFE', padding: '18px 16px 14px', borderRight: '1px solid #dde5e2', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', fontSize: 13 }}>
                            <span style={{ color: '#5c6d68' }}>Order total</span>
                        </div>
                        <div style={{ padding: '10px 0 12px', borderBottom: '1px dashed #dde5e2', marginBottom: 10 }}>
                            <span style={{ fontSize: 12, color: '#5c6d68' }}>Due</span>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 600, color: '#12201d', display: 'block', marginTop: 3 }}>
                                {currency}{formatNumber(total || 0)}
                            </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', fontSize: 13 }}>
                            <span style={{ color: '#5c6d68' }}>Adjustments</span>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: '#12201d' }}>
                                +{currency}{formatNumber(adjustmentTotal)}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', fontSize: 13 }}>
                            <span style={{ color: '#5c6d68' }}>Margin</span>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: '#2563EB' }}>
                                {currency}{formatNumber(totalProfitMargin)}
                            </span>
                        </div>

                        <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#93a19c', fontWeight: 600, margin: '12px 0 5px' }}>Balances</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #dde5e2', borderRadius: 5, padding: '6px 10px', fontSize: 12.5 }}>
                                <span style={{ color: '#12201d', fontWeight: 500 }}>Cash</span>
                                <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#93a19c' }}>{formatBalance(cashBalance)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #dde5e2', borderRadius: 5, padding: '6px 10px', fontSize: 12.5 }}>
                                <span style={{ color: '#12201d', fontWeight: 500 }}>Bank</span>
                                <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#93a19c' }}>{formatBalance(bankBalance)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #dde5e2', borderRadius: 5, padding: '6px 10px', fontSize: 12.5 }}>
                                <span style={{ color: '#12201d', fontWeight: 500 }}>Mobile</span>
                                <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#93a19c' }}>{formatBalance(mobileBalance)}</span>
                            </div>
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: 12 }}>
                            <span style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#2563EB', fontWeight: 600 }}>{changeDue > 0 ? 'Change' : 'Remaining'}</span>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 24, fontWeight: 600, color: '#2563EB', display: 'block', marginTop: 3 }}>
                                {changeDue > 0 ? currency + formatNumber(changeDue) : currency + formatNumber(effectiveRemainingDue || 0)}
                            </span>
                        </div>
                    </div>

                    {/* Right — Payment */}
                    <div style={{ flex: 1, padding: '18px 20px 14px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#93a19c', fontWeight: 600, marginBottom: 6 }}>Amount received</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', border: '1px solid #dde5e2', borderRadius: 6, padding: '0 14px', height: 48 }}>
                                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: '#93a19c', marginRight: 8, fontSize: 17 }}>{currency}</span>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    style={{ border: 'none', outline: 'none', fontFamily: "'JetBrains Mono',monospace", fontSize: 17, fontWeight: 500, width: '100%', color: '#12201d' }}
                                    placeholder="0.00"
                                    value={currentPaymentAmount}
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val === '' || /^\d*\.?\d*$/.test(val)) setCurrentPaymentAmount(val);
                                    }}
                                    autoFocus
                                />
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: 10.5, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#93a19c' }}>Remaining</span>
                                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 17, fontWeight: 600, color: '#2563EB', display: 'block' }}>
                                    {currency}{formatNumber(effectiveRemainingDue || 0)}
                                </span>
                            </div>
                        </div>

                        <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#93a19c', fontWeight: 600, marginBottom: 6 }}>Payment method</div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                            <button onClick={() => addPaymentMethod('1000')}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', border: `1px solid ${activePaymentMethod === '1000' ? '#2563EB' : '#dde5e2'}`, borderRadius: 6, padding: '10px 8px', fontSize: 13, fontWeight: 500, color: activePaymentMethod === '1000' ? '#2563EB' : '#12201d', cursor: 'pointer', background: activePaymentMethod === '1000' ? '#DBEAFE' : '#fff' }}>
                                <Banknote size={17} /> Cash
                            </button>
                            <button onClick={() => addPaymentMethod('1050')}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', border: `1px solid ${activePaymentMethod === '1050' ? '#2563EB' : '#dde5e2'}`, borderRadius: 6, padding: '10px 8px', fontSize: 13, fontWeight: 500, color: activePaymentMethod === '1050' ? '#2563EB' : '#12201d', cursor: 'pointer', background: activePaymentMethod === '1050' ? '#DBEAFE' : '#fff' }}>
                                <CreditCard size={17} /> Bank
                            </button>
                            <button onClick={() => addPaymentMethod('1060')}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', border: `1px solid ${activePaymentMethod === '1060' ? '#2563EB' : '#dde5e2'}`, borderRadius: 6, padding: '10px 8px', fontSize: 13, fontWeight: 500, color: activePaymentMethod === '1060' ? '#2563EB' : '#12201d', cursor: 'pointer', background: activePaymentMethod === '1060' ? '#DBEAFE' : '#fff' }}>
                                <Smartphone size={17} /> Mobile
                            </button>
                            {customerName && walletBalance > 0 && (
                                <button onClick={() => addPaymentMethod('WALLET')}
                                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', border: `1px solid ${activePaymentMethod === 'WALLET' ? '#2563EB' : '#dde5e2'}`, borderRadius: 6, padding: '10px 8px', fontSize: 13, fontWeight: 500, color: activePaymentMethod === 'WALLET' ? '#2563EB' : '#12201d', cursor: 'pointer', background: activePaymentMethod === 'WALLET' ? '#DBEAFE' : '#fff' }}>
                                    <Wallet size={17} /> Wallet
                                </button>
                            )}
                            {customerName && loyaltyPoints > 0 && (
                                <button onClick={() => addPaymentMethod('LOYALTY')}
                                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', border: `1px solid ${activePaymentMethod === 'LOYALTY' ? '#2563EB' : '#dde5e2'}`, borderRadius: 6, padding: '10px 8px', fontSize: 13, fontWeight: 500, color: activePaymentMethod === 'LOYALTY' ? '#2563EB' : '#12201d', cursor: 'pointer', background: activePaymentMethod === 'LOYALTY' ? '#DBEAFE' : '#fff' }}>
                                    <Award size={17} /> Loyalty
                                </button>
                            )}
                        </div>

                        {/* Quick amounts */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                            <div onClick={() => setCurrentPaymentAmount(Number.isFinite(total) ? total.toFixed(2) : '')}
                                style={{ flex: 1, textAlign: 'center', padding: '8px 0', border: '1px solid #dde5e2', borderRadius: 5, fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, color: '#5c6d68', cursor: 'pointer' }}>
                                Exact
                            </div>
                            <div onClick={() => setCurrentPaymentAmount(prev => (Number(prev) + 5000).toFixed(2))}
                                style={{ flex: 1, textAlign: 'center', padding: '8px 0', border: '1px solid #dde5e2', borderRadius: 5, fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, color: '#5c6d68', cursor: 'pointer' }}>
                                +{currency}5,000
                            </div>
                            <div onClick={() => setCurrentPaymentAmount(prev => (Number(prev) + 10000).toFixed(2))}
                                style={{ flex: 1, textAlign: 'center', padding: '8px 0', border: '1px solid #dde5e2', borderRadius: 5, fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, color: '#5c6d68', cursor: 'pointer' }}>
                                +{currency}10,000
                            </div>
                        </div>

                        {/* Split payments */}
                        {splitPayments.length > 0 && (
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#93a19c', fontWeight: 600, marginBottom: 5 }}>Payment Breakdown</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {splitPayments.map((p, i) => (
                                        <div key={i} style={{ background: '#DBEAFE', padding: '5px 10px', borderRadius: 5, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                                            <span style={{ fontWeight: 600, color: '#2563EB' }}>{p.method}</span>
                                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: '#12201d' }}>{currency}{formatNumber(p.amount)}</span>
                                            <button onClick={() => {
                                                setSplitPayments(prev => prev.filter((_, idx) => idx !== i));
                                                setActivePaymentMethod(null);
                                                const totalPaid = splitPayments.filter((_, idx) => idx !== i).reduce((s, x) => s + x.amount, 0);
                                                setRemainingDue(total - totalPaid);
                                                setChangeDue(0);
                                                setCurrentPaymentAmount((total - totalPaid).toFixed(2));
                                            }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#93a19c', padding: 0, fontSize: 14 }}>&times;</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Change due banner */}
                        {changeDue > 0 && (
                            <div style={{ background: '#DBEAFE', border: '1px solid #2563EB', borderRadius: 6, padding: '8px 12px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: '#2563EB' }}>Change due</span>
                                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 17, fontWeight: 600, color: '#2563EB' }}>{currency}{formatNumber(changeDue)}</span>
                            </div>
                        )}

                        <div style={{ flex: 1 }} />

                        <button
                            onClick={handleComplete}
                            disabled={!canCompleteSale}
                            style={{ width: '100%', border: 'none', borderRadius: 6, padding: '13px 0', fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600, background: canCompleteSale ? '#2563EB' : '#DBEAFE', color: canCompleteSale ? '#fff' : '#93a19c', cursor: canCompleteSale ? 'pointer' : 'default' }}>
                            {!canCompleteSale ? 'Awaiting payment' : `Complete Sale`}
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div onClick={onCancel} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '11px 20px', borderTop: '1px solid #dde5e2', fontSize: 12.5, color: '#5c6d68', cursor: 'pointer' }}>
                    &larr; Back to register
                </div>
            </div>
        </div>
    );
};
