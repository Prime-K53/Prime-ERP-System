import React, { useState, useEffect, useMemo } from 'react';
import { logger } from '@/services/logger';
import { Calculator, ChevronDown, ChevronUp, X, Info, Copy, RefreshCw, Save, Printer, Package, Settings, Plus, Download } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSales } from '../../context/SalesContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { dbService } from '../../services/db';
import { Item, MarketAdjustment, BOMTemplate, FinishingOption } from '../../types';
import { generateAutoSKU } from '../../utils/skuGenerator';
import { normalizeInventoryItemPricing } from '../../utils/pricing';
import { calculateProfit, calculateMarkup, validateMinimumMarkup, buildPricingSnapshot } from '../../services/pricingValidationService';
import { currencyService } from '../../services/currencyService';
import html2canvas from 'html2canvas';

const defaultFinishingOptions: FinishingOption[] = [
    { id: 'binding', name: 'Binding', enabled: false, price: 150, description: 'Book binding - comb or spiral', items: [] },
    { id: 'coverPages', name: 'Cover Pages', enabled: false, price: 20, description: 'Front and back cover pages per copy', items: [] },
    { id: 'cutting', name: 'Cutting & Trimming', enabled: false, price: 30, description: 'Trim edges to clean finish', items: [] },
    { id: 'holePunch', name: 'Hole Punching', enabled: false, price: 20, description: 'Punch holes for folder binding', items: [] },
    { id: 'folding', name: 'Folding', enabled: false, price: 15, description: 'Fold pages for insertion', items: [] },
    { id: 'stapling', name: 'Stapling', enabled: false, price: 10, description: 'Corner or saddle stapling', items: [] },
];

const SmartPricing: React.FC = () => {
    const { companyConfig } = useAuth();

    const { addJobOrder, jobOrders } = useSales();
    const navigate = useNavigate();
    const location = useLocation();
    const currency = currencyService.getCurrency(currencyService.getBaseCurrency())?.symbol || '$';
    
    const [pages, setPages] = useState(1);
    const [copies, setCopies] = useState(1);
    const [selectedPaperId, setSelectedPaperId] = useState<string>('');
    const [selectedTonerId, setSelectedTonerId] = useState<string>('');
    const [finishingOptions, setFinishingOptions] = useState<FinishingOption[]>(defaultFinishingOptions);
    const [sellingPrice, setSellingPrice] = useState<number>(0);
    const [productName, setProductName] = useState('Scheme Pad');
    const [selectedInventoryProductId, setSelectedInventoryProductId] = useState('');
    const [editingProductId, setEditingProductId] = useState<string | null>(null);
    const [editingBomId, setEditingBomId] = useState<string | null>(null);
    const [itemType, setItemType] = useState<'Product' | 'Service'>('Product');
    const [isCreatingProduct, setIsCreatingProduct] = useState(false);
    const [inventory, setInventory] = useState<Item[]>([]);
    const [marketAdjustments, setMarketAdjustments] = useState<MarketAdjustment[]>([]);
    const [bomTemplates, setBOMTemplates] = useState<BOMTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [paperExpanded, setPaperExpanded] = useState(true);
    const [finishingExpanded, setFinishingExpanded] = useState(true);
    const [marketExpanded, setMarketExpanded] = useState(false);
    const [bomExpanded, setBomExpanded] = useState(false);
    const [showSummaryCard, setShowSummaryCard] = useState(false);
    const [cameFromModal, setCameFromModal] = useState(false);
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [saveItemName, setSaveItemName] = useState('');
    const [saveDialogType, setSaveDialogType] = useState<'Product' | 'Service'>('Product');
    const [saveVariants, setSaveVariants] = useState<Array<{ id: string; attribute: string; pages: number; basePrice: number; sellingPrice: number }>>([]);

    useEffect(() => {
        const loadData = async () => {
            try {
                setIsLoading(true);
                const [inv, adjustments, templates] = await Promise.all([
                    dbService.getAll<Item>('inventory'),
                    dbService.getAll<MarketAdjustment>('marketAdjustments'),
                    dbService.getAll<BOMTemplate>('bomTemplates'),
                ]);
                setInventory(inv.map(normalizeInventoryItemPricing));
                setMarketAdjustments(adjustments.filter(adj => adj.active ?? adj.isActive ?? false));
                setBOMTemplates(templates);

                if (companyConfig?.productionSettings?.finishingOptions?.length > 0) {
                    setFinishingOptions(companyConfig.productionSettings.finishingOptions);
                } else {
                    const savedCosts = await dbService.getSetting<Record<string, number>>('finishingOptionCosts');
                    if (savedCosts) {
                        setFinishingOptions(prev => prev.map(opt => ({
                            ...opt,
                            price: savedCosts[opt.id] ?? opt.price
                        })));
                    }
                }

                const isRawMat = (i: Item) => i.type === 'Raw Material' || i.type === 'Material';

                const paperItemsList = inv.filter(i => {
                    if (!isRawMat(i)) return false;
                    const cat = (i.category || '').toLowerCase();
                    return cat.includes('paper') || cat.includes('bond') || cat.includes('sheet');
                });
                const tonerItemsList = inv.filter(i => {
                    if (!isRawMat(i)) return false;
                    const cat = (i.category || '').toLowerCase();
                    return cat.includes('toner') || cat.includes('ink') || cat.includes('cartridge');
                });

                if (paperItemsList.length > 0) setSelectedPaperId(paperItemsList[0].id);
                if (tonerItemsList.length > 0) {
                    const universalToner = tonerItemsList.find(t => 
                        (t.name || '').toLowerCase().includes('universal')
                    );
                    setSelectedTonerId(universalToner ? universalToner.id : tonerItemsList[0].id);
                }
            } catch (err) {
                logger.error('Failed to load pricing data:', err);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [companyConfig]);

    useEffect(() => {
        const loadProductId = (location.state as { loadProductId?: string })?.loadProductId || new URLSearchParams(location.search).get('loadProductId');
        if (loadProductId && inventory.length > 0) {
            loadInventoryProduct(loadProductId);
            setCameFromModal(true);
            window.history.replaceState({}, document.title);
        }
    }, [inventory, location.state, location.search]);

    const isRawMat = (i: Item) => i.type === 'Raw Material' || i.type === 'Material';

    const paperItems = useMemo(() => inventory.filter(i => {
        if (!isRawMat(i)) return false;
        const cat = (i.category || '').toLowerCase();
        return cat.includes('paper') || cat.includes('bond') || cat.includes('sheet');
    }), [inventory]);

    const tonerItems = useMemo(() => inventory.filter(i => {
        if (!isRawMat(i)) return false;
        const cat = (i.category || '').toLowerCase();
        return cat.includes('toner') || cat.includes('ink') || cat.includes('cartridge');
    }), [inventory]);

    const selectedPaper = useMemo(() => inventory.find(i => i.id === selectedPaperId), [inventory, selectedPaperId]);
    const selectedToner = useMemo(() => inventory.find(i => i.id === selectedTonerId), [inventory, selectedTonerId]);

    const editableInventoryProducts = useMemo(
        () => inventory
            .filter(item => item.type === 'Product' || item.type === 'Service')
            .sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''))),
        [inventory]
    );

    const calculateCosts = () => {
        let paperCostVal = 0;
        if (selectedPaper) {
            const sheetsPerCopy = Math.ceil(pages / 2);
            const totalSheetsVal = sheetsPerCopy * copies;
            const reamSize = Number(selectedPaper.conversionRate || selectedPaper.conversion_rate || 500);
            const paperUnitCost = Number(selectedPaper.cost_price || selectedPaper.cost_per_unit || selectedPaper.cost || 0);
            const costPerSheet = reamSize > 0 ? paperUnitCost / reamSize : 0;
            paperCostVal = Number((totalSheetsVal * costPerSheet).toFixed(2));
        }

        let tonerCostVal = 0;
        if (selectedToner) {
            const capacity = 20000;
            const totalPagesVal = pages * copies;
            const tonerUnitCost = Number(selectedToner.cost_price || selectedToner.cost_per_unit || selectedToner.cost || 0);
            const costPerPage = tonerUnitCost / capacity;
            tonerCostVal = Number((totalPagesVal * costPerPage).toFixed(2));
        }

        const finishingCostVal = finishingOptions
            .filter(o => o.enabled)
            .reduce((sum, o) => {
                return sum + (o.price * copies);
            }, 0);

        const finishingInventoryCostVal = finishingOptions
            .filter(o => o.enabled && o.items && o.items.length > 0)
            .reduce((sum, o) => {
                const optionInventoryCost = o.items.reduce((itemSum, itemConfig) => {
                    const item = inventory.find(i => i.id === itemConfig.itemId);
                    if (!item) return itemSum;
                    const itemCost = Number(item.cost_price || item.cost_per_unit || item.cost || 0);
                    return itemSum + (itemCost * itemConfig.quantity * copies);
                }, 0);
                return sum + optionInventoryCost;
            }, 0);

        const baseCostVal = paperCostVal + tonerCostVal + finishingCostVal + finishingInventoryCostVal;
        
        return { 
            paperCost: paperCostVal, 
            tonerCost: tonerCostVal, 
            finishingCost: finishingCostVal, 
            finishingInventoryCost: finishingInventoryCostVal, 
            baseCost: baseCostVal,
        };
    };

    const { paperCost, tonerCost, finishingCost, finishingInventoryCost, baseCost } = calculateCosts();
    const costPrice = baseCost;
    const profit = calculateProfit(costPrice, sellingPrice);
    const profitMarkup = calculateMarkup(costPrice, sellingPrice);
    const validation = validateMinimumMarkup(costPrice, sellingPrice, editingProductId ? { id: editingProductId, category: undefined } : undefined);
    const pricingSnapshot = buildPricingSnapshot(costPrice, sellingPrice, editingProductId ? { id: editingProductId, category: undefined } : undefined);

    const handlePagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value >= 1 && value <= 10000) setPages(value);
        else if (e.target.value === '') setPages(1);
    };

    const handleSellingPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(e.target.value);
        if (!isNaN(value) && value >= 0) setSellingPrice(value);
        else if (e.target.value === '') setSellingPrice(0);
    };

    const toggleFinishingOption = (id: string) => {
        setFinishingOptions(prev => prev.map(opt => 
            opt.id === id ? { ...opt, enabled: !opt.enabled } : opt
        ));
    };

    const resetCalculator = () => {
        setPages(1);
        setCopies(1);
        setSellingPrice(0);
        if (paperItems.length > 0) setSelectedPaperId(paperItems[0].id);
        if (tonerItems.length > 0) setSelectedTonerId(tonerItems[0].id);
        setFinishingOptions(prev => prev.map(opt => ({ ...opt, enabled: false })));
    };

    const clearLoadedProduct = () => {
        setEditingProductId(null);
        setEditingBomId(null);
        setSelectedInventoryProductId('');
        setProductName('');
        setItemType('Product');
        resetCalculator();
    };

    const loadInventoryProduct = (productId: string) => {
        const product = inventory.find(item => item.id === productId);
        if (!product) {
            alert('Selected item was not found in inventory.');
            return;
        }

        const smartPricing = product.smartPricing || {};
        const savedPaperId = String(smartPricing.paperItemId || product.pricingConfig?.paperId || '');
        const savedTonerId = String(smartPricing.tonerItemId || product.pricingConfig?.tonerId || '');
        const savedFinishingIds = new Set<string>([
            ...((smartPricing.finishingEnabled || []) as string[]),
            ...(((product.pricingConfig?.finishingOptions || []) as FinishingOption[]).map(option => option.id))
        ]);
        const savedFinishingCostMap = {
            ...Object.fromEntries(
                (((smartPricing.finishingSelections || []) as FinishingOption[]).map(option => [
                    option.id,
                    Number(option.price) || 0
                ]))
            ),
            ...((smartPricing.finishingOptionCosts || {}) as Record<string, number>)
        };
        const resolvedPaperId = savedPaperId || paperItems[0]?.id || selectedPaperId || '';
        const resolvedTonerId = savedTonerId || tonerItems[0]?.id || selectedTonerId || '';

        setPages(Math.max(1, Number(smartPricing.pages ?? product.pages ?? 1) || 1));
        setSellingPrice(Number(product.sellingPrice ?? product.price ?? 0));
        setSelectedPaperId(resolvedPaperId);
        setSelectedTonerId(resolvedTonerId);
        setFinishingOptions(prev => prev.map(option => ({
            ...option,
            price: Number(savedFinishingCostMap[option.id] ?? option.price) || option.price,
            enabled: savedFinishingIds.has(option.id)
        })));
        setEditingProductId(product.id);
        setEditingBomId(String(smartPricing.bomTemplateId || `BOM-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`));
        setSelectedInventoryProductId(product.id);
        setProductName(product.name || '');
        setItemType((product.type as 'Product' | 'Service') || 'Product');
    };

    const handleSaveProduct = async (nameOverride?: string) => {
        const nameToUse = nameOverride || productName;
        if (!nameToUse.trim()) {
            alert('Please enter a name');
            return;
        }

        if (!validation.valid) {
            alert(`Unable to save product.\n\nCalculated markup: ${profitMarkup.toFixed(1)}%\nMinimum required markup: ${validation.minimumMarkup}%\n\n${validation.message}`);
            return;
        }

        setIsCreatingProduct(true);

        try {
            const existingProduct = editingProductId ? inventory.find(item => item.id === editingProductId) : null;
            const productId = editingProductId || `PROD-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            const bomId = editingBomId || existingProduct?.smartPricing?.bomTemplateId || `BOM-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            const enabledFinishingOptions = finishingOptions.filter(option => option.enabled);
            const finishingOptionCosts = enabledFinishingOptions.reduce<Record<string, number>>((acc, option) => {
                acc[option.id] = Number(option.price) || 0;
                return acc;
            }, {});

            const newProduct: Item = {
                ...(existingProduct || {}),
                id: productId,
                name: nameToUse.trim(),
                sku: existingProduct?.sku || generateAutoSKU(itemType, nameToUse, undefined, inventory),
                type: itemType,
                classification: itemType === 'Service' ? 'printing_service' : existingProduct?.classification,
                category: existingProduct?.category || (itemType === 'Service' ? 'Printing Service' : 'Printed Products'),
                unit: existingProduct?.unit || 'Booklet',
                cost: baseCost,
                cost_price: baseCost,
                costPrice: baseCost,
                price: sellingPrice,
                selling_price: sellingPrice,
                sellingPrice: sellingPrice,
                profitAmount: profit,
                profitMargin: profitMarkup,
                minimumMargin: validation.minimumMarkup,
                pricingValidated: validation.valid,
                validationTimestamp: new Date().toISOString(),
                stock: existingProduct?.stock || 0,
                pages,
                pricingConfig: {
                    ...(existingProduct?.pricingConfig || {}),
                    paperId: selectedPaperId,
                    tonerId: selectedTonerId,
                    finishingOptions: enabledFinishingOptions,
                    manualOverride: false,
                    marketAdjustment: 0,
                },
                smartPricing: {
                    pages,
                    copies: 1,
                    totalPages: pages,
                    totalSheets: Math.ceil(pages / 2),
                    paperItemId: selectedPaperId,
                    tonerItemId: selectedTonerId,
                    finishingEnabled: enabledFinishingOptions.map(o => o.id),
                    finishingOptionCosts,
                    bomTemplateId: bomId,
                    paperCost,
                    tonerCost,
                    finishingCost,
                    finishingInventoryCost,
                    baseCost,
                } as Item['smartPricing']
            };

            const components: any[] = [];
            if (selectedPaper) {
                components.push({
                    itemId: selectedPaperId,
                    name: selectedPaper.name,
                    quantityFormula: `${totalSheets}`,
                    unit: selectedPaper.unit || 'ream'
                });
            }
            if (selectedToner) {
                components.push({
                    itemId: selectedTonerId,
                    name: selectedToner.name,
                    quantityFormula: `${Math.ceil(totalPages / 20000 * 100)} / 100`,
                    unit: selectedToner.unit || 'unit'
                });
            }
            enabledFinishingOptions.forEach(opt => {
                components.push({
                    itemId: opt.id,
                    name: opt.name,
                    quantityFormula: `${opt.id === 'coverPages' ? 2 : 1}`,
                    unit: 'unit'
                });
            });

            const bomSuffix = itemType === 'Service' ? ' (Printing Service)' : ' (Product)';
            const newBom: BOMTemplate = {
                ...(bomTemplates.find(template => template.id === bomId) || {}),
                id: bomId,
                name: `${productName.trim()}${bomSuffix}`,
                type: 'Custom',
                components,
                lastUpdated: new Date().toISOString()
            };

            await dbService.put('inventory', newProduct);
            await dbService.put('bomTemplates', newBom);

            setInventory(prev => {
                const exists = prev.some(item => item.id === newProduct.id);
                return exists ? prev.map(item => item.id === newProduct.id ? newProduct : item) : [...prev, newProduct];
            });
            setBOMTemplates(prev => {
                const exists = prev.some(template => template.id === newBom.id);
                return exists ? prev.map(template => template.id === newBom.id ? newBom : template) : [...prev, newBom];
            });

            setEditingProductId(newProduct.id);
            setEditingBomId(newBom.id);
            setSelectedInventoryProductId(newProduct.id);

            alert(editingProductId
                ? `${itemType} "${nameToUse.trim()}" updated and saved back to inventory.`
                : `${itemType} "${nameToUse.trim()}" created and saved to inventory with corresponding BOM recipe.`);
            if (cameFromModal) {
                navigate(-1);
            }
        } catch (error) {
            logger.error('Failed to save item:', error);
            alert(editingProductId ? 'Failed to update item' : 'Failed to create item');
        } finally {
            setIsCreatingProduct(false);
        }
    };

    const formatCurrency = (value: number) => `${currency} ${value.toFixed(2)}`;
    const totalPages = pages;
    const totalSheets = Math.ceil(pages / 2);

    const handleSaveCardImage = async () => {
        const el = document.getElementById('price-summary-card');
        if (!el) return;
        try {
            const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2, useCORS: true, logging: false });
            const link = document.createElement('a');
            link.download = `price-summary-card-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            logger.error('Failed to save card image:', err);
        }
    };

    const formatRoundingLabel = (methodUsed: string): string => {
        if (!methodUsed) return 'rounded';

        if (methodUsed.startsWith('ALWAYS_UP_')) {
            const step = methodUsed.replace('ALWAYS_UP_', '');
            return `Rounding up (${step})`;
        } else if (methodUsed.startsWith('NEAREST_')) {
            const step = methodUsed.replace('NEAREST_', '');
            return `nearest ${step}`;
        } else if (methodUsed === 'PSYCHOLOGICAL') {
            return 'psychological';
        }

        return 'rounded';
    };

    const getItemCost = (item: Item | undefined) => {
        if (!item) return 0;
        return Number(item.cost_price || item.cost_per_unit || item.cost || 0);
    };

    const getItemUnit = (item: Item | undefined) => {
        if (!item) return '';
        return item.unit || 'unit';
    };

    const handleOpenSaveDialog = () => {
        setSaveItemName(productName || '');
        setSaveDialogType('Product');
        setSaveVariants([]);
        setShowSaveDialog(true);
    };

    const addVariantRow = () => {
        if (saveVariants.length >= 5) return;
        const flatCost = paperCost + tonerCost + finishingCost + finishingInventoryCost;
        setSaveVariants(prev => [...prev, {
            id: `v${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            attribute: '',
            pages,
            basePrice: parseFloat(flatCost.toFixed(2)),
            sellingPrice: 0,
        }]);
    };

    const updateVariantRow = (id: string, field: string, value: any) => {
        setSaveVariants(prev => prev.map(v => {
            if (v.id !== id) return v;
            const updated = { ...v, [field]: value };
            if (field === 'pages') {
                const pageCost = (paperCost + tonerCost) / pages;
                updated.basePrice = parseFloat((pageCost * (value as number) + finishingCost + finishingInventoryCost).toFixed(2));
            }
            return updated;
        }));
    };

    const removeVariantRow = (id: string) => {
        setSaveVariants(prev => prev.filter(v => v.id !== id));
    };

    const handleSaveFromDialog = async () => {
        if (!saveItemName.trim()) {
            alert('Please enter a name');
            return;
        }

        if (!validation.valid) {
            alert(`Unable to save product.\n\nCalculated markup: ${profitMarkup.toFixed(1)}%\nMinimum required markup: ${validation.minimumMarkup}%\n\n${validation.message}`);
            return;
        }

        const name = saveItemName.trim();
        const type = saveDialogType;
        const variantsToSave = saveVariants.filter(v => v.attribute.trim() && v.sellingPrice > 0);

        setProductName(name);
        setItemType(type);
        setShowSaveDialog(false);

        await new Promise(resolve => setTimeout(resolve, 50));

        setIsCreatingProduct(true);
        try {
            await handleSaveProduct(name);

            if (variantsToSave.length > 0) {
                const enabledFinishingOptions = finishingOptions.filter(o => o.enabled);

                for (const variant of variantsToSave) {
                    const varPages = variant.pages;
                    const varTotalSheets = Math.ceil(varPages / 2);
                    const varPaperCost = parseFloat((paperCost * (varPages / pages)).toFixed(2));
                    const varTonerCost = parseFloat((tonerCost * (varPages / pages)).toFixed(2));
                    const varCost = parseFloat((varPaperCost + varTonerCost + finishingCost + finishingInventoryCost).toFixed(2));
                    const varId = `PROD-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                    const varBomId = `BOM-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

                    const varProfit = parseFloat((variant.sellingPrice - varCost).toFixed(2));
                    const varItem: Item = {
                        id: varId,
                        name: `${name} - ${variant.attribute.trim()}`,
                        sku: generateAutoSKU(type, `${name} ${variant.attribute.trim()}`, undefined, inventory),
                        type: type,
                        classification: type === 'Service' ? 'printing_service' : undefined,
                        category: type === 'Service' ? 'Printing Service' : 'Printed Products',
                        unit: 'Booklet',
                        cost: varCost,
                        cost_price: varCost,
                        costPrice: varCost,
                        price: variant.sellingPrice,
                        selling_price: variant.sellingPrice,
                        sellingPrice: variant.sellingPrice,
                        profitAmount: varProfit,
                        profitMargin: varCost > 0 ? parseFloat(((varProfit / varCost) * 100).toFixed(2)) : 0,
                        minimumMargin: validation.minimumMarkup,
                        pricingValidated: validation.valid,
                        stock: 0,
                        pages: varPages,
                        pricingConfig: {
                            paperId: selectedPaperId,
                            tonerId: selectedTonerId,
                            finishingOptions: enabledFinishingOptions,
                            manualOverride: false,
                            marketAdjustment: 0,
                        },
                        smartPricing: {
                            pages: varPages,
                            copies: 1,
                            totalPages: varPages,
                            totalSheets: varTotalSheets,
                            paperItemId: selectedPaperId,
                            tonerItemId: selectedTonerId,
                            finishingEnabled: enabledFinishingOptions.map(o => o.id),
                            finishingOptionCosts: enabledFinishingOptions.reduce<Record<string, number>>((acc, o) => {
                                acc[o.id] = Number(o.price) || 0;
                                return acc;
                            }, {}),
                            bomTemplateId: varBomId,
                            paperCost: varPaperCost,
                            tonerCost: varTonerCost,
                            finishingCost: finishingCost,
                            finishingInventoryCost: finishingInventoryCost,
                            baseCost: varCost,
                        } as Item['smartPricing']
                    };

                    const varComponents: any[] = [];
                    if (selectedPaper) {
                        varComponents.push({
                            itemId: selectedPaperId,
                            name: selectedPaper.name,
                            quantityFormula: `${varTotalSheets}`,
                            unit: selectedPaper.unit || 'ream'
                        });
                    }
                    if (selectedToner) {
                        varComponents.push({
                            itemId: selectedTonerId,
                            name: selectedToner.name,
                            quantityFormula: `${Math.ceil(varPages / 20000 * 100)} / 100`,
                            unit: selectedToner.unit || 'unit'
                        });
                    }
                    enabledFinishingOptions.forEach(opt => {
                        varComponents.push({
                            itemId: opt.id,
                            name: opt.name,
                            quantityFormula: `${opt.id === 'coverPages' ? 2 : 1}`,
                            unit: 'unit'
                        });
                    });

                    const varBom: BOMTemplate = {
                        id: varBomId,
                        name: `${name} - ${variant.attribute.trim()} (${type === 'Service' ? 'Printing Service' : 'Product'})`,
                        type: 'Custom',
                        components: varComponents,
                        lastUpdated: new Date().toISOString()
                    };

                    await dbService.put('inventory', varItem);
                    await dbService.put('bomTemplates', varBom);
                }
            }
        } catch (error) {
            logger.error('Failed to save with variants:', error);
            alert('Failed to save item');
        } finally {
            setIsCreatingProduct(false);
        }
    };

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <Calculator className="w-12 h-12 text-indigo-500 animate-pulse" />
                    <p className="text-slate-500">Loading pricing engine...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-gradient-to-br from-slate-50 to-indigo-50 overflow-auto">
            <div className="max-w-4xl mx-auto p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-200">
                            <Calculator className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">Smart Pricing Engine</h1>
                            <p className="text-slate-500">Calculate job pricing with BOM cost analysis</p>
                            {editingProductId && (
                                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700">
                                    Editing Inventory {itemType}: {productName || inventory.find(item => item.id === editingProductId)?.name || editingProductId}
                                </div>
                            )}
                        </div>
                        {editingProductId && !validation.valid && sellingPrice > 0 && (
                            <div className="mt-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-center gap-2">
                                <Info size={16} /> Markup {profitMarkup.toFixed(1)}% below minimum {validation.minimumMarkup}%
                            </div>
                        )}
                    </div>
                    <button 
                        onClick={() => navigate('/settings', { state: { tab: 'Finishing' } })}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50"
                    >
                        <Settings size={18} />
                        Manage Prices
                    </button>
                </div>

                <div id="smart-pricing-inventory-loader" className="mb-6 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 via-white to-indigo-50">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-lg font-bold text-slate-800">Load from Inventory</h2>
                            <p className="text-sm text-slate-500">Pick any existing product or service, configure it here, then save it back with its Smart Pricing BOM.</p>
                        </div>
                    </div>
                    <div className="px-6 py-5 grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3 items-end">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Load Existing Product or Service</label>
                            <select
                                value={selectedInventoryProductId}
                                onChange={(e) => setSelectedInventoryProductId(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">Select a product or service...</option>
                                {editableInventoryProducts.map(product => (
                                    <option key={product.id} value={product.id}>
                                        [{product.type}] {product.name} ({product.sku})
                                    </option>
                                ))}
                            </select>
                            {editableInventoryProducts.length === 0 && (
                                <div className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                                    No products or services were found in inventory yet.
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => loadInventoryProduct(selectedInventoryProductId)}
                            disabled={!selectedInventoryProductId}
                            className="px-5 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
                        >
                            Load Item
                        </button>
                        <button
                            onClick={clearLoadedProduct}
                            className="px-5 py-3 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50"
                        >
                            New Item
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3 space-y-4">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <button 
                                onClick={() => setPaperExpanded(!paperExpanded)}
                                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <Calculator size={18} className="text-blue-600" />
                                    </div>
                                    <h3 className="font-semibold text-slate-800">Print Settings</h3>
                                </div>
                                {paperExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </button>
                            {paperExpanded && (
                                <div className="px-6 pb-6 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-2">Pages per Copy</label>
                                            <input
                                                type="number"
                                                value={pages}
                                                onChange={handlePagesChange}
                                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                                                min={1}
                                                max={10000}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-2">Selling Price ({currency})</label>
                                            <input
                                                type="number"
                                                value={sellingPrice || ''}
                                                onChange={handleSellingPriceChange}
                                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-lg font-bold"
                                                min={0}
                                                step={0.01}
                                                placeholder="Enter selling price..."
                                            />
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-500">
                                        Sheets needed: <span className="font-medium text-slate-700">{totalSheets}</span> | 
                                        Cost price: <span className="font-medium text-slate-700">{formatCurrency(costPrice)}</span>
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <button 
                                onClick={() => setBomExpanded(!bomExpanded)}
                                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-100 rounded-lg">
                                        <Package size={18} className="text-amber-600" />
                                    </div>
                                    <h3 className="font-semibold text-slate-800">BOM Materials (Auto-selected)</h3>
                                    <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">Active</span>
                                </div>
                                {bomExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </button>
                            {bomExpanded && (
                                <div className="px-6 pb-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-2">Paper</label>
                                        {paperItems.length > 0 ? (
                                            <select
                                                value={selectedPaperId}
                                                onChange={(e) => setSelectedPaperId(e.target.value)}
                                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                                            >
                                                {paperItems.map(item => (
                                                    <option key={item.id} value={item.id}>
                                                        {item.name} - {currency} {getItemCost(item).toFixed(2)}/{getItemUnit(item)} (Stock: {item.stock || 0})
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">No paper items found</div>
                                        )}
                                        {selectedPaper && (
                                            <div className="mt-2 p-3 bg-blue-50 rounded-xl">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-600">Sheets needed:</span>
                                                    <span className="font-medium text-slate-800">{totalSheets} sheets</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-600">Paper cost:</span>
                                                    <span className="font-medium text-blue-600">{formatCurrency(paperCost)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-2">Toner/Ink</label>
                                        {tonerItems.length > 0 ? (
                                            <select
                                                value={selectedTonerId}
                                                onChange={(e) => setSelectedTonerId(e.target.value)}
                                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                                            >
                                                {tonerItems.map(item => (
                                                    <option key={item.id} value={item.id}>
                                                        {item.name} - {currency} {getItemCost(item).toFixed(2)}/{getItemUnit(item)} (Stock: {item.stock || 0})
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">No toner items found</div>
                                        )}
                                        {selectedToner && (
                                            <div className="mt-2 p-3 bg-purple-50 rounded-xl">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-600">Pages to print:</span>
                                                    <span className="font-medium text-slate-800">{totalPages} pages</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-600">Toner cost:</span>
                                                    <span className="font-medium text-purple-600">{formatCurrency(tonerCost)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <button 
                                onClick={() => setFinishingExpanded(!finishingExpanded)}
                                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-100 rounded-lg">
                                        <Info size={18} className="text-purple-600" />
                                    </div>
                                    <h3 className="font-semibold text-slate-800">Finishing Options</h3>
                                </div>
                                {finishingExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </button>
                            {finishingExpanded && (
                                <div className="px-6 pb-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {finishingOptions.map(option => (
                                            <label 
                                                key={option.id} 
                                                className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all ${
                                                    option.enabled ? 'bg-purple-50 border-purple-200' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'
                                                } border`}
                                            >
                                                <div className="flex-1">
                                                    <div className="font-medium text-slate-800">{option.name}</div>
                                                    <div className="text-xs text-slate-500">{option.description}</div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-medium text-slate-600">{currency} {option.price}</span>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={option.enabled}
                                                        onChange={() => toggleFinishingOption(option.id)}
                                                        className="w-5 h-5 text-purple-600 rounded"
                                                    />
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>

                    <div className="lg:col-span-2 space-y-4">
                        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden sticky top-6">
                            <div className="p-6 bg-gradient-to-r from-indigo-600 to-purple-600">
                                <h3 className="text-white font-semibold text-lg">Price Summary</h3>
                                <p className="text-indigo-200 text-sm">{pages} pages · Cost: {formatCurrency(costPrice)}</p>
                            </div>
                            
                            <div className="p-6 space-y-4">
                                <div className="flex justify-between text-slate-600">
                                    <span>{selectedPaper?.name?.replace(/\s*\d+gsm.*/i, '') || 'Paper'}</span>
                                    <span className="font-medium">{formatCurrency(paperCost)}</span>
                                </div>
                                <div className="flex justify-between text-slate-600">
                                    <span>{selectedToner?.name?.replace(/\s*Universal\s*/i, '') || 'Toner'}</span>
                                    <span className="font-medium">{formatCurrency(tonerCost)}</span>
                                </div>
                                <div className="flex justify-between text-slate-600">
                                    <span>Finishing</span>
                                    <span className="font-medium">{formatCurrency(finishingCost)}</span>
                                </div>
                                {finishingInventoryCost > 0 && (
                                    <div className="flex justify-between text-slate-600">
                                        <span className="pl-4">Finishing Materials</span>
                                        <span className="font-medium">{formatCurrency(finishingInventoryCost)}</span>
                                    </div>
                                )}
                                <div className="border-t border-slate-200 pt-3 flex justify-between font-semibold text-slate-800">
                                    <span>Cost Price (CP)</span>
                                    <span className="text-lg">{formatCurrency(costPrice)}</span>
                                </div>
                                <div className="flex justify-between text-blue-600 font-semibold">
                                    <span>Selling Price (SP)</span>
                                    <span className="text-lg">{formatCurrency(sellingPrice)}</span>
                                </div>
                                <div className={`flex justify-between font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    <span>Profit</span>
                                    <span>{profit >= 0 ? '+' : ''}{formatCurrency(profit)}</span>
                                </div>
                                <div className={`flex justify-between ${validation.valid ? 'text-green-600' : 'text-red-600'}`}>
                                    <span>Profit Margin</span>
                                    <span className="font-semibold">{profitMarkup.toFixed(1)}%</span>
                                </div>
                                <div className="flex justify-between text-slate-500">
                                    <span>Minimum Required Markup</span>
                                    <span className="font-medium">{validation.minimumMarkup}%</span>
                                </div>
                                <div className={`p-3 rounded-xl text-sm font-medium text-center ${
                                    validation.valid
                                        ? 'bg-green-50 text-green-700 border border-green-200'
                                        : sellingPrice > 0
                                        ? 'bg-red-50 text-red-700 border border-red-200'
                                        : 'bg-slate-50 text-slate-400 border border-slate-200'
                                }`}>
                                    {sellingPrice > 0
                                        ? (validation.valid
                                            ? 'Above Minimum Markup'
                                            : `Below Minimum Markup (${profitMarkup.toFixed(1)}% < ${validation.minimumMarkup}%)`)
                                        : 'Enter a selling price to validate'}
                                </div>
                            </div>

                            <div className="px-6 pb-6 space-y-3">
                                <button 
                                    onClick={() => setShowSummaryCard(true)}
                                    className="w-full flex items-center justify-center gap-2 py-3 border border-indigo-200 text-indigo-700 rounded-xl hover:bg-indigo-50 transition-colors"
                                    disabled={!validation.valid || sellingPrice <= 0}
                                >
                                    <Download size={18} />
                                    Summary Card
                                </button>
                                <button 
                                    onClick={handleOpenSaveDialog}
                                    disabled={!validation.valid || sellingPrice <= 0}
                                    className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50"
                                    title={!validation.valid && sellingPrice > 0 ? `Markup ${profitMarkup.toFixed(1)}% below minimum ${validation.minimumMarkup}%` : ''}
                                >
                                    {editingProductId ? `Save ${itemType}` : 'Save to Inventory'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showSaveDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-slate-800">Save to Inventory</h2>
                            <button onClick={() => setShowSaveDialog(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                                <p className="text-sm font-medium text-slate-600">Pricing Summary</p>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="flex justify-between"><span className="text-slate-500">Cost:</span><span className="font-medium">{formatCurrency(costPrice)}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Selling:</span><span className="font-medium">{formatCurrency(sellingPrice)}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Profit:</span><span className={`font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(profit)}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Margin:</span><span className={`font-medium ${validation.valid ? 'text-green-600' : 'text-red-600'}`}>{profitMarkup.toFixed(1)}%</span></div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Item Name</label>
                                <input
                                    type="text"
                                    value={saveItemName}
                                    onChange={e => setSaveItemName(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Enter item name..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Type</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setSaveDialogType('Product')}
                                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                                            saveDialogType === 'Product' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <Package size={20} className={saveDialogType === 'Product' ? 'text-indigo-600' : 'text-slate-400'} />
                                        <span className={`font-medium ${saveDialogType === 'Product' ? 'text-indigo-700' : 'text-slate-600'}`}>Product</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSaveDialogType('Service')}
                                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                                            saveDialogType === 'Service' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <Printer size={20} className={saveDialogType === 'Service' ? 'text-indigo-600' : 'text-slate-400'} />
                                        <span className={`font-medium ${saveDialogType === 'Service' ? 'text-indigo-700' : 'text-slate-600'}`}>Printing Service</span>
                                    </button>
                                </div>
                            </div>

                            {!editingProductId && (
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="block text-sm font-medium text-slate-700">Variants</label>
                                        <button
                                            type="button"
                                            onClick={addVariantRow}
                                            disabled={saveVariants.length >= 5}
                                            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 disabled:text-slate-300"
                                        >
                                            <Plus size={14} /> Add Variant
                                        </button>
                                    </div>
                                    {saveVariants.length > 0 && (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-slate-200">
                                                        <th className="text-left py-2 pr-2 text-slate-500 font-medium">Attribute</th>
                                                        <th className="text-left py-2 px-2 text-slate-500 font-medium">Pages</th>
                                                        <th className="text-right py-2 px-2 text-slate-500 font-medium">Base Price</th>
                                                        <th className="text-right py-2 px-2 text-slate-500 font-medium">Selling Price</th>
                                                        <th className="py-2 pl-2"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {saveVariants.map(v => (
                                                        <tr key={v.id} className="border-b border-slate-100">
                                                            <td className="py-1.5 pr-2">
                                                                <input
                                                                    type="text"
                                                                    value={v.attribute}
                                                                    onChange={e => updateVariantRow(v.id, 'attribute', e.target.value)}
                                                                    className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                                                                    placeholder="e.g. A4"
                                                                />
                                                            </td>
                                                            <td className="py-1.5 px-2">
                                                                <input
                                                                    type="number"
                                                                    value={v.pages}
                                                                    onChange={e => updateVariantRow(v.id, 'pages', parseInt(e.target.value) || 1)}
                                                                    className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                                                                    min={1}
                                                                />
                                                            </td>
                                                            <td className="py-1.5 px-2 text-right text-slate-600">
                                                                {formatCurrency(v.basePrice)}
                                                            </td>
                                                            <td className="py-1.5 px-2">
                                                                <input
                                                                    type="number"
                                                                    value={v.sellingPrice || ''}
                                                                    onChange={e => updateVariantRow(v.id, 'sellingPrice', parseFloat(e.target.value) || 0)}
                                                                    className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-right"
                                                                    min={0}
                                                                    step={0.01}
                                                                    placeholder="0.00"
                                                                />
                                                            </td>
                                                            <td className="py-1.5 pl-2">
                                                                <button type="button" onClick={() => removeVariantRow(v.id)} className="p-1 text-red-400 hover:text-red-600">
                                                                    <X size={14} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                    <p className="text-[11px] text-slate-400 mt-1">Base price auto-calculated from cost per page. Add up to 5 variants.</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-100 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowSaveDialog(false)}
                                className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveFromDialog}
                                disabled={isCreatingProduct || !saveItemName.trim()}
                                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
                            >
                                {isCreatingProduct ? 'Saving...' : editingProductId ? 'Update' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showSummaryCard && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <h2 className="text-xl font-bold text-slate-800">Price Summary Card</h2>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleSaveCardImage}
                                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="Save as Image"
                                >
                                    <Download size={20} />
                                </button>
                                <button onClick={() => setShowSummaryCard(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <div id="price-summary-card" className="p-6">
                            <div className="space-y-4">
                                <div className="text-center pb-4 border-b border-slate-100">
                                    <h3 className="text-lg font-bold text-slate-800">Pricing Summary</h3>
                                    <p className="text-xs text-slate-400">{new Date().toLocaleDateString()}</p>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Pages per Copy</span>
                                        <span className="font-medium text-slate-800">{pages}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Sheets Needed</span>
                                        <span className="font-medium text-slate-800">{totalSheets}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Toner</span>
                                        <span className="font-medium text-slate-800">{selectedToner?.name || 'None'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Finishing</span>
                                        <span className="font-medium text-slate-800">{finishingOptions.filter(o => o.enabled).map(o => o.name).join(', ') || 'None'}</span>
                                    </div>
                                </div>
                                <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between">
                                    <span className="font-bold text-2xl text-slate-900">Total</span>
                                    <span className="font-bold text-2xl text-slate-900">{formatCurrency(sellingPrice)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100">
                            <button
                                onClick={() => setShowSummaryCard(false)}
                                className="w-full py-3 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default SmartPricing;
