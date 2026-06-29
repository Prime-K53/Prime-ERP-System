import React from 'react';
import { AlertCircle, CheckCircle, DollarSign, TrendingUp, Info, FileText, Layers, Package } from 'lucide-react';
import type { InventoryRole } from '../../../types';

const premium = {
    glassCard: "bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 rounded-xl shadow-sm",
    glassCardStrong: "bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/80 rounded-xl shadow-lg",
    input: "w-full px-3 py-2 bg-white/50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 rounded-lg text-sm font-medium text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all placeholder:text-slate-400 hover:border-slate-300/60 dark:hover:border-slate-600/60",
    sectionTitle: "text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 mb-4 pb-2 border-b border-slate-200/50 dark:border-slate-700/50",
    metricCard: "bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200/50 dark:border-blue-800/50 rounded-xl p-4",
    metricValue: "text-xl font-bold text-blue-600 dark:text-blue-400",
    metricLabel: "text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400",
    divider: "h-px bg-gradient-to-r from-transparent via-slate-200/60 to-transparent dark:via-slate-700/60 my-4",
};

interface CostSourceInfo {
    type: 'bom' | 'recipe' | 'manual' | 'smart_pricing' | 'internal';
    label: string;
    details?: string;
}

interface PricingTabProps {
    costPrice: number;
    sellingPrice: number;
    profitAmount: number;
    profitMargin: number;
    minimumMargin: number;
    valid: boolean;
    message: string;
    currency: string;
    onSellingPriceChange: (value: number) => void;
    isSaving: boolean;
    costSource?: CostSourceInfo;
    inventoryRole?: InventoryRole;
}

const PricingTab: React.FC<PricingTabProps> = ({
    costPrice,
    sellingPrice,
    profitAmount,
    profitMargin,
    minimumMargin,
    valid,
    message,
    currency,
    onSellingPriceChange,
    isSaving,
    costSource,
    inventoryRole,
}) => {
    const isInternal = inventoryRole === 'internal';

    const marginColor = profitMargin >= minimumMargin ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
    const statusIcon = valid
        ? <CheckCircle className="w-5 h-5 text-emerald-500" />
        : <AlertCircle className="w-5 h-5 text-rose-500" />;
    const statusText = valid ? 'Above Minimum Markup' : 'Below Minimum Markup';
    const statusColor = valid ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
    const statusBg = valid
        ? 'bg-emerald-50/50 dark:bg-emerald-900/20 border-emerald-200/50 dark:border-emerald-800/50'
        : 'bg-rose-50/50 dark:bg-rose-900/20 border-rose-200/50 dark:border-rose-800/50';

    const sourceIcon = costSource?.type === 'bom' ? <FileText className="w-3.5 h-3.5" /> :
        costSource?.type === 'recipe' ? <Layers className="w-3.5 h-3.5" /> :
        costSource?.type === 'smart_pricing' ? <TrendingUp className="w-3.5 h-3.5" /> :
        costSource?.type === 'internal' ? <Package className="w-3.5 h-3.5" /> :
        <Info className="w-3.5 h-3.5" />;

    // ─── Internal-only view (cost source, no SP/margin) ───
    if (isInternal) {
        return (
            <div className="space-y-4">
                <h3 className={premium.sectionTitle}>Cost Source</h3>
                <div className={premium.glassCard + " p-5 space-y-4"}>
                    <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-lg border border-slate-200/60">
                        <Package className="w-5 h-5 text-slate-500 shrink-0" />
                        <div>
                            <p className="text-xs font-medium text-slate-600">Internal Inventory Resource</p>
                            <p className="text-[10px] text-slate-400">This item is a cost source for BOMs and service recipes. No selling price or markup required.</p>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400 block mb-1">
                            Cost Price (Normalized CP)
                        </label>
                        <div className={premium.input + " bg-slate-100/50 dark:bg-slate-700/50 cursor-not-allowed opacity-75"}>
                            {currency}{(costPrice || 0).toFixed(4)}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                            {sourceIcon} {costSource?.label || 'Cost per consumption unit'}
                        </p>
                        {costSource?.details && (
                            <p className="text-[9px] text-slate-400 mt-0.5">{costSource.details}</p>
                        )}
                    </div>
                    <div className={premium.metricCard}>
                        <div className={premium.metricLabel}>Normalized CP</div>
                        <div className={premium.metricValue}>{currency}{(costPrice || 0).toFixed(4)}</div>
                        <p className="text-[10px] text-slate-400 mt-1">per consumption unit</p>
                    </div>
                </div>
                <div className="flex items-start gap-2 p-3 bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/50 rounded-lg">
                    <Package className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                        Cost Price is derived from purchases and normalized to the consumption unit. 
                        BOMs and service recipes consume this item at the normalized CP.
                    </p>
                </div>
            </div>
        );
    }

    // ─── Full pricing view (sellable / both) ───
    return (
        <div className="space-y-4">
            <h3 className={premium.sectionTitle}>Pricing</h3>

            <div className={premium.glassCard + " p-5 space-y-4"}>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400 block mb-1">
                            Cost Price (CP)
                        </label>
                        <div className={premium.input + " bg-slate-100/50 dark:bg-slate-700/50 cursor-not-allowed opacity-75"}>
                            {currency}{(costPrice || 0).toFixed(2)}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                            {costSource ? (
                                <>{sourceIcon} {costSource.label}</>
                            ) : (
                                'Calculated from BOM / Smart Pricing'
                            )}
                        </p>
                        {costSource?.details && (
                            <p className="text-[9px] text-slate-400 mt-0.5">{costSource.details}</p>
                        )}
                    </div>
                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400 block mb-1">
                            Selling Price (SP)
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">{currency}</span>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={sellingPrice || ''}
                                onChange={(e) => onSellingPriceChange(parseFloat(e.target.value) || 0)}
                                className={premium.input + " pl-7"}
                                placeholder="0.00"
                                disabled={isSaving}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className={premium.glassCardStrong + " p-5"}>
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 mb-4">
                    Pricing Summary
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className={premium.metricCard}>
                        <div className={premium.metricLabel}>Cost Price</div>
                        <div className={premium.metricValue}>{currency}{(costPrice || 0).toFixed(2)}</div>
                    </div>
                    <div className={premium.metricCard}>
                        <div className={premium.metricLabel}>Selling Price</div>
                        <div className={premium.metricValue}>{currency}{(sellingPrice || 0).toFixed(2)}</div>
                    </div>
                    <div className={premium.metricCard}>
                        <div className={premium.metricLabel}>Profit</div>
                        <div className={premium.metricValue}>{currency}{(profitAmount || 0).toFixed(2)}</div>
                    </div>
                    <div className={premium.metricCard}>
                        <div className={premium.metricLabel}>Markup</div>
                        <div className={`${premium.metricValue} ${marginColor}`}>
                            {(profitMargin || 0).toFixed(1)}%
                        </div>
                    </div>
                </div>

                <div className={premium.divider} />

                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <Info className="w-4 h-4" />
                            Minimum Required Markup
                        </span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {minimumMargin.toFixed(1)}%
                        </span>
                    </div>

                    <div className={`flex items-center justify-between p-3 rounded-lg border ${statusBg}`}>
                        <div className="flex items-center gap-2">
                            {statusIcon}
                            <span className={`font-semibold text-sm ${statusColor}`}>
                                {statusText}
                            </span>
                        </div>
                        <span className={`text-sm font-bold ${marginColor}`}>
                            {(profitMargin || 0).toFixed(1)}%
                        </span>
                    </div>

                    {!valid && sellingPrice > 0 && (
                        <div className="flex items-start gap-2 p-3 bg-amber-50/50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/50 rounded-lg">
                            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                                {message || `The selling price must be at least ${currency}${(costPrice * (1 + minimumMargin / 100)).toFixed(2)} to meet the minimum markup requirement of ${minimumMargin}%.`}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/50 rounded-lg">
                <DollarSign className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <div>
                    <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                        Cost-Driven Pricing
                    </p>
                    <p className="text-[10px] text-blue-500 dark:text-blue-400 mt-0.5">
                        {costSource?.type === 'recipe'
                            ? 'Cost Price is calculated from the Service Recipe. Enter a Selling Price above to see profit and markup.'
                            : costSource?.type === 'bom' || costSource?.type === 'smart_pricing'
                                ? 'Cost Price is calculated from the BOM / Smart Pricing. Enter a Selling Price to see profit and markup.'
                                : 'Cost Price is calculated from the BOM. Enter a Selling Price above to see profit and markup.'
                        }
                        Products below the minimum markup ({minimumMargin}%) cannot be saved.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PricingTab;
