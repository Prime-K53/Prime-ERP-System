
import React, { useMemo, useState, useEffect } from 'react';
import { ShoppingCart, User, Plus, Minus, ShoppingBag, Undo2, ArrowRight, UserPlus, ChevronRight, Tag, AlertTriangle, X, TrendingUp } from 'lucide-react';
import { CartItem } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { useFinance } from '../../../context/FinanceContext';
import { PrintJobCartCard } from '../../../components/printing/PrintJobCartCard';

import { formatNumber } from '../../../utils/helpers';
import { roundToNearest, roundUpToStep } from '../../../utils/roundingUtils';
import { displayPrice } from '../../../services/pricingDisplayService';

interface CartSidebarProps {
    cart: CartItem[];
    selectedCustomerName: string | null;
    selectedSubAccount: string;
    setSelectedSubAccount: (val: string) => void;
    onSelectCustomer: () => void;
    updateQuantity: (id: string, delta: number, isAbsolute?: boolean) => void;
    updatePrice: (id: string, newPrice: number) => void;
    resetPriceOverride: (id: string) => void | Promise<void>;
    removeFromCart: (id: string) => void;
    clearCart: () => void;
    onPark: () => void;
    onReturn: () => void;
    onPay: () => void;
    totals: { subtotal: number, discount: number, total: number };
    /** Adjustment summary for display in totals section */
    // TODO: normalise to adjustmentSnapshots — see cleanup tracker
    adjustmentSummary?: { adjustmentId: string; adjustmentName: string; totalAmount: number; itemCount: number; }[];
    pricingSummary?: {
        profitMarginTotal: number;
        roundingTotal: number;
    };
    rounding?: {
        enabled: boolean;
        applyRounding: boolean;
        calculatedPrice: number;
        roundedPrice: number;
        difference: number;
        method: string;
        methodLabel?: string;
        methodOptions?: { value: string; label: string }[];
        showOriginalPrice?: boolean;
        manualOverrideAllowed?: boolean;
        onToggle?: (value: boolean) => void;
        onMethodChange?: (value: string) => void;
    };
}

export const CartSidebar: React.FC<CartSidebarProps> = ({
    cart, selectedCustomerName, selectedSubAccount, setSelectedSubAccount, onSelectCustomer, updateQuantity, updatePrice, resetPriceOverride, removeFromCart, clearCart, onPark, onReturn, onPay, totals, adjustmentSummary, pricingSummary, rounding
}) => {
    const { companyConfig } = useAuth();
    const { invoices } = useFinance();
    const currency = companyConfig.currencySymbol;

    const [roundingEnabled, setRoundingEnabled] = useState(false);
    const [roundingMethod, setRoundingMethod] = useState('Nearest');
    const roundingStep = 50;

    const grandTotal = totals.total;
    const profitMarginTotal = Number(pricingSummary?.profitMarginTotal || 0);
    const hasPricingBreakdown = Boolean(Math.abs(profitMarginTotal) > 0.0001);

    const roundedTotal = useMemo(() => {
        if (!roundingEnabled) return grandTotal;
        if (roundingMethod === 'Up') return roundUpToStep(grandTotal, roundingStep);
        return roundToNearest(grandTotal, roundingStep);
    }, [grandTotal, roundingEnabled, roundingMethod, roundingStep]);

    const roundingDifference = roundToNearest(roundedTotal - grandTotal, 0.01);

    const customerOutstanding = useMemo(() => {
        if (!selectedCustomerName) return 0;
        return (invoices || [])
            .filter((i: any) => i.customerName === selectedCustomerName && i.status !== 'Paid' && i.status !== 'Draft' && i.status !== 'Cancelled')
            .reduce((acc: number, inv: any) => acc + ((inv.totalAmount || 0) - (inv.paidAmount || 0)), 0);
    }, [selectedCustomerName, invoices]);

    return (
        <div className="flex flex-col h-full bg-white overflow-hidden border-l border-slate-200 rounded-xl">
            {/* Checkout Header */}
            <div className="px-4 py-2.5 flex justify-between items-center bg-white border-b border-slate-200 shrink-0 rounded-t-xl border-l-4 border-l-emerald-500">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-emerald-50 rounded text-emerald-600">
                        <ShoppingCart size={15} />
                    </div>
                    <div>
                        <h3 className="text-xs font-bold text-slate-800 leading-tight">Current Order</h3>
                        <p className="text-[9px] text-slate-500 font-medium">{cart.reduce((s, i) => s + i.quantity, 0)} items</p>
                    </div>
                </div>
                <button
                    onClick={clearCart}
                    disabled={cart.length === 0}
                    className="text-red-500 hover:text-red-700 text-[10px] font-bold disabled:opacity-0 disabled:pointer-events-none transition-colors"
                >
                    Clear all
                </button>
            </div>

            {/* Customer Selector */}
            <div className="px-3 py-1.5 bg-white border-b border-slate-200 shrink-0">
                <button
                    onClick={onSelectCustomer}
                    className={`w-full flex justify-between items-center p-1.5 rounded-lg border transition-all bg-white shadow-sm
                    ${selectedCustomerName
                            ? 'border-blue-300 bg-blue-50/30'
                            : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/20'}`}
                >
                    <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors
                          ${selectedCustomerName ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                            {selectedCustomerName ? <User size={12} /> : <UserPlus size={12} />}
                        </div>
                        <div className="text-left">
                            <div className="text-[10px] font-semibold text-slate-800 leading-tight">
                                {selectedCustomerName || 'Add Customer'}
                            </div>
                            {selectedCustomerName && (
                                <div className={`text-[8px] font-medium ${customerOutstanding > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                    {customerOutstanding > 0 ? 'Balance: ' : 'Bal: '}{currency}{(customerOutstanding || 0).toLocaleString()}
                                </div>
                            )}
                        </div>
                    </div>
                    <ChevronRight size={10} className="text-slate-300" />
                </button>
            </div>

            {/* Cart Item List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-10 text-center">
                        <ShoppingBag size={48} className="mb-4 opacity-20" />
                        <p className="text-sm font-medium">Your cart is empty</p>
                        <p className="text-xs mt-1">Add items from the product grid to start an order.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {cart.map(item => {
                            if (item.isPrintingJob && item.printingSpec) {
                                return (
                                    <div key={item.id} className="p-2">
                                        <PrintJobCartCard
                                            spec={item.printingSpec}
                                            currency={currency}
                                            productionRef={item.productionRef || `PJ-${item.id.slice(-5)}`}
                                            onRemove={() => removeFromCart(item.id)}
                                        />
                                    </div>
                                );
                            }
                            return (
                                <CartItemRow
                                    key={item.id}
                                    item={item}
                                    updateQuantity={updateQuantity}
                                    updatePrice={updatePrice}
                                    removeFromCart={removeFromCart}
                                />
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Checkout Totals Summary */}
            <div className="p-4 bg-white border-t-2 border-slate-100 space-y-3 shrink-0 rounded-b-xl shadow-[0_-2px_8px_-3px_rgba(0,0,0,0.06)]">
                {roundingEnabled && (
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Rounding</span>
                            <div className="flex items-center gap-1">
                                <span className="text-[9px] text-slate-400 font-medium">On</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={roundingEnabled} onChange={e => setRoundingEnabled(e.target.checked)} />
                                    <div className="w-7 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-600"></div>
                                </label>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-purple-600 font-medium">Method</span>
                            <select value={roundingMethod} onChange={e => setRoundingMethod(e.target.value)}
                                className="text-[10px] p-1 border border-purple-200 rounded bg-white text-slate-700 font-semibold outline-none">
                                <option value="Nearest">Nearest</option>
                                <option value="Up">Round Up</option>
                            </select>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-purple-600 font-medium">Step</span>
                            <span className="text-[10px] text-slate-700 font-semibold">{currency}{formatNumber(roundingStep)}</span>
                        </div>
                    </div>
                )}

                {roundingEnabled && Math.abs(roundingDifference) > 0.001 && (
                    <div className="flex justify-between items-center">
                        <span className="text-purple-600 text-[11px] font-semibold">Rounding Adjustment</span>
                        <span className={`font-mono text-[11px] font-semibold ${roundingDifference >= 0 ? 'text-purple-600' : 'text-rose-600'}`}>
                            {roundingDifference >= 0 ? '+' : ''}{currency}{formatNumber(roundingDifference)}
                        </span>
                    </div>
                )}

                {hasPricingBreakdown && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-50">
                        {profitMarginTotal !== 0 && (
                            <div className="flex justify-between items-center">
                                <span className={`text-[11px] font-semibold tracking-tight flex items-center gap-1.5 ${profitMarginTotal < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    <TrendingUp size={10} className={profitMarginTotal < 0 ? 'text-rose-500' : 'text-emerald-500'} /> Profit Margin
                                </span>
                                <span className={`font-mono text-[11px] font-semibold ${profitMarginTotal < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    {profitMarginTotal >= 0 ? '+' : ''}{currency}{formatNumber(profitMarginTotal)}
                                </span>
                            </div>
                        )}
                        {profitMarginTotal <= 0 && (
                            <div className="flex items-start gap-2 p-2 bg-rose-50 border border-rose-200 rounded-lg mt-1">
                                <AlertTriangle size={12} className="text-rose-500 shrink-0 mt-0.5" />
                                <p className="text-[10px] text-rose-700 leading-relaxed">
                                    {profitMarginTotal === 0
                                        ? 'Zero profit margin — price equals cost.'
                                        : `Negative margin of ${currency}${formatNumber(Math.abs(profitMarginTotal))} — selling below cost.`}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex justify-between items-center pt-1">
                    <span className="text-sm font-bold text-slate-700">Total</span>
                    <span className="text-xl font-bold text-slate-900">{currency}{formatNumber(displayPrice(roundedTotal, undefined, 'pos'))}</span>
                </div>

                <div className="flex flex-col gap-2">
                    <button
                        onClick={onPay}
                        disabled={cart.length === 0}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold text-sm hover:from-emerald-700 hover:to-emerald-600 transition-all disabled:opacity-50 disabled:from-slate-300 disabled:to-slate-300 flex items-center justify-center gap-2 shadow-md shadow-emerald-200/50 active:scale-[0.98]"
                    >
                        <span>Receive Payment</span> <ArrowRight size={16} />
                    </button>

                    <div className={`grid gap-2 ${companyConfig.transactionSettings?.pos?.allowReturns !== false ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        <button
                            onClick={() => setRoundingEnabled(prev => !prev)}
                            disabled={cart.length === 0}
                            className={`flex items-center justify-center gap-2 py-2 rounded-full border font-bold text-xs transition-all disabled:opacity-50 ${roundingEnabled ? 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100' : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'}`}
                        >
                            <Tag size={12} /> {roundingEnabled ? 'Rounding On' : 'Rounding'}
                        </button>
                        {companyConfig.transactionSettings?.pos?.allowReturns !== false && (
                            <button onClick={onReturn} className="flex items-center justify-center gap-2 py-2 rounded-full border border-slate-200 bg-white text-slate-800 font-bold text-xs hover:bg-slate-50 transition-all">
                                <Undo2 size={12} /> Refund
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

const CartItemRow: React.FC<{ item: CartItem, updateQuantity: (id: string, delta: number, isAbsolute?: boolean) => void, updatePrice: (id: string, newPrice: number) => void, removeFromCart: (id: string) => void }> = ({ item, updateQuantity, updatePrice, removeFromCart }) => {
    const { companyConfig } = useAuth();
    const currency = companyConfig.currencySymbol;
    const [localQty, setLocalQty] = useState(item.quantity.toString());
    const serviceDetails = item.serviceDetails;

    const [isEditingPrice, setIsEditingPrice] = useState(false);
    const [localPrice, setLocalPrice] = useState(item.price.toString());

    useEffect(() => {
        setLocalQty(item.quantity.toString());
    }, [item.quantity]);

    useEffect(() => {
        setLocalPrice(item.price.toString());
    }, [item.price]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            const val = parseInt(localQty);
            if (!isNaN(val) && val >= 1) {
                updateQuantity(item.id, val, true);
            } else {
                setLocalQty(item.quantity.toString());
            }
        }
    };

    const handleBlur = () => {
        const val = parseInt(localQty);
        if (!isNaN(val) && val >= 1) {
            updateQuantity(item.id, val, true);
        } else {
            setLocalQty(item.quantity.toString());
        }
    };

    const handlePriceKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            const val = parseFloat(localPrice);
            if (!isNaN(val) && val >= 0) {
                updatePrice(item.id, val);
                setIsEditingPrice(false);
            } else {
                setLocalPrice(item.price.toString());
                setIsEditingPrice(false);
            }
        } else if (e.key === 'Escape') {
            setLocalPrice(item.price.toString());
            setIsEditingPrice(false);
        }
    };

    const handlePriceBlur = () => {
        const val = parseFloat(localPrice);
        if (!isNaN(val) && val >= 0) {
            updatePrice(item.id, val);
        } else {
            setLocalPrice(item.price.toString());
        }
        setIsEditingPrice(false);
    };

    return (
        <div className="p-3 bg-white border-l-4 border-l-blue-400 hover:border-l-blue-500 hover:bg-blue-50/20 transition-all group relative rounded-lg border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start mb-2">
                <div className="flex-1 min-w-0 pr-6">
                    <h4 className="font-semibold text-slate-800 text-xs leading-tight mb-0.5">{item.name}</h4>
                    {serviceDetails && (
                        <div className="text-[10px] text-slate-500 leading-snug mb-1">
                            <div>{serviceDetails.pages} pages x {serviceDetails.copies} copies</div>
                        </div>
                    )}
                    {item.attributes && Object.keys(item.attributes).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                            {Object.entries(item.attributes).map(([key, value]) => (
                                <span key={key} className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {key.replace(/_/g, ' ')}: {String(value)}
                                </span>
                            ))}
                        </div>
                    )}

                </div>
                <button onClick={() => removeFromCart(item.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all p-0.5 rounded hover:bg-red-50" title="Remove item" aria-label="Remove item from cart">
                    <X size={13} />
                </button>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                    <div className="flex items-center border border-slate-200 rounded bg-white">
                        <button onClick={() => updateQuantity(item.id, -1)} className="w-4 h-4 flex items-center justify-center hover:bg-slate-50 border-r border-slate-200 shrink-0" title="Decrease quantity" aria-label="Decrease quantity"><Minus size={8} /></button>
                        <input type="number" value={localQty} onChange={(e) => setLocalQty(e.target.value)} onKeyDown={handleKeyDown} onBlur={handleBlur}
                            className="w-[33px] p-0 text-center border-none outline-none text-[13px] font-bold text-slate-800 bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        <button onClick={() => updateQuantity(item.id, 1)} className="w-4 h-4 flex items-center justify-center hover:bg-slate-50 border-l border-slate-200 shrink-0" title="Increase quantity" aria-label="Increase quantity"><Plus size={8} /></button>
                    </div>
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        @ {currency}
                        {isEditingPrice ? (
                            <input
                                type="number"
                                autoFocus
                                className="w-16 bg-white border border-blue-400 rounded px-1 text-xs font-bold text-blue-600 outline-none"
                                value={localPrice}
                                onChange={(e) => setLocalPrice(e.target.value)}
                                onKeyDown={handlePriceKeyDown}
                                onBlur={handlePriceBlur}
                            />
                        ) : (
                            <span 
                                onClick={() => setIsEditingPrice(true)}
                                className={`font-bold cursor-pointer hover:text-blue-600 transition-colors ${item.manual_override ? 'text-blue-600 underline decoration-dotted' : 'text-slate-800'}`}
                                title="Click to override price"
                            >
                                {formatNumber(displayPrice(item.price, undefined, 'pos'))}
                            </span>
                        )}
                    </span>
                </div>
                <div className="text-right">
                    <div className="font-bold text-slate-800 text-sm">{currency}{formatNumber(displayPrice(item.price * item.quantity, undefined, 'pos'))}</div>

                </div>
            </div>
        </div>
    );
};
