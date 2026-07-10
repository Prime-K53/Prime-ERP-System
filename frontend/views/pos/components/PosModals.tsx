import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { logger } from '@/services/logger';
// PRICING RULE: Do NOT implement pricing logic here. All pricing MUST go through pricingEngine.ts
import { X, CheckCircle, Printer, Usb, Wallet, UserPlus, Save, ArrowRight, Plus, Search, Clock, Info, AlertTriangle } from 'lucide-react';
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

            const finishingCost = (result.breakdown || []).reduce((sum, item: any) => sum + (Number(item.amount) || 0), 0);

            setPricingState({
                baseCost: result.cost + finishingCost,
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
                        className="w-full py-3.5 bg-blue-600 text-white rounded-full font-bold text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                        Add to Order <ArrowRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Dynamic Service Calculator Modal ---
const getFinishingName = (id: string) => ({ binding: 'Binding', coverPages: 'Cover Pages', cutting: 'Cutting & Trimming', holePunch: 'Hole Punching', folding: 'Folding', stapling: 'Stapling' })[id] || id;

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
    const [enginePricing, setEnginePricing] = useState<DynamicServicePricingResult | null>(null);
    const [finishingCostOverrides, setFinishingCostOverrides] = useState<Record<string, number>>({});
    const [sellingPrice, setSellingPrice] = useState<number>(0);
    const [priceManuallySet, setPriceManuallySet] = useState(false);
    const [bomTemplate, setBomTemplate] = useState<any>(null);

    const sp = service.smartPricing;
    const hasSmartPricing = !!sp;

    const [enabledFinishing, setEnabledFinishing] = useState<string[]>(() => (sp?.finishingEnabled || []) as string[]);

    useEffect(() => { let m = true; dbService.getSetting<Record<string, number>>('finishingOptionCosts').then(c => { if (m) setFinishingCostOverrides(c || {}); }).catch(() => { if (m) setFinishingCostOverrides({}); }); return () => { m = false; }; }, []);

    useEffect(() => {
        const bomId = sp?.bomTemplateId;
        if (bomId) {
            dbService.get('bomTemplates', bomId).then(tpl => {
                if (tpl) setBomTemplate(tpl);
            }).catch(() => {});
        } else {
            setBomTemplate(null);
        }
    }, [sp?.bomTemplateId]);

    const paper = useMemo(() => sp ? inventory.find((i: any) => i.id === sp.paperItemId) : null, [sp, inventory]);
    const toner = useMemo(() => sp ? inventory.find((i: any) => i.id === sp.tonerItemId) : null, [sp, inventory]);

    const normalizedAdjustments = useMemo(() => (marketAdjustments || []).filter((adj: any) => (adj.active ?? adj.isActive) && (!adj.applyToCategories?.length || adj.applyToCategories.includes(service.category))).map((adj: any) => ({ name: adj.name, type: adj.type, value: adj.value, percentage: adj.percentage ?? adj.value, calculatedAmount: adj.value, adjustmentId: adj.id, isActive: true })), [marketAdjustments, service.category]);

    const resolveFinishingCost = useCallback((id: string): number => {
        if (!sp) return 0;
        const savedCost = sp.finishingSelections?.find((o: any) => o?.id === id)?.price ?? (sp.finishingOptionCosts || {})[id] ?? finishingCostOverrides[id] ?? companyConfig?.productionSettings?.finishingOptions?.find((o: any) => o?.id === id)?.price ?? 0;
        if (savedCost > 0) return Number(savedCost);
        const fees = ((sp.finishingEnabled || []) as string[]);
        const fb = fees.length > 0 && Number(sp.finishingCost) > 0 ? Number(sp.finishingCost) / (fees.length * Math.max(1, Number(sp.copies) || 1)) : 0;
        return fb > 0 ? Number(fb.toFixed(2)) : ({ binding: 150, coverPages: 20, cutting: 30, holePunch: 20, folding: 15, stapling: 10 }[id] || 0);
    }, [sp, companyConfig, finishingCostOverrides]);

    const costBreakdown = useMemo(() => {
        const p = paper && sp ? { sheetsPerCopy: Math.ceil(pages / 2), totalSheets: Math.ceil(pages / 2) * copies, costPerSheet: (() => { const rs = Number(paper.conversionRate || paper.conversion_rate || 500); return rs > 0 ? Number(paper.cost_price || paper.cost_per_unit || paper.cost || 0) / rs : 0; })(), paperCost: 0 } : { sheetsPerCopy: 0, totalSheets: 0, costPerSheet: 0, paperCost: 0 };
        if (p.paperCost === 0 && p.totalSheets > 0) p.paperCost = Number((p.totalSheets * p.costPerSheet).toFixed(2));
        const t = toner && sp ? { tonerCostPerPage: (Number(toner.cost_price || toner.cost_per_unit || toner.cost || 0) / 20000), tonerCost: Number(((pages * copies) * (Number(toner.cost_price || toner.cost_per_unit || toner.cost || 0) / 20000)).toFixed(2)) } : { tonerCostPerPage: 0, tonerCost: 0 };
        const fd = sp ? (enabledFinishing.map(id => ({ id, name: getFinishingName(id), cost: resolveFinishingCost(id), total: resolveFinishingCost(id) }))) : [];
        const fc = Number(fd.reduce((s, f) => s + f.total, 0).toFixed(2));
        return { paperCost: p.paperCost, tonerCost: t.tonerCost, finishingCost: fc, baseCost: Number((p.paperCost + t.tonerCost + fc).toFixed(2)), sheetsPerCopy: p.sheetsPerCopy, totalSheets: p.totalSheets, costPerSheet: p.costPerSheet, tonerCostPerPage: t.tonerCostPerPage, finishingDetails: fd };
    }, [pages, copies, paper, toner, sp, enabledFinishing, resolveFinishingCost]);

    const computePageScaledCost = useCallback((pageCount: number, copyCount: number): number => {
        if (!sp) { const flat = service.serviceConfig?.baseLaborCost || service.serviceConfig?.baseRate || service.cost || 0; return flat * (pageCount / (Number(service.pages) || 1)) * copyCount; }
        const p = inventory.find((i: any) => i.id === sp.paperItemId); const tn = inventory.find((i: any) => i.id === sp.tonerItemId);
        const pc = p ? Number((Math.ceil(pageCount / 2) * copyCount * (Number(p.conversionRate || p.conversion_rate || 500) > 0 ? Number(p.cost_price || p.cost_per_unit || p.cost || 0) / Number(p.conversionRate || p.conversion_rate || 500) : 0)).toFixed(2)) : 0;
        const tc = tn ? Number(((pageCount * copyCount) * (Number(tn.cost_price || tn.cost_per_unit || tn.cost || 0) / 20000)).toFixed(2)) : 0;
        const fc = enabledFinishing.reduce((s, id) => s + resolveFinishingCost(id), 0);
        return Number((pc + tc + fc).toFixed(2));
    }, [service, inventory, sp, enabledFinishing, resolveFinishingCost]);

    useEffect(() => { let m = true; const calc = async () => { try { const bc = computePageScaledCost(pages, copies); const r = await calculateServicePrice({ itemId: service.id, categoryId: service.category, baseCost: bc, pages, copies, adjustments: normalizedAdjustments, context: 'SERVICE' }); if (m) { const tp = pages * copies; setEnginePricing({ pages, copies, totalPages: tp, unitCostPerCopy: copies > 0 ? roundToCurrency(bc / copies) : bc, unitPricePerCopy: r.unitPrice, unitCostPerPage: tp > 0 ? roundToCurrency(bc / tp) : bc, unitPricePerPage: tp > 0 ? roundToCurrency(r.unitPrice / tp) : r.unitPrice, totalCost: bc, totalPrice: r.totalPrice, calculatedTotalPrice: r.totalPrice, adjustmentTotal: r.adjustmentTotal, adjustmentSnapshots: r.adjustmentSnapshots, marginAmount: r.marginAmount, rounding_difference: r.roundingDifference, components: [], serviceDetails: { pages, copies, totalPages: tp, unitCostPerPage: tp > 0 ? roundToCurrency(bc / tp) : bc, unitPricePerPage: tp > 0 ? roundToCurrency(r.unitPrice / tp) : r.unitPrice, unitCostPerCopy: copies > 0 ? roundToCurrency(bc / copies) : bc, unitPricePerCopy: r.unitPrice, totalCost: bc, totalPrice: r.totalPrice, calculatedTotalPrice: r.totalPrice, materials: [], adjustments: [] } }); } } catch (e) { logger.error('[ServiceCalculatorModal] Pricing engine error:', e); } }; calc(); return () => { m = false; }; }, [service, pages, copies, normalizedAdjustments, computePageScaledCost]);

    useEffect(() => { if (enginePricing && !priceManuallySet && enginePricing.totalPrice > 0) setSellingPrice(enginePricing.totalPrice); }, [enginePricing, priceManuallySet]);

    const ap = enginePricing; if (!ap) return null;
    const fc = (v: number) => `${currencySymbol}${formatNumber(v)}`;
    const profit = roundToCurrency(sellingPrice - (ap?.totalCost || 0));
    const isLoss = profit < 0;
    const profitMarginPct = (ap?.totalCost || 0) > 0 ? roundToCurrency((profit / (ap?.totalCost || 1)) * 100) : 0;
    const priceDiff = ap ? roundToCurrency(sellingPrice - ap.totalPrice) : 0;

    const handleConfirm = () => onConfirm({ ...ap, totalPrice: sellingPrice, unitPricePerCopy: copies > 0 ? roundToCurrency(sellingPrice / copies) : 0, calculatedTotalPrice: ap.totalPrice, marginAmount: profit, priceLocked: true, lockedTotalPrice: sellingPrice, lockedUnitPricePerCopy: copies > 0 ? roundToCurrency(sellingPrice / copies) : 0, lockedUnitCostPerCopy: copies > 0 ? roundToCurrency(ap.totalCost / copies) : 0 });

    const ink900 = '#16191c', ink700 = '#3a4046', ink500 = '#6b7178', ink300 = '#aeb3b8', line = '#e7e5e1', canvas = '#eeece7', amber = '#b8742f', amberDeep = '#8f5a22', amberTint = '#fbf2e6', good = '#3f7d52', goodTint = '#eef6ef';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md" style={{ background: 'rgba(22,25,28,0.55)' }}>
            <div className="w-full max-w-[660px]" style={{ background: '#fff', borderRadius: 14, border: `1px solid ${line}`, boxShadow: '0 24px 48px -20px rgba(22,25,28,0.28)', overflow: 'hidden' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 20px 14px 20px', borderBottom: `1px solid ${line}` }}>
                    <div>
                        <div style={{ fontFamily: "inherit", fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: amber, marginBottom: 5 }}>Printing Service</div>
                        <div style={{ fontSize: 19, color: ink900, lineHeight: 1.1, fontWeight: 700 }}>{service.name}</div>
                    </div>
                    <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: 'transparent', color: ink500, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginTop: 2 }}
                        onMouseOver={e => { e.currentTarget.style.background = canvas; e.currentTarget.style.color = ink900; }}
                        onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = ink500; }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>

                {/* Two-column body */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr' }}>
                    <div className="custom-scrollbar" style={{ padding: '16px 20px', maxHeight: '64vh', overflowY: 'auto' }}>

                        {/* Quantities */}
                        <div style={{ fontFamily: "inherit", fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: ink500, marginBottom: 9 }}>Quantities</div>
                        <div style={{ display: 'flex', border: `1px solid ${line}`, borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
                            <div style={{ flex: 1, padding: '8px 10px', borderRight: `1px solid ${line}` }}>
                                <div style={{ fontFamily: "inherit", fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: ink500, marginBottom: 3 }}>Pages</div>
                                <input type="number" min={1} value={pages} onChange={e => setPages(Math.max(1, parseInt(e.target.value || '1', 10) || 1))}
                                    style={{ border: 'none', padding: 0, fontSize: 14, fontWeight: 700, fontFamily: "inherit", color: ink900, width: '100%', background: 'transparent', outline: 'none' }} />
                            </div>
                            <div style={{ flex: 1, padding: '8px 10px', borderRight: `1px solid ${line}` }}>
                                <div style={{ fontFamily: "inherit", fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: ink500, marginBottom: 3 }}>Copies</div>
                                <input type="number" min={1} value={copies} onChange={e => setCopies(Math.max(1, parseInt(e.target.value || '1', 10) || 1))}
                                    style={{ border: 'none', padding: 0, fontSize: 14, fontWeight: 700, fontFamily: "inherit", color: ink900, width: '100%', background: 'transparent', outline: 'none' }} />
                            </div>
                            <div style={{ flex: '0 0 56px', padding: '8px 10px', borderRight: `1px solid ${line}`, background: canvas, textAlign: 'center' }}>
                                <div style={{ fontFamily: "inherit", fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: ink500, marginBottom: 3 }}>Sheets</div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: ink700 }}>{Math.ceil(pages / 2)}</div>
                            </div>
                            <div style={{ flex: '0 0 56px', padding: '8px 10px', background: canvas, textAlign: 'center' }}>
                                <div style={{ fontFamily: "inherit", fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: ink500, marginBottom: 3 }}>Total</div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: ink700 }}>{pages * copies}<span style={{ fontSize: 10, color: ink500, fontWeight: 400 }}>pg</span></div>
                            </div>
                        </div>

                        {/* BOM line */}
                        {bomTemplate && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: ink500, paddingBottom: 14, marginBottom: 14, borderBottom: `1px solid ${line}` }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={amber} strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></svg>
                                Specs from <b style={{ color: ink900, fontWeight: 700 }}>BOM: {bomTemplate.name}</b>
                            </div>
                        )}

                        {/* Finishing Options */}
                        {costBreakdown.finishingDetails.length > 0 && (
                            <>
                                <div style={{ fontFamily: "inherit", fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: ink500, marginBottom: 9 }}>Finishing Options</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {costBreakdown.finishingDetails.map(fd => {
                                        const isOn = enabledFinishing.includes(fd.id);
                                        return (
                                            <button key={fd.id} type="button" onClick={() => setEnabledFinishing(prev => prev.includes(fd.id) ? prev.filter(id => id !== fd.id) : [...prev, fd.id])}
                                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', background: isOn ? amberTint : canvas, transition: 'all .12s' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: isOn ? amber : ink300 }}></div>
                                                    <span style={{ fontSize: 12, fontWeight: 600, color: ink900 }}>{fd.name}</span>
                                                </div>
                                                <span style={{ fontFamily: "inherit", fontSize: 11, color: isOn ? amber : ink500 }}>{fc(fd.cost)}/job</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Divider */}
                    <div style={{ background: line }}></div>

                    {/* Right column — Costing */}
                    <div className="custom-scrollbar" style={{ padding: '16px 20px', maxHeight: '64vh', overflowY: 'auto' }}>
                        <div style={{ fontFamily: "inherit", fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: ink500, marginBottom: 9 }}>Cost Breakdown</div>

                        {hasSmartPricing ? (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', fontSize: 12.5 }}>
                                    <span style={{ color: ink500 }}>Paper</span>
                                    <span style={{ fontFamily: "inherit", fontWeight: 600, color: ink900 }}>{fc(costBreakdown.paperCost)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', fontSize: 12.5 }}>
                                    <span style={{ color: ink500 }}>Toner</span>
                                    <span style={{ fontFamily: "inherit", fontWeight: 600, color: ink900 }}>{fc(costBreakdown.tonerCost)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', fontSize: 12.5 }}>
                                    <span style={{ color: ink500 }}>Finishing</span>
                                    <span style={{ fontFamily: "inherit", fontWeight: 600, color: ink900 }}>{fc(costBreakdown.finishingCost)}</span>
                                </div>
                                <div style={{ borderTop: `1px dashed ${line}`, margin: '4px 0' }}></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', fontSize: 12.5 }}>
                                    <span style={{ color: ink500 }}>Cost Price</span>
                                    <span style={{ fontFamily: "inherit", fontWeight: 600, color: ink900 }}>{fc(costBreakdown.baseCost)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', fontSize: 12.5 }}>
                                    <span style={{ color: ink500 }}>Selling Price</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <span style={{ fontFamily: "inherit", fontSize: 11, color: ink500 }}>{currencySymbol}</span>
                                        <input type="number" step="0.01" min={0} value={sellingPrice} onChange={e => { setSellingPrice(Math.max(0, parseFloat(e.target.value || '0'))); setPriceManuallySet(true); }}
                                            style={{ width: 80, textAlign: 'right', border: `1px solid ${line}`, borderRadius: 6, padding: '3px 7px', fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: ink900, outline: 'none' }}
                                            onFocus={e => e.currentTarget.style.borderColor = amber}
                                            onBlur={e => e.currentTarget.style.borderColor = line} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', fontSize: 12.5 }}>
                                    <span style={{ color: ink500 }}>Calculated</span>
                                    <span style={{ fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, color: amberDeep }}>{fc(ap.totalPrice)}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: goodTint, borderRadius: 8, padding: '9px 12px', marginTop: 12 }}>
                                    <div style={{ fontSize: 11.5, color: good, fontWeight: 700 }}>
                                        Profit <span style={{ fontFamily: "inherit" }}>{isLoss ? '-' : '+'}{fc(Math.abs(profit))}</span>
                                    </div>
                                    <div style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 700, color: good, background: '#fff', padding: '3px 9px', borderRadius: 999 }}>{profitMarginPct}% margin</div>
                                </div>
                                {isLoss && (
                                    <div style={{ marginTop: 8, padding: '6px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 11, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <AlertTriangle size={12} /> Below cost — loss of {fc(Math.abs(profit))}
                                    </div>
                                )}
                                {!isLoss && profit > 0 && profitMarginPct < 10 && (
                                    <div style={{ marginTop: 8, padding: '6px 10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 11, color: '#d97706', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Info size={12} /> Low margin ({profitMarginPct}%) — increase price
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', fontSize: 12.5 }}>
                                    <span style={{ color: ink500 }}>Base Rate</span>
                                    <span style={{ fontFamily: "inherit", fontWeight: 600, color: ink900 }}>{fc(ap.totalCost)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', fontSize: 12.5 }}>
                                    <span style={{ color: ink500 }}>Selling Price</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <span style={{ fontFamily: "inherit", fontSize: 11, color: ink500 }}>{currencySymbol}</span>
                                        <input type="number" step="0.01" min={0} value={sellingPrice} onChange={e => { setSellingPrice(Math.max(0, parseFloat(e.target.value || '0'))); setPriceManuallySet(true); }}
                                            style={{ width: 80, textAlign: 'right', border: `1px solid ${line}`, borderRadius: 6, padding: '3px 7px', fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: ink900, outline: 'none' }}
                                            onFocus={e => e.currentTarget.style.borderColor = amber}
                                            onBlur={e => e.currentTarget.style.borderColor = line} />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '14px 20px 18px 20px', borderTop: `1px solid ${line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <div>
                        <div style={{ fontFamily: "inherit", fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: ink500 }}>Total Due</div>
                        <div style={{ fontSize: 23, color: ink900, lineHeight: 1.15, fontWeight: 700 }}>{fc(sellingPrice)}</div>
                        <div style={{ fontFamily: "inherit", fontSize: 10, color: ink500 }}>{pages * copies} page{pages * copies !== 1 ? 's' : ''} · {Math.ceil(pages / 2) * copies} sheet{Math.ceil(pages / 2) * copies !== 1 ? 's' : ''} · {fc(copies > 0 ? roundToCurrency(sellingPrice / copies) : 0)}/copy</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button onClick={onClose} style={{ border: `1px solid ${line}`, borderRadius: 8, padding: '10px 16px', fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#fff', color: ink700, whiteSpace: 'nowrap', transition: 'all .15s' }}
                            onMouseOver={e => e.currentTarget.style.background = canvas}
                            onMouseOut={e => e.currentTarget.style.background = '#fff'}>
                            Cancel
                        </button>
                        <button onClick={handleConfirm} style={{ border: 'none', borderRadius: 8, padding: '10px 16px', fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: 'pointer', background: ink900, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap', transition: 'all .15s' }}
                            onMouseOver={e => e.currentTarget.style.background = '#000'}
                            onMouseOut={e => e.currentTarget.style.background = ink900}>
                            Add to Order
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
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
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[12px] font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
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
