import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { logger } from '@/services/logger';
// PRICING RULE: Do NOT implement pricing logic here. All pricing MUST go through pricingEngine.ts
import { X, CheckCircle, Printer, Usb, Wallet, UserPlus, Save, ArrowRight, Calculator, DollarSign, Tag, ShieldCheck, Plus, Search, Building2, FileText, Clock, Settings, Info, RefreshCw, Layers, Package, Zap } from 'lucide-react';
import { HeldOrder, Sale, Invoice, Item, ProductVariant, BillOfMaterial, WorkOrder, BOMTemplate } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { useFinance } from '../../../context/FinanceContext';
import { useInventory } from '../../../context/InventoryContext';
import { useSales } from '../../../context/SalesContext';
import { DEFAULT_ACCOUNTS, ACCOUNT_IDS } from '../../../constants';
import { hardwareService } from '../../../services/hardwareService';
import { generateAccountNumber, roundFinancial, formatNumber, roundToCurrency } from '../../../utils/helpers';
import { bomService } from '../../../services/bomService';
import { pricingService, DynamicServicePricingResult } from '../../../services/pricingService';
import { dbService } from '../../../services/db';
import { calculateServicePrice } from '../../../utils/pricing/pricingEngine';
import { normalizeStoredPricing, resolveStoredSellingPrice } from '../../../utils/pricing';
import { getPlaceholder } from '../../../constants/placeholders';



// --- Printing Variant Modal ---
export const PrintingVariantModal: React.FC<{
    product: Item;
    bom?: BillOfMaterial;
    materials: Item[];
    onSelect: (variant: any) => void;
    onClose: () => void;
}> = ({ product, bom, materials, onSelect, onClose }) => {
    const { companyConfig, notify } = useAuth(); const { inventory, marketAdjustments } = useInventory();
    const currency = companyConfig.currencySymbol;
    const [bomTemplates, setBomTemplates] = useState<BOMTemplate[]>([]);
    const [attributes, setAttributes] = useState<Record<string, any>>({
        number_of_pages: 1,
        paper_type: 'A4 80g',
        print_mode: 'B/W',
        binding_type: 'None'
    });
    const [pricingState, setPricingState] = useState({
        baseCost: product.cost,
        adjustmentTotal: 0,
        sellingPrice: product.price,
        adjustmentBreakdown: [] as Array<{ name: string; value: number; type: string }>,
        adjustmentSnapshots: [] as Array<{ name: string; type: string; value: number; calculatedAmount: number }>
    });
    const [quantity, setQuantity] = useState(1);

    // Load BOM templates on mount
    useEffect(() => {
        let mounted = true;
        dbService.getAll<BOMTemplate>('bomTemplates')
            .then((templates) => {
                if (mounted) setBomTemplates(templates || []);
            })
            .catch((err) => {
                logger.error('Failed to load BOM templates for variant pricing', err);
            });
        return () => { mounted = false; };
    }, []);

    // Memoize values to prevent infinite loops
    const materialsList = useMemo(() => inventory || materials, [inventory, materials]);
    const adjustmentsList = useMemo(() => marketAdjustments || [], [marketAdjustments]);

    useEffect(() => {
        // Check if parent has Hidden BOM for dynamic pricing
        const hasHiddenBOM = product.smartPricing?.hiddenBOMId || product.smartPricing?.bomTemplateId;

        if (hasHiddenBOM) {
            // Use dynamic variant pricing from pricingService
            const virtualVariant = {
                id: 'virtual',
                productId: product.id,
                sku: product.sku,
                name: product.name,
                attributes: attributes,
                pages: attributes.number_of_pages || 1,
                price: 0,
                cost: 0,
                stock: 0,
                pricingSource: 'dynamic',
                inheritsParentBOM: true
            } as unknown as ProductVariant;

            const result = pricingService.calculateVariantPrice(
                product,
                virtualVariant,
                quantity,
                materialsList,
                bomTemplates,
                adjustmentsList
            );

            setPricingState({
                baseCost: result.cost,
                adjustmentTotal: result.adjustmentTotal,
                sellingPrice: result.price,
                adjustmentBreakdown: result.breakdown,
                adjustmentSnapshots: result.adjustmentSnapshots
            });
        } else if (bom) {
            // Legacy BOM calculation
            const result = bomService.calculateVariantBOM(bom, { attributes } as Record<string, unknown>, materials);
            const cost = roundFinancial(result.totalProductionCost);

            let price = product.price;
            if (bom.priceFormula) {
                price = roundFinancial(bomService.resolveFormula(bom.priceFormula, attributes));
            }

            setPricingState({
                baseCost: cost,
                adjustmentTotal: 0,
                sellingPrice: roundToCurrency(cost),
                adjustmentBreakdown: [],
                adjustmentSnapshots: []
            });
        }
    }, [attributes, bom, materials, product, quantity, materialsList, adjustmentsList]);

    const handleAttributeChange = (key: string, value: any) => {
        setAttributes(prev => ({ ...prev, [key]: value }));
    };

    const handleConfirm = () => {
        const variantName = `${product.name} (${Object.entries(attributes).map(([k, v]) => `${k}: ${v}`).join(', ')})`;
        const virtualVariant = {
            ...product,
            id: `${product.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            parentId: product.id,
            name: variantName,
            attributes: attributes,
            quantity: quantity,
            price: pricingState.sellingPrice,
            cost: pricingState.baseCost,
            adjustmentTotal: pricingState.adjustmentTotal,
            adjustmentSnapshots: pricingState.adjustmentSnapshots,
            pagesOverride: attributes.number_of_pages // Pass through for transactionService
        };
        onSelect(virtualVariant);
    };

    return (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-[2px]">
            <div className="bg-white rounded shadow-2xl w-full max-w-lg overflow-hidden border border-[#d4d7dc]">
                <div className="px-6 py-4 border-b border-[#d4d7dc] flex justify-between items-center bg-[#f4f5f8]">
                    <h2 className="text-sm font-bold text-[#393a3d] uppercase tracking-wider">Configure {product.name}</h2>
                    <button onClick={onClose} className="text-[#8d9096] hover:text-[#d52b1e]" title="Close" aria-label="Close product configuration"><X size={20} /></button>
                </div>
                <div className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[11px] font-bold text-[#6b6c7f] uppercase tracking-wider mb-1.5">Number of Pages</label>
                            <input
                                type="number"
                                className="w-full p-2 border border-[#babec5] rounded text-sm focus:border-[#0077c5] outline-none"
                                placeholder="e.g. 5"
                                onChange={e => handleAttributeChange('number_of_pages', parseInt(e.target.value))}
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-[#6b6c7f] uppercase tracking-wider mb-1.5">Paper Type</label>
                            <select
                                className="w-full p-2 border border-[#babec5] rounded text-sm focus:border-[#0077c5] outline-none"
                                onChange={e => handleAttributeChange('paper_type', e.target.value)}
                            >
                                <option value="">Select...</option>
                                <option value="A4 80g">A4 80g</option>
                                <option value="A4 100g">A4 100g</option>
                                <option value="A3 80g">A3 80g</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-[#6b6c7f] uppercase tracking-wider mb-1.5">Quantity</label>
                            <input
                                type="number"
                                className="w-full p-2 border border-[#babec5] rounded text-sm font-bold focus:border-[#0077c5] outline-none"
                                value={quantity}
                                onChange={e => setQuantity(parseInt(e.target.value))}
                            />
                        </div>
                    </div>

                    <div className="bg-[#f4f5f8] p-6 rounded border border-[#d4d7dc] space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-[11px] font-bold text-[#6b6c7f] uppercase">Unit Price</span>
                            <span className="text-sm font-bold text-[#393a3d]">{currency}{pricingState.sellingPrice.toLocaleString()}</span>
                        </div>
                        <div className="pt-3 border-t border-[#d4d7dc] flex justify-between items-center">
                            <span className="text-xs font-bold text-[#393a3d] uppercase">Total Amount</span>
                            <span className="text-xl font-bold text-[#0077c5]">{currency}{(pricingState.sellingPrice * quantity).toLocaleString()}</span>
                        </div>
                    </div>

                    <button
                        onClick={handleConfirm}
                        className="w-full py-3.5 bg-[#2ca01c] text-white rounded-full font-bold text-sm hover:bg-[#248217] transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                        Add to Order <ArrowRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Dynamic Service Calculator Modal ---
export const ServiceCalculatorModal: React.FC<{
    service: Item;
    currencySymbol: string;
    initialPages?: number;
    initialCopies?: number;
    onConfirm: (pricing: DynamicServicePricingResult) => void;
    onClose: () => void;
}> = ({ service, currencySymbol, initialPages = 1, initialCopies = 1, onConfirm, onClose }) => {
    const { companyConfig } = useAuth(); const { inventory = [], marketAdjustments = [] } = useInventory();
    const [pages, setPages] = useState(Math.max(1, Number(initialPages) || 1));
    const [copies, setCopies] = useState(Math.max(1, Number(initialCopies) || 1));
    const [isCalculating, setIsCalculating] = useState(false);
    const [enginePricing, setEnginePricing] = useState<DynamicServicePricingResult | null>(null);
    const [finishingCostOverrides, setFinishingCostOverrides] = useState<Record<string, number>>({});

    const sp = service.smartPricing;
    const config = service.serviceConfig;
    const hasSmartPricing = !!sp;

    const [enabledFinishing, setEnabledFinishing] = useState<string[]>(() =>
        (sp?.finishingEnabled || []) as string[]
    );

    useEffect(() => {
        let mounted = true;
        dbService.getSetting<Record<string, number>>('finishingOptionCosts')
            .then((savedCosts) => {
                if (!mounted) return;
                setFinishingCostOverrides(savedCosts || {});
            })
            .catch(() => {
                if (!mounted) return;
                setFinishingCostOverrides({});
            });
        return () => { mounted = false; };
    }, []);

    const paper = useMemo(() => sp ? inventory.find((i: any) => i.id === sp.paperItemId) : null, [sp, inventory]);
    const toner = useMemo(() => sp ? inventory.find((i: any) => i.id === sp.tonerItemId) : null, [sp, inventory]);

    const normalizedAdjustments = useMemo(() => {
        return (marketAdjustments || [])
            .filter((adj: any) => {
                const isActive = adj.active ?? adj.isActive;
                const categoryMatch = !adj.applyToCategories || adj.applyToCategories.length === 0 || adj.applyToCategories.includes(service.category);
                return isActive && categoryMatch;
            })
            .map((adj: any) => ({
                name: adj.name,
                type: adj.type,
                value: adj.value,
                percentage: adj.percentage ?? adj.value,
                calculatedAmount: adj.value,
                adjustmentId: adj.id,
                isActive: true
            }));
    }, [marketAdjustments, service.category]);

    const getFinishingName = useCallback((id: string): string => {
        const configOptions = companyConfig?.productionSettings?.finishingOptions || [];
        const found = configOptions.find((o: any) => o.id === id);
        if (found) return found.name;
        const names: Record<string, string> = {
            binding: 'Binding', coverPages: 'Cover Pages', cutting: 'Cutting & Trimming',
            holePunch: 'Hole Punching', folding: 'Folding', stapling: 'Stapling',
        };
        return names[id] || id;
    }, [companyConfig]);

    const resolveFinishingCost = useCallback((id: string, pageCount: number, copyCount: number): number => {
        if (!sp) return 0;
        const savedFinishingSelections = Array.isArray(sp.finishingSelections) ? sp.finishingSelections : [];
        const savedFinishingCostMap = (sp.finishingOptionCosts || {}) as Record<string, number>;
        const enabledFinishingIds = ((sp.finishingEnabled || []) as string[]);
        const savedCopies = Math.max(1, Number(sp.copies) || 1);
        const savedFinishingFallbackPerOption = enabledFinishingIds.length > 0 && Number(sp.finishingCost) > 0
            ? (Number(sp.finishingCost) / (enabledFinishingIds.length * savedCopies))
            : 0;
        const defaultFinishingCosts: Record<string, number> = {
            binding: 150, coverPages: 20, cutting: 30, holePunch: 20, folding: 15, stapling: 10
        };
        const selection = savedFinishingSelections.find((option: any) => option?.id === id);
        const configuredOption = companyConfig?.productionSettings?.finishingOptions?.find((option: any) => option?.id === id);
        const configuredCost = Number(
            selection?.price ?? savedFinishingCostMap[id] ?? finishingCostOverrides[id] ?? configuredOption?.price
        ) || 0;
        return configuredCost > 0
            ? configuredCost
            : (savedFinishingFallbackPerOption > 0 ? savedFinishingFallbackPerOption : (defaultFinishingCosts[id] || 0));
    }, [sp, companyConfig, finishingCostOverrides]);

    const costBreakdown = useMemo(() => {
        let paperCost = 0;
        let sheetsPerCopy = 0;
        let totalSheets = 0;
        let costPerSheet = 0;
        if (paper && sp) {
            sheetsPerCopy = Math.ceil(pages / 2);
            totalSheets = sheetsPerCopy * copies;
            const reamSize = Number(paper.conversionRate || paper.conversion_rate || 500);
            const paperUnitCost = Number(paper.cost_price || paper.cost_per_unit || paper.cost || 0);
            costPerSheet = reamSize > 0 ? paperUnitCost / reamSize : 0;
            paperCost = Number((totalSheets * costPerSheet).toFixed(2));
        }

        let tonerCost = 0;
        let tonerCostPerPage = 0;
        if (toner && sp) {
            const capacity = 20000;
            const totalPagesVal = pages * copies;
            const tonerUnitCost = Number(toner.cost_price || toner.cost_per_unit || toner.cost || 0);
            tonerCostPerPage = tonerUnitCost / capacity;
            tonerCost = Number((totalPagesVal * tonerCostPerPage).toFixed(2));
        }

        let finishingCost = 0;
        const finishingDetails: { id: string; name: string; cost: number; total: number }[] = [];
        if (sp) {
            enabledFinishing.forEach((id) => {
                const optionCost = resolveFinishingCost(id, pages, copies);
                finishingDetails.push({
                    id,
                    name: getFinishingName(id),
                    cost: optionCost,
                    total: Number((optionCost * copies).toFixed(2)),
                });
                finishingCost += optionCost * copies;
            });
        }
        finishingCost = Number(finishingCost.toFixed(2));

        const baseCost = Number((paperCost + tonerCost + finishingCost).toFixed(2));
        return { paperCost, tonerCost, finishingCost, baseCost, sheetsPerCopy, totalSheets, costPerSheet, tonerCostPerPage, finishingDetails };
    }, [pages, copies, paper, toner, sp, enabledFinishing, resolveFinishingCost, getFinishingName]);

    const computePageScaledCost = useCallback((pageCount: number, copyCount: number): number => {
        if (sp) {
            const savedPages = Math.max(1, Number(sp.pages) || 1);
            const savedCopies = Math.max(1, Number(sp.copies) || 1);
            const savedBaseCost = Number(sp.baseCost) || 0;
            if (savedBaseCost > 0 && savedPages === pageCount && savedCopies === copyCount) {
                return savedBaseCost;
            }
            let paperCostVal = 0;
            const paperItem = inventory.find((i: any) => i.id === sp.paperItemId);
            if (paperItem) {
                const sPerCopy = Math.ceil(pageCount / 2);
                const tSheets = sPerCopy * copyCount;
                const rSize = Number(paperItem.conversionRate || paperItem.conversion_rate || 500);
                const pCost = Number(paperItem.cost_price || paperItem.cost_per_unit || paperItem.cost || 0);
                const cPerSheet = rSize > 0 ? pCost / rSize : 0;
                paperCostVal = Number((tSheets * cPerSheet).toFixed(2));
            }
            let tonerCostVal = 0;
            const tonerItem = inventory.find((i: any) => i.id === sp.tonerItemId);
            if (tonerItem) {
                const capacity = 20000;
                const totalPagesVal = pageCount * copyCount;
                const tCost = Number(tonerItem.cost_price || tonerItem.cost_per_unit || tonerItem.cost || 0);
                tonerCostVal = Number((totalPagesVal * (tCost / capacity)).toFixed(2));
            }

            const finishingCostVal = enabledFinishing.reduce((sum: number, id: string) => {
                const optionCost = resolveFinishingCost(id, pageCount, copyCount);
                return sum + (optionCost * copyCount);
            }, 0);

            return Number((paperCostVal + tonerCostVal + finishingCostVal).toFixed(2));
        }
        const flatCostPerCopy = config?.baseLaborCost || config?.baseRate || service.cost || 0;
        const baselinePages = Number(service.pages) || 1;
        const scaledCostPerCopy = flatCostPerCopy * (pageCount / baselinePages);
        return scaledCostPerCopy * copyCount;
    }, [service, inventory, config, sp, enabledFinishing, resolveFinishingCost]);

    useEffect(() => {
        let mounted = true;
        const calculate = async () => {
            setIsCalculating(true);
            try {
                const baseCost = computePageScaledCost(pages, copies);

                const result = await calculateServicePrice({
                    itemId: service.id,
                    categoryId: service.category,
                    baseCost: baseCost,
                    basePrice: undefined,
                    pages: pages,
                    copies: copies,
                    adjustments: normalizedAdjustments,
                    context: 'SERVICE'
                });

                if (mounted) {
                    const totalPages = pages * copies;
                    const unitCostPerCopy = copies > 0 ? roundToCurrency(baseCost / copies) : baseCost;
                    const unitCostPerPage = totalPages > 0 ? roundToCurrency(baseCost / totalPages) : baseCost;
                    const unitPricePerPage = totalPages > 0 ? roundToCurrency(result.unitPrice / totalPages) : result.unitPrice;

                    const transformed: DynamicServicePricingResult = {
                        pages,
                        copies,
                        totalPages,
                        unitCostPerCopy,
                        unitPricePerCopy: result.unitPrice,
                        unitCostPerPage,
                        unitPricePerPage,
                        totalCost: baseCost,
                        totalPrice: result.totalPrice,
                        calculatedTotalPrice: result.totalPrice,
                        adjustmentTotal: result.adjustmentTotal,
                        adjustmentSnapshots: result.adjustmentSnapshots,
                        marginAmount: result.marginAmount,
                        rounding_difference: result.roundingDifference,
                        components: [],
                        serviceDetails: {
                            pages,
                            copies,
                            totalPages,
                            unitCostPerPage,
                            unitPricePerPage,
                            unitCostPerCopy,
                            unitPricePerCopy: result.unitPrice,
                            totalCost: baseCost,
                            totalPrice: result.totalPrice,
                            calculatedTotalPrice: result.totalPrice,
                            materials: [],
                            adjustments: []
                        }
                    };
                    setEnginePricing(transformed);
                }
            } catch (err) {
                logger.error('[ServiceCalculatorModal] Pricing engine error:', err);
            } finally {
                if (mounted) setIsCalculating(false);
            }
        };

        calculate();
        return () => { mounted = false; };
    }, [service, pages, copies, normalizedAdjustments, computePageScaledCost]);

    const activePricing = enginePricing;
    const formatCurrency = (value: number) => `${currencySymbol}${formatNumber(value)}`;
    const marginBaseAmount = roundToCurrency(
        Number(activePricing?.totalCost || 0)
        + Math.max(0, Number(activePricing?.adjustmentTotal || 0) - Number(activePricing?.marginAmount || 0))
    );
    const effectiveMarginPercent = marginBaseAmount > 0
        ? roundToCurrency((Number(activePricing?.marginAmount || 0) / marginBaseAmount) * 100)
        : 0;
    const formatPercent = (value: number) => `${Number(value.toFixed(1)).toString()}%`;

    const premiumCard = 'backdrop-blur-sm border border-slate-200/80 rounded-xl p-4 transition-all duration-200';
    const premiumInput = 'w-full px-3 py-2 bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-xl text-[13px] font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all tabular-nums';

    if (!activePricing) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/40">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 flex flex-col animate-in fade-in zoom-in-95 duration-200 font-sans" style={{ fontFamily: "'Inter',sans-serif", fontSize: 13.5, lineHeight: 1.45 }}>
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/10">
                                <Calculator size={16} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-[15px] font-bold text-white leading-snug">Service Configuration</h2>
                                <p className="text-[11px] text-slate-400 font-medium">{service.name}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white">
                            <X size={18} />
                        </button>
                    </div>
                    <div className="flex gap-2 mt-3">
                        <div className="flex-1">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                                <FileText size={11} /> Pages
                            </label>
                            <input type="number" min={1} step={1} value={pages}
                                onChange={e => setPages(Math.max(1, parseInt(e.target.value || '1', 10) || 1))}
                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-[13px] font-bold text-white focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 outline-none transition-all tabular-nums placeholder-slate-500" />
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                                <Layers size={11} /> Copies
                            </label>
                            <input type="number" min={1} value={copies}
                                onChange={e => setCopies(Math.max(1, parseInt(e.target.value || '1', 10) || 1))}
                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-[13px] font-bold text-white focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 outline-none transition-all tabular-nums placeholder-slate-500" />
                        </div>
                    </div>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1" style={{ background: '#F8FAFC' }}>
                    {/* Paper & Toner */}
                    {hasSmartPricing && (
                        <div className="grid grid-cols-2 gap-3">
                            <div className={`${premiumCard} bg-white`}>
                                <div className="flex items-center gap-2 text-indigo-700 mb-2">
                                    <Package size={13} />
                                    <span className="text-[11px] font-bold uppercase tracking-wider">Paper</span>
                                </div>
                                {paper ? (
                                    <div>
                                        <p className="text-[13px] font-semibold text-slate-800 truncate">{paper.name}</p>
                                        <p className="text-[10px] text-slate-500 mt-0.5">
                                            {formatCurrency(costBreakdown.costPerSheet)} / sheet · {costBreakdown.totalSheets} sheets
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-[12px] text-slate-400 italic">No paper configured</p>
                                )}
                            </div>
                            <div className={`${premiumCard} bg-white`}>
                                <div className="flex items-center gap-2 text-indigo-700 mb-2">
                                    <Printer size={13} />
                                    <span className="text-[11px] font-bold uppercase tracking-wider">Toner</span>
                                </div>
                                {toner ? (
                                    <div>
                                        <p className="text-[13px] font-semibold text-slate-800 truncate">{toner.name}</p>
                                        <p className="text-[10px] text-slate-500 mt-0.5">
                                            {formatCurrency(costBreakdown.tonerCostPerPage)} / page
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-[12px] text-slate-400 italic">No toner configured</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Finishing Options */}
                    {hasSmartPricing && costBreakdown.finishingDetails.length > 0 && (
                        <div className={`${premiumCard} bg-white`}>
                            <div className="flex items-center gap-2 text-slate-700 mb-3">
                                <Zap size={13} />
                                <span className="text-[11px] font-bold uppercase tracking-wider">Finishing Options</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {costBreakdown.finishingDetails.map(fd => {
                                    const isOn = enabledFinishing.includes(fd.id);
                                    return (
                                        <button key={fd.id} type="button" onClick={() => {
                                            setEnabledFinishing(prev =>
                                                prev.includes(fd.id) ? prev.filter(id => id !== fd.id) : [...prev, fd.id]
                                            );
                                        }}
                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border-2 transition-all ${
                                                isOn
                                                    ? 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-sm'
                                                    : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                                            }`}>
                                            <div className={`w-2 h-2 rounded-full ${isOn ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                                            {fd.name}
                                            <span className={`text-[10px] ${isOn ? 'text-indigo-500' : 'text-slate-400'}`}>
                                                {formatCurrency(fd.cost)}/copy
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Cost Breakdown */}
                    <div className={`${premiumCard} bg-white shadow-md border border-slate-200`}>
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Calculator size={13} /> Cost Breakdown
                            </span>
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded-md border border-emerald-200">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                <span className="text-[10px] font-semibold text-emerald-700">Live</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {hasSmartPricing && (
                                <>
                                    <div className="flex justify-between items-center py-1">
                                        <span className="text-[12px] text-slate-600">Paper Cost</span>
                                        <span className="text-[12px] font-semibold text-slate-800 tabular-nums">{formatCurrency(costBreakdown.paperCost)}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1">
                                        <span className="text-[12px] text-slate-600">Toner Cost</span>
                                        <span className="text-[12px] font-semibold text-slate-800 tabular-nums">{formatCurrency(costBreakdown.tonerCost)}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1">
                                        <span className="text-[12px] text-slate-600">Finishing Cost</span>
                                        <span className="text-[12px] font-semibold text-slate-800 tabular-nums">{formatCurrency(costBreakdown.finishingCost)}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1.5 border-t border-slate-100">
                                        <span className="text-[13px] font-semibold text-slate-700">Base Cost</span>
                                        <span className="text-[13px] font-bold text-slate-800 tabular-nums">{formatCurrency(costBreakdown.baseCost)}</span>
                                    </div>
                                </>
                            )}
                            {!hasSmartPricing && (
                                <div className="flex justify-between items-center py-1">
                                    <span className="text-[12px] text-slate-600">Base Rate</span>
                                    <span className="text-[12px] font-semibold text-slate-800 tabular-nums">{formatCurrency(activePricing.totalCost)}</span>
                                </div>
                            )}

                            {activePricing.adjustmentSnapshots && activePricing.adjustmentSnapshots.length > 0 && (
                                activePricing.adjustmentSnapshots
                                    .filter((adj: any) => adj.name?.toLowerCase().includes('margin') ? false : true)
                                    .map((adj: any, i: number) => (
                                        <div key={i} className="flex justify-between items-center py-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[12px] text-emerald-700">{adj.name}</span>
                                                {adj.type === 'PERCENTAGE' && (
                                                    <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded font-semibold">+{adj.value}%</span>
                                                )}
                                            </div>
                                            <span className="text-[12px] font-semibold text-emerald-700 tabular-nums">+{formatCurrency(adj.calculatedAmount)}</span>
                                        </div>
                                    ))
                            )}

                            {activePricing.marginAmount > 0 && activePricing.unitCostPerCopy > 0 && (
                                <div className="flex justify-between items-center py-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[12px] text-blue-700">Profit Margin</span>
                                        <span className="text-[9px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded font-semibold">
                                            +{formatPercent(effectiveMarginPercent)}
                                        </span>
                                    </div>
                                    <span className="text-[12px] font-semibold text-blue-700 tabular-nums">+{formatCurrency(activePricing.marginAmount)}</span>
                                </div>
                            )}

                            {(activePricing.rounding_difference || 0) !== 0 && (
                                <div className="flex justify-between items-center py-1">
                                    <span className="text-[12px] text-slate-500">Round Up</span>
                                    <span className="text-[12px] font-medium text-slate-500 tabular-nums">
                                        +{formatCurrency(activePricing.rounding_difference * activePricing.copies)}
                                    </span>
                                </div>
                            )}

                            <div className="pt-2.5 border-t border-slate-200 flex justify-between items-center">
                                <span className="text-[14px] font-bold text-slate-800">Total Price</span>
                                <span className="text-[18px] font-bold text-indigo-600 tabular-nums">{formatCurrency(activePricing.totalPrice)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Total Due */}
                    <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 rounded-xl p-4">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full -translate-y-1/3 translate-x-1/3"></div>
                        <div className="relative flex justify-between items-end">
                            <div>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Total Due</p>
                                <h3 className="text-[24px] font-bold text-white tabular-nums">{formatCurrency(activePricing.totalPrice)}</h3>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                    {formatCurrency(activePricing.unitPricePerCopy)} / copy
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] font-medium text-slate-400">Total Pages</div>
                                <div className="text-[14px] font-bold text-white tabular-nums">{activePricing.totalPages} <span className="text-[10px] text-slate-400 font-normal">pgs</span></div>
                                <div className="text-[10px] text-slate-500 mt-0.5">{Math.ceil(pages / 2) * copies} sheets</div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                        <button onClick={onClose}
                            className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-semibold text-[13px] hover:bg-slate-50 transition-all active:scale-[0.98] shadow-sm">
                            Cancel
                        </button>
                        <button onClick={() => onConfirm({
                            ...activePricing,
                            priceLocked: true,
                            lockedTotalPrice: activePricing.totalPrice,
                            lockedUnitPricePerCopy: activePricing.unitPricePerCopy,
                            lockedUnitCostPerCopy: activePricing.unitCostPerCopy
                        })}
                            className="flex-[1.5] py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold text-[13px] hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5">
                            Add to Order <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Customer Modal ---
export const CustomerModal: React.FC<{
    onSelect: (name: string) => void;
    onClose: () => void;
}> = ({ onSelect, onClose }) => {
    const { companyConfig, notify } = useAuth(); const { invoices } = useFinance(); const { customers } = useSales();
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCustomerContact, setNewCustomerContact] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const customerNames = useMemo(() => {
        const names = new Set<string>();
        customers?.forEach(c => {
            if (c.name) names.add(c.name);
        });
        invoices?.forEach(inv => {
            if (inv.customerName) names.add(inv.customerName);
        });
        return Array.from(names).sort();
    }, [invoices, customers]);

    const filteredCustomerNames = useMemo(() => {
        if (!searchTerm.trim()) return customerNames;
        const term = searchTerm.trim().toLowerCase();
        return customerNames.filter(name => name.toLowerCase().includes(term));
    }, [customerNames, searchTerm]);

    const handleQuickAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCustomerName) return;

        onSelect(newCustomerName);
        notify(`Customer ${newCustomerName} selected`, 'success');
        onClose();
    };

    return (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-[2px]">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden border border-slate-200 font-sans leading-relaxed">
                <div className="px-4 py-2.5 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
                    <h2 className="text-[20px] font-semibold text-slate-800">Select Customer</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title="Close" aria-label="Close customer selection"><X size={18} /></button>
                </div>

                <div className="px-4 py-2 bg-white border-b border-slate-200 shrink-0">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Search customers..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-[13px] text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white leading-relaxed"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex justify-between items-center shrink-0">
                    <p className="text-[12px] font-medium text-slate-500 uppercase tracking-wider">Accounts</p>
                    <button
                        onClick={() => setShowQuickAdd(!showQuickAdd)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all ${showQuickAdd ? 'bg-slate-100 text-slate-700 border border-slate-200' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                    >
                        {showQuickAdd ? <X size={14} /> : <UserPlus size={14} />}
                        {showQuickAdd ? 'Cancel' : 'New Customer'}
                    </button>
                </div>

                {showQuickAdd && (
                    <form onSubmit={handleQuickAdd} className="p-4 bg-slate-50 border-b border-slate-200 animate-in slide-in-from-top-2 shrink-0">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="space-y-1">
                                <label className="block text-[12px] font-medium text-slate-500">Full Name *</label>
                                <input
                                    className="w-full p-2 border border-slate-300 rounded-lg text-[13px] text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white leading-relaxed"
                                    placeholder="e.g. Acme Printing"
                                    value={newCustomerName}
                                    onChange={e => setNewCustomerName(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[12px] font-medium text-slate-500">Contact info</label>
                                <input
                                    className="w-full p-2 border border-slate-300 rounded-lg text-[13px] text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white leading-relaxed"
                                    placeholder="Phone or Email"
                                    value={newCustomerContact}
                                    onChange={e => setNewCustomerContact(e.target.value)}
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={!newCustomerName}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-[12px] font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
                        >
                            <Save size={14} /> Save and Select
                        </button>
                    </form>
                )}

                <div className="overflow-y-auto flex-1 divide-y divide-slate-100 custom-scrollbar">
                    {filteredCustomerNames.length === 0 ? (
                        <div className="px-6 py-10 text-center text-[13px] text-slate-400 leading-relaxed">
                            {searchTerm ? `No customers matching "${searchTerm}"` : 'No customers found'}
                        </div>
                    ) : filteredCustomerNames.map(name => {
                        const custInvoices = invoices.filter(i => i.customerName === name && i.status !== 'Paid' && i.status !== 'Draft');
                        const custDebt = custInvoices.reduce((sum, i) => sum + (i.totalAmount - (i.paidAmount || 0)), 0);

                        return (
                            <button key={name} onClick={() => onSelect(name)} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex justify-between items-center transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-semibold text-[13px] group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                                        {name.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-medium text-slate-800 text-[13.5px] leading-snug truncate">{name}</div>
                                    </div>
                                </div>
                                <div className="text-right shrink-0 ml-4">
                                    <div className={`font-medium text-[13px] tabular-nums leading-snug ${custDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {companyConfig.currencySymbol}{custDebt.toLocaleString()}
                                    </div>
                                    <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">
                                        {custDebt > 0 ? 'Due' : 'Clear'}
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

// --- Held Orders Modal ---
export const HeldOrdersModal: React.FC<{
    orders: HeldOrder[];
    onRetrieve: (o: HeldOrder) => void;
    onClose: () => void;
}> = ({ orders, onRetrieve, onClose }) => (
    <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-[2px]">
        <div className="bg-white rounded shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col border border-[#d4d7dc]">
            <div className="px-6 py-4 border-b border-[#d4d7dc] flex justify-between items-center bg-[#f4f5f8]">
                <h2 className="text-sm font-bold text-[#393a3d] uppercase tracking-wider">Parked Orders</h2>
                <button onClick={onClose} className="text-[#8d9096] hover:text-[#d52b1e]" title="Close" aria-label="Close parked orders"><X size={20} /></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 divide-y divide-[#f4f5f8] custom-scrollbar">
                {orders.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-[#8d9096]">
                        <Clock size={48} className="mb-4 opacity-20" />
                        <p className="text-sm font-medium">No parked orders found</p>
                    </div>
                )}
                {orders.map(order => (
                    <div key={order.id} className="px-6 py-5 flex justify-between items-center hover:bg-[#f4f5f8] transition-all group">
                        <div className="space-y-1">
                            <div className="font-bold text-[#393a3d]">{order.customerName}</div>
                            <div className="text-xs text-[#6b6c7f] flex items-center gap-3">
                                <span>{new Date(order.date).toLocaleString()}</span>
                                <span className="w-1 h-1 bg-[#d4d7dc] rounded-full"></span>
                                <span>{order.items.length} items</span>
                            </div>
                            {order.note && <div className="text-xs text-[#6b6c7f] italic">Note: {order.note}</div>}
                        </div>
                        <button onClick={() => onRetrieve(order)} className="bg-white border border-[#babec5] text-[#393a3d] px-6 py-2 rounded-full font-bold text-xs hover:bg-[#eceef1] hover:border-[#8d9096] transition-all">
                            Retrieve
                        </button>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

// --- Returns Modal ---
export const ReturnsModal: React.FC<{
    sales: Sale[];
    onProcess: (saleId: string, items: any[], accountId: string) => void;
    onClose: () => void;
}> = ({ sales, onProcess, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [returnItems, setReturnItems] = useState<{ itemId: string, qty: number }[]>([]);
    const [refundAccountId, setRefundAccountId] = useState(ACCOUNT_IDS.CASH_DRAWER); // Default to Cash Account

    const cashBankAccounts = useMemo(() =>
        DEFAULT_ACCOUNTS.filter(acc => [ACCOUNT_IDS.CASH_DRAWER, ACCOUNT_IDS.BANK, ACCOUNT_IDS.MOBILE_MONEY].includes(acc.id)),
        []);

    const handleSearch = () => {
        const sale = sales.find(s => s.id === searchTerm);
        if (sale) setSelectedSale(sale); else alert("Sale not found");
    };

    const toggleItem = (itemId: string, max: number) => {
        setReturnItems(prev => {
            if (prev.find(i => i.itemId === itemId)) return prev.filter(i => i.itemId !== itemId);
            return [...prev, { itemId, qty: max }];
        });
    };

    return (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-[2px]">
            <div className="bg-white rounded shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col border border-[#d4d7dc]">
                <div className="px-6 py-4 border-b border-[#d4d7dc] flex justify-between items-center bg-[#f4f5f8]">
                    <h2 className="text-sm font-bold text-[#393a3d] uppercase tracking-wider">Process Return</h2>
                    <button onClick={onClose} className="text-[#8d9096] hover:text-[#d52b1e]" title="Close" aria-label="Close return process"><X size={20} /></button>
                </div>
                <div className="p-6 bg-white border-b border-[#d4d7dc]">
                    <div className="flex gap-3 max-w-lg">
                        <input
                            type="text"
                            placeholder="e.g. REC-1234"
                            className="flex-1 p-2.5 border border-[#babec5] rounded text-sm focus:border-[#0077c5] outline-none"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <button onClick={handleSearch} className="bg-[#0077c5] text-white px-6 rounded-full text-xs font-bold hover:bg-[#005da3]">Search</button>
                    </div>
                </div>
                <div className="p-2 overflow-y-auto flex-1 divide-y divide-[#f4f5f8] custom-scrollbar">
                    {selectedSale ? (
                        <div className="p-4 space-y-2">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-[11px] font-bold text-[#6b6c7f] uppercase tracking-wider">Select items to refund</p>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">POS Sale</span>
                            </div>
                            {selectedSale.items.map(item => (
                                <div key={item.id} className="flex items-center justify-between p-4 hover:bg-[#f4f5f8] rounded transition-all cursor-pointer group" onClick={() => toggleItem(item.id, item.quantity)}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-5 h-5 border rounded flex items-center justify-center transition-all ${returnItems.some(r => r.itemId === item.id) ? 'bg-[#0077c5] border-[#0077c5] text-white' : 'border-[#babec5] bg-white group-hover:border-[#8d9096]'}`}>
                                            {returnItems.some(r => r.itemId === item.id) && <CheckCircle size={14} />}
                                        </div>
                                        <div>
                                            <div className="font-bold text-[#393a3d] text-sm">{item.name}</div>
                                            <div className="text-[11px] text-[#6b6c7f]">{item.quantity} units @ ${item.price}</div>
                                        </div>
                                    </div>
                                    <div className="font-bold text-[#393a3d]">${formatNumber(item.quantity * item.price)}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-[#8d9096]">
                            <Search size={48} className="mb-4 opacity-20" />
                            <p className="text-sm font-medium">Search for a sale to begin refund</p>
                        </div>
                    )}
                </div>
                <div className="p-6 bg-[#f4f5f8] border-t border-[#d4d7dc] flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black text-[#6b6c7f] uppercase mb-1">Pay Refund From</label>
                            <select
                                value={refundAccountId}
                                onChange={(e) => setRefundAccountId(e.target.value)}
                                className="p-2 border border-[#babec5] rounded text-sm bg-white font-bold text-[#393a3d] focus:border-[#0077c5] outline-none min-w-[200px]"
                            >
                                {cashBankAccounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <button
                        onClick={() => selectedSale && onProcess(selectedSale.id, returnItems, refundAccountId)}
                        disabled={returnItems.length === 0}
                        className="bg-[#d52b1e] text-white px-10 py-3 rounded-full font-bold text-sm uppercase tracking-wider disabled:opacity-50 shadow-sm hover:bg-[#b9251a] transition-all"
                    >
                        Complete Refund
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Variant Selector Modal ---
export const VariantSelectorModal: React.FC<{
    product: Item;
    onSelect: (variant: ProductVariant) => void;
    onClose: () => void;
}> = ({ product, onSelect, onClose }) => {
    const { companyConfig } = useAuth();
    const currency = companyConfig.currencySymbol;
    const [quantity, setQuantity] = useState(1);

    const isStationery = product.type === 'Stationery' || product.type === 'Product';

    // For products with existing variants, we also skip the configure step
    // Users should set the correct pages/price when creating variants in inventory
    const shouldSkipConfigure = isStationery || (product.variants && product.variants.length > 0);

    const handleVariantClick = (v: ProductVariant) => {
        // Directly select the variant without configure step for stationery/products with variants
        onSelect({ ...normalizeStoredPricing(v as unknown as Record<string, unknown>), quantity } as unknown as ProductVariant);
    };

    return (
        <div className="absolute inset-0 z-[70] bg-black/60 flex items-center justify-center p-4 backdrop-blur-[2px]">
            <div className="bg-white rounded shadow-2xl w-full max-w-lg max-h-[75vh] flex flex-col overflow-hidden border border-[#d4d7dc]">
                <div className="px-6 py-4 border-b border-[#d4d7dc] flex justify-between items-center bg-[#f4f5f8]">
                    <div>
                        <h2 className="text-sm font-bold text-[#393a3d] uppercase tracking-wider">
                            Select Variant
                        </h2>
                        <p className="text-[10px] text-[#6b6c7f] font-medium">{product.name}</p>
                    </div>
                    <button onClick={onClose} className="text-[#8d9096] hover:text-[#d52b1e]" title="Close" aria-label="Close variant selection"><X size={20} /></button>
                </div>

                {/* Quantity Selector */}
                <div className="px-6 py-3 bg-white border-b border-[#f4f5f8] flex items-center justify-between">
                    <label className="text-xs font-bold text-[#6b6c7f] uppercase tracking-wider">Quantity to Add</label>
                    <div className="w-32">
                        <input
                            type="number"
                            min="1"
                            className="w-full p-2 border border-[#babec5] rounded text-sm font-bold focus:border-[#0077c5] outline-none text-right"
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        />
                    </div>
                </div>

                <div className="p-2 overflow-y-auto flex-1 divide-y divide-[#f4f5f8] custom-scrollbar">
                    {product.variants?.map(v => (
                        <button
                            key={v.id}
                            onClick={() => handleVariantClick(v)}
                            className="w-full text-left px-6 py-4 hover:bg-[#f4f5f8] flex justify-between items-center transition-all group"
                        >
                            <div className="flex-1">
                                <div className="font-bold text-[#393a3d] text-sm">{v.name}</div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {Object.entries(v.attributes || {}).map(([key, val]) => (
                                        <span key={key} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#eceef1] text-[#6b6c7f] uppercase">
                                            {key.replace(/_/g, ' ')}: {String(val)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="text-right ml-4">
                                <div className="text-sm font-bold text-[#0077c5]">{currency}{formatNumber(resolveStoredSellingPrice(v))}</div>
                                {(product.type === 'Stationery' || product.type === 'Material' || product.type === 'Raw Material' || product.type === 'Product') && v.stock > 0 && (
                                    <div className="text-[10px] font-medium text-[#6b6c7f]">
                                        {v.stock} in stock
                                    </div>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
