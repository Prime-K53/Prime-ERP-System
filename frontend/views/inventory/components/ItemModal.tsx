import React, { useState, useEffect, useMemo } from 'react';
import { logger } from '@/services/logger';
// PRICING RULE: Cost from BOM/Smart Pricing. Selling Price user-entered. Profit live-calculated.
//   No rounding, no markup, no market adjustments in product creation. Display rounding only.
import { X, Save, Plus, Trash2, AlertCircle, Package, DollarSign, Hash, MapPin, Truck, Tag, FileText, Box, Layers, ArrowRight, Wand2, Grid, Scale, RefreshCw, Eye, EyeOff, Info, Check, Edit3, TrendingUp, ChevronLeft, ChevronRight, Settings, Calculator, Zap } from 'lucide-react';
import { Item, Warehouse, ProductVariant, PricingConfig, FinishingOption, AdjustmentSnapshot, BOMTemplate, PricingRoundingMethod, Variant, VariantSource, InventoryRole, ResourceSubtype, ServiceCostMethod } from '../../../types';
import { toVariant } from '../../../utils/variantMigration';
import { useAuth } from '../../../context/AuthContext';
import { useInventory } from '../../../context/InventoryContext';
import { useProcurement } from '../../../context/ProcurementContext';
import { generateAutoSKU, generateAutoBarcode, generateBulkVariants } from '../../../utils/skuGenerator';
import { pricingService } from '../../../services/pricingService';
import { dbService } from '../../../services/db';
import { normalizeInventoryItemPricing, calculateBaseSellingPrice } from '../../../utils/pricing';
import { calculateProfit, calculateMarkup, validateMinimumMarkup, resolveMinimumMarkup } from '../../../services/pricingValidationService';
import PricingTab from './PricingTab';

// Generate a unique ID without external dependency
const generateId = (): string => {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
};

// â”€â”€â”€ Premium Design System â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const premium = {
    modal: "relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col",
    glassCard: "bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 rounded-xl shadow-sm",
    glassCardStrong: "bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/80 rounded-xl shadow-lg",
    input: "w-full px-3 py-2 bg-white/50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 rounded-lg text-sm font-medium text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all placeholder:text-slate-400 hover:border-slate-300/60 dark:hover:border-slate-600/60",
    inputError: "border-red-300/60 dark:border-red-700/60 bg-red-50/50 dark:bg-red-900/20",
    select: "w-full px-3 py-2 bg-white/50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 rounded-lg text-sm font-medium text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all appearance-none cursor-pointer hover:border-slate-300/60 dark:hover:border-slate-600/60",
    textarea: "w-full px-3 py-2 bg-white/50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 rounded-lg text-sm font-medium text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all placeholder:text-slate-400 min-h-[80px] resize-none hover:border-slate-300/60 dark:hover:border-slate-600/60",
    label: "text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400 block mb-1.5 whitespace-nowrap shrink-0",
    btnPrimary: "inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold text-sm hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
    btnSecondary: "inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white/70 dark:bg-slate-800/70 backdrop-blur text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 rounded-lg font-semibold text-sm hover:bg-slate-50/70 dark:hover:bg-slate-700/70 transition-all shadow-sm",
    btnGhost: "inline-flex items-center justify-center gap-2 px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 rounded-lg font-medium text-sm transition-all",
    btnDanger: "inline-flex items-center justify-center gap-2 px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50/70 dark:hover:bg-rose-900/20 rounded-lg font-medium text-sm transition-all",
    btnIcon: "p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 rounded-lg transition-all",
    sectionTitle: "text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 mb-4 pb-2 border-b border-slate-200/50 dark:border-slate-700/50",
    grid2: "grid grid-cols-1 sm:grid-cols-2 gap-3",
    grid3: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3",
    grid4: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3",
    grid5: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3",
    sidebar: "w-48 bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur border-r border-slate-200/50 dark:border-slate-700/50 flex flex-col",
    sidebarItem: (active: boolean) => `flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all mx-2 my-1 ${active
        ? 'bg-gradient-to-r from-blue-500/10 to-indigo-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-sm'
        : 'text-slate-600 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-700/70 hover:text-slate-800 dark:hover:text-slate-200'}`,
    metricCard: "bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200/50 dark:border-blue-800/50 rounded-xl p-4",
    metricValue: "text-xl font-bold text-blue-600 dark:text-blue-400",
    metricLabel: "text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400",
    divider: "h-px bg-gradient-to-r from-transparent via-slate-200/60 to-transparent dark:via-slate-700/60 my-4",
    scrollbar: "scrollbar-thin scrollbar-thumb-slate-200/50 scrollbar-track-transparent dark:scrollbar-thumb-slate-700/50",
};

interface ItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (item: Item) => Promise<void> | void;
    onUpdate: (item: Item) => Promise<void> | void;
    item?: Item | null; // For edit mode
    warehouses: Warehouse[];
    mode: 'add' | 'edit';
}

interface FormErrors {
    name?: string;
    sku?: string;
    category?: string;
    type?: string;
    price?: string;
    cost?: string;
    stock?: string;
    unit?: string;
    resourceSubtype?: string;
}

const defaultItem: Partial<Item> = {
    name: '',
    sku: '',
    description: '',
    price: 0,
    cost: 0,
    stock: 0,
    category: '',
    type: 'Product',
    unit: 'pcs',
    minStockLevel: 0,
    preferredSupplierId: '',
    binLocation: '',
    barcode: '',
    purchaseUnit: '',
    usageUnit: '',
    conversionRate: 1,
    isLargeFormat: false,
    rollWidth: 0,
    rollLength: 0,
    pages: 1,
    leadTimeDays: 0,
    minOrderQty: 1,
    reorderPoint: 0,
    marginPercent: 0,
    variants: [],
    variantModels: [],
    isVariantParent: false,
    isStationeryPack: false,
    costPerPack: 0,
    unitsPerPack: 0,

    locationStock: [],
    isCustomizableService: false, // Default: not a customizable service
    inventoryRole: undefined,
    resourceSubtype: undefined,
    consumptionUnit: '',
    conversionFactor: 1,
    pricingConfig: {
        marketAdjustment: 0,
        finishingOptions: [],
        manualOverride: false
    }
};

const DEFAULT_FINISHING_BUTTONS: Array<{ id: string; name: string; cost: number; description?: string }> = [
    { id: 'binding', name: 'Binding', cost: 150, description: 'Book binding - comb or spiral' },
    { id: 'coverPages', name: 'Cover Pages', cost: 20, description: 'Front and back cover pages per copy' },
    { id: 'cutting', name: 'Cutting & Trimming', cost: 30, description: 'Trim edges to clean finish' },
    { id: 'holePunch', name: 'Hole Punching', cost: 20, description: 'Punch holes for folder binding' },
    { id: 'folding', name: 'Folding', cost: 15, description: 'Fold pages for insertion' },
    { id: 'stapling', name: 'Stapling', cost: 10, description: 'Corner or saddle stapling' }
];



const ItemModal: React.FC<ItemModalProps> = ({
    isOpen,
    onClose,
    onSave,
    onUpdate,
    item,
    warehouses,
    mode
}) => {

    const { companyConfig } = useAuth();
    const { inventory, marketAdjustments } = useInventory();
    const { suppliers } = useProcurement();
    const currency = companyConfig.currencySymbol || '$';

    const [formData, setFormData] = useState<Partial<Item>>(defaultItem);
    const [errors, setErrors] = useState<FormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<'basic' | 'pricing' | 'inventory' | 'variants'>('basic');
    
    const [newVariant, setNewVariant] = useState<Partial<ProductVariant> & { source?: VariantSource; stockingUnit?: string; costMethod?: string; bomTemplateId?: string }>({
        id: '',
        sku: '',
        name: '',
        attributes: {},
        price: 0,
        cost: 0,
        stock: 0,
        marginPercent: 0,
        pages: 1,
        source: 'manual',
        stockingUnit: 'pcs',
        costMethod: 'mixed',
        bomTemplateId: '',
    });
    const [showVariantForm, setShowVariantForm] = useState(false);

    // Live price preview for the "Add Variant" form
    const [variantPreview, setVariantPreview] = useState<ReturnType<typeof calculateSmartVariantPrice>>(null);

    // Bulk Variant Generation State
    const [showBulkGenerator, setShowBulkGenerator] = useState(false);
    const [bulkAttributes, setBulkAttributes] = useState<{ name: string, values: string[] }[]>([{ name: 'Size', values: [] }]);
    const [bulkInputValue, setBulkInputValue] = useState<{ [key: number]: string }>({});
    const [bomTemplates, setBomTemplates] = useState<BOMTemplate[]>([]);
    const [bomLoading, setBomLoading] = useState<boolean>(true);
    const [finishingButtons, setFinishingButtons] = useState<Array<{ id: string; name: string; cost: number; description?: string }>>([]);

    // Stationery Pack Conversion State
    const [usePackConversion, setUsePackConversion] = useState(false);

    // Pricing validation state
    const [pricingValidation, setPricingValidation] = useState<{
        profit: number;
        profitMargin: number;
        minimumMargin: number;
        valid: boolean;
        message: string;
    } | null>(null);

    // Derived unified Variant models (dual-write from ProductVariant[])
    const derivedVariantModels = useMemo<Variant[]>(() => {
        return (formData.variants || []).map(pv => {
            const v = toVariant(formData as Item, pv);
            const existing = (formData.variantModels as Variant[] | undefined)?.find(ev => ev.id === pv.id);
            if (existing) {
                v.source = existing.source || v.source;
                v.stockingUnit = existing.stockingUnit || v.stockingUnit;
                if (existing.units) v.units = existing.units;
            }
            return v;
        });
    }, [formData.variants, formData.variantModels, formData]);

    // Computed values for pack conversion
    const derivedCostPerPiece = useMemo(() => {
        if (!formData.isStationeryPack) return formData.cost || 0;
        if (!formData.unitsPerPack || formData.unitsPerPack === 0) return 0;
        return (formData.costPerPack || 0) / formData.unitsPerPack;
    }, [formData.isStationeryPack, formData.cost, formData.costPerPack, formData.unitsPerPack]);

    const costPrice = derivedCostPerPiece || formData.cost || 0;
    const sellingPrice = Number(formData.sellingPrice || formData.selling_price || formData.price || 0);

    useEffect(() => {
        const profit = calculateProfit(costPrice, sellingPrice);
        const markup = calculateMarkup(costPrice, sellingPrice);
        const validation = validateMinimumMarkup(costPrice, sellingPrice, formData as Item);
        setPricingValidation({
            profit,
            profitMargin: markup,
            minimumMargin: validation.minimumMarkup,
            valid: validation.valid,
            message: validation.message
        });
    }, [sellingPrice, costPrice, formData]);

    const handleSellingPriceChange = (value: number) => {
        const safeValue = Math.max(0, Number(value) || 0);
        setFormData(prev => ({
            ...prev,
            sellingPrice: safeValue,
            selling_price: safeValue,
            price: safeValue
        }));
    };


    const calculateSmartVariantPrice = (pages: number, copies: number = 1) => {
        const sp = formData.smartPricing;
        if (!sp) return null;

        // Paper cost
        let paperCost = 0;
        const paper = inventory.find((i: Item) => i.id === sp.paperItemId);
        if (paper) {
            const sheetsPerCopy = Math.ceil(pages / 2);
            const totalSheets = sheetsPerCopy * copies;
            const reamSize = Number(paper.conversionRate || paper.conversion_rate || 500);
            const paperUnitCost = Number(paper.cost_price || paper.cost_per_unit || paper.cost || 0);
            const costPerSheet = reamSize > 0 ? paperUnitCost / reamSize : 0;
            paperCost = Number((totalSheets * costPerSheet).toFixed(2));
        }

        // Toner cost
        let tonerCost = 0;
        const toner = inventory.find((i: Item) => i.id === sp.tonerItemId);
        if (toner) {
            const capacity = 20000;
            const totalPages = pages * copies;
            const tonerUnitCost = Number(toner.cost_price || toner.cost_per_unit || toner.cost || 0);
            tonerCost = Number((totalPages * (tonerUnitCost / capacity)).toFixed(2));
        }

        // Finishing cost Ã¢â‚¬â€ reuse saved finishing button costs (same source as SmartPricing)
        const finishingCost = ((sp.finishingEnabled || []) as string[]).reduce((sum: number, id: string) => {
            const opt = finishingButtons.find(f => f.id === id);
            return sum + (opt?.cost || 0);
        }, 0);

        const baseCost = paperCost + tonerCost + finishingCost;

        // Market adjustments Ã¢â‚¬â€ same logic as SmartPricing
        const adjustmentLines = marketAdjustments.map(adj => {
            const type = (adj.type || '').toUpperCase();
            const value = (type === 'PERCENTAGE' || type === 'PERCENT')
                ? baseCost * ((adj.value || 0) / 100)
                : (adj.value || 0) * pages * copies;
            return { id: adj.id, name: adj.name, type: adj.type, value: Number(value.toFixed(2)), rawValue: adj.value };
        });
        const marketAdjustmentTotal = adjustmentLines.reduce((s: number, a: any) => s + a.value, 0);
        const priceAfterAdjustments = baseCost + marketAdjustmentTotal;
        return {
            paperCost,
            tonerCost,
            finishingCost,
            baseCost,
            pages,
            copies,
        };
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

    // Contextual unit options per type
    const getUnitOptions = () => {
        switch (formData.type) {
            case 'Product': 
            case 'Service': return ['pcs', 'units', 'sets', 'packs', 'hours', 'sessions', 'fixed'];
            case 'Raw Material': return ['kg', 'g', 'l', 'ml', 'm', 'cm', 'rolls', 'sheets', 'reams', 'boxes', 'packs'];
            case 'Stationery': return ['pcs', 'packs', 'boxes', 'reams'];
            default: return ['pcs'];
        }
    };

    // ... (keep useMemo and useEffect hooks for pricing engine logic) ...

    const calculatedPrice = useMemo(() => {
        const cost = derivedCostPerPiece;
        // Keep marginConfig/margin_type/margin_value access for stored data compatibility
        const marginConfig = formData.pricingConfig?.marginConfig as { margin_type: string; margin_value: number } | undefined;

        let effectiveMarkup = formData.marginPercent || 0;
        if (marginConfig?.margin_type === 'percentage') {
            effectiveMarkup = marginConfig.margin_value;
        }

        const baseMarkupPrice = calculateBaseSellingPrice(cost, effectiveMarkup);

        let finalBasePrice = baseMarkupPrice;
        if (marginConfig?.margin_type === 'fixed_amount') {
            finalBasePrice = cost + marginConfig.margin_value;
        }

        const extraMarkup = formData.pricingConfig?.markup || 0;
        return finalBasePrice * (1 + extraMarkup / 100);
    }, [derivedCostPerPiece, formData.pricingConfig?.markup, formData.marginPercent, formData.pricingConfig?.marginConfig]);

    const finalPrice = useMemo(() => {
        return calculatedPrice;
    }, [calculatedPrice]);

    const isStockTrackedItemType = (type?: string) => type === 'Stationery' || type === 'Material' || type === 'Raw Material' || type === 'Product';
    const isServiceType = formData.type === 'Service';
    const hasStockFunctionality = isStockTrackedItemType(formData.type);
    const isItemManualOverride = Boolean(formData.pricingConfig?.manualOverride);
    const activeMarketAdjustments = useMemo(
        () => marketAdjustments.filter(ma => ma.active ?? ma.isActive),
        [marketAdjustments]
    );
    const stationeryAdjustmentOptions = useMemo(() => activeMarketAdjustments.filter(adj => {
        const categories = adj.applyToCategories || [];
        return categories.length === 0 || (formData.category ? categories.includes(formData.category) : false);
    }), [activeMarketAdjustments, formData.category]);

    // Helper: derive ready-state for inventory/market adjustments
    const isInventoryReady = inventory && inventory.length > 0;
    const isMarketAdjustmentsReady = marketAdjustments && marketAdjustments.length > 0;



    useEffect(() => {
        if (!hasStockFunctionality && activeTab === 'inventory') {
            setActiveTab('basic');
        }
    }, [activeTab, hasStockFunctionality]);

    const resolveRoundingBasePrice = () => {
        if (formData.pricingConfig?.manualOverride) {
            return Number(formData.price) || 0;
        }
        // SmartPricing product: use the snapshot's roundedPrice as the authoritative price
        const snapPrice = Number(formData.smartPricing?.roundedPrice);
        if (Number.isFinite(snapPrice) && snapPrice > 0) return snapPrice;
        const raw = Number(formData.calculated_price);
        if (Number.isFinite(raw) && raw > 0) return raw;
        return Number(formData.price) || 0;
    };

    const resolveVariantBasePrice = (variant: ProductVariant) => {
        // Prefer SmartPricing snapshot (most accurate Ã¢â‚¬â€ set by the engine)
        const snapPrice = Number(variant.smartPricingSnapshot?.roundedPrice);
        if (Number.isFinite(snapPrice) && snapPrice > 0) return snapPrice;
        // Then selling_price (already rounded and persisted)
        const sp = Number(variant.selling_price);
        if (Number.isFinite(sp) && sp > 0) return sp;
        // Then calculated_price
        const cp = Number(variant.calculated_price);
        if (Number.isFinite(cp) && cp > 0) return cp;
        // Finally raw price
        return Number(variant.price) || 0;
    };

    // Load BOM templates on mount
    useEffect(() => {
        let mounted = true;
        setBomLoading(true);
dbService.getAll<BOMTemplate>('bomTemplates')
    .then((templates) => {
        if (mounted) setBomTemplates(templates || []);
    })
    .catch((err) => {
        logger.error('Failed to load BOM templates for variant pricing', err);
    })
    .finally(() => { if (mounted) setBomLoading(false); });
        // Load finishing option costs: companyConfig > IndexedDB > hard-coded defaults
        const resolveFinishingPrices = async () => {
            const configOptions = companyConfig?.productionSettings?.finishingOptions;
            if (configOptions && configOptions.length > 0) {
                const merged = DEFAULT_FINISHING_BUTTONS.map(d => ({
                    ...d,
                    cost: configOptions.find(o => o.id === d.id)?.price ?? d.cost,
                }));
                if (mounted) setFinishingButtons(merged);
                return;
            }
            try {
                const savedCosts = await dbService.getSetting<Record<string, number>>('finishingOptionCosts');
                if (!mounted) return;
                const merged = DEFAULT_FINISHING_BUTTONS.map(d => ({ ...d, cost: savedCosts?.[d.id] ?? d.cost }));
                setFinishingButtons(merged);
            } catch {
                if (mounted) setFinishingButtons(DEFAULT_FINISHING_BUTTONS);
            }
        };
        resolveFinishingPrices();
        return () => { mounted = false; };
    }, []);

    // Populate form when editing
    useEffect(() => {
        if (item && mode === 'edit') {
            const normalizedItem = normalizeInventoryItemPricing(item);
            const shouldBeManual =
                normalizedItem.pricingConfig?.manualOverride ||
                (normalizedItem.type === 'Service' || normalizedItem.type === 'Raw Material' || normalizedItem.type === 'Material');

            setFormData({
                ...defaultItem,
                ...normalizedItem,
                variants: normalizedItem.variants || [],
                pricingConfig: {
                    ...defaultItem.pricingConfig,
                    ...normalizedItem.pricingConfig,
                    manualOverride: shouldBeManual
                }
            });
        } else {
            setFormData({
                ...defaultItem,
                sku: generateAutoSKU('ITEM', 'NEW', undefined, inventory)
            });
        }
        setErrors({});
        setActiveTab('basic');
        setShowVariantForm(false);
        setShowBulkGenerator(false);
        setShowBulkGenerator(false);
    }, [item, mode, isOpen]);

    // Material filtering for BOM
    const materials = useMemo(() => (inventory || []).filter((i: Item) => i.type === 'Raw Material' || i.type === 'Material'), [inventory]);
    const paperMaterials = useMemo(() => materials.filter((i: Item) => i.category?.toLowerCase().includes('paper') || i.name.toLowerCase().includes('paper')), [materials]);
    const tonerMaterials = useMemo(() => materials.filter((i: Item) => i.category?.toLowerCase().includes('toner') || i.category?.toLowerCase().includes('cartridge') || i.name.toLowerCase().includes('toner')), [materials]);

    // Calculate BOM costs from stored template
    const bomCosts = useMemo(() => {
        if (!formData.smartPricing?.bomTemplateId || !bomTemplates.length) {
            return { paper: 0, toner: 0, finishing: 0, total: 0 };
        }
        const template = bomTemplates.find(b => b.id === formData.smartPricing.bomTemplateId);
        if (!template?.components?.length) {
            return { paper: 0, toner: 0, finishing: 0, total: 0 };
        }
        let paper = 0, toner = 0, finishing = 0;
        template.components.forEach(comp => {
            const item = materials.find(m => m.id === comp.itemId);
            if (!item) return;
            const cost = item.cost || 0;
            const qty = parseFloat(comp.quantityFormula) || 1;
            if (comp.name?.toLowerCase().includes('paper')) {
                paper += cost * qty;
            } else if (comp.name?.toLowerCase().includes('toner')) {
                toner += cost * qty;
            } else {
                finishing += cost * qty;
            }
        });
        return { paper, toner, finishing, total: paper + toner + finishing };
    }, [formData.smartPricing?.bomTemplateId, bomTemplates, materials]);

    // Helper to calculate cost/price based on pages and config
    const calculateItemFinancials = (pPages: number, pConfig: PricingConfig | undefined, pItemType?: string, pManualCost?: number) => {
        const rawCost = pManualCost || (pItemType === 'Stationery' ? derivedCostPerPiece : formData.cost) || 0;
        const safePages = Math.max(1, pPages);
        // For services, the unit cost is interpreted as the total cost per copy (all pages).
        // Dividing by pages here ensures the baseCost calculation (cost * pages) remains consistent with the original unit cost.
        const cost = pItemType === 'Service' ? (rawCost / safePages) : rawCost;
        let baseCost = cost * safePages;
        
        // Simple calculation for now - this can be expanded to use the pricing engine
        const finishingCost = pConfig?.finishingOptions?.reduce((sum, opt) => sum + opt.quantity * 5, 0) || 0;
        let adjustments = 0;
        
        if (pConfig?.selectedAdjustmentIds) {
            adjustments = pConfig.selectedAdjustmentIds.reduce((sum, adjId) => {
                const adj = marketAdjustments.find(a => a.id === adjId);
                if (adj) {
                    if (adj.type === 'PERCENTAGE') {
                        return sum + (cost * pPages * adj.value / 100);
                    } else {
                        return sum + adj.value * pPages;
                    }
                }
                return sum;
            }, 0);
        }
        
        const total = baseCost + finishingCost + adjustments;
        const margin = total * ((formData.marginPercent || 0) / 100);
        const finalPrice = total + margin;
        
        return {
            paperCost: cost * pPages,
            tonerCost: 0, // Will be implemented in the pricing engine
            finishingCost,
            adjustments,
            margin,
            total: finalPrice
        };
    };


    // Pricing Calculation Logic
    useEffect(() => {
        // Wait for BOM to load first
        if (bomLoading) return;
        if (formData.type === 'Raw Material' || formData.type === 'Material' || formData.type === 'Stationery' || !formData.pricingConfig || formData.pricingConfig.manualOverride) return;
        // SmartPricing products: price is computed by the engine and stored in smartPricing snapshot.
        // Do NOT overwrite with calculateItemFinancials which uses parent cost=0 and produces K0.
        if (formData.smartPricing && formData.type === 'Product') return;


        const financials = calculateItemFinancials(formData.pages || 1, formData.pricingConfig, formData.type, formData.cost);
        if (!financials) return;

        setFormData(prev => ({
            ...prev,
            price: Number((financials.total ?? 0).toFixed(2)),
            selling_price: Number((financials.total ?? 0).toFixed(2)),
            calculated_price: Number((financials.total ?? 0).toFixed(2)),
            pricingConfig: {
                ...prev.pricingConfig!,
                totalCost: Number((financials.total ?? 0).toFixed(2)),
                marketAdjustment: Number((financials.adjustments ?? 0).toFixed(2))
            }
        }));


    }, [
        bomLoading,
        formData.pricingConfig?.paperId,
        formData.pricingConfig?.tonerId,
        formData.pricingConfig?.finishingOptions,
        formData.pricingConfig?.manualOverride,
        formData.pricingConfig?.selectedAdjustmentIds,
        formData.pricingConfig?.selectedRoundingMethod,
        formData.pages,
        formData.cost,
        materials,
        activeMarketAdjustments,
        companyConfig
    ]);

    const getVariantAttributeSummary = (variant: Partial<ProductVariant>) => {
        const attributes = variant.attributes || {};
        const values = Object.values(attributes).map(value => String(value).trim()).filter(Boolean);
        return values.join(', ');
    };

    const buildVariantAttributesFromText = (value: string) => {
        const trimmed = value.trim();
        return trimmed ? { Attribute: trimmed } : {};
    };

    const roundMoney = (value: number) => Number((Number(value) || 0).toFixed(2));

    const companyDefaultCustomRoundingStep = Number(companyConfig?.pricingSettings?.customStep) || 50;

    const calculateAdjustmentAmount = (adjustment: any, baseCost: number) => {
        const normalizedType = String(adjustment?.type || '').toUpperCase();
        const rawValue = Number(adjustment?.percentage ?? adjustment?.value ?? 0);
        const amount = (normalizedType === 'PERCENTAGE' || normalizedType === 'PERCENT')
            ? baseCost * (rawValue / 100)
            : Number(adjustment?.value || 0);

        return roundMoney(amount);
    };

    const buildStationeryAdjustmentSnapshots = (selectedAdjustmentIds: string[], baseCost: number) => {
        const uniqueIds = Array.from(new Set(selectedAdjustmentIds.filter(Boolean)));

        return uniqueIds
            .map((adjustmentId: string) => (
                stationeryAdjustmentOptions.find(adj => adj.id === adjustmentId)
                || activeMarketAdjustments.find(adj => adj.id === adjustmentId)
            ))
            .filter(Boolean)
            .map((adjustment: any) => ({
                name: adjustment.name,
                type: adjustment.type,
                value: Number(adjustment.value || 0),
                percentage: (String(adjustment.type || '').toUpperCase() === 'PERCENTAGE' || String(adjustment.type || '').toUpperCase() === 'PERCENT')
                    ? Number(adjustment.percentage ?? adjustment.value ?? 0)
                    : undefined,
                calculatedAmount: calculateAdjustmentAmount(adjustment, baseCost)
            })) as AdjustmentSnapshot[];
    };

    const resolveStationeryMargin = (baseForMargin: number, fallbackMarginPercent: number) => {
        const marginConfig = formData.pricingConfig?.marginConfig as { margin_type: string; margin_value: number } | undefined;

        if (marginConfig) {
            if (marginConfig.margin_type === 'fixed_amount') {
                const marginAmount = roundMoney(marginConfig.margin_value);
                return {
                    marginAmount,
                    marginPercent: baseForMargin > 0 ? roundMoney((marginAmount / baseForMargin) * 100) : 0,
                    label: `Global Fixed (${currency}${marginAmount.toFixed(2)})`
                };
            }

            const marginPercent = roundMoney(marginConfig.margin_value);
            return {
                marginAmount: roundMoney(baseForMargin * (marginPercent / 100)),
                marginPercent,
                label: `Global ${marginPercent}%`
            };
        }

        const marginPercent = roundMoney(fallbackMarginPercent);
        return {
            marginAmount: roundMoney(baseForMargin * (marginPercent / 100)),
            marginPercent,
            label: `${marginPercent}%`
        };
    };

    const calculateStationeryPricingLine = ({
        costPrice,
        selectedAdjustmentIds,
        marginPercentFallback,
        selectedRoundingMethod,
        customRoundingStep
    }: {
        costPrice: number;
        selectedAdjustmentIds?: string[];
        marginPercentFallback?: number;
        selectedRoundingMethod?: PricingRoundingMethod;
        customRoundingStep?: number;
    }) => {
        const safeCostPrice = roundMoney(Math.max(0, Number(costPrice) || 0));
        const normalizedSelectedIds = Array.from(new Set((selectedAdjustmentIds || []).filter(Boolean)));
        const adjustmentSnapshots = buildStationeryAdjustmentSnapshots(normalizedSelectedIds, safeCostPrice);
        const adjustmentTotal = roundMoney(
            adjustmentSnapshots.reduce((sum, snapshot) => sum + Number(snapshot.calculatedAmount || 0), 0)
        );
        const subtotalBeforeMargin = roundMoney(safeCostPrice + adjustmentTotal);
        const marginDetails = resolveStationeryMargin(
            subtotalBeforeMargin,
            Number(marginPercentFallback || 0)
        );
        const preRoundedPrice = roundMoney(subtotalBeforeMargin + marginDetails.marginAmount);

        return {
            costPrice: safeCostPrice,
            selectedAdjustmentIds: normalizedSelectedIds,
            adjustmentSnapshots,
            adjustmentTotal,
            subtotalBeforeMargin,
            marginAmount: marginDetails.marginAmount,
            marginPercent: marginDetails.marginPercent,
            marginLabel: marginDetails.label,
            calculatedPrice: preRoundedPrice,
            sellingPrice: preRoundedPrice,
            roundingDifference: 0,
            roundingMethod: undefined,
            customRoundingStep: customRoundingStep ?? companyDefaultCustomRoundingStep,
            wasRounded: false
        };
    };

    const stationeryAutoPricing = useMemo(() => calculateStationeryPricingLine({
        costPrice: derivedCostPerPiece || formData.cost || 0,
        selectedAdjustmentIds: formData.pricingConfig?.selectedAdjustmentIds || [],
        marginPercentFallback: Number(formData.marginPercent || 0),
        selectedRoundingMethod: formData.pricingConfig?.selectedRoundingMethod,
        customRoundingStep: Number(formData.pricingConfig?.customRoundingStep) || undefined
    }), [
        derivedCostPerPiece,
        formData.cost,
        formData.marginPercent,
        formData.pricingConfig?.selectedAdjustmentIds,
        formData.pricingConfig?.selectedRoundingMethod,
        formData.pricingConfig?.customRoundingStep,
        stationeryAdjustmentOptions,
        activeMarketAdjustments,
        formData.pricingConfig?.marginConfig,
        companyConfig
    ]);

    const displayedStationeryUnitPrice = isItemManualOverride
        ? Number(formData.price) || 0
        : stationeryAutoPricing.sellingPrice;

    useEffect(() => {
        if (formData.type !== 'Stationery' || formData.pricingConfig?.manualOverride) return;

        setFormData(prev => {
            if (prev.type !== 'Stationery' || prev.pricingConfig?.manualOverride) {
                return prev;
            }

            const adjustmentSnapshotsChanged = JSON.stringify(prev.adjustmentSnapshots || []) !== JSON.stringify(stationeryAutoPricing.adjustmentSnapshots || []);
            const selectedIdsChanged = JSON.stringify(prev.pricingConfig?.selectedAdjustmentIds || []) !== JSON.stringify(stationeryAutoPricing.selectedAdjustmentIds || []);
            const hasChanged =
                roundMoney(Number(prev.cost) || 0) !== stationeryAutoPricing.costPrice
                || roundMoney(Number(prev.cost_price ?? prev.cost) || 0) !== stationeryAutoPricing.costPrice
                || roundMoney(Number(prev.marginPercent) || 0) !== stationeryAutoPricing.marginPercent
                || roundMoney(Number(prev.calculated_price) || 0) !== stationeryAutoPricing.calculatedPrice
                || roundMoney(Number(prev.price) || 0) !== stationeryAutoPricing.sellingPrice
                || roundMoney(Number(prev.selling_price ?? prev.price) || 0) !== stationeryAutoPricing.sellingPrice
                || roundMoney(Number(prev.rounding_difference) || 0) !== stationeryAutoPricing.roundingDifference
                || prev.rounding_method !== stationeryAutoPricing.roundingMethod
                || adjustmentSnapshotsChanged
                || selectedIdsChanged
                || roundMoney(Number(prev.pricingConfig?.marketAdjustment) || 0) !== stationeryAutoPricing.adjustmentTotal
                || roundMoney(Number(prev.pricingConfig?.totalCost) || 0) !== stationeryAutoPricing.costPrice;

            if (!hasChanged) {
                return prev;
            }

            return {
                ...prev,
                cost: stationeryAutoPricing.costPrice,
                cost_price: stationeryAutoPricing.costPrice,
                marginPercent: stationeryAutoPricing.marginPercent,
                calculated_price: stationeryAutoPricing.calculatedPrice,
                price: stationeryAutoPricing.sellingPrice,
                selling_price: stationeryAutoPricing.sellingPrice,
                rounding_difference: stationeryAutoPricing.roundingDifference,
                rounding_method: stationeryAutoPricing.roundingMethod,
                adjustmentSnapshots: stationeryAutoPricing.adjustmentSnapshots,
                pricingConfig: {
                    ...prev.pricingConfig!,
                    selectedAdjustmentIds: stationeryAutoPricing.selectedAdjustmentIds,
                    marketAdjustment: stationeryAutoPricing.adjustmentTotal,
                    totalCost: stationeryAutoPricing.costPrice
                }
            };
        });
    }, [
        formData.type,
        formData.pricingConfig?.manualOverride,
        stationeryAutoPricing
    ]);

    const patchPricingConfig = (patch: Partial<PricingConfig>) => {
        setFormData(prev => ({
            ...prev,
            pricingConfig: {
                ...prev.pricingConfig!,
                ...patch
            }
        }));
    };

    const handlePricingConfigChange = (field: string, value: any) => {
        patchPricingConfig({ [field]: value } as Partial<PricingConfig>);
    };

    const handleToggleAdjustment = (adjId: string) => {
        setFormData(prev => {
            const currentIds = prev.pricingConfig?.selectedAdjustmentIds || [];
            const isSelected = currentIds.includes(adjId);
            const nextIds = isSelected
                ? currentIds.filter(id => id !== adjId)
                : [...currentIds, adjId];

            return {
                ...prev,
                pricingConfig: {
                    ...prev.pricingConfig!,
                    selectedAdjustmentIds: nextIds
                }
            };
        });
    };

    const updateFinishingOption = (id: string, field: keyof FinishingOption, value: any) => {
        setFormData(prev => {
            const current = prev.pricingConfig?.finishingOptions || [];
            const updated = current.map(opt => opt.id === id ? { ...opt, [field]: value } : opt)
                // remove any with quantity <= 0
                .filter(o => Number(o.quantity || 0) > 0);

            return { ...prev, pricingConfig: { ...prev.pricingConfig!, finishingOptions: updated } };
        });
    };


    const generateVariantId = (): string => {
        return 'VAR-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 5).toUpperCase();
    };

    const recalculateStationeryVariantPricing = (
        currentVariant: Partial<ProductVariant>,
        incomingPatch: Partial<ProductVariant>
    ): ProductVariant => {
        const merged = { ...currentVariant, ...incomingPatch };
        const cp = Number(merged.costPrice ?? merged.cost_price ?? merged.cost ?? 0);
        const sp = Number(merged.sellingPrice ?? merged.selling_price ?? merged.price ?? 0);

        if (!('costPrice' in incomingPatch)) {
            merged.costPrice = cp;
            merged.cost = cp;
            merged.cost_price = cp;
        }
        if (!('sellingPrice' in incomingPatch)) {
            merged.sellingPrice = sp;
            merged.price = sp;
            merged.selling_price = sp;
        }

        return {
            ...merged,
            costPrice: cp,
            sellingPrice: sp,
            cost: cp,
            cost_price: cp,
            price: sp,
            selling_price: sp,
            profitAmount: calculateProfit(cp, sp),
            profitMargin: calculateMarkup(cp, sp),
            minimumMargin: merged.minimumMargin ?? formData.minimumMargin ?? 0,
            pricingValidated: sp > 0 && cp >= 0,
            active: merged.active ?? true
        } as ProductVariant;
    };

    const handleStationeryVariantChange = (variantId: string, patch: Partial<ProductVariant>) => {
        setFormData(prev => ({
            ...prev,
            variants: (prev.variants || []).map(variant => (
                variant.id === variantId
                    ? recalculateStationeryVariantPricing(variant, patch) as ProductVariant
                    : variant
            ))
        }));
    };

    const createNewVariantDraft = (): Partial<ProductVariant> & { source?: VariantSource; stockingUnit?: string; costMethod?: string; bomTemplateId?: string } => {
        const cp = formData.type === 'Stationery' ? (derivedCostPerPiece || 0) : 0;
        return {
            id: '',
            sku: '',
            name: '',
            attributes: {},
            costPrice: cp,
            sellingPrice: 0,
            cost: cp,
            cost_price: cp,
            price: 0,
            selling_price: 0,
            profitAmount: 0,
            profitMargin: 0,
            minimumMargin: formData.minimumMargin ?? 0,
            pricingValidated: false,
            stock: 0,
            pages: 1,
            active: true,
            source: formData.isStationeryPack ? 'purchased' : 'manual',
            stockingUnit: formData.unit || 'pcs',
            costMethod: formData.productType === 'SERVICE' || formData.type === 'Service' ? 'mixed' : undefined,
            bomTemplateId: formData.smartPricing?.bomTemplateId || '',
        };
    };

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};
        const isInternal = formData.inventoryRole === 'internal';

        if (!formData.name?.trim()) {
            newErrors.name = 'Item name is required';
        }

        if (!formData.sku?.trim()) {
            newErrors.sku = 'SKU is required';
        }

        if (!formData.category?.trim()) {
            newErrors.category = 'Category is required';
        }

        if (!formData.type) {
            newErrors.type = 'Item type is required';
        }

        // Only require pricing for non-internal items
        if (!isInternal) {
            if (formData.price === undefined || formData.price < 0) {
                newErrors.price = 'Valid selling price is required';
            }
        }

        if (formData.cost === undefined || formData.cost < 0) {
            newErrors.cost = 'Valid cost price is required';
        }

        if (hasStockFunctionality && (formData.stock === undefined || formData.stock < 0)) {
            newErrors.stock = 'Valid stock quantity is required';
        }

        if (!formData.unit?.trim()) {
            newErrors.unit = 'Unit of measure is required';
        }

        // Resource subtype required for internal/both items
        if ((formData.inventoryRole === 'internal' || formData.inventoryRole === 'both') && !formData.resourceSubtype) {
            newErrors.resourceSubtype = 'Resource subtype is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        const isInternal = formData.inventoryRole === 'internal';
        const isStationery = formData.type === 'Stationery';

        // Skip pricing validation for internal-only items and stationery
        if (!isInternal && !isStationery && pricingValidation && !pricingValidation.valid) {
            alert(`Cannot save: ${pricingValidation.message}`);
            return;
        }

        setIsSubmitting(true);

        try {
            const resolvedCost = roundMoney(costPrice);
            const resolvedSellingPrice = isInternal ? 0 : roundMoney(sellingPrice);
            const resolvedProfit = isInternal ? 0 : (pricingValidation ? pricingValidation.profit : 0);
            const resolvedMargin = isInternal ? 0 : (pricingValidation ? pricingValidation.profitMargin : 0);
            const resolvedMinMargin = isInternal ? 0 : (pricingValidation ? pricingValidation.minimumMargin : resolveMinimumMarkup(formData as Item));

            const itemData: Item = {
                id: formData.id || generateId(),
                uuid: formData.uuid || generateId(),
                name: formData.name!.trim(),
                sku: formData.sku!.trim(),
                description: formData.description?.trim() || '',
                price: resolvedSellingPrice,
                cost: resolvedCost,
                cost_price: resolvedCost,
                costPrice: resolvedCost,
                sellingPrice: resolvedSellingPrice,
                selling_price: resolvedSellingPrice,
                profitAmount: resolvedProfit,
                profitMargin: resolvedMargin,
                minimumMargin: resolvedMinMargin,
                pricingValidated: isInternal ? true : true,
                validationTimestamp: new Date().toISOString(),
                stock: hasStockFunctionality ? (Number(formData.stock) || 0) : 0,
                category: formData.category!.trim(),
                type: formData.type as Item['type'],
                unit: formData.unit!.trim(),
                minStockLevel: hasStockFunctionality ? (Number(formData.minStockLevel) || 0) : 0,
                preferredSupplierId: formData.preferredSupplierId || undefined,
                binLocation: formData.binLocation?.trim() || undefined,
                barcode: formData.barcode?.trim() || undefined,
                purchaseUnit: formData.purchaseUnit?.trim() || undefined,
                usageUnit: formData.usageUnit?.trim() || undefined,
                conversionRate: Number(formData.conversionRate) || 1,
                isLargeFormat: formData.isLargeFormat || false,
                rollWidth: Number(formData.rollWidth) || undefined,
                rollLength: Number(formData.rollLength) || undefined,
                pages: Number(formData.pages) || 1,
                leadTimeDays: Number(formData.leadTimeDays) || undefined,
                minOrderQty: hasStockFunctionality ? (Number(formData.minOrderQty) || undefined) : undefined,
                reorderPoint: hasStockFunctionality ? (Number(formData.reorderPoint) || undefined) : undefined,
                variants: formData.variants || [],
                variantModels: derivedVariantModels,
                isVariantParent: (formData.variants && formData.variants.length > 0) || formData.isVariantParent || false,
                locationStock: hasStockFunctionality ? (formData.locationStock || []) : [],
                reserved: hasStockFunctionality ? (formData.reserved || 0) : 0,
                adjustmentSnapshots: formData.adjustmentSnapshots || [],
                pricingConfig: formData.pricingConfig,
                smartPricing: formData.smartPricing,
                // Inventory Resource fields
                inventoryRole: formData.inventoryRole,
                resourceSubtype: formData.resourceSubtype,
                consumptionUnit: formData.consumptionUnit?.trim() || undefined,
                conversionFactor: Number(formData.conversionFactor) || 1,
                normalizedCP: isInternal ? resolvedCost : undefined,
            };

            if (mode === 'edit') {
                await onUpdate(itemData);
            } else {
                await onSave(itemData);
            }

            handleClose();
        } catch (error) {
            logger.error('Error saving item:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setFormData(defaultItem);
        setErrors({});
        setShowVariantForm(false);
        setNewVariant(createNewVariantDraft());
        onClose();
    };

    const handleAddVariant = () => {
        if (!newVariant.name) {
            return;
        }

        const variantPages = Number(newVariant.pages) || 1;
        const isDynamic = newVariant.pricingSource === 'dynamic' || newVariant.inheritsParentBOM === true;
        const variantSku = newVariant.sku || generateAutoSKU(
            formData.type || 'ITEM',
            formData.name || newVariant.name || 'VAR',
            newVariant.attributes,
            inventory
        );
        
        let smartResult = null;
        if (isDynamic) {
            // Use SmartPricing engine if parent has a smartPricing snapshot AND variant is dynamic
            smartResult = calculateSmartVariantPrice(variantPages, 1);
        }

        const cp = (isDynamic && smartResult) ? smartResult.baseCost : (Number(newVariant.cost) || Number(newVariant.costPrice) || 0);
        const sp = Number(newVariant.sellingPrice ?? newVariant.price ?? 0);
        const variantId = newVariant.id || generateVariantId();
        const variantSource = (newVariant.source || formData.isStationeryPack ? 'purchased' : 'manual') as VariantSource;
        const variant: ProductVariant = {
            id: variantId,
            productId: formData.id || generateId(),
            uuid: generateId(),
            sku: variantSku,
            name: newVariant.name,
            attributes: newVariant.attributes || {},
            costPrice: cp,
            sellingPrice: sp,
            cost: cp,
            cost_price: cp,
            price: sp,
            selling_price: sp,
            profitAmount: calculateProfit(cp, sp),
            profitMargin: calculateMarkup(cp, sp),
            minimumMargin: newVariant.minimumMargin ?? formData.minimumMargin ?? 0,
            pricingValidated: sp > 0 && cp >= 0,
            active: true,
            stock: Number(newVariant.stock) || 0,
            pages: variantPages
        };
        const nextVariant = variant;

        // Build the unified Variant model (dual-write)
        const unifiedVariant: Variant = toVariant(formData as Item, nextVariant);
        unifiedVariant.source = variantSource;
        unifiedVariant.stockingUnit = newVariant.stockingUnit || formData.unit || 'pcs';
        unifiedVariant.costMethod = (newVariant.costMethod as ServiceCostMethod) || (formData.productType === 'SERVICE' || formData.type === 'Service' ? 'mixed' as const : undefined);
        if (newVariant.bomTemplateId) {
            unifiedVariant.serviceRecipeId = newVariant.bomTemplateId;
        }

        setFormData(prev => ({
            ...prev,
            variants: [...(prev.variants || []), nextVariant],
            variantModels: [...((prev.variantModels || []) as Variant[]), unifiedVariant],
            isVariantParent: true
        }));

        setNewVariant(createNewVariantDraft());
        setVariantPreview(null);
        setShowVariantForm(false);
    };

    const handleRemoveVariant = (variantId: string) => {
        setFormData(prev => {
            const newVariants = (prev.variants || []).filter(v => v.id !== variantId);
            const newModels = ((prev.variantModels || []) as Variant[]).filter(v => v.id !== variantId);
            return {
                ...prev,
                variants: newVariants,
                variantModels: newModels,
                isVariantParent: newVariants.length > 0
            };
        });
    };

    const openVariantForm = () => {
        setNewVariant(createNewVariantDraft());
        setShowVariantForm(true);
        if (formData.smartPricing) {
            setVariantPreview(calculateSmartVariantPrice(1, 1));
        } else {
            setVariantPreview(null);
        }
    };

    const handleLocationStockChange = (warehouseId: string, quantity: number) => {
        setFormData(prev => {
            const currentLocations = prev.locationStock || [];
            const existingIndex = currentLocations.findIndex(l => l.warehouseId === warehouseId);

            if (existingIndex >= 0) {
                const updated = [...currentLocations];
                updated[existingIndex] = { warehouseId, quantity };
                return { ...prev, locationStock: updated };
            } else {
                return { ...prev, locationStock: [...currentLocations, { warehouseId, quantity }] };
            }
        });
    };

    const handleVariantPagesChange = (variantId: string, newPages: number) => {
        const variant = formData.variants?.find(v => v.id === variantId);
        if (!variant) return;

        const specs = calculateItemFinancials(newPages, formData.pricingConfig, formData.type, variant.cost);
        const newCp = specs
            ? Number((specs.paperCost || 0) + (specs.tonerCost || 0) + (specs.finishingCost || 0))
            : Number(variant.costPrice ?? variant.cost ?? 0);

        handleStationeryVariantChange(variantId, { pages: newPages, costPrice: newCp, cost: newCp, cost_price: newCp });
    };

    const handleBulkGenerate = () => {
        const baseCp = Number(formData.costPrice ?? formData.cost ?? 0);
        const baseSp = Number(formData.sellingPrice ?? formData.price ?? 0);
        const variants = generateBulkVariants(
            baseSp,
            baseCp,
            bulkAttributes.filter(a => a.values.length > 0)
        );

        const taggedVariants = variants.map(v => {
            const cp = Number(v.costPrice ?? v.cost ?? baseCp);
            const sp = Number(v.sellingPrice ?? v.price ?? baseSp);
            return {
                ...v,
                id: generateId(),
                sku: generateAutoSKU(formData.type || 'ITEM', formData.name || 'UNK', v.attributes, inventory),
                name: `${formData.name} - ${v.name}`,
                attributes: v.attributes || {},
                costPrice: cp,
                sellingPrice: sp,
                cost: cp,
                cost_price: cp,
                price: sp,
                selling_price: sp,
            profitAmount: calculateProfit(cp, sp),
            profitMargin: calculateMarkup(cp, sp),
                minimumMargin: formData.minimumMargin ?? 0,
                pricingValidated: sp > 0 && cp >= 0,
                active: true
            } as ProductVariant;
        });

        const unifiedVariants = taggedVariants.map(v => {
            const uv = toVariant(formData as Item, v);
            uv.source = 'manual';
            uv.stockingUnit = formData.unit || 'pcs';
            uv.costMethod = (formData.productType === 'SERVICE' || formData.type === 'Service') ? 'mixed' as const : undefined;
            return uv;
        });

        setFormData(prev => ({
            ...prev,
            variants: [...(prev.variants || []), ...taggedVariants],
            variantModels: [...((prev.variantModels || []) as Variant[]), ...unifiedVariants],
            isVariantParent: true
        }));

        setShowBulkGenerator(false);
    };

    const addBulkValue = (index: number) => {
        const val = bulkInputValue[index]?.trim();
        if (!val) return;

        setBulkAttributes(prev => {
            const updated = [...prev];
            if (!updated[index].values.includes(val)) {
                updated[index].values.push(val);
            }
            return updated;
        });

        setBulkInputValue(prev => ({ ...prev, [index]: '' }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[4vh] sm:items-center sm:p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal - Premium compact size */}
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-[44.8rem] max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-200">
                
                {/* Premium Header */}
                <div className="sticky top-0 z-30 bg-gradient-to-r from-white to-white/95 dark:from-slate-900 dark:to-slate-900/95 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50">
                    <div className="flex items-center justify-between px-5 py-3">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                                    <Package className="w-4.5 h-4.5 text-white" />
                                </div>
                                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
                            </div>
                            <div>
                                <h2 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">
                                    {mode === 'edit' ? 'Edit Item' : 'New Item'}
                                </h2>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {mode === 'edit' ? item?.name : 'Add to inventory'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className={premium.btnPrimary}
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-3.5 h-3.5" />
                                        Save
                                    </>
                                )}
                            </button>
                            <button
                                onClick={handleClose}
                                className={premium.btnIcon}
                            >
                                <X className="w-4.5 h-4.5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Body: Sidebar + Content */}
                <div className="flex flex-1 overflow-hidden">
                    
                    {/* Premium Sidebar Navigation */}
                    <div className={premium.sidebar + " shrink-0 hidden md:flex py-3"}>
                        {([
                            { id: 'basic', label: 'Basic Info', icon: Tag, desc: 'Name, SKU, category' },
                            { id: 'pricing', label: 'Pricing', icon: Calculator, desc: 'Cost, markup, price' },
                            { id: 'inventory', label: 'Inventory', icon: Box, desc: 'Stock, warehouse' },
                            { id: 'variants', label: 'Variants', icon: Layers, desc: 'Product variations' }
                        ] as { id: 'basic' | 'pricing' | 'inventory' | 'variants'; label: string; icon: any; desc: string }[])
                            .filter(tab => tab.id !== 'inventory' || hasStockFunctionality)
                            .filter(tab => tab.id !== 'pricing' || formData.type === 'Product' || formData.type === 'Service' || formData.type === 'Stationery' || formData.type === 'Material')
                            .filter(tab => tab.id !== 'variants' || formData.type !== 'Material')
                            .map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                                onClick={() => setActiveTab(tab.id)}
                                                className={premium.sidebarItem(activeTab === tab.id) + " text-left"}
                            >
                                <tab.icon className={`w-4 h-4 shrink-0 ${activeTab === tab.id ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                                <div className="min-w-0">
                                    <div className="text-sm font-medium truncate">{tab.label}</div>
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{tab.desc}</div>
                                </div>
                            </button>
                        ))}
                        <div className="mt-auto mx-3">
                            <div className="h-px bg-gradient-to-r from-transparent via-slate-200/50 to-transparent dark:via-slate-700/50 mb-3" />
                            <div className="bg-gradient-to-br from-slate-50/50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-700/50 border border-slate-200/50 dark:border-slate-700/50 rounded-xl p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Margin</span>
                                    <span className={`text-sm font-bold ${pricingValidation?.valid ? 'text-emerald-600' : 'text-red-500'}`}>
                                        {pricingValidation?.profitMargin.toFixed(1) ?? '0.0'}%
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</span>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        pricingValidation?.valid
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-red-100 text-red-700'
                                    }`}>
                                        {pricingValidation?.valid ? 'OK' : 'Below Min'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Product</span>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        formData.status === 'Active' ? 'bg-emerald-100 text-emerald-700' :
                                        formData.status === 'Inactive' ? 'bg-slate-100 text-slate-600' :
                                        'bg-amber-100 text-amber-700'
                                    }`}>
                                        {formData.status || 'Active'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Mobile Tab Bar (visible on small screens) */}
                    <div className="md:hidden flex items-center px-3 gap-1 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200/50 dark:border-slate-700/50 overflow-x-auto scrollbar-hide shrink-0">
                        {([
                            { id: 'basic', label: 'Info', icon: Tag },
                            { id: 'pricing', label: 'Price', icon: Calculator },
                            { id: 'inventory', label: 'Stock', icon: Box },
                            { id: 'variants', label: 'Variants', icon: Layers }
                        ] as { id: 'basic' | 'pricing' | 'inventory' | 'variants'; label: string; icon: any }[])
                            .filter(tab => tab.id !== 'inventory' || hasStockFunctionality)
                            .filter(tab => tab.id !== 'pricing' || formData.type === 'Product' || formData.type === 'Service' || formData.type === 'Stationery' || formData.type === 'Material')
                            .filter(tab => tab.id !== 'variants' || formData.type !== 'Material')
                            .map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                                onClick={() => setActiveTab(tab.id)}
                                                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-all border-b-2 whitespace-nowrap ${activeTab === tab.id
                                    ? 'text-blue-600 border-blue-600 bg-blue-50/50 dark:text-blue-400 dark:bg-blue-900/20'
                                    : 'text-slate-500 border-transparent hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                                    }`}
                            >
                                <tab.icon className="w-3.5 h-3.5" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-auto p-5">
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Validation Error Summary */}
                            {Object.keys(errors).length > 0 && (
                                <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
                                    <AlertCircle size={16} className="text-rose-500 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Please fix the following errors</p>
                                        <ul className="mt-1.5 space-y-0.5">
                                            {Object.values(errors).filter(Boolean).map((msg, i) => (
                                                <li key={i} className="text-xs text-rose-600 font-medium">â€¢ {msg}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                             {/* Basic Info Tab */}
                             {activeTab === 'basic' && (
                                  <div className={premium.glassCard + " p-5"}>
                                      <h3 className={premium.sectionTitle}>Basic Information</h3>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                         {/* Name */}
                                         <div className="flex items-center gap-2">
                                             <label htmlFor="itemName" className={premium.label}>Item name</label>
                                             <input
                                                 type="text"
                                                 id="itemName"
                                                 value={formData.name || ''}
                                                 onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                 className={`${premium.input} ${errors.name ? premium.inputError : ''}`}
                                                 placeholder="e.g. Glossy Photo Paper"
                                             />
                                         </div>
                                         {errors.name && (
                                             <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                                                 <AlertCircle className="w-3 h-3" /> {errors.name}
                                             </p>
                                         )}

                                         {/* SKU */}
                                         <div className="flex items-center gap-2">
                                             <label htmlFor="itemSKU" className={premium.label}>SKU/code</label>
                                             <div className="flex gap-2 flex-1">
                                                 <input
                                                     type="text"
                                                     id="itemSKU"
                                                     value={formData.sku || ''}
                                                     onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                                     className={`${premium.input} ${errors.sku ? premium.inputError : ''}`}
                                                     placeholder="e.g. SKU-GPP-001"
                                                 />
                                                 <button
                                                     type="button"
                                                    onClick={() => {
                                                        const sku = generateAutoSKU(formData.type || 'ITEM', formData.name || 'UNK', undefined, inventory);
                                                        setFormData({ ...formData, sku });
                                                     }}
                                                     className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                                                     title="Auto-Generate SKU"
                                                 >
                                                     <Wand2 className="w-5 h-5" />
                                                 </button>
                                             </div>
                                         </div>
                                         {errors.sku && (
                                             <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                                                 <AlertCircle className="w-3 h-3" /> {errors.sku}
                                             </p>
                                         )}

                                         {/* Category */}
                                         <div className="flex items-center gap-2">
                                             <label htmlFor="itemCategory" className={premium.label}>Category</label>
                                             <input
                                                 type="text"
                                                 id="itemCategory"
                                                 value={formData.category || ''}
                                                 onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                                 className={`${premium.input} ${errors.category ? premium.inputError : ''}`}
                                                 placeholder="e.g. Office Supplies"
                                                 list="categories"
                                             />
                                         </div>
                                         {errors.category && (
                                             <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                                                 <AlertCircle className="w-3 h-3" /> {errors.category}
                                             </p>
                                         )}

                                         {/* Type */}
                                         <div className="flex items-center gap-2">
                                             <label htmlFor="itemType" className={premium.label}>Item type</label>
                                            <select
                                                id="itemType"
                                                value={formData.type || 'Product'}
                                                onChange={(e) => {
                                                    const nextType = e.target.value as Item['type'];
                                                    const nextSupportsStock = isStockTrackedItemType(nextType);
                                                    
                                                    // Preserve price when converting Product to Service (for products without variants)
                                                    const isConvertingToService = nextType === 'Service' && formData.type === 'Product';
                                                    const hasNoVariants = !formData.variants || formData.variants.length === 0;
                                                    // Check if product has BOM (Bill of Materials)
                                                    const hasBOM = Boolean(formData.bomTemplateId || (formData.smartPricing && formData.smartPricing.bomTemplateId));
                                                    
                                                    // FIX: Always preserve price, BOM, and details when converting Product to Service
                                                    if (isConvertingToService) {
                                                        // Preserve current price, cost, BOM and all details by enabling manual override
                                                        // FIX: Reset conversionRate to 1 to prevent price multiplication bug
                                                        // If product has BOM, make it a customizable service
                                                        setFormData({
                                                            ...formData,
                                                            type: nextType,
                                                            price: formData.price,
                                                            selling_price: formData.selling_price,
                                                            cost: formData.cost,
                                                            cost_price: formData.cost_price,
                                                            conversionRate: 1, // FIX: Reset to prevent price * conversionRate multiplication
                                                            ...(hasBOM ? {
                                                                // Product has BOM - make it a customizable service
                                                                bomTemplateId: formData.bomTemplateId,
                                                                smartPricing: {
                                                                    ...formData.smartPricing,
                                                                    bomTemplateId: formData.smartPricing?.bomTemplateId || formData.bomTemplateId,
                                                                    isCustomizableService: true
                                                                }
                                                            } : {}),
                                                            pricingConfig: {
                                                                ...formData.pricingConfig,
                                                                manualOverride: true
                                                            },
                                                            ...(nextSupportsStock ? {} : {
                                                                stock: 0,
                                                                reserved: 0,
                                                                minStockLevel: 0,
                                                                reorderPoint: 0,
                                                                locationStock: []
                                                            })
                                                        });
                                                    } else {
                                                        setFormData({
                                                            ...formData,
                                                            type: nextType,
                                                            ...(nextSupportsStock ? {} : {
                                                                stock: 0,
                                                                reserved: 0,
                                                                minStockLevel: 0,
                                                                reorderPoint: 0,
                                                                locationStock: []
                                                            })
                                                        });
                                                    }
                                                }}
                                                className={`${premium.select} ${errors.type ? premium.inputError : ''}`}
                                            >
                                                 <option value="Product">Product</option>
                                                 <option value="Material">Material</option>
                                                 <option value="Service">Service</option>
                                                 <option value="Stationery">Stationery</option>
                                             </select>
                                         </div>
                                         {errors.type && (
                                             <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                                                 <AlertCircle className="w-3 h-3" /> {errors.type}
                                             </p>
                                         )}

                                         {/* Unit */}
                                         <div className="flex items-center gap-2">
                                             <label htmlFor="itemUnit" className={premium.label}>Unit of sale</label>
                                             <select
                                                 id="itemUnit"
                                                 value={formData.unit || 'pcs'}
                                                 onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                                 className={premium.select}
                                             >
                                                 {getUnitOptions().map(option => (
                                                     <option key={option} value={option}>{option}</option>
                                                 ))}
                                             </select>
                                         </div>
                                          {errors.unit && (
                                              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                                                  <AlertCircle className="w-3 h-3" /> {errors.unit}
                                              </p>
                                          )}
                                      </div>

                                      {/* Inventory Role */}
                                      <div>
                                          <label className={premium.label}>Inventory Role</label>
                                          <select
                                              value={formData.inventoryRole || ''}
                                              onChange={(e) => {
                                                  const role = (e.target.value || undefined) as InventoryRole | undefined;
                                                  setFormData({ ...formData, inventoryRole: role });
                                              }}
                                              className={premium.select}
                                          >
                                              <option value="">Auto (based on type)</option>
                                              <option value="sellable">Sellable</option>
                                              <option value="internal">Internal Only (cost source)</option>
                                              <option value="both">Both</option>
                                          </select>
                                      </div>

                                      {/* Resource Subtype (shown for internal / both) */}
                                      {(formData.inventoryRole === 'internal' || formData.inventoryRole === 'both') && (
                                          <div>
                                              <label className={premium.label}>Resource Subtype</label>
                                              <select
                                                  value={formData.resourceSubtype || ''}
                                                  onChange={(e) => setFormData({ ...formData, resourceSubtype: (e.target.value || undefined) as ResourceSubtype | undefined })}
                                                  className={premium.select}
                                              >
                                                  <option value="">Select subtype...</option>
                                                  <option value="raw_material">Raw Material</option>

                                                  <option value="packaging">Packaging</option>
                                                  <option value="spare_part">Spare Part</option>
                                              </select>
                                          </div>
                                      )}

                                      {/* Purchase / Consumption units (shown for internal / both) */}
                                      {(formData.inventoryRole === 'internal' || formData.inventoryRole === 'both') && (
                                          <>
                                              <div>
                                                  <label className={premium.label}>Purchase Unit</label>
                                                  <input
                                                      type="text"
                                                      value={formData.purchaseUnit || ''}
                                                      onChange={(e) => setFormData({ ...formData, purchaseUnit: e.target.value })}
                                                      className={premium.input}
                                                      placeholder="e.g. Ream, Cartridge, Roll"
                                                  />
                                              </div>
                                              <div>
                                                  <label className={premium.label}>Consumption Unit</label>
                                                  <input
                                                      type="text"
                                                      value={formData.consumptionUnit || ''}
                                                      onChange={(e) => setFormData({ ...formData, consumptionUnit: e.target.value })}
                                                      className={premium.input}
                                                      placeholder="e.g. Sheet, Page, Gram"
                                                  />
                                              </div>
                                              <div>
                                                  <label className={premium.label}>Conversion Factor</label>
                                                  <input
                                                      type="number"
                                                      step="0.0001"
                                                      min="0.0001"
                                                      value={formData.conversionFactor || 1}
                                                      onChange={(e) => setFormData({ ...formData, conversionFactor: parseFloat(e.target.value) || 1 })}
                                                      className={premium.input}
                                                      placeholder="e.g. 500 (sheets per ream)"
                                                  />
                                                  <p className="text-[10px] text-slate-400 mt-1">
                                                      How many consumption units per one purchase unit
                                                  </p>
                                              </div>
                                          </>
                                      )}

                                     {/* Description */}
                                     <div>
                                         <label htmlFor="itemDescription" className={premium.label}>Description</label>
                                         <textarea
                                             id="itemDescription"
                                             value={formData.description || ''}
                                             onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                             className={premium.textarea}
                                             rows={3}
                                             placeholder="e.g. High-quality paper for professional photography"
                                         />
                                     </div>

                                      {/* Product-specific sections removed: Print specifications eliminated per request */}

                                     

                                     {/* Large Format Toggle */}
                                     <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                                         <input
                                             type="checkbox"
                                             id="isLargeFormat"
                                             checked={formData.isLargeFormat || false}
                                             onChange={(e) => setFormData({ ...formData, isLargeFormat: e.target.checked })}
                                             className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                         />
                                         <label htmlFor="isLargeFormat" className="text-sm font-medium text-slate-700">
                                             Large Format Item (Rolls/Bulk)
                                         </label>
                                     </div>

                                     {formData.isLargeFormat && (
                                         <div className="grid grid-cols-2 gap-4 pl-4 border-l-4 border-indigo-200">
                                             <div>
                                                 <label htmlFor="rollWidth" className={premium.label}>Roll Width (cm)</label>
                                                 <input
                                                     type="number"
                                                     id="rollWidth"
                                                     value={formData.rollWidth || ''}
                                                     onChange={(e) => setFormData({ ...formData, rollWidth: Number(e.target.value) })}
                                                     className={premium.input}
                                                     placeholder="e.g. 61"
                                                 />
                                             </div>
                                             <div>
                                                 <label htmlFor="rollLength" className={premium.label}>Roll Length (m)</label>
                                                 <input
                                                     type="number"
                                                     id="rollLength"
                                                     value={formData.rollLength || ''}
                                                     onChange={(e) => setFormData({ ...formData, rollLength: Number(e.target.value) })}
                                                     className={premium.input}
                                                     placeholder="e.g. 30"
                                                 />
                                             </div>
                                         </div>
                                     )}
                                 </div>
                             )}

{/* Pricing Tab - Premium Design */}
                            {activeTab === 'pricing' && (
                                <div className={premium.glassCard + " p-5"}>
                                    <PricingTab
                                        costPrice={costPrice}
                                        sellingPrice={sellingPrice}
                                        profitAmount={pricingValidation?.profit ?? 0}
                                        profitMargin={pricingValidation?.profitMargin ?? 0}
                                        minimumMargin={pricingValidation?.minimumMargin ?? resolveMinimumMarkup(formData as Item)}
                                        valid={pricingValidation?.valid ?? false}
                                        message={pricingValidation?.message ?? ''}
                                        currency={currency}
                                        onSellingPriceChange={handleSellingPriceChange}
                                        isSaving={isSubmitting}
                                        costSource={
                                            formData.inventoryRole === 'internal'
                                                ? { type: 'internal', label: 'Internal Resource', details: `Cost source (${formData.resourceSubtype || 'raw material'})` }
                                                : formData.productType === 'SERVICE' || formData.type === 'Service'
                                                    ? {
                                                          type: formData.smartPricing?.bomTemplateId ? 'smart_pricing' : 'recipe',
                                                          label: formData.smartPricing?.bomTemplateId ? 'Smart Pricing / BOM' : 'Service Recipe',
                                                          details: formData.smartPricing?.bomTemplateId ? `Using BOM template` : undefined,
                                                      }
                                                    : formData.smartPricing?.bomTemplateId
                                                        ? { type: 'smart_pricing', label: 'Smart Pricing / BOM' }
                                                        : undefined
                                        }
                                        inventoryRole={formData.inventoryRole}
                                    />
                                </div>
                            )}
                            {/* Inventory Tab */}
                            {activeTab === 'inventory' && (
                                <div className={premium.glassCard + " p-5"}>
                                    <h3 className={premium.sectionTitle}>Inventory &amp; Stock</h3>
                                    {/* Metric Tiles */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className={premium.glassCard}>
                                            <div className="text-xs text-slate-500 mb-1">On hand</div>
                                            <div className="text-lg font-medium text-slate-800">
                                                {formData.stock || 0} <span className="text-xs font-normal text-slate-400">{formData.purchaseUnit || formData.unit || 'units'}</span>
                                            </div>
                                        </div>
                                        <div className={premium.glassCard}>
                                            <div className="text-xs text-slate-500 mb-1">Reserved</div>
                                            <div className="text-lg font-medium text-slate-800">
                                                {formData.reserved || 0} <span className="text-xs font-normal text-slate-400">{formData.purchaseUnit || formData.unit || 'units'}</span>
                                            </div>
                                        </div>
                                        <div className={premium.glassCard}>
                                            <div className="text-xs text-slate-500 mb-1">Available</div>
                                            <div className="text-lg font-medium text-slate-800">
                                                {(formData.stock || 0) - (formData.reserved || 0)} <span className="text-xs font-normal text-slate-400">{formData.purchaseUnit || formData.unit || 'units'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stock Status Badge for Stationery */}
                                    {(formData.type === 'Stationery' || formData.type === 'Service') && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500">Status:</span>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                ((formData.stock || 0) - (formData.reserved || 0)) <= 0 
                                                    ? 'bg-red-100 text-red-700'
                                                    : ((formData.stock || 0) - (formData.reserved || 0)) <= (formData.reorderPoint || 10)
                                                        ? 'bg-amber-100 text-amber-700'
                                                        : 'bg-green-100 text-green-700'
                                            }`}>
                                                {((formData.stock || 0) - (formData.reserved || 0)) <= 0 ? 'Out' : ((formData.stock || 0) - (formData.reserved || 0)) <= (formData.reorderPoint || 10) ? 'Low' : 'OK'}
                                            </span>
                                        </div>
                                    )}

                                    {/* Reorder Settings */}
                                    <div className={premium.glassCard}>
                                        <h3 className={premium.sectionTitle}>Reorder settings</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className={premium.label}>Reorder point</label>
                                                <input
                                                    type="number"
                                                    name="reorderPoint"
                                                    min="0"
                                                    value={formData.reorderPoint || 0}
                                                    onChange={(e) => setFormData({ ...formData, reorderPoint: Number(e.target.value) })}
                                                    className={premium.input}
                                                    placeholder="e.g. 10"
                                                />
                                            </div>
                                            <div>
                                                <label className={premium.label}>Reorder quantity</label>
                                                <input
                                                    type="number"
                                                    name="reorderQty"
                                                    min="1"
                                                    value={formData.minOrderQty || 1}
                                                    onChange={(e) => setFormData({ ...formData, minOrderQty: Number(e.target.value) })}
                                                    className={premium.input}
                                                    placeholder="e.g. 50"
                                                />
                                            </div>
                                            <div>
                                                <label className={premium.label}>Storage location</label>
                                                <input
                                                    type="text"
                                                    name="storageLocation"
                                                    value={formData.binLocation || ''}
                                                    onChange={(e) => setFormData({ ...formData, binLocation: e.target.value })}
                                                    className={premium.input}
                                                    placeholder="e.g. A-1-2"
                                                />
                                            </div>
                                            <div>
                                                <label className={premium.label}>Stock status</label>
                                                <select name="stockStatus" className={premium.select}>
                                                    <option>In Stock</option>
                                                    <option>Low Stock</option>
                                                    <option>Out of Stock</option>
                                                    <option>Discontinued</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Track per Variant Toggle for Stationery */}
                                    {formData.type === 'Stationery' && (
                                        <div className={premium.glassCard}>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm font-medium text-slate-700">Track per variant</div>
                                                    <div className="text-xs text-slate-500">Enable variant-level stock tracking</div>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" name="trackPerVariant" className="sr-only peer" />
                                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                </div>
                            )}

                            {/* Variants Tab */}
                            {activeTab === 'variants' && (
                                <div className={premium.glassCard + " p-5"}>
                                    <h3 className={premium.sectionTitle}>Product Variants</h3>
                                    {/* Header Section */}
                                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                                                        <Layers className="w-5 h-5 text-white" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-lg font-bold text-slate-800">Product Variants</h4>
                                                        <p className="text-sm text-slate-600">Create and manage product variations</p>
                                                    </div>
                                                </div>
                                                {formData.variants && formData.variants.length > 0 && (
                                                    <div className="mt-4 flex items-center gap-4 text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-slate-500">Total Variants:</span>
                                                            <span className="font-bold text-blue-600">{formData.variants.length}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-slate-500">Total Stock:</span>
                                                            <span className="font-bold text-emerald-600">
                                                                {formData.variants.reduce((sum, v) => sum + (v.stock || 0), 0)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-slate-500">Value:</span>
                                                            <span className="font-bold text-purple-600">
                                                                {currency}{formData.variants.reduce((sum, v) => sum + ((Number(v.sellingPrice ?? v.selling_price ?? v.price ?? 0)) * (v.stock || 0)), 0).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowBulkGenerator(true)}
                                                    className="flex items-center gap-2 px-4 py-2.5 bg-white text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-indigo-200 text-sm font-medium shadow-sm"
                                                >
                                                    <Grid className="w-4 h-4" /> Bulk Generate
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={openVariantForm}
                                                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl transition-all text-sm font-medium shadow-sm"
                                                >
                                                    <Plus className="w-4 h-4" /> Add Variant
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bulk Generator Panel */}
                                    {showBulkGenerator && (
                                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-200 shadow-lg animate-in fade-in slide-in-from-top-4">
                                            <div className="flex justify-between items-center mb-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                                                        <Wand2 className="w-4 h-4 text-white" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 text-lg">Bulk Variant Generator</h4>
                                                        <p className="text-sm text-slate-600">Create multiple variants at once</p>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => setShowBulkGenerator(false)} 
                                                    className="p-2 hover:bg-indigo-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>

                                            <div className="space-y-4">
                                                {bulkAttributes.map((attr, idx) => (
                                                    <div key={idx} className="bg-white rounded-xl p-5 border border-indigo-100 shadow-sm">
                                                        <div className="flex gap-4 items-start">
                                                            <div className="w-1/3">
                                                                 <label className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-2 block">Attribute Name</label>
                                                                 <input
                                                                     type="text"
                                                                     name="bulkAttributeName"
                                                                     value={attr.name}
                                                                     onChange={(e) => {
                                                                         const newAttrs = [...bulkAttributes];
                                                                         newAttrs[idx].name = e.target.value;
                                                                         setBulkAttributes(newAttrs);
                                                                     }}
                                                                     className="w-full px-3 py-2.5 border border-indigo-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                                                     placeholder="e.g. Color"
                                                                 />
                                                            </div>
                                                            <div className="flex-1">
                                                                <label className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-2 block">Values</label>
                                                                <div className="flex flex-wrap gap-2 mb-3">
                                                                    {attr.values.map((val, vIdx) => (
                                                                        <span key={vIdx} className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-2 shadow-sm">
                                                                            {val}
                                                                            <button 
                                                                                type="button" 
                                                                                onClick={() => {
                                                                                    const newAttrs = [...bulkAttributes];
                                                                                    newAttrs[idx].values = newAttrs[idx].values.filter((_, i) => i !== vIdx);
                                                                                    setBulkAttributes(newAttrs);
                                                                                }}
                                                                                className="hover:bg-white/20 rounded p-0.5 transition-colors"
                                                                            >
                                                                                <X className="w-3 h-3" />
                                                                            </button>
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                                <div className="flex gap-2">
                                                                     <input
                                                                         type="text"
                                                                         name="bulkAttributeValue"
                                                                         value={bulkInputValue[idx] || ''}
                                                                         onChange={(e) => setBulkInputValue({ ...bulkInputValue, [idx]: e.target.value })}
                                                                         onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addBulkValue(idx))}
                                                                         className="flex-1 px-3 py-2.5 border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                                                         placeholder="e.g. Red"
                                                                     />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => addBulkValue(idx)}
                                                                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                                                                    >
                                                                        Add
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setBulkAttributes(bulkAttributes.filter((_, i) => i !== idx))}
                                                                className="mt-8 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                                disabled={bulkAttributes.length === 1}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}

                                                <button
                                                    type="button"
                                                    onClick={() => setBulkAttributes([...bulkAttributes, { name: '', values: [] }])}
                                                    className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-dashed border-indigo-300 text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 rounded-xl transition-all text-sm font-medium"
                                                >
                                                    <Plus className="w-4 h-4" /> Add Another Attribute
                                                </button>

                                                <div className="pt-6 border-t border-indigo-200 flex justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={handleBulkGenerate}
                                                        className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl flex items-center gap-3 font-medium shadow-lg transition-all transform hover:scale-105"
                                                        disabled={bulkAttributes.some(a => a.values.length === 0)}
                                                    >
                                                        <Wand2 className="w-5 h-5" />
                                                        Generate {bulkAttributes.reduce((acc, curr) => acc * (curr.values.length || 1), 1)} Variants
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Variant Form */}
                                    {showVariantForm && (
                                        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border border-blue-200 shadow-lg space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                                <div>
                                                     <label className="block text-xs font-medium text-slate-600 mb-1">Variant Name</label>
                                                     <input
                                                         type="text"
                                                         name="variantName"
                                                         value={newVariant.name || ''}
                                                         onChange={(e) => setNewVariant({ ...newVariant, name: e.target.value })}
                                                         className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                         placeholder="e.g. A4 Notebook"
                                                     />
                                                 </div>
                                                 <div>
                                                     <label className="block text-xs font-medium text-slate-600 mb-1">Attributes</label>
                                                     <input
                                                         type="text"
                                                         name="variantAttribute"
                                                         value={getVariantAttributeSummary(newVariant)}
                                                         onChange={(e) => setNewVariant({
                                                             ...newVariant,
                                                             attributes: buildVariantAttributesFromText(e.target.value)
                                                         })}
                                                         className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                         placeholder="e.g. Red Cover, 100gsm"
                                                     />
                                                 </div>
                                                   {formData.type !== 'Stationery' && (
                                                   <div>
                                                       <label className="block text-xs font-medium text-slate-600 mb-1">Pages</label>
                                                       <input
                                                           type="number"
                                                           name="variantPages"
                                                           min="1"
                                                           value={newVariant.pages || 1}
                                                           onChange={(e) => {
                                                               const p = Math.max(1, Number(e.target.value) || 1);
                                                               const smartResult = formData.smartPricing ? calculateSmartVariantPrice(p, 1) : null;
                                                               setVariantPreview(smartResult);
                                                               if (smartResult && !(newVariant)._costOverridden) {
                                                                   setNewVariant({
                                                                       ...newVariant,
                                                                       pages: p,
                                                                       costPrice: smartResult.baseCost,
                                                                       cost: smartResult.baseCost,
                                                                       cost_price: smartResult.baseCost,
                                                                   });
                                                               } else {
                                                                   setNewVariant({ ...newVariant, pages: p });
                                                               }
                                                           }}
                                                           className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                           placeholder="e.g. 40"
                                                       />
                                                   </div>
                                                   )}
                                                  <div>
                                                      <label className="block text-xs font-medium text-slate-600 mb-1">Cost Price ({currency})</label>
                                                      <input
                                                          type="number"
                                                          name="variantCostPrice"
                                                          step="0.01"
                                                          value={Number(newVariant.costPrice ?? newVariant.cost_price ?? newVariant.cost ?? 0)}
                                                          onChange={(e) => {
                                                              const cp = Number(e.target.value);
                                                              setNewVariant({ ...newVariant, costPrice: cp, cost: cp, cost_price: cp, _costOverridden: true });
                                                          }}
                                                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                          placeholder="e.g. 5.00"
                                                      />
                                                   </div>
                                                  <div>
                                                      <label className="block text-xs font-medium text-slate-600 mb-1">Selling Price ({currency})</label>
                                                      <input
                                                          type="number"
                                                          name="variantSellingPrice"
                                                          step="0.01"
                                                          value={Number(newVariant.sellingPrice ?? newVariant.selling_price ?? newVariant.price ?? 0)}
                                                          onChange={(e) => {
                                                              const sp = Number(e.target.value);
                                                              setNewVariant({ ...newVariant, sellingPrice: sp, price: sp, selling_price: sp });
                                                          }}
                                                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                          placeholder="e.g. 12.50"
                                                      />
                                                  </div>
                                                  <div>
                                                      <label className="block text-xs font-medium text-slate-600 mb-1">Source</label>
                                                      <select
                                                          value={newVariant.source || 'manual'}
                                                          onChange={(e) => setNewVariant({ ...newVariant, source: e.target.value as VariantSource })}
                                                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                      >
                                                          <option value="manual">Manual</option>
                                                          <option value="purchased">Purchased</option>
                                                          <option value="manufactured">Manufactured</option>
                                                      </select>
                                                  </div>
                                                  <div>
                                                      <label className="block text-xs font-medium text-slate-600 mb-1">Stocking Unit</label>
                                                      <input
                                                          type="text"
                                                          value={newVariant.stockingUnit || formData.unit || 'pcs'}
                                                          onChange={(e) => setNewVariant({ ...newVariant, stockingUnit: e.target.value })}
                                                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                          placeholder="e.g. pcs"
                                                       />
                                                   </div>
                                                   {(formData.productType === 'SERVICE' || formData.type === 'Service') && (
                                                       <>
                                                           <div>
                                                               <label className="block text-xs font-medium text-slate-600 mb-1">Cost Method</label>
                                                               <select
                                                                   value={newVariant.costMethod || 'mixed'}
                                                                    onChange={(e) => setNewVariant({ ...newVariant, costMethod: e.target.value as ServiceCostMethod })}
                                                                   className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                               >
                                                                   <option value="fixed">Fixed Cost</option>
                                                                   <option value="material_based">Material Based</option>
                                                                   <option value="labor_based">Labor Based</option>
                                                                   <option value="mixed">Mixed</option>
                                                               </select>
                                                           </div>
                                                           <div>
                                                               <label className="block text-xs font-medium text-slate-600 mb-1">BOM Template</label>
                                                               <select
                                                                   value={newVariant.bomTemplateId || ''}
                                                                   onChange={(e) => setNewVariant({ ...newVariant, bomTemplateId: e.target.value })}
                                                                   className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                               >
                                                                   <option value="">None (manual recipe)</option>
                                                                   {bomTemplates.map(t => (
                                                                       <option key={t.id} value={t.id}>{t.name}</option>
                                                                   ))}
                                                               </select>
                                                           </div>
                                                       </>
                                                   )}
                                              </div>

                                            {formData.smartPricing && variantPreview && (
                                                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-1.5">
                                                    <div className="text-xs font-semibold text-indigo-700 mb-2 flex items-center gap-1.5">
                                                        <TrendingUp className="w-3.5 h-3.5" /> Smart Pricing BOM Cost ({variantPreview.pages} pages)
                                                    </div>
                                                    <div className="flex justify-between text-xs text-slate-600">
                                                        <span>{inventory.find(i => i.id === formData.smartPricing?.paperItemId)?.name?.replace(/\s*\d+gsm.*/i,'') || 'Paper'}</span>
                                                        <span>{currency}{variantPreview.paperCost.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs text-slate-600">
                                                        <span>{inventory.find(i => i.id === formData.smartPricing?.tonerItemId)?.name?.replace(/\s*Universal\s*/i,'') || 'Toner'}</span>
                                                        <span>{currency}{variantPreview.tonerCost.toFixed(2)}</span>
                                                    </div>
                                                    {variantPreview.finishingCost > 0 && (
                                                        <div className="flex justify-between text-xs text-slate-600">
                                                            <span>Finishing</span>
                                                            <span>{currency}{variantPreview.finishingCost.toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between text-sm font-bold text-indigo-700 border-t border-indigo-200 pt-2 mt-1">
                                                        <span>Cost Price</span>
                                                        <span>{currency}{variantPreview.baseCost.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            )}



                                            <div className="flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowVariantForm(false)}
                                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleAddVariant}
                                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                                                >
                                                    Add Variant
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Variants List Ã¢â‚¬â€ table layout */}
                                    {formData.variants && formData.variants.length > 0 ? (
                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                            <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
                                                <h5 className="font-semibold text-slate-800 text-sm">Active Variants ({formData.variants.length})</h5>
                                                {formData.smartPricing && (
                                                    <span className="text-[10px] font-medium px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full flex items-center gap-1">
                                                        <TrendingUp className="w-3 h-3" /> Smart Pricing
                                                    </span>
                                                )}
                                            </div>

                                            {/* Table */}
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b border-slate-100">
                                                            <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Variant Name</th>
                                                            <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Attributes</th>
                                                            <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Source</th>
                                                            <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Cost Price</th>
                                                            <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">Selling Price</th>
                                                            <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-orange-400 uppercase tracking-wider">Profit</th>
                                                            <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-orange-400 uppercase tracking-wider">Margin</th>
                                                            <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                                                            <th className="w-16 px-3 py-2.5"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {formData.variants.map((variant, idx) => {
                                                            const cp = Number(variant.costPrice ?? variant.cost_price ?? variant.cost ?? 0);
                                                            const sp = Number(variant.sellingPrice ?? variant.selling_price ?? variant.price ?? 0);
                                                            const profit = Number(variant.profitAmount ?? calculateProfit(cp, sp));
                                                             const markup = Number(variant.profitMargin ?? calculateMarkup(cp, sp));
                                                             const validation = validateMinimumMarkup(sp, cp, formData as Item);
                                                            return (
                                                                <tr key={variant.id || idx} className="hover:bg-slate-50 transition-colors align-top">
                                                                    <td className="px-4 py-3">
                                                                        <input
                                                                            type="text"
                                                                            value={variant.name || ''}
                                                                            onChange={(e) => handleStationeryVariantChange(variant.id, { name: e.target.value })}
                                                                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                                                                        />
                                                                        <div className="mt-1 text-[10px] font-mono text-slate-400">{variant.sku}</div>
                                                                    </td>
                                                                        <td className="px-3 py-3">
                                                                        <input
                                                                            type="text"
                                                                            value={getVariantAttributeSummary(variant)}
                                                                            onChange={(e) => handleStationeryVariantChange(variant.id, {
                                                                                attributes: buildVariantAttributesFromText(e.target.value)
                                                                            })}
                                                                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                                                                            placeholder="Attributes"
                                                                        />
                                                                    </td>
                                                                    <td className="px-3 py-3 text-center">
                                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                                                                            (derivedVariantModels[idx]?.source || 'manual') === 'manufactured'
                                                                                ? 'bg-purple-100 text-purple-700'
                                                                                : (derivedVariantModels[idx]?.source || 'manual') === 'purchased'
                                                                                    ? 'bg-blue-100 text-blue-700'
                                                                                    : 'bg-slate-100 text-slate-600'
                                                                        }`}>
                                                                            {derivedVariantModels[idx]?.source || 'manual'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-3 py-3">
                                                                        <input
                                                                            type="number"
                                                                            step="0.01"
                                                                            value={cp}
                                                                            onChange={(e) => {
                                                                                const newCp = Number(e.target.value);
                                                                                handleStationeryVariantChange(variant.id, { costPrice: newCp, cost: newCp, cost_price: newCp });
                                                                            }}
                                                                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-right text-sm text-slate-700"
                                                                        />
                                                                    </td>
                                                                    <td className="px-3 py-3">
                                                                        <input
                                                                            type="number"
                                                                            step="0.01"
                                                                            value={sp}
                                                                            onChange={(e) => {
                                                                                const newSp = Number(e.target.value);
                                                                                handleStationeryVariantChange(variant.id, { sellingPrice: newSp, price: newSp, selling_price: newSp });
                                                                            }}
                                                                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-right text-sm text-slate-700"
                                                                        />
                                                                    </td>
                                                                    <td className="px-3 py-3 text-right">
                                                                        <div className="font-medium text-sm text-slate-700">
                                                                            {currency}{profit.toFixed(2)}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-3 text-right">
                                                                        <div className={`text-sm font-semibold ${validation.valid ? 'text-green-600' : 'text-red-500'}`}>
                                                                            {markup.toFixed(1)}%
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-3 text-center">
                                                                        {validation.valid ? (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-medium">
                                                                                <Check className="w-3 h-3" /> OK
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-medium" title={validation.message}>
                                                                                <X className="w-3 h-3" /> {validation.minimumMarkup ? markup.toFixed(1) + '% < ' + (validation.minimumMarkup * 100).toFixed(1) + '%' : 'Fail'}
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-3 py-3 text-center">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleRemoveVariant(variant.id)}
                                                                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl border-2 border-dashed border-slate-300">
                                            <div className="w-16 h-16 bg-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                                <Layers className="w-8 h-8 text-slate-400" />
                                            </div>
                                            <h5 className="text-lg font-semibold text-slate-700 mb-2">No Variants Yet</h5>
                                            <p className="text-sm text-slate-500 mb-6">Start by adding your first product variant</p>
                                            <button
                                                type="button"
                                                onClick={openVariantForm}
                                                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-medium shadow-sm"
                                            >
                                                <Plus className="w-4 h-4" /> Create First Variant
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </form>
                    </div>

                </div>

                {/* Footer removed for top-tab style */}

            </div >
        </div >
    );
};

export default ItemModal;




