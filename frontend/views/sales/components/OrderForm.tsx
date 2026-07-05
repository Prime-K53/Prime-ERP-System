import React, { useState, useEffect, useMemo, useRef } from 'react';
import { logger } from '@/services/logger';
// PRICING RULE: Raw prices from engine. Display rounding via pricingDisplayService only.
//   No rounding, no markup, no market adjustments in persistence layer.
import { X, Save, Plus, Trash2, Calculator, Info, ShieldCheck, Building2, Package, Tag, Clock, Search, ChevronDown, Coins, UserPlus, Calendar, RefreshCw, Wallet, Mail, Layers, ExternalLink, FileText, Printer, FileDown, Eye, TrendingUp, Truck, Scale, Copy, Sparkles, AlertTriangle, Lightbulb, Image, History, AlertCircle, Check, FolderOpen } from 'lucide-react';
import { useOrders } from '../../../context/OrdersContext';
import { useAuth } from '../../../context/AuthContext';
import { useFinance } from '../../../context/FinanceContext';
import { useSales } from '../../../context/SalesContext';
import { useInventory } from '../../../context/InventoryContext';
import { CartItem, Item, Invoice, ProductVariant, Account, OrderItem, OrderPayment, BOMTemplate, AdjustmentSnapshot, Customer } from '../../../types';
import { generateNextId, getDefaultPaymentTermsForSegment, resolveCustomerPaymentPolicy, roundToCurrency } from '../../../utils/helpers';
import { pricingService, DynamicServicePricingResult } from '../../../services/pricingService';
import { dbService } from '../../../services/db';

import { useNavigate } from 'react-router-dom';
import { VariantSelectorModal, ServiceCalculatorModal } from '../../pos/components/PosModals';
import { Loader2 } from 'lucide-react';
import QuickPrintModal from '../../../components/QuickPrintModal';
import { calculateSellingPrice, calculateServicePrice } from '../../../utils/pricing/pricingEngine';
import { getPlaceholder } from '../../../constants/placeholders';
import { resolveStoredCalculatedPrice, resolveStoredCost, resolveStoredSellingPrice, calculatePhotocopyCostPerPage, calculateTypePrintingCostPerPage } from '../../../utils/pricing';
import { aggregateMarketAdjustmentSnapshots, attachPricingBreakdown, getMarketAdjustmentSnapshots, getSnapshotCalculatedAmount, resolveItemAdjustmentSnapshots, summarizePricingBreakdown } from '../../../utils/pricingBreakdown';
import { displayPrice } from '../../../services/pricingDisplayService';
import { resolveCustomerPrice, getApplicableDiscounts, applyDiscounts, incrementDiscountUsage, getCustomerPricingTier } from '../../../services/customerPricingService';
import { calculateItemTax } from '../../../services/taxRateService';
import { getFifoUnitCost } from '../../../services/fifoCostService';

import { useDocumentPreview } from '../../../hooks/useDocumentPreview';
import { useOrderFormAI, AISuggestionItem, AIPriceOptimisation, AIFraudFlag } from '../../../hooks/useOrderFormAI';
import InventoryTransactionHistory from '../../inventory/components/InventoryTransactionHistory';
import { OfflineImage } from '../../../components/OfflineImage';
import { currencyService } from '../../../services/currencyService';


interface OrderFormProps {
    type: string;
    initialData?: any;
    onSave: (data: any, asDraft?: boolean, auditReason?: string, andPay?: boolean) => void;
    onCancel: () => void;
    onPreview?: () => void;
    saving?: boolean;
}

type QuotationWorkflowType = 'General' | 'Printing';

type PrintServiceJob = {
    id: string;
    jobName: string;
    paperSize: string;
    colorMode: 'bw' | 'color';
    sides: 'single' | 'duplex';
    quantity: number;
    pricePerUnit: number;
    finishing: string[];
};

type PrintQuotationDetails = {
    jobs: PrintServiceJob[];
};

const createPrintJobId = () => `PRINT-JOB-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createEmptyPrintJob = (): PrintServiceJob => ({
    id: createPrintJobId(),
    jobName: '',
    paperSize: 'A4',
    colorMode: 'bw',
    sides: 'single',
    quantity: 1,
    pricePerUnit: 0,
    finishing: []
});

const RECURRING_STATUSES = ['Draft', 'Active', 'Paused', 'Cancelled', 'Expired'] as const;

const cloneSerializable = <T,>(value: T): T => {
    if (value == null) return value;
    if (typeof structuredClone === 'function') {
        try { return structuredClone(value); } catch { /* fall through */ }
    }
    return JSON.parse(JSON.stringify(value));
};

const normalizeDateInputValue = (value?: string | null) => {
    const fallback = new Date();
    const parsed = value ? new Date(value) : fallback;
    if (Number.isNaN(parsed.getTime())) {
        return fallback.toISOString().split('T')[0];
    }
    return parsed.toISOString().split('T')[0];
};

const addRecurringFrequency = (dateValue: string, frequency?: string) => {
    const nextDate = new Date(normalizeDateInputValue(dateValue));
    switch (frequency) {
        case 'Daily':
            nextDate.setDate(nextDate.getDate() + 1);
            break;
        case 'Weekly':
            nextDate.setDate(nextDate.getDate() + 7);
            break;
        case 'Quarterly':
            nextDate.setMonth(nextDate.getMonth() + 3);
            break;
        case 'Annually':
            nextDate.setFullYear(nextDate.getFullYear() + 1);
            break;
        default:
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
    }
    return nextDate.toISOString().split('T')[0];
};

const getDefaultRecurringNextRunDate = (frequency = 'Monthly', fromDate?: string) => {
    return addRecurringFrequency(normalizeDateInputValue(fromDate), frequency);
};

const normalizeRecurringStatus = (status?: string) => {
    if (!status || !RECURRING_STATUSES.includes(status as typeof RECURRING_STATUSES[number])) {
        console.warn(`Unknown recurring status "${status}" — defaulting to Draft`);
        return 'Draft';
    }
    return status;
};

const PAPER_SIZES = ['A4', 'A3', 'A5', 'Letter', 'Legal', 'Tabloid', 'Custom'];
const COLOR_MODE_OPTIONS = [
    { value: 'bw', label: 'Black & White', pricePerUnit: 0 },
    { value: 'color', label: 'Full Color', pricePerUnit: 0 }
];
const SIDES_OPTIONS = [
    { value: 'single', label: 'Single Sided' },
    { value: 'duplex', label: 'Double Sided (Duplex)' }
];

const normalizePrintQuotationDetails = (raw: any): PrintQuotationDetails => {
    const rawJobs = Array.isArray(raw?.jobs) ? raw.jobs : [];
    const jobs = rawJobs.length > 0
        ? rawJobs.map((entry: any) => ({
            id: String(entry?.id || createPrintJobId()),
            jobName: String(entry?.jobName || entry?.job_name || '').trim(),
            paperSize: String(entry?.paperSize || entry?.paper_size || 'A4').trim() || 'A4',
            colorMode: (entry?.colorMode === 'color' ? 'color' : 'bw') as 'bw' | 'color',
            sides: (entry?.sides === 'duplex' ? 'duplex' : 'single') as 'single' | 'duplex',
            quantity: Math.max(1, Math.floor(Number(entry?.quantity) || 1)),
            pricePerUnit: Math.max(0, Number(entry?.pricePerUnit || entry?.price_per_unit) || 0),
            finishing: Array.isArray(entry?.finishing) ? entry.finishing.map(String) : []
        }))
        : [createEmptyPrintJob()];

    return { jobs };
};

const FINISHING_OPTIONS = ['Stapling', 'Binding', 'Lamination', 'Hole Punch', 'Folding', 'Cutting', 'Scoring', 'Padding'];

const buildPrintQuotationItems = (details: PrintQuotationDetails): CartItem[] => {
    return details.jobs
        .map((job) => {
            const name = String(job.jobName || '').trim();
            const qty = Math.max(1, Math.floor(Number(job.quantity) || 1));
            const price = roundToCurrency(Math.max(0, Number(job.pricePerUnit) || 0));

            if (!name || price <= 0) {
                return null;
            }

            const lineTotal = roundToCurrency(qty * price);

            return {
                id: job.id,
                itemId: job.id,
                sku: `PRINT-${job.colorMode === 'color' ? 'CLR' : 'BW'}-${job.paperSize}`,
                name: `${name}`,
                description: `${qty} x ${job.paperSize} ${job.colorMode === 'color' ? 'Color' : 'B&W'} ${job.sides === 'duplex' ? 'Duplex' : 'Single'}`,
                quantity: qty,
                price: price,
                unitPrice: price,
                basePrice: price,
                cost: 0,
                category: 'Printing',
                type: 'Service',
                unit: 'copy',
                minStockLevel: 0,
                stock: 0,
                lineTotalNet: lineTotal,
                adjustmentSnapshots: [],
                serviceDetails: {
                    mode: 'PRINTING_QUOTATION',
                    jobName: name,
                    paperSize: job.paperSize,
                    colorMode: job.colorMode,
                    sides: job.sides,
                    finishing: job.finishing
                }
            } as CartItem;
        })
        .filter(Boolean) as CartItem[];
};

export const OrderForm: React.FC<OrderFormProps> = ({ type, initialData, onSave, onCancel, onPreview, saving }) => {
    const { companyConfig, notify, user } = useAuth();
    const { invoices, recurringInvoices, accounts } = useFinance();
    const { quotations, customerPayments, customers, addCustomer } = useSales();
    const { inventory, marketAdjustments, updateReservedStock } = useInventory();
    const { createOrder } = useOrders();
    const { handlePreview } = useDocumentPreview();
    const navigate = useNavigate();
    const currency = companyConfig?.currencySymbol || currencyService.getCurrency(currencyService.getBaseCurrency())?.symbol || '$';
    const ai = useOrderFormAI();

    const [aiSuggestions, setAiSuggestions] = useState<AISuggestionItem[]>([]);
    const [showAiSuggestions, setShowAiSuggestions] = useState(false);
    const [aiFraudFlags, setAiFraudFlags] = useState<AIFraudFlag[]>([]);
    const [showAiFraud, setShowAiFraud] = useState(false);
    const [aiDiscountSuggestion, setAiDiscountSuggestion] = useState<any>(null);
    const [aiGeneratingDesc, setAiGeneratingDesc] = useState(false);
    const [calculatedOtherCharges, setCalculatedOtherCharges] = useState(0);

    // Derive Customer Names from Transactions and Customers List
    const customerNames = useMemo(() => {
        const names = new Set<string>();
        customers?.forEach(c => names.add(c.name));
        invoices?.forEach(inv => names.add(inv.customerName));
        customerPayments?.forEach(rec => names.add(rec.customerName));
        quotations?.forEach(q => names.add(q.customerName));
        return Array.from(names).sort();
    }, [customers, invoices, customerPayments, quotations]);

    const [formData, setFormData] = useState<any>({
        id: '',
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        customerName: '',
        customerId: '',
        subAccountName: 'Main',
        salesAccountId: companyConfig?.glMapping?.defaultSalesAccount || '4000',
        items: [] as CartItem[],
        status: type === 'Invoice' ? 'Unpaid' : (type === 'Order' ? 'Pending' : 'Draft'),
        discount: 0,
        otherCharges: 0,
        otherChargesEnabled: false,
        otherChargesAdjustment: '',
        otherChargesPercent: 0,
        roundingMethod: 'Nearest',
        roundingEnabled: false,
        frequency: 'Monthly',
        autoDeductWallet: false,
        autoEmail: true,
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        scheduledDates: [] as string[],
        nextRunDate: getDefaultRecurringNextRunDate(),
        notes: '',
        billingAddress: '',
        shippingAddress: '',
        orderNumber: '',
        orderDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'Cash',
        tax: 0,
        taxRate: 0,
        quotationType: 'General' as QuotationWorkflowType,
        printQuotationDetails: normalizePrintQuotationDetails(null),
        customerPricingTier: '',
        customerPricingSegment: '',
        referenceDoc: ''
    });

    const findCustomerByName = (name: string) => {
        const normalized = name.trim().toLowerCase();
        if (!normalized) return undefined;
        return customers.find(c => c.name.trim().toLowerCase() === normalized);
    };

    const ensureCustomerExists = async (name: string): Promise<Customer | null> => {
        const normalizedName = name.trim();
        if (!normalizedName) return null;

        const existing = findCustomerByName(normalizedName);
        if (existing) return existing;

        if (typeof addCustomer !== 'function') return null;

        const newCustomer: Customer = {
            id: generateNextId('CUST', customers, companyConfig),
            name: normalizedName,
            email: '',
            phone: '',
            balance: 0,
            walletBalance: 0,
            creditLimit: 0,
            status: 'Active',
            segment: 'Individual',
            paymentTerms: getDefaultPaymentTermsForSegment('Individual')
        };

        await addCustomer(newCustomer);
        return newCustomer;
    };

    const selectedCustomerObj = useMemo(() => {
        if (!formData.customerName) return null;
        return findCustomerByName(formData.customerName) || null;
    }, [customers, formData.customerName]);

    const customerSubAccounts = useMemo(() => {
        if (!formData.customerName) return [];

        const profileSubs = selectedCustomerObj?.subAccounts || [];

        const transactionSubNames = new Set<string>();
        invoices.filter(i => i.customerName === formData.customerName).forEach(i => {
            if (i.subAccountName) transactionSubNames.add(i.subAccountName);
        });
        customerPayments.filter(r => r.customerName === formData.customerName).forEach(r => {
            if (r.subAccountName) transactionSubNames.add(r.subAccountName);
        });

        const subs = [...profileSubs];
        transactionSubNames.forEach(name => {
            if (!subs.find(s => s.name === name) && name !== 'Main') {
                subs.push({ name, accountNumber: 'Legacy/External', walletBalance: 0 });
            }
        });

        return subs.sort((a, b) => a.name.localeCompare(b.name));
    }, [selectedCustomerObj, formData.customerName, invoices, customerPayments]);

    const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);

    // Search States
    const [customerSearch, setCustomerSearch] = useState('');
    const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
    const [itemSearch, setItemSearch] = useState('');
    const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false);
    const [customerPanelOpen, setCustomerPanelOpen] = useState(false);
    const [showItemHistory, setShowItemHistory] = useState(false);
    const [itemHistoryItemId, setItemHistoryItemId] = useState<string | undefined>();
    const [photoViewItem, setPhotoViewItem] = useState<Item | null>(null);

    const customerDropdownRef = useRef<HTMLDivElement>(null);
    const itemDropdownRef = useRef<HTMLDivElement>(null);

    const getCustomerOutstanding = (name: string) => {
        return (invoices as Invoice[])
            .filter(i => i.customerName === name && i.status !== 'Paid' && i.status !== 'Draft' && i.status !== 'Cancelled')
            .reduce((sum, i) => sum + (i.totalAmount - (i.paidAmount || 0)), 0);
    };

    const filteredCustomers = useMemo(() => {
        return customerNames.filter((name: string) =>
            name.toLowerCase().includes(customerSearch.toLowerCase())
        );
    }, [customerNames, customerSearch]);

    const filteredInventory = useMemo(() => {
        const base = inventory.filter((i: Item) => i.type !== 'Material');
        if (!itemSearch) return base;
        return base.filter((i: Item) =>
            (i.name.toLowerCase().includes(itemSearch.toLowerCase()) || i.sku.toLowerCase().includes(itemSearch.toLowerCase()))
        );
    }, [inventory, itemSearch]);

    const revenueAccounts = useMemo(() => {
        return (accounts as Account[]).filter(acc => acc.type === 'Revenue' || acc.code.startsWith('4'));
    }, [accounts]);

    const [auditReason, setAuditReason] = useState('');
    const [selectedProductForVariants, setSelectedProductForVariants] = useState<Item | null>(null);
    const [selectedServiceForCalculator, setSelectedServiceForCalculator] = useState<Item | null>(null);
    const [serviceEditIndex, setServiceEditIndex] = useState<number | null>(null);
    const [serviceInitialValues, setServiceInitialValues] = useState<{ pages: number; copies: number }>({ pages: 1, copies: 1 });
    const [selectedManualOverrideItemId, setSelectedManualOverrideItemId] = useState('');
    const [manualOverrideValue, setManualOverrideValue] = useState('');
    const [showManualOverrideCard, setShowManualOverrideCard] = useState(false);
    const [bomTemplates, setBomTemplates] = useState<BOMTemplate[]>([]);
    const [quickPrintModal, setQuickPrintModal] = useState<{ open: boolean; type: 'photocopy' | 'printing' }>({
      open: false,
      type: 'photocopy'
    });
    const isEditing = !!initialData?.id;
    const [localUnlock, setLocalUnlock] = useState(false);
    const isQuotation = type === 'Quotation';
    const isRecurring = type === 'Recurring';
    const isPrintingQuotation = isQuotation && formData.quotationType === 'Printing';
    const primaryActionLabel = isRecurring
        ? (isEditing
            ? 'Update Subscription'
            : normalizeRecurringStatus(formData.status) === 'Active'
                ? 'Create & Activate Subscription'
                : 'Save Subscription')
        : (isEditing ? 'Commit Secure Patch' : 'Post & Seal Voucher');
    const printQuotationDetails = useMemo(
        () => normalizePrintQuotationDetails(formData.printQuotationDetails),
        [formData.printQuotationDetails]
    );
    const generatedPrintItems = useMemo(
        () => buildPrintQuotationItems(printQuotationDetails),
        [printQuotationDetails]
    );
    const quotationLineItems = useMemo(
        () => (isPrintingQuotation ? generatedPrintItems : formData.items),
        [formData.items, generatedPrintItems, isPrintingQuotation]
    );
    const manualOverrideItems = useMemo(
        () => (isPrintingQuotation ? [] : (Array.isArray(formData.items) ? formData.items.filter((entry: any) => !entry?.isVariantParent) : [])),
        [formData.items, isPrintingQuotation]
    );
    const selectedManualOverrideItem = useMemo(
        () => manualOverrideItems.find((entry: any) => entry.id === selectedManualOverrideItemId) || manualOverrideItems[0] || null,
        [manualOverrideItems, selectedManualOverrideItemId]
    );
    const printJobCount = useMemo(
        () => printQuotationDetails.jobs.reduce((sum, job) => sum + Math.max(0, Math.floor(Number(job.quantity) || 0)), 0),
        [printQuotationDetails]
    );
    const getPricingDisplayMeta = (label: string) => {
        const normalized = String(label || '').toLowerCase();

        if (normalized.includes('transport') || normalized.includes('logistics') || normalized.includes('delivery')) {
            return { priority: 0, Icon: Truck, iconClass: 'text-blue-500', textClass: 'text-blue-600' };
        }
        if (normalized.includes('waste') || normalized.includes('wastage') || normalized.includes('shrinkage')) {
            return { priority: 1, Icon: Scale, iconClass: 'text-rose-500', textClass: 'text-rose-600' };
        }
        if (normalized.includes('round')) {
            return { priority: 3, Icon: Tag, iconClass: 'text-purple-500', textClass: normalized.includes('-') ? 'text-rose-600' : 'text-purple-600' };
        }
        if (normalized.includes('profit') || normalized.includes('margin')) {
            return { priority: 4, Icon: TrendingUp, iconClass: 'text-emerald-500', textClass: 'text-emerald-600' };
        }
        return { priority: 2, Icon: Tag, iconClass: 'text-indigo-500', textClass: 'text-indigo-600' };
    };
    const isPriceLocked = (!localUnlock) && (initialData?.isPriceLocked || (formData.status === 'Approved' || formData.status === 'Completed' || formData.status === 'Paid'));

    const getAutomaticOrderItemPrice = (item: CartItem | null) => {
        if (!item) return 0;

        const explicitOriginal = Number(item.originalPrice);
        if (Number.isFinite(explicitOriginal) && explicitOriginal > 0) return explicitOriginal;

        const storedSelling = Number(item.selling_price);
        if (Number.isFinite(storedSelling) && storedSelling > 0) return storedSelling;

        const calculatedPrice = Number(item.calculated_price);
        if (Number.isFinite(calculatedPrice) && calculatedPrice > 0) return calculatedPrice;

        return Number(item.price) || 0;
    };

    useEffect(() => {
        if (!manualOverrideItems.length) {
            setSelectedManualOverrideItemId('');
            return;
        }

        const currentExists = manualOverrideItems.some((entry: any) => entry.id === selectedManualOverrideItemId);
        if (!selectedManualOverrideItemId || !currentExists) {
            setSelectedManualOverrideItemId(manualOverrideItems[0].id);
        }
    }, [manualOverrideItems, selectedManualOverrideItemId]);

    useEffect(() => {
        if (selectedManualOverrideItem) {
            setManualOverrideValue(String(Number(selectedManualOverrideItem.price || 0)));
        } else {
            setManualOverrideValue('');
        }
    }, [selectedManualOverrideItem]);

    useEffect(() => {
        if (!manualOverrideItems.length) {
            setShowManualOverrideCard(false);
        }
    }, [manualOverrideItems.length]);

    const applyManualLineItemPrice = (targetId: string, newPrice: number) => {
        const safePrice = roundToCurrency(Math.max(0, Number(newPrice) || 0));

        setFormData((prev: any) => ({
            ...prev,
            items: Array.isArray(prev.items)
                ? prev.items.map((entry: any) => {
                    if (entry.id !== targetId) return entry;

                    const originalPrice = entry.basePrice || entry.cost || entry.price || 0;
                    if (originalPrice > 0) {
                        const deviation = Math.abs(safePrice - originalPrice) / originalPrice;
                        if (deviation > 0.5) {
                            notify(`Price override is ${(deviation * 100).toFixed(0)}% from original price — verify correctness`, 'warning');
                        }
                    }

                    return {
                        ...entry,
                        price: safePrice,
                        manual_override: true,
                        serviceDetails: entry.serviceDetails
                            ? {
                                ...entry.serviceDetails,
                                unitPricePerCopy: safePrice,
                                totalPrice: safePrice * (Number(entry.quantity) || 1)
                            }
                            : entry.serviceDetails
                    };
                })
                : prev.items
        }));
    };

    const resetManualLineItemPrice = async (targetId: string) => {
        const currentItems = Array.isArray(formData.items) ? [...formData.items] : [];
        const idx = currentItems.findIndex((entry: any) => entry.id === targetId);
        if (idx < 0) return;

        const item = currentItems[idx];

        if (item.type === 'Service' && item.serviceDetails) {
            const cartItem = item;
            const pages = Number(cartItem.serviceDetails?.pages || item.pagesOverride || 1);

            if (cartItem.priceLocked && cartItem.lockedUnitPricePerCopy !== undefined) {
                currentItems[idx] = {
                    ...currentItems[idx],
                    price: cartItem.lockedUnitPricePerCopy,
                    selling_price: cartItem.lockedUnitPricePerCopy,
                    cost: cartItem.lockedUnitCostPerCopy || cartItem.cost,
                    cost_price: cartItem.lockedUnitCostPerCopy || cartItem.cost_price || cartItem.cost,
                    basePrice: cartItem.lockedUnitCostPerCopy || cartItem.basePrice,
                    manual_override: false,
                    serviceDetails: {
                        ...cartItem.serviceDetails,
                        pages,
                        copies: item.quantity,
                        totalPages: pages * item.quantity,
                        unitPricePerCopy: cartItem.lockedUnitPricePerCopy,
                        unitCostPerCopy: cartItem.lockedUnitCostPerCopy || cartItem.cost,
                        totalCost: Number(cartItem.lockedUnitCostPerCopy || cartItem.cost || 0) * item.quantity,
                        totalPrice: cartItem.lockedUnitPricePerCopy * item.quantity
                    }
                };
                setFormData({ ...formData, items: currentItems });
                return;
            }

            const baseService = inventory.find((i: Item) => i.id === (cartItem.itemId || item.id)) || item;
            const activeAdjs: any[] = [];

            const baseCost = Number(baseService.cost) || 0;
            const pricing = await calculateServicePrice({
                itemId: baseService.id,
                categoryId: baseService.category,
                baseCost,
                pages,
                copies: item.quantity,
                adjustments: activeAdjs,
                marketAdjustments: activeAdjs,
                context: 'SERVICE'
            });

            currentItems[idx] = {
                ...currentItems[idx],
                price: pricing.unitPrice,
                selling_price: pricing.unitPrice,
                cost: pricing.cost,
                cost_price: pricing.cost,
                basePrice: pricing.cost,
                adjustmentSnapshots: pricing.adjustmentSnapshots,
                adjustmentTotal: pricing.adjustmentTotal,
                manual_override: false,
                serviceDetails: {
                    pages,
                    copies: item.quantity,
                    totalPages: pages * item.quantity,
                    unitCostPerPage: pricing.cost / pages,
                    unitPricePerCopy: pricing.unitPrice,
                    unitCostPerCopy: pricing.cost,
                    totalCost: baseCost,
                    totalPrice: pricing.totalPrice
                }
            };

            setFormData({ ...formData, items: currentItems });
            return;
        }

        const baseItemId = item.parentId || item.id;
        const baseItem = inventory.find((i: Item) => i.id === baseItemId) || item;
        const activeAdjs: any[] = [];
        const marketAdjustmentsInput: any[] = [];

        const normalizedSnapshots = resolveItemAdjustmentSnapshots(item);
        const storedVariantPrice = resolveStoredSellingPrice(item);
        const storedVariantCost = resolveStoredCost(item);
        const storedVariantAdjustmentTotal = Number(
            item.smartPricingSnapshot?.marketAdjustmentTotal
            ?? item.adjustmentTotal
            ?? normalizedSnapshots.reduce((sum: number, snapshot: any) => sum + getSnapshotCalculatedAmount(snapshot), 0)
        );

        if (item.parentId && storedVariantPrice > 0) {
            currentItems[idx] = {
                ...currentItems[idx],
                price: storedVariantPrice,
                selling_price: storedVariantPrice,
                calculated_price: resolveStoredCalculatedPrice(item) || storedVariantPrice,
                cost: storedVariantCost || currentItems[idx].cost || 0,
                cost_price: storedVariantCost || currentItems[idx].cost_price || currentItems[idx].cost || 0,
                adjustmentSnapshots: normalizedSnapshots,
                adjustmentTotal: storedVariantAdjustmentTotal,
                manual_override: false
            };
            setFormData({ ...formData, items: currentItems });
            return;
        }

        const basePrice = resolveStoredSellingPrice(baseItem);
        const priceData = basePrice > 0 ? {
            unitPrice: basePrice,
            cost: Number(currentItems[idx].cost || baseItem.cost) || 0,
            adjustmentTotal: marketAdjustmentsInput.reduce((sum: number, adj: any) => sum + (adj.calculatedAmount || 0), 0),
            adjustmentSnapshots: marketAdjustmentsInput
        } : await calculateSellingPrice({
            itemId: baseItem.id,
            categoryId: baseItem.category,
            baseCost: Number(currentItems[idx].cost || baseItem.cost) || 0,
            basePrice: Number(currentItems[idx].price || baseItem.price) || undefined,
            quantity: Number(currentItems[idx].quantity) || 1,
            adjustments: marketAdjustmentsInput,
            context: 'ORDER',
            quantityTiers: baseItem?.volumePricing,
            allowQuantityTiering: baseItem?.allowVolumePricing,
        });

        currentItems[idx] = {
            ...currentItems[idx],
            price: priceData.unitPrice,
            selling_price: priceData.unitPrice,
            cost: priceData.cost,
            cost_price: priceData.cost,
            adjustmentSnapshots: priceData.adjustmentSnapshots,
            adjustmentTotal: priceData.adjustmentTotal,
            manual_override: false
        };

        setFormData({ ...formData, items: currentItems });
    };

    const getInventoryPrices = (item: CartItem) => {
        const invItem = inventory.find((i: Item) => i.id === (item.parentId || item.id));
        if (!invItem) return { price: item.price, cost: item.cost || 0, adjustmentSnapshots: resolveItemAdjustmentSnapshots(item) };

        if (item.parentId && invItem.variants) {
            const variant = invItem.variants.find(v => v.id === item.id);
            if (variant) {
                const snap = variant.smartPricingSnapshot;
                const resolvedPrice = resolveStoredSellingPrice(variant);
                const resolvedCost = resolveStoredCost(variant);
                return {
                    price: resolvedPrice,
                    cost: resolvedCost,
                    adjustmentSnapshots: resolveItemAdjustmentSnapshots(variant),
                    smartPricingSnapshot: snap
                };
            }
        }

        return {
            price: resolveStoredSellingPrice(invItem) || 0,
            cost: resolveStoredCost(invItem) || 0,
            adjustmentSnapshots: resolveItemAdjustmentSnapshots(invItem)
        };
    };

    useEffect(() => {
        let mounted = true;
        dbService.getAll<BOMTemplate>('bomTemplates')
            .then((templates) => {
                if (mounted) setBomTemplates(templates || []);
            })
            .catch((err) => {
                logger.error('Failed to load BOM templates for OrderForm service pricing', err);
            });

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (!formData.customerName) return;

        const customer = findCustomerByName(formData.customerName);
        if (!customer) return;

        const transactionType = type === 'Quotation'
            ? 'quotation'
            : type === 'Order'
                ? 'order'
                : 'invoice';
        const { paymentTerms, dueDate } = resolveCustomerPaymentPolicy({
            customer,
            subAccountName: formData.subAccountName,
            transactionType,
            issuedDate: formData.date,
            preserveCustomTerms: true
        });

        setFormData(prev => {
            if (prev.paymentTerms === paymentTerms && prev.dueDate === dueDate) {
                return prev;
            }

            return {
                ...prev,
                paymentTerms,
                dueDate
            };
        });
    }, [customers, formData.customerName, formData.date, formData.subAccountName, type]);

    const releaseReservedItems = (items: CartItem[]) => {
        items.forEach((item: any) => {
            const itemId = item.parentId || item.id;
            const variantId = item.parentId ? item.id : undefined;
            if (item.type !== 'Service') {
                updateReservedStock(itemId, -(item.quantity || 0), `Quotation type changed`, variantId);
            }
        });
    };

    const handleQuotationTypeChange = (nextType: QuotationWorkflowType) => {
        if (!isQuotation || formData.quotationType === nextType) return;

        if (Array.isArray(formData.items) && formData.items.length > 0) {
            releaseReservedItems(formData.items);
        }

        setFormData((prev: any) => ({
            ...prev,
            quotationType: nextType,
            items: [],
            printQuotationDetails: normalizePrintQuotationDetails(prev.printQuotationDetails)
        }));
    };

    const updatePrintQuotationDetails = (updater: (prev: PrintQuotationDetails) => PrintQuotationDetails) => {
        setFormData((prev: any) => ({
            ...prev,
            printQuotationDetails: updater(normalizePrintQuotationDetails(prev.printQuotationDetails))
        }));
    };

    const handleAddPrintJob = () => {
        updatePrintQuotationDetails((prev) => ({
            ...prev,
            jobs: [...prev.jobs, createEmptyPrintJob()]
        }));
    };

    const handleUpdatePrintJob = (jobId: string, field: keyof PrintServiceJob, value: any) => {
        updatePrintQuotationDetails((prev) => ({
            ...prev,
            jobs: prev.jobs.map((job) => {
                if (job.id !== jobId) return job;
                if (field === 'finishing') {
                    return { ...job, finishing: Array.isArray(value) ? value : [] };
                }
                if (field === 'colorMode') {
                    return { ...job, colorMode: value === 'color' ? 'color' : 'bw' };
                }
                if (field === 'sides') {
                    return { ...job, sides: value === 'duplex' ? 'duplex' : 'single' };
                }
                if (field === 'quantity' || field === 'pricePerUnit') {
                    return { ...job, [field]: Math.max(0, Number(value) || 0) };
                }
                return { ...job, [field]: value };
            })
        }));
    };

    const handleRemovePrintJob = (jobId: string) => {
        updatePrintQuotationDetails((prev) => {
            const remaining = prev.jobs.filter((job) => job.id !== jobId);
            return {
                ...prev,
                jobs: remaining.length > 0 ? remaining : [createEmptyPrintJob()]
            };
        });
    };

    const analysis = useMemo(() => {
        let totalGross = 0;
        let totalNet = 0;
        let totalCostPrice = 0;
        let totalQty = 0;
        const adjustmentBreakdown: Record<string, number> = {};

        const processedItems = quotationLineItems.map((item: CartItem) => {
            totalQty += item.quantity || 0;
            const lineBase = (Number(item.basePrice || item.price) || 0) * item.quantity;
            totalNet += lineBase;

            const lineTotal = (Number(item.price) || 0) * item.quantity;
            totalGross += lineTotal;

            const invItem = inventory.find((i: Item) => i.id === (item.parentId || item.id));
            let itemCost = item.cost || 0;

            if (item.serviceDetails) {
                itemCost = Number(item.cost) || 0;
            } else if (invItem) {
                const variant = item.parentId && invItem.variants
                    ? invItem.variants.find((v: any) => v.id === item.id)
                    : null;
                itemCost = variant ? (variant.cost || 0) : invItem.cost;
            }
            totalCostPrice += itemCost * item.quantity;

            let currentSnapshots = resolveItemAdjustmentSnapshots(item);

            const isSmartPricingVariant = !!item.parentId && !!item.smartPricingSnapshot;

            if (!currentSnapshots || currentSnapshots.length === 0) {
                if (isSmartPricingVariant) {
                    currentSnapshots = [];
                } else {
                    currentSnapshots = [];
                }
            }

            if (currentSnapshots && currentSnapshots.length > 0) {
                getMarketAdjustmentSnapshots(currentSnapshots).forEach((snap: any) => {
                    const amount = getSnapshotCalculatedAmount(snap) * item.quantity;
                    const name = snap.name || 'Other Adjustment';
                    adjustmentBreakdown[name] = (adjustmentBreakdown[name] || 0) + amount;
                });
            }

            return attachPricingBreakdown({
                ...item,
                adjustmentSnapshots: currentSnapshots,
                lineTotalNet: lineTotal
            });
        });

        const pricingSummary = summarizePricingBreakdown(processedItems);

        const currentTaxRate = companyConfig?.taxRate || 0;
        const taxAmount = (companyConfig?.enableTax) ? (totalGross - (formData.discount || 0)) * (currentTaxRate / 100) : 0;
        const otherCharges = Number(formData.otherCharges) || 0;
        const calcOtherCharges = Number(calculatedOtherCharges) || 0;
        const subTotal = totalGross;
        const finalTotal = totalGross - Number(formData.discount || 0) + taxAmount + otherCharges + calcOtherCharges;

        return {
            subTotal,
            totalCostPrice,
            totalAmount: finalTotal,
            tax: taxAmount,
            taxRate: currentTaxRate,
            processedItems,
            adjustmentBreakdown,
            otherCharges,
            pricingSummary,
            totalQty,
            totalItems: processedItems.length,
        };
    }, [quotationLineItems, formData.discount, formData.otherCharges, formData.customerPricingTier, inventory, marketAdjustments, companyConfig, calculatedOtherCharges]);

    const finalDisplayTotal = analysis.totalAmount;
    const orderedAdjustmentEntries = useMemo(() => {
        return Object.entries(analysis.adjustmentBreakdown).sort(([nameA], [nameB]) => {
            const metaA = getPricingDisplayMeta(nameA);
            const metaB = getPricingDisplayMeta(nameB);
            if (metaA.priority !== metaB.priority) return metaA.priority - metaB.priority;
            return nameA.localeCompare(nameB);
        });
    }, [analysis.adjustmentBreakdown]);

    useEffect(() => {
        if (!initialData) {
            let key = 'invoice';
            let collection = invoices;

            if (type === 'Quotation') {
                key = 'quotation';
                collection = quotations;
            } else if (type === 'Recurring') {
                key = 'REC';
                collection = recurringInvoices;
            } else if (type === 'Order') {
                key = 'order';
                collection = [];
            }

            setFormData((prev: any) => ({ ...prev, id: generateNextId(key, collection, companyConfig) }));
        } else {
            const clonedItems = Array.isArray(initialData.items) ? cloneSerializable(initialData.items) : [];
            const clonedScheduledDates = Array.isArray(initialData.scheduledDates)
                ? [...initialData.scheduledDates].map((date: any) => String(date))
                : [];
            const resolvedRecurringStatus = normalizeRecurringStatus(initialData.status);
            const fallbackId = initialData.id || generateNextId(
                type === 'Quotation' ? 'quotation' : type === 'Recurring' ? 'REC' : type === 'Order' ? 'order' : 'invoice',
                type === 'Quotation' ? quotations : type === 'Recurring' ? recurringInvoices : type === 'Order' ? [] : invoices,
                companyConfig
            );

            const editCustomer = initialData.customerId
                ? customers.find((c: any) => c.id === initialData.customerId)
                : null;
            const editSegment = editCustomer?.segment || initialData.customerPricingSegment || '';

            setFormData((prev: any) => ({
                ...prev,
                ...initialData,
                id: fallbackId,
                customerName: initialData.customerName || '',
                customerId: initialData.customerId || '',
                customerPricingTier: initialData.customerPricingTier || '',
                customerPricingSegment: editSegment,
                subAccountName: initialData.subAccountName || 'Main',
                salesAccountId: initialData.salesAccountId || companyConfig?.glMapping?.defaultSalesAccount || '4000',
                items: clonedItems,
                status: isRecurring
                    ? resolvedRecurringStatus
                    : (initialData.status || (type === 'Invoice' ? 'Unpaid' : (type === 'Order' ? 'Pending' : 'Draft'))),
                discount: initialData.discount || 0,
                otherCharges: initialData.otherCharges || 0,
                date: initialData.date || prev.date,
                dueDate: initialData.dueDate || prev.dueDate,
                paymentTerms: initialData.paymentTerms || prev.paymentTerms,
                paymentMethod: initialData.paymentMethod || 'Cash',
                frequency: initialData.frequency || prev.frequency,
                startDate: isRecurring
                    ? normalizeDateInputValue(initialData.startDate || initialData.date || prev.startDate)
                    : (initialData.startDate || prev.startDate),
                endDate: initialData.endDate || '',
                scheduledDates: clonedScheduledDates,
                nextRunDate: isRecurring
                    ? normalizeDateInputValue(initialData.nextRunDate || getDefaultRecurringNextRunDate(initialData.frequency || prev.frequency, initialData.startDate || initialData.date || prev.startDate))
                    : initialData.nextRunDate || prev.nextRunDate,
                quotationType: initialData.quotationType || 'General',
                printQuotationDetails: normalizePrintQuotationDetails(initialData.printQuotationDetails || initialData.examinationDetails),
                referenceDoc: initialData.referenceDoc || ''
            }));
            setCustomerSearch(initialData.customerName || '');
        }
    }, [type, initialData, invoices, recurringInvoices, quotations, companyConfig, isRecurring]);

    const itemsRef = useRef(formData.items);
    itemsRef.current = formData.items;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey && e.key === 'F2') {
                e.preventDefault();
                const match = itemSearch.trim()
                    ? inventory.find((i: Item) =>
                        i.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
                        i.sku.toLowerCase().includes(itemSearch.toLowerCase())
                      )
                    : null;
                setItemHistoryItemId(match?.id);
                setShowItemHistory(true);
            }
        };
        const handleClickOutside = (event: MouseEvent) => {
            if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
                setIsCustomerDropdownOpen(false);
            }
            if (itemDropdownRef.current && !itemDropdownRef.current.contains(event.target as Node)) {
                setIsItemDropdownOpen(false);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleClickOutside);
            // Release stock reservations on unmount (crash recovery)
            const items = itemsRef.current;
            items.forEach((item: any) => {
                const itemId = item.parentId || item.id;
                const variantId = item.parentId ? item.id : undefined;
                if (item.type !== 'Service' && item.quantity > 0) {
                    try { updateReservedStock(itemId, -item.quantity, `Form closed (cleanup)`, variantId); } catch (e) { logger.error("Operation failed", e as Error); }
                }
            });
        };
    }, []);

    const openServiceCalculator = (service: Item, editIndex: number | null = null, initial?: { pages: number; copies: number }) => {
        setSelectedServiceForCalculator(service);
        setServiceEditIndex(editIndex);
        setServiceInitialValues({
            pages: Math.max(1, Number(initial?.pages || service.pages || 1)),
            copies: Math.max(1, Number(initial?.copies || 1))
        });
    };

    const handleServicePricingConfirm = async (pricing: DynamicServicePricingResult) => {
        if (!selectedServiceForCalculator) return;
        const service = selectedServiceForCalculator;
        const pricedLine: CartItem = { ...service, quantity: pricing.copies, discount: 0, price: pricing.unitPricePerCopy, cost: pricing.unitCostPerCopy, basePrice: pricing.unitCostPerCopy, adjustmentSnapshots: pricing.adjustmentSnapshots || [], adjustmentTotal: pricing.adjustmentTotal, pagesOverride: pricing.pages, serviceDetails: pricing.serviceDetails, priceLocked: pricing.priceLocked || false, lockedTotalPrice: pricing.lockedTotalPrice, lockedUnitPricePerCopy: pricing.lockedUnitPricePerCopy, lockedUnitCostPerCopy: pricing.lockedUnitCostPerCopy } as CartItem;

        const items = Array.isArray(formData.items) ? [...formData.items] : [];

        if (serviceEditIndex !== null && serviceEditIndex >= 0 && serviceEditIndex < items.length) {
            items[serviceEditIndex] = { ...items[serviceEditIndex], ...pricedLine };
        } else {
            const existingIdx = items.findIndex((l: any) => l.type === 'Service' && !l.parentId && l.id === service.id && Number(l.serviceDetails?.pages || l.pagesOverride || 0) === pricing.pages);
            if (existingIdx > -1 && !(pricing.priceLocked && pricing.lockedUnitPricePerCopy !== undefined)) {
                const mergedCopies = Number(items[existingIdx].quantity || 0) + pricing.copies;
                const mergedPricing = await calculateServicePrice({ itemId: service.id, categoryId: service.category, baseCost: Number(service.cost) || 0, pages: pricing.pages, copies: mergedCopies, adjustments: [], marketAdjustments: [], context: 'SERVICE' });
                const totalPages = pricing.pages * mergedCopies;
                items[existingIdx] = { ...items[existingIdx], quantity: mergedCopies, price: mergedPricing.unitPrice, cost: mergedPricing.cost, basePrice: mergedPricing.cost, pagesOverride: pricing.pages, adjustmentSnapshots: mergedPricing.adjustmentSnapshots, adjustmentTotal: mergedPricing.adjustmentTotal, serviceDetails: { pages: pricing.pages, copies: mergedCopies, totalPages, unitCostPerPage: mergedPricing.cost / pricing.pages, unitPricePerCopy: mergedPricing.unitPrice, unitCostPerCopy: mergedPricing.cost, totalCost: Number(service.cost) || 0, totalPrice: mergedPricing.totalPrice } };
            } else items.push(pricedLine);
        }

        setFormData({ ...formData, items }); notify(`${service.name} updated`, "success"); setSelectedServiceForCalculator(null); setServiceEditIndex(null);
    };

    const handleEditServiceConfiguration = (idx: number) => {
        const line = formData.items[idx];
        if (!line || line.type !== 'Service') return;

        const baseService = inventory.find((i: Item) => i.id === (line.itemId || line.id)) || line;
        openServiceCalculator(baseService, idx, {
            pages: Number(line.serviceDetails?.pages || line.pagesOverride || 1),
            copies: Number(line.serviceDetails?.copies || line.quantity || 1)
        });
    };

    const handleSubmission = async (asDraft: boolean, andPay: boolean = false) => {
        if (saving) return;
        if (!formData.customerName || analysis.processedItems.length === 0) {
            notify("Selection of customer and items is required.", "error");
            return;
        }

        if (isRecurring && !formData.nextRunDate) {
            notify("Next billing date is required for a subscription.", "error");
            return;
        }
        if (isRecurring && !formData.startDate) {
            notify("Start date is required for a subscription.", "error");
            return;
        }
        if (isRecurring && formData.endDate && new Date(formData.endDate).getTime() < new Date(formData.startDate).getTime()) {
            notify("End date cannot be earlier than the subscription start date.", "error");
            return;
        }

        let normalizedPrintDetails = printQuotationDetails;
        if (isPrintingQuotation) {
            normalizedPrintDetails = normalizePrintQuotationDetails(formData.printQuotationDetails);
            const validJobs = normalizedPrintDetails.jobs.filter((job) =>
                String(job.jobName || '').trim() && Math.max(0, Number(job.pricePerUnit) || 0) > 0
            );

            if (validJobs.length === 0) {
                notify("Add at least one print job with a name and price per unit.", "error");
                return;
            }

            normalizedPrintDetails = { jobs: validJobs };
        }

        let resolvedCustomerName = formData.customerName.trim();
        let resolvedCustomerId = formData.customerId || '';

        const existingCustomer = findCustomerByName(resolvedCustomerName);
        if (existingCustomer) {
            resolvedCustomerName = existingCustomer.name;
            resolvedCustomerId = existingCustomer.id;
        } else {
            try {
                const createdCustomer = await ensureCustomerExists(resolvedCustomerName);
                if (createdCustomer) {
                    resolvedCustomerName = createdCustomer.name;
                    resolvedCustomerId = createdCustomer.id;
                }
            } catch (err: any) {
                notify(`Failed to add client: ${err.message || 'Unknown error'}`, "error");
                return;
            }
        }

        if (!resolvedCustomerId) {
            notify("Unable to resolve a valid client record. Please add/select a client and try again.", "error");
            return;
        }

        // Apply per-item discount rules and per-item tax
        const customerSegment = selectedCustomerObj?.segment || formData.customerPricingSegment || '';
        const applicableDiscounts = await getApplicableDiscounts(resolvedCustomerId, customerSegment, undefined, analysis.totalAmount);
        const processedItems = await Promise.all(analysis.processedItems.map(async (item: any) => {
            const basePrice = item.customerPriceAdjusted ? item.price : (Number(item.baseUnitPrice || item.price || 0));
            const unitPrice = Number(item.price) || 0;
            const qty = Number(item.quantity) || 0;
            const lineTotal = unitPrice * qty;

            let discountAmount = 0;
            let discountDetails: any[] = [];
            if (applicableDiscounts.length > 0) {
                const itemForDiscount = inventory.find((i: Item) => i.id === (item.parentId || item.id));
                const itemCategory = itemForDiscount?.category || item.category || '';
                const catDiscounts = applicableDiscounts.filter(
                    (d: any) => d.scope === 'global' || d.scope === itemCategory || d.itemId === item.id
                );
                if (catDiscounts.length > 0) {
                    const result = applyDiscounts(lineTotal, qty, unitPrice, catDiscounts);
                    discountAmount = result.appliedDiscounts.reduce((s: number, d: any) => s + d.amount, 0);
                    discountDetails = result.appliedDiscounts || [];
                }
            }

            const baseItem = inventory.find((i: Item) => i.id === (item.parentId || item.id));
            const taxableAmount = lineTotal - discountAmount;
            let taxAmount = 0;
            let taxRate = companyConfig?.taxRate || 0;
            let taxDetails: any = null;
            if (companyConfig?.enableTax && baseItem) {
                const taxResult = await calculateItemTax(baseItem, unitPrice, qty, resolvedCustomerId);
                taxAmount = taxResult?.taxAmount || 0;
                taxRate = taxResult?.rate || taxRate;
            }

            return {
                ...item,
                discount: discountAmount,
                discountDetails,
                taxAmount,
                taxRate,
                taxableAmount,
                taxDetails: null,
                lineTotalNet: lineTotal - discountAmount
            };
        }));

        const totalGross = processedItems.reduce((sum: number, i: any) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0);
        const totalDiscount = processedItems.reduce((sum: number, i: any) => sum + (i.discount || 0), 0);
        const totalTax = processedItems.reduce((sum: number, i: any) => sum + (i.taxAmount || 0), 0);
        const otherCharges = Number(formData.otherCharges) || 0;
        const preRoundTotal = totalGross - totalDiscount + totalTax + otherCharges + calculatedOtherCharges;
        const { rounded: finalTotalAmount, difference: roundingDifference } = applyRoundingToTotal(preRoundTotal, formData.roundingMethod || 'Nearest');
        const effectiveTaxRate = processedItems.length > 0
            ? (totalTax / (totalGross - totalDiscount)) * 100
            : 0;

        const consumptionSnapshots: any[] = [];

        processedItems.forEach((item: any) => {
            if (item.consumptionSnapshots) {
                consumptionSnapshots.push(...item.consumptionSnapshots);
            }
        });
        const aggregatedSnapshots = aggregateMarketAdjustmentSnapshots(processedItems);

        if (type === 'Order') {
            if (formData.status === 'Completed' && !formData.shippingAddress) {
                notify("Shipping address is required for completed orders.", "error");
                return;
            }

            const orderItems: OrderItem[] = processedItems.map((item: any) => ({
                id: Math.random().toString(36).substr(2, 9),
                orderId: formData.id,
                productId: item.id,
                productName: item.name,
                quantity: item.quantity,
                unitPrice: item.price,
                subtotal: item.lineTotalNet,
                total: item.lineTotalNet,
                discount: item.discount || 0,
                discountDetails: item.discountDetails,
                taxAmount: item.taxAmount || 0,
                taxRate: item.taxRate || 0,
                taxDetails: item.taxDetails,
                adjustmentSnapshots: item.adjustmentSnapshots,
                adjustmentTotal: item.adjustmentTotal || item.pricingBreakdown?.adjustmentTotal || 0,
                pricingBreakdown: item.pricingBreakdown,
                smartPricingSnapshot: item.smartPricingSnapshot,
                productionCostSnapshot: item.productionCostSnapshot,
                variantId: item.parentId ? item.id : item.variantId,
                parentId: item.parentId,
                serviceDetails: item.serviceDetails
            }));

            const paidAmount = andPay ? finalTotalAmount : 0;
            const payments: OrderPayment[] = andPay ? [{
                id: `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                orderId: formData.id,
                amountPaid: finalTotalAmount,
                paymentDate: new Date().toISOString(),
                paymentMethod: formData.paymentMethod,
                recordedBy: user?.name || user?.username || 'System',
                reference: `Initial payment for Order #${formData.id}`
            }] : [];

            await createOrder({
                id: formData.id,
                orderNumber: formData.id,
                customerId: resolvedCustomerId,
                customerName: resolvedCustomerName,
                orderDate: formData.date,
                status: asDraft ? 'Pending' : (formData.status === 'Draft' ? 'Pending' : formData.status),
                items: orderItems,
                totalAmount: finalTotalAmount,
                paidAmount: paidAmount,
                discount: totalDiscount,
                discountDetails: processedItems.flatMap((i: any) => i.discountDetails || []),
                notes: formData.notes,
                billingAddress: formData.billingAddress,
                shippingAddress: formData.shippingAddress,
                createdBy: user?.name || user?.username || 'System',
                payments: payments,
                adjustmentSnapshots: aggregatedSnapshots,
                adjustmentTotal: analysis.pricingSummary.adjustmentTotal,
                materialTotal: analysis.pricingSummary.materialTotal,
                profitMarginTotal: analysis.pricingSummary.profitMarginTotal,
                roundingTotal: preRoundTotal,
                roundingDifference: roundingDifference,
                roundingMethod: formData.roundingMethod || '',
                consumptionSnapshots: consumptionSnapshots,
                subtotal: totalGross - totalDiscount,
                tax: totalTax,
                taxRate: effectiveTaxRate,
                otherCharges: otherCharges
            });
            const allAppliedDiscounts = processedItems.flatMap((i: any) => i.discountDetails || []);
            for (const d of allAppliedDiscounts) {
                await incrementDiscountUsage(d.ruleId || d.id).catch(() => {});
            }
            onCancel();
            return;
        }

        const finalData = {
            ...formData,
            customerId: resolvedCustomerId,
            customerName: resolvedCustomerName,
            customerPhone: selectedCustomerObj?.phone || formData.customerPhone || '',
            customerEmail: selectedCustomerObj?.email || formData.customerEmail || '',
            customerAddress: formData.billingAddress || formData.shippingAddress || selectedCustomerObj?.billingAddress || selectedCustomerObj?.address || '',
            items: processedItems,
            totalAmount: finalTotalAmount,
            total: finalTotalAmount,
            discount: totalDiscount,
            otherCharges: otherCharges,
            discountDetails: processedItems.flatMap((i: any) => i.discountDetails || []),
            status: isRecurring
                ? normalizeRecurringStatus(asDraft ? 'Draft' : formData.status)
                : (asDraft ? 'Draft' : (formData.status || 'Unpaid')),
            materialTotal: analysis.pricingSummary.materialTotal,
            adjustmentTotal: analysis.pricingSummary.adjustmentTotal,
            adjustmentSnapshots: aggregatedSnapshots,
            profitMarginTotal: analysis.pricingSummary.profitMarginTotal,
            roundingTotal: preRoundTotal,
            roundingDifference: roundingDifference,
            roundingMethod: formData.roundingMethod || '',
            consumptionSnapshots: consumptionSnapshots,
            tax: totalTax,
            taxRate: effectiveTaxRate,
            paymentTerms: formData.paymentTerms,
            startDate: isRecurring ? normalizeDateInputValue(formData.startDate || formData.date) : formData.startDate,
            endDate: isRecurring ? (formData.endDate || '') : formData.endDate,
            scheduledDates: isRecurring ? [...(formData.scheduledDates || [])].sort() : formData.scheduledDates,
            nextRunDate: isRecurring
                ? normalizeDateInputValue(formData.nextRunDate || getDefaultRecurringNextRunDate(formData.frequency || 'Monthly', formData.startDate || formData.date))
                : formData.nextRunDate,
            createdBy: user?.name || user?.username || 'System User',
            quotationType: isPrintingQuotation ? 'Printing' : 'General',
            printQuotationDetails: isPrintingQuotation ? normalizedPrintDetails : null,
            referenceDoc: formData.referenceDoc || ''
        };

        const allAppliedDiscounts = processedItems.flatMap((i: any) => i.discountDetails || []);
        for (const d of allAppliedDiscounts) {
            await incrementDiscountUsage(d.ruleId || d.id).catch(() => {});
        }

        onSave(finalData, asDraft, auditReason, andPay);
    };

    const handleQuickService = (serviceName: string) => {
        if (serviceName === 'Printing') {
            setQuickPrintModal({ open: true, type: 'printing' });
        } else if (serviceName === 'Photocopy') {
            setQuickPrintModal({ open: true, type: 'photocopy' });
        }
    };

    const handleQuickPrintConfirm = (quantity: number, pagesPerCopy: number, total: number, printType: 'photocopy' | 'printing', pinningCost?: number, pinningCount?: number) => {
        const isPhotocopy = printType === 'photocopy';
        const pricePerPage = isPhotocopy 
          ? (companyConfig.transactionSettings?.pos?.photocopyPrice ?? 2.00)
          : (companyConfig.transactionSettings?.pos?.typePrintingPrice ?? 5.00);

        const costPerPage = isPhotocopy
          ? calculatePhotocopyCostPerPage(inventory)
          : calculateTypePrintingCostPerPage(inventory);

        const totalPages = pagesPerCopy * quantity;
        const materialCost = costPerPage * totalPages;
        const unitCostPerCopy = totalPages > 0 ? materialCost : 0;

        const finalPrice = total;

        const newItem: CartItem = {
          id: `QUICK-${isPhotocopy ? 'PHOTO' : 'PRINT'}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          itemId: isPhotocopy ? 'SVC-PHOTOCOPY' : 'SVC-TYPE-PRINT',
          name: isPhotocopy ? 'Quick Photocopy' : 'Type & Printing',
          sku: isPhotocopy ? 'QUICK-PHOTO' : 'QUICK-PRINT',
          desc: isPhotocopy 
            ? `Quick Photocopy (${pagesPerCopy} pages, ${Math.ceil(pagesPerCopy / 2)} sheets x ${quantity} copies)`
            : `Type & Printing (${pagesPerCopy} pages x ${quantity} copies)`,
          price: finalPrice,
          cost: materialCost,
          cost_price: materialCost,
          quantity: 1,
          pagesOverride: pagesPerCopy,
          category: 'Service',
          type: 'Service',
          unit: isPhotocopy ? 'sheet' : 'page',
          pages: pagesPerCopy,
          stock: 9999,
          minStockLevel: 0,
          adjustedPrice: finalPrice,
          priceLocked: true,
          lockedUnitPricePerCopy: finalPrice,
          lockedUnitCostPerCopy: unitCostPerCopy,
          serviceDetails: {
            pages: pagesPerCopy,
            copies: quantity,
            pinningCost: pinningCost,
            pinningCount: pinningCount
          }
        } as CartItem;

        setFormData((prev: any) => ({
            ...prev,
            items: [...prev.items, newItem]
        }));

        notify(`${quantity}x${pagesPerCopy} pages added to voucher`, 'success');
    };

const handleAddItem = async (item: Item) => {
        if (item.isVariantParent) {
            setSelectedProductForVariants(item);
            return;
        }

        if (item.type === 'Service') {
            openServiceCalculator(item, null, { pages: item.pages || 1, copies: 1 });
            setItemSearch('');
            return;
        }

        const existingItemIdx = formData.items.findIndex((i: any) => i.id === item.id && !i.parentId);

        if (existingItemIdx > -1) {
            await handleQuantityChange(existingItemIdx, formData.items[existingItemIdx].quantity + 1);
            notify(`Incremented quantity for ${item.name}`, "success");
        } else {
            if ((item.type as string) !== 'Service') {
                updateReservedStock(item.id, 1, `Selection in ${type} Form`);
            }

            const activeAdjs: any[] = [];
            const marketAdjustmentsInput: any[] = [];

            const storedPrice = resolveStoredSellingPrice(item);
            const pricing = storedPrice > 0 ? {
                unitPrice: storedPrice,
                cost: Number(item.cost) || 0,
                adjustmentTotal: 0,
                adjustmentSnapshots: []
            } : await calculateSellingPrice({
                itemId: item.id,
                categoryId: item.category,
                baseCost: Number(item.cost) || 0,
                quantity: 1,
                adjustments: marketAdjustmentsInput,
                context: 'ORDER',
                quantityTiers: item?.volumePricing,
                allowQuantityTiering: item?.allowVolumePricing,
            });

            let finalUnitPrice = pricing.unitPrice;
            let customerPriceAdjusted = false;
            const baseUnitPrice = finalUnitPrice;
            const segment = formData.customerPricingSegment || selectedCustomerObj?.segment || '';
            let tier: any = null;
            if (formData.customerId) {
                tier = await getCustomerPricingTier(formData.customerId).catch(() => null);
                if (tier) {
                    finalUnitPrice = resolveCustomerPrice(baseUnitPrice, tier, segment);
                    customerPriceAdjusted = true;
                }
            }

            const newItem: CartItem = {
                ...item,
                quantity: 1,
                discount: 0,
                price: finalUnitPrice,
                unitPrice: finalUnitPrice,
                selling_price: finalUnitPrice,
                cost: pricing.cost,
                basePrice: finalUnitPrice,
                baseUnitPrice,
                customerPriceAdjusted,
                customerPricingTier: tier?.id || '',
                customerPricingSegment: segment,
                adjustmentSnapshots: pricing.adjustmentSnapshots,
                adjustmentTotal: pricing.adjustmentTotal,
                pagesOverride: item.pages
            };

            setFormData((prev: any) => ({
                ...prev,
                items: [...prev.items, newItem]
            }));
            notify(`${item.name} added`, "success");
        }

        setItemSearch('');
    };

const handleVariantSelect = async (variant: ProductVariant) => {
        if (!selectedProductForVariants) return;

        const normalizedAdjustmentSnapshots = resolveItemAdjustmentSnapshots(variant);

        const existingItemIdx = formData.items.findIndex((i: any) => i.id === variant.id && i.parentId === selectedProductForVariants.id);

        if (existingItemIdx > -1) {
            await handleQuantityChange(existingItemIdx, formData.items[existingItemIdx].quantity + 1);
            notify(`Incremented quantity for ${variant.name}`, "success");
        } else {
            const parentItem = selectedProductForVariants;
            const variantItem: any = {
                ...selectedProductForVariants,
                id: variant.id,
                parentId: selectedProductForVariants.id,
                sku: variant.sku,
                name: variant.name,
                price: resolveStoredSellingPrice(variant) || 0,
                selling_price: resolveStoredSellingPrice(variant) || 0,
                calculated_price: resolveStoredCalculatedPrice(variant) || 0,
                cost: resolveStoredCost(variant) || 0,
                cost_price: resolveStoredCost(variant) || 0,
                stock: variant.stock,
                isVariantParent: false,
                variants: [],
                pagesOverride: variant.pages,
                pricingSource: variant.pricingSource,
                productionCostSnapshot: variant.productionCostSnapshot,
                quantity: variant.quantity || 1
            };

            const quantity = variantItem.quantity || 1;

            updateReservedStock(selectedProductForVariants.id, quantity, `Variant selection in ${type} Form`, variant.id);

            const activeAdjs: any[] = [];
            const marketAdjustmentsInput: any[] = [];

            const snapPrice = resolveStoredSellingPrice(variant);
            const snapCost = resolveStoredCost(variant);
            const snapAdjTotal = Number(
                variant.smartPricingSnapshot?.marketAdjustmentTotal
                ?? variant.adjustmentTotal
                ?? normalizedAdjustmentSnapshots.reduce((sum: number, snapshot: any) => sum + getSnapshotCalculatedAmount(snapshot), 0)
            );
            const snapAdjSnaps = normalizedAdjustmentSnapshots;

            if (snapPrice > 0) {
                variantItem.price = snapPrice;
                variantItem.selling_price = snapPrice;
                variantItem.calculated_price = resolveStoredCalculatedPrice(variant) || snapPrice;
                variantItem.cost = snapCost;
                variantItem.cost_price = snapCost;
                variantItem.basePrice = snapCost;
                variantItem.adjustmentSnapshots = snapAdjSnaps;
                variantItem.adjustmentTotal = snapAdjTotal;
                variantItem.smartPricingSnapshot = variant.smartPricingSnapshot;
            } else {
                const pricing = await calculateSellingPrice({
                    itemId: parentItem.id,
                    categoryId: parentItem.category,
                    baseCost: Number(variantItem.cost) || 0,
                    basePrice: Number(variantItem.price) || undefined,
                    quantity: 1,
                    adjustments: marketAdjustmentsInput,
                    context: 'ORDER',
                    quantityTiers: parentItem?.volumePricing,
                    allowQuantityTiering: parentItem?.allowVolumePricing,
                });
                variantItem.price = pricing.unitPrice;
                variantItem.selling_price = pricing.unitPrice;
                variantItem.calculated_price = pricing.unitPrice;
                variantItem.cost = pricing.cost;
                variantItem.cost_price = pricing.cost;
                variantItem.basePrice = pricing.cost;
                variantItem.adjustmentSnapshots = pricing.adjustmentSnapshots;
                variantItem.adjustmentTotal = pricing.adjustmentTotal;
            }

            const segment = formData.customerPricingSegment || selectedCustomerObj?.segment || '';
            if (formData.customerId && !variant.customerPriceAdjusted) {
                const tier = await getCustomerPricingTier(formData.customerId).catch(() => null);
                if (tier) {
                    const baseUnitPrice = variantItem.price || 0;
                    const adjusted = resolveCustomerPrice(baseUnitPrice, tier, segment);
                    variantItem.price = adjusted;
                    variantItem.selling_price = adjusted;
                    variantItem.baseUnitPrice = baseUnitPrice;
                    variantItem.customerPriceAdjusted = true;
                    variantItem.customerPricingTier = tier?.id || '';
                    variantItem.customerPricingSegment = segment;
                }
            }

            setFormData((prev: any) => ({
                ...prev,
                items: [...prev.items, variantItem]
            }));

            notify(`${variant.name} added`, "success");
        }

        setSelectedProductForVariants(null);
        setItemSearch('');
    };

    const handleQuantityChange = async (idx: number, newValue: number) => {
        if (isPriceLocked) return;

        const item = formData.items[idx];
        const safeQty = Math.max(1, Math.floor(Number(newValue) || 1));

        if (item.type === 'Service' && item.serviceDetails) {
            const cartItem = item;

            if (cartItem.manual_override) {
                const pages = Number(cartItem.serviceDetails?.pages || item.pagesOverride || 1);
                const newItems = [...formData.items];
                newItems[idx] = {
                    ...newItems[idx],
                    quantity: safeQty,
                    manual_override: true,
                    serviceDetails: {
                        ...cartItem.serviceDetails,
                        pages,
                        copies: safeQty,
                        totalPages: pages * safeQty,
                        unitCostPerPage: pages > 0 ? Number(cartItem.cost || 0) / pages : 0,
                        unitPricePerCopy: cartItem.price,
                        unitCostPerCopy: cartItem.cost,
                        totalCost: Number(cartItem.cost || 0) * safeQty,
                        totalPrice: Number(cartItem.price || 0) * safeQty
                    }
                };

                setFormData({ ...formData, items: newItems });
                return;
            }

            if (cartItem.priceLocked && cartItem.lockedUnitPricePerCopy !== undefined) {
                const newItems = [...formData.items];
                newItems[idx] = {
                    ...newItems[idx],
                    quantity: safeQty,
                    price: cartItem.lockedUnitPricePerCopy,
                    cost: cartItem.lockedUnitCostPerCopy || cartItem.cost,
                    basePrice: cartItem.lockedUnitCostPerCopy || cartItem.basePrice,
                    priceLocked: true,
                    lockedTotalPrice: cartItem.lockedTotalPrice,
                    lockedUnitPricePerCopy: cartItem.lockedUnitPricePerCopy,
                    lockedUnitCostPerCopy: cartItem.lockedUnitCostPerCopy
                };

                setFormData({ ...formData, items: newItems });
                return;
            }

            const pages = Number(cartItem.serviceDetails?.pages || item.pagesOverride || 1);
            const baseService = inventory.find((i: Item) => i.id === (cartItem.itemId || item.id)) || item;

            const activeAdjs: any[] = [];

            const baseCost = Number(baseService.cost) || 0;
            const pricing = await calculateServicePrice({
                itemId: baseService.id,
                categoryId: baseService.category,
                baseCost: baseCost,
                pages: pages,
                copies: safeQty,
                adjustments: activeAdjs,
                marketAdjustments: activeAdjs,
                context: 'SERVICE'
            });

            const totalPages = pages * safeQty;
            const newItems = [...formData.items];
            newItems[idx] = {
                ...newItems[idx],
                quantity: safeQty,
                price: pricing.unitPrice,
                cost: pricing.cost,
                basePrice: pricing.cost,
                pagesOverride: pages,
                adjustmentSnapshots: pricing.adjustmentSnapshots,
                adjustmentTotal: pricing.adjustmentTotal,
                serviceDetails: {
                    pages,
                    copies: safeQty,
                    totalPages,
                    unitCostPerPage: pricing.cost / pages,
                    unitPricePerCopy: pricing.unitPrice,
                    unitCostPerCopy: pricing.cost,
                    totalCost: baseCost,
                    totalPrice: pricing.totalPrice
                }
            };

            setFormData({ ...formData, items: newItems });
            return;
        }

        const diff = safeQty - item.quantity;

        if (diff !== 0) {
            const itemId = item.parentId || item.id;
            const variantId = item.parentId ? item.id : undefined;
            if (item.type !== 'Service') {
                updateReservedStock(itemId, diff, `Quantity adjustment in ${type} Form`, variantId);
            }
        }

        const newItems = [...formData.items];
        newItems[idx].quantity = safeQty;

        if (item.parentId && (!newItems[idx].price || newItems[idx].price <= 0)) {
            const parentInv = inventory.find((i: Item) => i.id === item.parentId);
            const savedVariant = parentInv?.variants?.find((v: any) => v.id === item.id);
            if (savedVariant) {
                const restored = resolveStoredSellingPrice(savedVariant);
                if (restored > 0) {
                    newItems[idx].price = restored;
                    newItems[idx].selling_price = restored;
                    newItems[idx].calculated_price = resolveStoredCalculatedPrice(savedVariant) || restored;
                    newItems[idx].cost = resolveStoredCost(savedVariant) || 0;
                    newItems[idx].cost_price = resolveStoredCost(savedVariant) || 0;
                    newItems[idx].adjustmentSnapshots = resolveItemAdjustmentSnapshots(savedVariant);
                    newItems[idx].adjustmentTotal = Number(
                        savedVariant.smartPricingSnapshot?.marketAdjustmentTotal
                        ?? savedVariant.adjustmentTotal
                        ?? newItems[idx].adjustmentSnapshots.reduce((sum: number, snapshot: any) => sum + getSnapshotCalculatedAmount(snapshot), 0)
                    );
                }
            }
        }

        if ((!newItems[idx].price || newItems[idx].price <= 0) && item.type !== 'Service') {
            const baseItemId = item.parentId || item.id;
            const baseItem = inventory.find(i => i.id === baseItemId) || item;
            
            const activeAdjs: any[] = [];
            const marketAdjustmentsInput: any[] = [];

            const fallbackPrice = resolveStoredSellingPrice(baseItem);
            const priceData = Number(newItems[idx].price || fallbackPrice) > 0 ? {
                unitPrice: Number(newItems[idx].price || fallbackPrice),
                cost: Number(newItems[idx].cost || baseItem.cost),
                adjustmentTotal: 0,
                adjustmentSnapshots: []
            } : await calculateSellingPrice({
                itemId: baseItem.id,
                categoryId: baseItem.category,
                baseCost: Number(newItems[idx].cost || baseItem.cost) || 0,
                basePrice: Number(newItems[idx].price || baseItem.price) || undefined,
                quantity: safeQty,
                adjustments: marketAdjustmentsInput,
                context: 'ORDER',
                quantityTiers: baseItem?.volumePricing,
                allowQuantityTiering: baseItem?.allowVolumePricing,
            });

            newItems[idx].price = priceData.unitPrice;
            newItems[idx].cost = priceData.cost;
            newItems[idx].adjustmentSnapshots = priceData.adjustmentSnapshots;
            newItems[idx].adjustmentTotal = priceData.adjustmentTotal;
        }

        setFormData({ ...formData, items: newItems });
    };

    const handlePagesChange = async (idx: number, newPages: number) => {
        if (isPriceLocked) return;

        const item = formData.items[idx];
        const newItems = [...formData.items];
        newItems[idx].pagesOverride = newPages;

        if (item.type === 'Service' && !item.manual_override && !item.priceLocked) {
            const baseService = inventory.find((i: Item) => i.id === (item.itemId || item.id)) || item;
            const baseCost = Number(baseService.cost) || 0;
            try {
                const pricing = await calculateServicePrice({
                    itemId: baseService.id,
                    categoryId: baseService.category,
                    baseCost: baseCost,
                    pages: newPages,
                    copies: item.quantity || 1,
                    adjustments: [],
                    marketAdjustments: [],
                    context: 'SERVICE'
                });
                newItems[idx].price = pricing.unitPrice;
                newItems[idx].cost = pricing.cost;
                newItems[idx].basePrice = pricing.cost;
                newItems[idx].adjustmentSnapshots = pricing.adjustmentSnapshots;
                newItems[idx].adjustmentTotal = pricing.adjustmentTotal;
                newItems[idx].serviceDetails = {
                    ...item.serviceDetails,
                    pages: newPages,
                    copies: item.quantity,
                    totalPages: newPages * (item.quantity || 1),
                    unitPricePerCopy: pricing.unitPrice,
                    unitCostPerCopy: pricing.cost
                };
            } catch { /* keep existing pricing */ }
        }

        setFormData({ ...formData, items: newItems });
    };

    const handleRemoveItem = (idx: number) => {
        const item = formData.items[idx];
        const itemId = item.parentId || item.id;
        const variantId = item.parentId ? item.id : undefined;

        if (item.type !== 'Service') {
            updateReservedStock(itemId, -item.quantity, `Item removed from ${type} Form`, variantId);
        }

        setFormData({
            ...formData,
            items: formData.items.filter((_: any, i: number) => i !== idx)
        });
    };

    const recalculateCartPrices = (items: any[], tier: any, segment: string) => {
        return items.map((item: any) => {
            const basePrice = item.baseUnitPrice || item.price || 0;
            const adjusted = resolveCustomerPrice(basePrice, tier, segment);
            return {
                ...item,
                price: adjusted,
                unitPrice: adjusted,
                selling_price: adjusted,
                baseUnitPrice: basePrice,
                customerPriceAdjusted: true,
                customerPricingTier: tier?.id || '',
                customerPricingSegment: segment
            };
        });
    };

    const selectCustomer = async (name: string) => {
        const normalizedName = name.trim();
        if (!normalizedName) return;
        const customer = findCustomerByName(normalizedName);
        const selectedName = customer?.name || normalizedName;
        const segment = customer?.segment || '';
        const tier = customer ? await getCustomerPricingTier(customer.id).catch(() => null) : null;

        const updatedItems = recalculateCartPrices(formData.items, tier, segment);

        setFormData({
            ...formData,
            customerName: selectedName,
            customerId: customer?.id || '',
            subAccountName: 'Main',
            billingAddress: customer?.billingAddress || customer?.address || formData.billingAddress || '',
            shippingAddress: customer?.shippingAddress || customer?.billingAddress || customer?.address || formData.shippingAddress || '',
            customerPhone: customer?.phone || formData.customerPhone || '',
            customerEmail: customer?.email || formData.customerEmail || '',
            customerPricingTier: tier?.id || '',
            customerPricingSegment: segment,
            items: updatedItems
        });
        setCustomerSearch(selectedName);
        setIsCustomerDropdownOpen(false);
        setCustomerPanelOpen(false);

        if (customer && customer.creditLimit) {
            const outstanding = getCustomerOutstanding(selectedName);
            if (outstanding > customer.creditLimit) {
                notify(`Warning: ${selectedName} has exceeded their credit limit. Outstanding: ${currency}${outstanding.toLocaleString()}`, "warning");
            }
        }
    };

    const handleQuickAddCustomer = async () => {
        const name = customerSearch.trim();
        if (!name) return;

        try {
            const customer = await ensureCustomerExists(name);
            if (!customer) {
                notify("Could not create client record. Please try again.", "error");
                return;
            }
            selectCustomer(customer.name);
        } catch (err: any) {
            notify(`Failed to add client: ${err.message || 'Unknown error'}`, "error");
        }
    };

    const handleVoucherDateChange = (nextDate: string) => {
        setFormData((prev: any) => {
            if (!isRecurring) {
                return { ...prev, date: nextDate };
            }

            const currentDefault = getDefaultRecurringNextRunDate(prev.frequency || 'Monthly', prev.startDate || prev.date);
            const shouldRecalculateNextRunDate = !isEditing && (!prev.nextRunDate || prev.nextRunDate === currentDefault);

            return {
                ...prev,
                date: nextDate,
                startDate: prev.startDate || nextDate,
                nextRunDate: shouldRecalculateNextRunDate
                    ? getDefaultRecurringNextRunDate(prev.frequency || 'Monthly', prev.startDate || nextDate)
                    : prev.nextRunDate
            };
        });
    };

    const handleRecurringFrequencyChange = (nextFrequency: string) => {
        setFormData((prev: any) => {
            const currentDefault = getDefaultRecurringNextRunDate(prev.frequency || 'Monthly', prev.startDate || prev.date);
            const shouldRecalculateNextRunDate = !isEditing && (!prev.nextRunDate || prev.nextRunDate === currentDefault);

            return {
                ...prev,
                frequency: nextFrequency,
                nextRunDate: shouldRecalculateNextRunDate
                    ? getDefaultRecurringNextRunDate(nextFrequency, prev.startDate || prev.date)
                    : prev.nextRunDate
            };
        });
    };

    const handleRecurringStartDateChange = (nextStartDate: string) => {
        setFormData((prev: any) => {
            const currentDefault = getDefaultRecurringNextRunDate(prev.frequency || 'Monthly', prev.startDate || prev.date);
            const shouldRecalculateNextRunDate = !isEditing && (!prev.nextRunDate || prev.nextRunDate === currentDefault);

            return {
                ...prev,
                startDate: nextStartDate,
                nextRunDate: shouldRecalculateNextRunDate
                    ? getDefaultRecurringNextRunDate(prev.frequency || 'Monthly', nextStartDate)
                    : prev.nextRunDate
            };
        });
    };

    const addManualDate = () => {
        if (!manualDate || formData.scheduledDates.includes(manualDate)) return;
        setFormData({
            ...formData,
            scheduledDates: [...formData.scheduledDates, manualDate].sort()
        });
    };

    const removeManualDate = (date: string) => {
        setFormData({
            ...formData,
            scheduledDates: formData.scheduledDates.filter((d: string) => d !== date)
        });
    };

    const handleCancelForm = () => {
        formData.items.forEach((item: any) => {
            const itemId = item.parentId || item.id;
            const variantId = item.parentId ? item.id : undefined;
            if (item.type !== 'Service') {
                updateReservedStock(itemId, -item.quantity, `Form cancelled`, variantId);
            }
        });
        onCancel();
    };

    const toggleCustomerPanel = () => {
        if (!formData.customerName || formData.customerName === 'Cash') {
            setCustomerPanelOpen(false);
            return;
        }
        setCustomerPanelOpen(prev => !prev);
    };

    const isDuplicateInvoice = useMemo(() => {
        const invNo = formData.id?.trim();
        if (!invNo) return false;
        const allIds = new Set<string>();
        invoices?.forEach(i => allIds.add(i.id));
        quotations?.forEach(q => allIds.add(q.id));
        return allIds.has(invNo) && !isEditing;
    }, [formData.id, invoices, quotations, isEditing]);

    const ROUNDING_METHODS = [
        { value: 'Nearest', label: 'Nearest' },
        { value: 'Up', label: 'Always Up' },
        { value: 'Down', label: 'Always Down' },
        { value: 'Truncate', label: 'Truncate' },
    ];

    const applyRoundingToTotal = (value: number, method: string): { rounded: number; difference: number } => {
        if (!formData.roundingEnabled) return { rounded: value, difference: 0 };
        const step = companyConfig?.pricingSettings?.customStep || 1;
        let rounded: number;
        switch (method) {
            case 'Up': rounded = Math.ceil(value / step) * step; break;
            case 'Down': rounded = Math.floor(value / step) * step; break;
            case 'Truncate': rounded = Math.trunc(value); break;
            default: rounded = Math.round(value); break;
        }
        return { rounded, difference: rounded - value };
    };

    const roundOff = useMemo(() => {
        const preRound = analysis.subTotal - Number(formData.discount || 0) + (analysis.tax || 0) + Number(formData.otherCharges || 0) + calculatedOtherCharges;
        const { rounded, difference } = applyRoundingToTotal(preRound, formData.roundingMethod || 'Nearest');
        return difference;
    }, [analysis.subTotal, formData.discount, analysis.tax, formData.otherCharges, calculatedOtherCharges, formData.roundingMethod, formData.roundingEnabled]);

    const activeMarketAdjustments = useMemo(() => {
        return (marketAdjustments || []).filter((adj: any) => adj.active !== false && adj.isActive !== false);
    }, [marketAdjustments]);

    const selectedAdjustment = useMemo(() => {
        if (!formData.otherChargesAdjustment) return null;
        return activeMarketAdjustments.find((adj: any) => adj.id === formData.otherChargesAdjustment);
    }, [activeMarketAdjustments, formData.otherChargesAdjustment]);

    const handleCalculateCharges = () => {
        if (!selectedAdjustment || !formData.otherChargesEnabled) {
            setCalculatedOtherCharges(0);
            notify('Select a market adjustment first', 'info');
            return;
        }

        const adj = selectedAdjustment;
        const isPercent = adj.type?.toUpperCase() === 'PERCENTAGE' || adj.type?.toUpperCase() === 'PERCENT' || adj.type === 'percentage';
        const adjValue = isPercent ? (adj.value || adj.percentage || 0) : (adj.value || 0);

        setFormData((prev: any) => ({
            ...prev,
            otherChargesPercent: isPercent ? adjValue : 0
        }));

        let totalAdjAmount = 0;
        const currentItems = [...formData.items];

        currentItems.forEach((item: any, idx: number) => {
            const itemPrice = Number(item.price) || 0;
            const itemQty = Number(item.quantity) || 1;
            let adjAmount = 0;

            if (isPercent) {
                adjAmount = itemPrice * (adjValue / 100);
            } else {
                adjAmount = adjValue / Math.max(1, currentItems.length);
            }

            const snapshots = Array.isArray(item.adjustmentSnapshots) ? [...item.adjustmentSnapshots] : [];
            snapshots.push({
                type: adj.type,
                name: adj.name || adj.type,
                value: adjValue,
                isPercent,
                calculatedAmount: adjAmount,
                timestamp: new Date().toISOString(),
                source: 'other_charges'
            });

            currentItems[idx] = {
                ...item,
                price: itemPrice + adjAmount,
                manual_override: true,
                otherChargesAdjustment: adjAmount,
                adjustmentSnapshots: snapshots
            };
            totalAdjAmount += adjAmount * itemQty;
        });

        setFormData((prev: any) => ({
            ...prev,
            items: currentItems
        }));
        setCalculatedOtherCharges(totalAdjAmount);
        notify(`Other charges calculated: ${currency}${totalAdjAmount.toLocaleString()}`, 'success');
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
                <div className="px-5 py-3 border-b border-indigo-800 bg-gradient-to-r from-indigo-700 to-slate-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <h2 className="text-base font-semibold text-white">
                            {isEditing ? 'Edit' : 'Create'} {type}
                            <span className="ml-2 text-sm font-mono text-indigo-200">#{formData.id}</span>
                        </h2>
                        {isDuplicateInvoice && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600 border border-red-200">
                                <AlertCircle size={12} /> Duplicate invoice number
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {isPriceLocked && (
                            <button
                                onClick={() => {
                                    const reason = window.prompt("Enter audit reason for price unlock:");
                                    if (reason && reason.trim()) {
                                        setLocalUnlock(true);
                                        setAuditReason(reason.trim());
                                        notify("Price unlocked for revision", "info");
                                    }
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 hover:bg-amber-100 flex items-center gap-1.5"
                            >
                                <ShieldCheck size={13} /> Unlock Price
                            </button>
                        )}
                        {onPreview && (
                            <button onClick={onPreview} className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-white/10 border border-white/20 hover:bg-white/20 hover:text-white flex items-center gap-1.5">
                                <Eye size={13} /> Preview
                            </button>
                        )}
                        <button onClick={handleCancelForm} className="p-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-white/10">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                            {isQuotation && (
                                <div className="col-span-2 flex items-center justify-between bg-indigo-50 rounded-lg px-4 py-2.5 border border-indigo-100">
                                    <div className="flex items-center gap-2.5">
                                        <FileText size={15} className="text-indigo-600" />
                                        <span className="text-xs font-medium text-indigo-700">Quotation Type</span>
                                    </div>
                                    <div className="flex gap-1">
                                        {(['General', 'Printing'] as QuotationWorkflowType[]).map(entry => (
                                            <button
                                                key={entry}
                                                type="button"
                                                onClick={() => handleQuotationTypeChange(entry)}
                                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                                                    formData.quotationType === entry
                                                        ? 'bg-indigo-600 text-white shadow-sm'
                                                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                                                }`}
                                            >
                                                {entry === 'Printing' ? 'Print Service' : entry}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-3">
                                <span className="text-xs font-medium text-slate-500 w-24">Invoice No</span>
                                <input
                                    type="text"
                                    className={`flex-1 px-3 py-1.5 text-sm border rounded-md bg-white font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors ${
                                        isDuplicateInvoice ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-200 text-slate-800'
                                    }`}
                                    value={formData.id}
                                    onChange={e => setFormData({ ...formData, id: e.target.value })}
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-medium text-slate-500 w-24">Invoice Status</span>
                                <select
                                    className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                                    value={type === 'Invoice' ? 'Sales Invoice' : type === 'Quotation' ? 'Quotation' : type === 'Order' ? 'Sales Order' : 'Proforma'}
                                    onChange={() => {}}
                                >
                                    <option>Sales Invoice</option>
                                    <option>Credit Note</option>
                                    <option>Proforma</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="text-xs font-medium text-slate-500 w-24">Voucher Date</span>
                                <input
                                    type="date"
                                    className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                                    value={formData.date}
                                    onChange={e => handleVoucherDateChange(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-medium text-slate-500 w-24">Due Date</span>
                                <input
                                    type="date"
                                    className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                                    value={formData.dueDate}
                                    onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                                />
                            </div>

                            <div className="flex items-center gap-3 relative" ref={customerDropdownRef}>
                                    <span className="text-xs font-medium text-slate-500 w-24">Customer</span>
                                <div className="flex-1 relative">
                                    <input
                                        type="text"
                                        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                                        placeholder="Search customer..."
                                        value={customerSearch}
                                        onChange={e => {
                                            setCustomerSearch(e.target.value);
                                            setIsCustomerDropdownOpen(true);
                                        }}
                                        onFocus={() => setIsCustomerDropdownOpen(true)}
                                    />
                                    {isCustomerDropdownOpen && (
                                        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                            {filteredCustomers.length === 0 ? (
                                                <div className="p-3 text-center">
                                                    <p className="text-xs text-slate-400 mb-2">No customers found</p>
                                                    {customerSearch.length > 1 && (
                                                        <button onClick={handleQuickAddCustomer} className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mx-auto">
                                                            <UserPlus size={12} /> Add "{customerSearch}"
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                filteredCustomers.map(name => (
                                                    <button
                                                        key={name}
                                                        onClick={() => selectCustomer(name)}
                                                        className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex justify-between items-center border-b border-gray-100 last:border-0"
                                                    >
                                                        <span className="font-medium text-slate-700">{name}</span>
                                                        <span className={`text-xs font-medium ${
                                                            getCustomerOutstanding(name) > 0 ? 'text-red-500' : 'text-green-500'
                                                        }`}>
                                                            {currency}{getCustomerOutstanding(name).toLocaleString()}
                                                        </span>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                                {formData.customerName && (
                                    <button
                                        onClick={toggleCustomerPanel}
                                        className={`px-2 py-1 text-xs font-medium rounded border cursor-pointer transition-colors ${
                                            getCustomerOutstanding(formData.customerName) > 0
                                                ? 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100'
                                                : 'text-indigo-600 bg-indigo-50 border-indigo-200 hover:bg-indigo-100'
                                        }`}
                                        title="Click to view account"
                                    >
                                        {getCustomerOutstanding(formData.customerName) > 0
                                            ? `${currency}${getCustomerOutstanding(formData.customerName).toLocaleString()} overdue`
                                            : 'balance'}
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-medium text-slate-500 w-24">Reference</span>
                                <input
                                    type="text"
                                    className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                                    placeholder="Reference..."
                                    value={formData.referenceDoc || ''}
                                    onChange={e => setFormData({ ...formData, referenceDoc: e.target.value })}
                                />
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="text-xs font-medium text-slate-500 w-24">Sales Account</span>
                                <select
                                    className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                                    value={formData.salesAccountId}
                                    onChange={e => setFormData({ ...formData, salesAccountId: e.target.value })}
                                >
                                    {revenueAccounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                                    ))}
                                </select>
                                <span className="px-2 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded cursor-pointer hover:bg-indigo-100 transition-colors">balance</span>
                            </div>

                            {type === 'Order' && (
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-medium text-slate-500 w-24">Payment Method</span>
                                    <select
                                        className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                                        value={formData.paymentMethod}
                                        onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="Credit Card">Credit Card</option>
                                        <option value="Wallet">Customer Wallet</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        {formData.customerName && customerPanelOpen && (() => {
                            const cust = selectedCustomerObj;
                            if (!cust) return null;
                            const bal = getCustomerOutstanding(formData.customerName);
                            return (
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Building2 size={15} className="text-indigo-500" />
                                        <span className="text-sm font-semibold text-slate-800">{formData.customerName}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                        <div className="flex justify-between py-0.5 border-b border-gray-100">
                                            <span className="text-slate-500">Balance</span>
                                            <span className={`font-medium ${bal > 0 ? 'text-red-600' : bal < 0 ? 'text-green-600' : 'text-slate-600'}`}>
                                                {bal > 0 ? `${currency}${bal.toLocaleString()} overdue` : bal < 0 ? `${currency}${Math.abs(bal).toLocaleString()} credit` : 'Settled'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-0.5 border-b border-gray-100">
                                            <span className="text-slate-500">Credit Limit</span>
                                            <span className="font-medium text-slate-700">{currency}{(cust.creditLimit || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between py-0.5 border-b border-gray-100">
                                            <span className="text-slate-500">Phone</span>
                                            <span className="font-medium text-slate-700">{cust.phone || '—'}</span>
                                        </div>
                                        <div className="flex justify-between py-0.5 border-b border-gray-100">
                                            <span className="text-slate-500">Email</span>
                                            <span className="font-medium text-slate-700">{cust.email || '—'}</span>
                                        </div>
                                        <div className="flex justify-between py-0.5">
                                            <span className="text-slate-500">Wallet</span>
                                            <span className="font-medium text-slate-700">{currency}{(cust.walletBalance || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between py-0.5">
                                            <span className="text-slate-500">Segment</span>
                                            <span className="font-medium text-slate-700">{cust.segment || '—'}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1 py-1 bg-transparent rounded">
                            Line Items
                        </div>

                        <div className="flex items-center gap-2 px-1">
                            <button type="button" onClick={() => handleQuickService('Photocopy')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors">
                                <kbd className="px-1 py-0.5 bg-white border border-indigo-200 rounded text-[10px] font-mono">F10</kbd> Photocopy
                            </button>
                            <button type="button" onClick={() => handleQuickService('Printing')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors">
                                <kbd className="px-1 py-0.5 bg-white border border-indigo-200 rounded text-[10px] font-mono">F11</kbd> Type & Print
                            </button>
                            <button type="button" onClick={() => { if (formData.items.length > 0) handleRemoveItem(formData.items.length - 1); }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                                <kbd className="px-1 py-0.5 bg-white border border-red-200 rounded text-[10px] font-mono">Del</kbd> Remove row
                            </button>
                        </div>

                        <div className="flex gap-3">
                            <div className="flex-1 relative" ref={itemDropdownRef}>
                                <div className="flex items-center border border-gray-200 rounded-md bg-white px-3 py-1.5 gap-2 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-300 transition-all">
                                    <span className="text-xs font-semibold text-indigo-600 whitespace-nowrap">Item</span>
                                    <input
                                        type="text"
                                        className="flex-1 text-sm bg-transparent outline-none"
                                        placeholder="Search inventory..."
                                        value={itemSearch}
                                        onFocus={() => setIsItemDropdownOpen(true)}
                                        onChange={e => {
                                            setItemSearch(e.target.value);
                                            setIsItemDropdownOpen(true);
                                        }}
                                    />
                                </div>
                                {isItemDropdownOpen && (
                                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                        {filteredInventory.length === 0 ? (
                                            <div className="p-4 text-center text-xs text-slate-400">No matching items</div>
                                        ) : (
                                            filteredInventory.map(item => {
                                                const hasVariants = item.variants && item.variants.length > 0;
                                                const prices = hasVariants ? item.variants.map((v: any) => Number(v.price || v.selling_price || 0)) : [];
                                                const minPrice = hasVariants ? Math.min(...prices) : 0;
                                                const maxPrice = hasVariants ? Math.max(...prices) : 0;
                                                const isPriceRange = hasVariants && minPrice !== maxPrice;
                                                const stock = item.stock || 0;
                                                return (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => {
                                                            handleAddItem(item);
                                                            setIsItemDropdownOpen(false);
                                                            setItemSearch('');
                                                        }}
                                                        className="w-full px-3 py-2 text-left hover:bg-slate-50 flex justify-between items-center border-b border-gray-100 last:border-0"
                                                    >
                                                        <div>
                                                            <div className="text-sm font-medium text-slate-700">{item.name}</div>
                                                            <div className="text-[10px] text-slate-400 font-mono">{item.sku || 'NO-SKU'}</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-sm font-semibold text-slate-800">
                                                                {isPriceRange
                                                                    ? `${currency}${minPrice.toLocaleString()} - ${currency}${maxPrice.toLocaleString()}`
                                                                    : `${currency}${Number((hasVariants ? minPrice : item.price) || 0).toLocaleString()}`
                                                                }
                                                            </div>
                                                            <div className={`text-[10px] ${stock < 10 ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                                                                {stock} left
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center border border-gray-200 rounded-md bg-white px-3 py-1.5 gap-2 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-300 transition-all">
                                    <span className="text-xs font-semibold text-indigo-600 whitespace-nowrap">F10: Photocopy</span>
                                    <input
                                        type="text"
                                        className="flex-1 text-sm bg-transparent outline-none"
                                        placeholder="Search photocopy services..."
                                        onFocus={() => handleQuickService('Photocopy')}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 px-1 text-xs">
                            <span className="text-slate-500">Units left: <span className="font-medium text-slate-700">
                                {formData.items.length > 0 ? `${Math.min(...formData.items.map((i: any) => {
                                    const inv = inventory.find((inv: Item) => inv.id === (i.parentId || i.id));
                                    return inv?.stock ?? 0;
                                }))}` : '—'}
                            </span></span>
                            <a href="#" className="text-indigo-600 hover:text-indigo-700 hover:underline" onClick={e => { e.preventDefault(); const match = itemSearch.trim() ? inventory.find((i: Item) => i.name.toLowerCase().includes(itemSearch.toLowerCase()) || i.sku.toLowerCase().includes(itemSearch.toLowerCase())) : null; setItemHistoryItemId(match?.id); setShowItemHistory(true); }}>
                                Alt+F2: Item History
                            </a>
                            <a href="#" className="text-indigo-600 hover:text-indigo-700 hover:underline" onClick={e => { e.preventDefault(); notify('View photo feature', 'info'); }}>
                                View Photo
                            </a>
                        </div>

                        {isPrintingQuotation && (
                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 flex items-center justify-between text-white">
                                    <div className="flex items-center gap-2">
                                        <FileText size={16} />
                                        <span className="text-sm font-semibold">Print Service Quotation</span>
                                    </div>
                                    <span className="text-xs text-indigo-200">{printJobCount.toLocaleString()} total copies</span>
                                </div>
                                <div className="p-3 space-y-2">
                                    {printQuotationDetails.jobs.map((job, index) => (
                                        <div key={job.id} className="border border-slate-200 rounded-lg p-3 space-y-2 hover:border-slate-300 transition-colors">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-semibold text-slate-500">Job #{index + 1}</span>
                                                <button onClick={() => handleRemovePrintJob(job.id)} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2">
                                                <div>
                                                    <label className="text-[10px] text-slate-500 font-medium">Job Name</label>
                                                    <input type="text" value={job.jobName} onChange={e => handleUpdatePrintJob(job.id, 'jobName', e.target.value)} className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors" placeholder="e.g. Brochures" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-slate-500 font-medium">Paper Size</label>
                                                    <select value={job.paperSize} onChange={e => handleUpdatePrintJob(job.id, 'paperSize', e.target.value)} className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors">
                                                        {PAPER_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-slate-500 font-medium">Qty</label>
                                                    <input type="number" min={1} value={job.quantity || ''} onChange={e => handleUpdatePrintJob(job.id, 'quantity', e.target.value)} className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-slate-500 font-medium">Price/Unit</label>
                                                    <input type="number" min={0} step="0.01" value={job.pricePerUnit || ''} onChange={e => handleUpdatePrintJob(job.id, 'pricePerUnit', e.target.value)} className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors" />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] text-slate-500">Color:</span>
                                                    {COLOR_MODE_OPTIONS.map(opt => (
                                                        <button key={opt.value} type="button" onClick={() => handleUpdatePrintJob(job.id, 'colorMode', opt.value)}
                                                            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${job.colorMode === opt.value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                                            {opt.label}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] text-slate-500">Sides:</span>
                                                    {SIDES_OPTIONS.map(opt => (
                                                        <button key={opt.value} type="button" onClick={() => handleUpdatePrintJob(job.id, 'sides', opt.value)}
                                                            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${job.sides === opt.value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                                            {opt.label}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="flex items-center gap-1 flex-1">
                                                    <span className="text-[10px] text-slate-500">Finishing:</span>
                                                    {FINISHING_OPTIONS.map(opt => {
                                                        const isSelected = job.finishing.includes(opt);
                                                        return (
                                                            <button key={opt} type="button" onClick={() => {
                                                                const next = isSelected ? job.finishing.filter(f => f !== opt) : [...job.finishing, opt];
                                                                handleUpdatePrintJob(job.id, 'finishing', next);
                                                            }} className={`px-1.5 py-0.5 text-[10px] rounded border transition-colors ${isSelected ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                                                                {opt}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div className="text-right text-xs">
                                                <span className="text-slate-500">{job.quantity} x {currency}{job.pricePerUnit.toFixed(2)} = </span>
                                                <span className="font-semibold text-indigo-700">{currency}{(job.quantity * job.pricePerUnit).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                    <button onClick={handleAddPrintJob} className="w-full py-2 text-xs font-medium text-indigo-600 border-2 border-dashed border-slate-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-1">
                                        <Plus size={13} /> Add Print Job
                                    </button>
                                </div>
                            </div>
                        )}

                        {type === 'Recurring' && (
                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-4">
                                <div className="flex items-center gap-2">
                                    <RefreshCw size={15} className="text-indigo-600" />
                                    <span className="text-sm font-semibold text-slate-800">Subscription Settings</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-slate-500 font-medium block mb-1">Billing Frequency</label>
                                        <select value={formData.frequency} onChange={e => handleRecurringFrequencyChange(e.target.value)} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors">
                                            <option value="Daily">Daily</option>
                                            <option value="Weekly">Weekly</option>
                                            <option value="Monthly">Monthly</option>
                                            <option value="Quarterly">Quarterly</option>
                                            <option value="Annually">Annually</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 font-medium block mb-1">Status</label>
                                        <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors">
                                            {RECURRING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 font-medium block mb-1">Start Date</label>
                                        <input type="date" value={formData.startDate} onChange={e => handleRecurringStartDateChange(e.target.value)} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 font-medium block mb-1">End Date</label>
                                        <input type="date" value={formData.endDate} min={formData.startDate || undefined} onChange={e => setFormData({ ...formData, endDate: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 font-medium block mb-1">Next Billing Date</label>
                                        <input type="date" value={formData.nextRunDate} onChange={e => setFormData({ ...formData, nextRunDate: e.target.value })} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 text-xs text-slate-600">
                                        <input type="checkbox" checked={formData.autoDeductWallet} onChange={e => setFormData({ ...formData, autoDeductWallet: e.target.checked })} className="rounded text-indigo-600" />
                                        Auto-Deduct from Wallet
                                    </label>
                                    <label className="flex items-center gap-2 text-xs text-slate-600">
                                        <input type="checkbox" checked={formData.autoEmail} onChange={e => setFormData({ ...formData, autoEmail: e.target.checked })} className="rounded text-indigo-600" />
                                        Auto-Email on Generation
                                    </label>
                                </div>
                            </div>
                        )}

                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-4 py-2 bg-slate-50 border-b border-gray-200 flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-600">Items</span>
                                <span className="text-xs text-slate-400">{analysis.processedItems.length} item{analysis.processedItems.length !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <colgroup>
                                        <col style={{width: '38%'}} />
                                        <col style={{width: '14%'}} />
                                        <col style={{width: '22%'}} />
                                        <col style={{width: '20%'}} />
                                        <col style={{width: '6%'}} />
                                    </colgroup>
                                    <thead>
                                        <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            <th className="px-3 py-2 text-left border-b border-gray-200">Item</th>
                                            <th className="px-3 py-2 text-center border-b border-gray-200">QTY</th>
                                            <th className="px-3 py-2 text-right border-b border-gray-200">Price</th>
                                            <th className="px-3 py-2 text-right border-b border-gray-200">Amount</th>
                                            <th className="px-3 py-2 text-center border-b border-gray-200"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {analysis.processedItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-3 py-8 text-center text-slate-400 text-sm">
                                                    <FileText size={20} className="mx-auto mb-1 opacity-40" />
                                                    Press Enter to add the first item
                                                </td>
                                            </tr>
                                        ) : (
                                            analysis.processedItems.map((item: CartItem, idx: number) => {
                                                const invItem = inventory.find((i: Item) => i.id === (item.parentId || item.id));
                                                const stock = invItem?.stock ?? 0;
                                                const qty = Number(item.quantity) || 0;
                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-3 py-2 text-sm text-slate-800 font-medium flex items-center gap-2">
                                                            {invItem?.image ? (
                                                                <button onClick={e => { e.stopPropagation(); setPhotoViewItem(invItem); }} className="shrink-0 w-7 h-7 rounded border border-slate-200 overflow-hidden hover:border-indigo-300 hover:shadow-sm transition-all" title="View Photo">
                                                                    <OfflineImage src={invItem.image} alt="" className="w-full h-full object-cover" />
                                                                </button>
                                                            ) : (
                                                                <span className="shrink-0 w-7 h-7 rounded border border-slate-100 flex items-center justify-center text-slate-300" title="No photo">
                                                                    <Image size={12} />
                                                                </span>
                                                            )}
                                                            <span>{item.name}</span>
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                className={`w-16 text-center text-sm border border-gray-200 rounded px-1.5 py-1 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors ${qty > stock && stock > 0 ? 'text-red-600' : ''}`}
                                                                value={qty}
                                                                onChange={e => handleQuantityChange(idx, parseFloat(e.target.value) || 0)}
                                                                disabled={isPriceLocked || isPrintingQuotation}
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2 text-right">
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                step="0.01"
                                                                className="w-24 text-right text-sm border border-gray-200 rounded px-1.5 py-1 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                                                                value={Number(item.price || 0)}
                                                                onChange={e => {
                                                                    if (isPriceLocked || isPrintingQuotation) return;
                                                                    applyManualLineItemPrice(item.id, parseFloat(e.target.value) || 0);
                                                                }}
                                                                disabled={isPriceLocked || isPrintingQuotation}
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2 text-right text-sm font-semibold text-indigo-700">
                                                            {currency}{((Number(item.price) || 0) * qty).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                            <button
                                                                onClick={() => handleRemoveItem(idx)}
                                                                disabled={isPriceLocked || isPrintingQuotation}
                                                                className="text-slate-300 hover:text-red-500 disabled:opacity-30 transition-colors"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="px-3 py-2 border-t border-gray-200 bg-slate-50 flex items-center">
                                <button
                                    onClick={() => {
                                        if (!formData.items.length) {
                                            const firstItem = inventory.find((i: Item) => i.type !== 'Material' && !i.isVariantParent);
                                            if (firstItem) handleAddItem(firstItem);
                                        } else {
                                            handleQuantityChange(0, (formData.items[0]?.quantity || 0) + 1);
                                        }
                                    }}
                                    className="text-xs font-medium text-indigo-600 border border-dashed border-indigo-200 rounded px-3 py-1 hover:bg-indigo-50 flex items-center gap-1"
                                >
                                    <Plus size={12} /> Add row
                                </button>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                            <div className="px-4 py-2 bg-slate-50 border-b border-gray-200 flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-500">
                                    {analysis.totalItems} item{analysis.totalItems !== 1 ? 's' : ''} &middot; {analysis.totalQty} qty
                                </span>
                                <span className="text-sm font-semibold text-slate-800">
                                    {currency}{analysis.subTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-[1fr_280px] gap-0">
                            <div className="pr-4 border-r border-gray-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <input
                                        type="checkbox"
                                        className="rounded"
                                        checked={formData.otherChargesEnabled}
                                        onChange={e => {
                                            setFormData({ ...formData, otherChargesEnabled: e.target.checked });
                                            if (!e.target.checked) {
                                                setCalculatedOtherCharges(0);
                                            }
                                        }}
                                    />
                                    <span className="text-xs font-medium text-slate-700">Other Charges</span>
                                    {formData.otherChargesEnabled && (
                                        <>
                                            <select
                                                className="text-xs border border-gray-200 rounded px-2 py-1 bg-white flex-1 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                                                value={formData.otherChargesAdjustment}
                                                onChange={e => {
                                                    const adj = activeMarketAdjustments.find((a: any) => a.id === e.target.value);
                                                    const val = adj ? (adj.type?.toUpperCase() === 'PERCENTAGE' || adj.type?.toUpperCase() === 'PERCENT' || adj.type === 'percentage' ? (adj.value || adj.percentage || 0) : 0) : 0;
                                                    setFormData({ ...formData, otherChargesAdjustment: e.target.value, otherChargesPercent: val });
                                                }}
                                            >
                                                <option value="">Select market adjustment...</option>
                                                {activeMarketAdjustments.length === 0 && (
                                                    <option value="" disabled>No adjustments available</option>
                                                )}
                                                {activeMarketAdjustments.map((adj: any) => {
                                                    const isPercent = adj.type?.toUpperCase() === 'PERCENTAGE' || adj.type?.toUpperCase() === 'PERCENT' || adj.type === 'percentage';
                                                    const val = isPercent ? (adj.value || adj.percentage || 0) : (adj.value || 0);
                                                    return (
                                                        <option key={adj.id} value={adj.id}>
                                                            {adj.name} {isPercent ? `(${val}%)` : `(${currency}${val})`}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                            {selectedAdjustment && formData.otherChargesPercent > 0 && (
                                                <span className="text-xs font-semibold text-indigo-600 whitespace-nowrap">
                                                    {formData.otherChargesPercent}%
                                                </span>
                                            )}
                                            <button
                                                onClick={handleCalculateCharges}
                                                disabled={!formData.otherChargesAdjustment}
                                                className="px-3 py-1 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-1"
                                            >
                                                <Calculator size={12} /> Calculate
                                            </button>
                                        </>
                                    )}
                                </div>
                                {formData.otherChargesEnabled && calculatedOtherCharges > 0 && (
                                    <div className="mb-2 text-xs text-indigo-700 font-medium bg-indigo-50 border border-indigo-200 rounded px-2.5 py-1">
                                        Adjustment applied: {currency}{calculatedOtherCharges.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </div>
                                )}
                                <textarea
                                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 bg-white resize-y min-h-[48px] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                                    placeholder="Narration / notes..."
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                />
                                <div className="text-[10px] text-slate-400 mt-0.5">Ctrl+Enter for new line</div>
                            </div>
                            <div className="pl-4 min-w-[240px]">
                                <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-lg p-3 space-y-2 shadow-sm">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500">Round Up</span>
                                        <div className="flex items-center gap-1">
                                            <select
                                                className="text-[10px] border border-slate-200 rounded px-1.5 py-0.5 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                                                value={formData.roundingMethod || 'Nearest'}
                                                onChange={e => setFormData({ ...formData, roundingMethod: e.target.value })}
                                            >
                                                {ROUNDING_METHODS.map(m => (
                                                    <option key={m.value} value={m.value}>{m.label}</option>
                                                ))}
                                            </select>
                                            <input
                                                type="checkbox"
                                                className="rounded ml-1 text-indigo-600"
                                                checked={formData.roundingEnabled}
                                                onChange={e => setFormData({ ...formData, roundingEnabled: e.target.checked })}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-500">Other Charges</span>
                                        <span className="font-medium text-slate-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                                            {currency}{(Number(formData.otherCharges || 0) + calculatedOtherCharges).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-500">Round Off</span>
                                        <span className="font-medium text-slate-600">{roundOff.toFixed(2)}</span>
                                    </div>
                                    <hr className="border-slate-200" />
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-semibold text-slate-700">Total Amount</span>
                                        <span className="text-base font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 rounded px-3 py-1 whitespace-nowrap">
                                            {currency}{(finalDisplayTotal + roundOff).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-3">
                                    <div className="text-xs font-medium text-slate-500 mb-1">Reference Document</div>
                                    <input
                                        type="text"
                                        className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors"
                                        placeholder="No reference attached"
                                        value={formData.referenceDoc || ''}
                                        onChange={e => setFormData({ ...formData, referenceDoc: e.target.value })}
                                    />
                                    <div className="flex gap-1.5 mt-1.5">
                                        <button className="flex-1 text-xs text-slate-600 bg-white border border-slate-200 rounded px-2 py-1 hover:bg-slate-50 hover:text-slate-700 flex items-center justify-center gap-1 transition-colors">
                                            <FolderOpen size={12} /> Browse
                                        </button>
                                        <button className="flex-1 text-xs text-slate-600 bg-white border border-slate-200 rounded px-2 py-1 hover:bg-slate-50 hover:text-slate-700 flex items-center justify-center gap-1 transition-colors">
                                            <Eye size={12} /> View
                                        </button>
                                        <button className="flex-1 text-xs text-red-500 bg-white border border-slate-200 rounded px-2 py-1 hover:bg-red-50 flex items-center justify-center gap-1 transition-colors">
                                            <Trash2 size={12} /> Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded">
                            <FileText size={11} /> Draft
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded" style={{display: 'none'}}>
                            <Check size={11} /> Saved
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                if (!formData.items.length) { notify('Nothing to duplicate — add items first.', 'info'); return; }
                                setFormData((prev: any) => ({
                                    ...prev,
                                    id: `${type === 'Invoice' ? 'INV' : type === 'Quotation' ? 'Q' : 'ORD'}${Math.floor(Math.random() * 9000 + 1000)}`
                                }));
                                notify('Voucher duplicated', 'success');
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
                        >
                            <Copy size={12} /> Duplicate
                        </button>
                        {isEditing && (
                            <input
                                type="text"
                                value={auditReason}
                                onChange={e => setAuditReason(e.target.value)}
                                placeholder="Audit reason required (price unlock, quote override, etc.)"
                                className="w-48 text-xs border border-amber-200 rounded px-2 py-1.5 bg-amber-50 placeholder:text-amber-400 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300 outline-none transition-colors"
                            />
                        )}
                        <button
                            onClick={() => handleSubmission(true)}
                            disabled={formData.items.length === 0 || (isEditing && !auditReason.trim()) || saving}
                            className="px-4 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-40 transition-colors"
                        >
                            <Save size={12} /> Save and Preview
                        </button>
                        <button
                            onClick={() => handleSubmission(false, false)}
                            disabled={formData.items.length === 0 || (isEditing && !auditReason.trim()) || saving}
                            className="px-5 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-blue-600 rounded-lg hover:from-indigo-700 hover:to-blue-700 shadow-sm flex items-center gap-1.5 disabled:opacity-40 transition-all"
                        >
                            <Check size={13} /> Save & Finalise
                        </button>
                    </div>
                </div>

                {selectedProductForVariants && (
                    <VariantSelectorModal
                        product={selectedProductForVariants}
                        onSelect={handleVariantSelect}
                        onClose={() => setSelectedProductForVariants(null)}
                    />
                )}
                {selectedServiceForCalculator && (
                    <ServiceCalculatorModal
                        service={selectedServiceForCalculator}
                        currencySymbol={currency}
                        initialPages={serviceInitialValues.pages}
                        initialCopies={serviceInitialValues.copies}
                        onConfirm={handleServicePricingConfirm}
                        onClose={() => {
                            setSelectedServiceForCalculator(null);
                            setServiceEditIndex(null);
                        }}
                    />
                )}
                {quickPrintModal.open && (
                    <QuickPrintModal
                        open={quickPrintModal.open}
                        onClose={() => setQuickPrintModal({ open: false, type: 'photocopy' })}
                        type={quickPrintModal.type}
                        pricePerPage={quickPrintModal.type === 'photocopy' 
                            ? (companyConfig.transactionSettings?.pos?.photocopyPrice ?? 2.00)
                            : (companyConfig.transactionSettings?.pos?.typePrintingPrice ?? 5.00)}
                        costPerPage={quickPrintModal.type === 'photocopy'
                            ? calculatePhotocopyCostPerPage(inventory)
                            : calculateTypePrintingCostPerPage(inventory)}
                        currency={currency}
                        staplePrice={companyConfig.transactionSettings?.pos?.staplePrice}
                        pinningItem={(() => {
                            const pinning = inventory.find(i => {
                                const name = i.name?.toLowerCase() || '';
                                return name.includes('staple') || /\bpins?\b/.test(name);
                            });
                            if (!pinning) return null;
                            const conversionRate = Number(pinning.conversionRate ?? pinning.conversion_rate ?? 1);
                            return {
                                costPerUnit: Number(pinning.cost_price ?? pinning.cost_per_unit ?? pinning.cost ?? 0),
                                conversionRate: conversionRate,
                                materialId: pinning.id
                            };
                        })()}
                        onConfirm={handleQuickPrintConfirm}
                    />
                )}
                {showItemHistory && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setShowItemHistory(false)}>
                        <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col m-4" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-slate-50">
                                <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                    <History size={16} className="text-indigo-500" />
                                    Item History
                                    {itemHistoryItemId && (
                                        <span className="text-xs font-normal text-slate-400">
                                            #{inventory.find((i: Item) => i.id === itemHistoryItemId)?.sku ?? itemHistoryItemId}
                                        </span>
                                    )}
                                </span>
                                <button onClick={() => setShowItemHistory(false)} className="p-1 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4">
                                {itemHistoryItemId ? (
                                    <InventoryTransactionHistory itemId={itemHistoryItemId} />
                                ) : (
                                    <div className="py-8 text-center text-sm text-slate-400">
                                        <History size={32} className="mx-auto mb-2 opacity-30" />
                                        Type an item name or SKU in the search box above, then press Alt+F2
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {photoViewItem && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setPhotoViewItem(null)}>
                        <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden m-4" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-slate-50">
                                <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                    <Image size={16} className="text-indigo-500" />
                                    {photoViewItem.name}
                                    {photoViewItem.sku && (
                                        <span className="text-xs font-normal text-slate-400">#{photoViewItem.sku}</span>
                                    )}
                                </span>
                                <button onClick={() => setPhotoViewItem(null)} className="p-1 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="p-4 flex items-center justify-center bg-slate-100 min-h-[300px]">
                                <OfflineImage src={photoViewItem.image} alt={photoViewItem.name} className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-sm" fallback={
                                    <div className="flex flex-col items-center gap-2 text-slate-400 py-12">
                                        <Image size={48} className="opacity-30" />
                                        <span className="text-sm">No image available</span>
                                    </div>
                                } />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
