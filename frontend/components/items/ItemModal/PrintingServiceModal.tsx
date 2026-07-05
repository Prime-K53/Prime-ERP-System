import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Calculator, ChevronDown, ChevronUp, X, Info, Plus, Printer, Package, FileText, Sparkles, Brain, TrendingUp, CheckCircle, AlertCircle, Lightbulb, Zap, Star } from 'lucide-react';
import type { Item, FinishingOption } from '../../../types';
import { dbService } from '../../../services/db';
import { normalizeInventoryItemPricing } from '../../../utils/pricing';
import { generateAutoSKU } from '../../../utils/skuGenerator';
import { calculateProfit, calculateMarkup, validateMinimumMarkup, resolveMinimumMarkup } from '../../../services/pricingValidationService';
import { currencyService } from '../../../services/currencyService';
import { useAuth } from '../../../context/AuthContext';
import { aiService } from '../../../services/ai/aiService';

interface Props {
  item?: Item | null;
  onSave: (item: Item) => Promise<void>;
  onClose: () => void;
  allItems?: Item[];
  lockClassification?: boolean;
  sourceTab?: string | null;
}

type PrintingTab = 'basicInfo' | 'pricing' | 'printSettings' | 'bomMaterials' | 'finishing' | 'variants';

const TABS: { key: PrintingTab; label: string; icon: React.ReactNode }[] = [
  { key: 'basicInfo', label: 'Basic Infos', icon: <FileText size={13} /> },
  { key: 'pricing', label: 'Pricing', icon: <Calculator size={13} /> },
  { key: 'bomMaterials', label: 'BOM Materials', icon: <Package size={13} /> },
  { key: 'finishing', label: 'Finishing Options', icon: <Zap size={13} /> },
  { key: 'printSettings', label: 'Print Setting', icon: <Printer size={13} /> },
  { key: 'variants', label: 'Variants', icon: <Brain size={13} /> },
];

const defaultFinishingOptions: FinishingOption[] = [
  { id: 'binding', name: 'Binding', enabled: false, price: 150, description: 'Book binding - comb or spiral', items: [] },
  { id: 'coverPages', name: 'Cover Pages', enabled: false, price: 20, description: 'Front and back cover pages per copy', items: [] },
  { id: 'cutting', name: 'Cutting & Trimming', enabled: false, price: 30, description: 'Trim edges to clean finish', items: [], batchSize: 10 },
  { id: 'holePunch', name: 'Hole Punching', enabled: false, price: 20, description: 'Punch holes for folder binding', items: [], batchSize: 10 },
  { id: 'folding', name: 'Folding', enabled: false, price: 15, description: 'Fold pages for insertion', items: [], batchSize: 10 },
  { id: 'stapling', name: 'Stapling', enabled: false, price: 10, description: 'Corner or saddle stapling', items: [] },
];

const PrintingServiceModal: React.FC<Props> = ({ item, onSave, onClose, allItems = [], sourceTab }) => {
  const { companyConfig } = useAuth();
  const isProduct = sourceTab === 'product' || item?.type === 'Product' || (item as any)?.classification === 'product';
  const isStationery = sourceTab === 'stationery' || item?.type === 'Stationery' || (item as any)?.classification === 'stationery';
  const entityType = isStationery ? 'Stationery' : isProduct ? 'Product' : 'Service';
  const inventory = useMemo(() => allItems.map(normalizeInventoryItemPricing), [allItems]);
  const [activeTab, setActiveTab] = useState<PrintingTab>('basicInfo');
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(item?.name || '');
  const [sku, setSku] = useState(item?.sku || '');
  const [description, setDescription] = useState(item?.description || '');
  const [category, setCategory] = useState(item?.category || (isStationery ? 'Stationery' : isProduct ? 'Products' : 'Printing Service'));
  const [status, setStatus] = useState<'Active' | 'Archived'>((item as any)?.status === 'Archived' ? 'Archived' : 'Active');
  const [favorite, setFavorite] = useState(!!(item as any)?.favorite);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [hasVariants, setHasVariants] = useState(!!(item as any)?.hasVariants || !!((item as any)?.variants?.length > 0));
  const [pages, setPages] = useState(() => (item as any)?.smartPricing?.pages || (item as any)?.pages || 1);
  const [copies] = useState(1);
  const [sellingPrice, setSellingPrice] = useState(() => Number((item as any)?.sellingPrice || (item as any)?.price || 0));
  // Stationery-specific fields
  const [unit, setUnit] = useState(item?.unit || 'pcs');
  const [isStationeryPack, setIsStationeryPack] = useState(!!(item as any)?.isStationeryPack);
  const [costPerPack, setCostPerPack] = useState(Number((item as any)?.costPerPack || 0));
  const [unitsPerPack, setUnitsPerPack] = useState(Number((item as any)?.unitsPerPack || 0));
  const [stationeryCostPrice, setStationeryCostPrice] = useState(() => {
    if (isStationery) {
      const c = (item as any)?.cost;
      const cp = (item as any)?.cost_price;
      const cpp = (item as any)?.costPerPiece;
      return c != null ? Number(c) : cp != null ? Number(cp) : cpp != null ? Number(cpp) : 0;
    }
    return 0;
  });
  const [selectedPaperId, setSelectedPaperId] = useState(() => (item as any)?.pricingConfig?.paperId || (item as any)?.smartPricing?.paperItemId || '');
  const [selectedTonerId, setSelectedTonerId] = useState(() => (item as any)?.pricingConfig?.tonerId || (item as any)?.smartPricing?.tonerItemId || '');
  const [printSides, setPrintSides] = useState<'single' | 'double'>((item as any)?.printSides || 'double');
  const [paperType, setPaperType] = useState<'paper' | 'cover'>((item as any)?.paperType || 'paper');
  const [fileType, setFileType] = useState<'excel' | 'word'>((item as any)?.fileType || 'excel');
  const [finishingOptions, setFinishingOptions] = useState<FinishingOption[]>(() => {
    const saved = (item as any)?.printFinishing || (item as any)?.pricingConfig?.finishingOptions || [];
    const configOptions = companyConfig?.productionSettings?.finishingOptions;
    const baseOptions = configOptions?.length ? configOptions : defaultFinishingOptions;
    if (saved.length > 0) {
      return baseOptions.map(o => ({
        ...o,
        enabled: saved.some((f: any) => f.id === o.id || f === o.name),
        price: saved.find((f: any) => f.id === o.id)?.price ?? o.price,
      }));
    }
    return structuredClone(baseOptions);
  });
  const [saveVariants, setSaveVariants] = useState<Array<{ id: string; attribute: string; pages: number; basePrice: number; sellingPrice: number; suggestedPrice?: number }>>(() => {
    const existingVariants = (item as any)?.variants;
    if (existingVariants?.length > 0) {
      const targetPct = resolveMinimumMarkup();
      return existingVariants.map((v: any) => {
        const bp = v.basePrice != null ? Number(v.basePrice) : 0;
        const suggested = bp > 0 ? parseFloat((bp * (1 + targetPct / 100)).toFixed(2)) : 0;
        return {
          id: `v${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          attribute: v.attribute || '',
          pages: v.pages || 1,
          basePrice: bp,
          sellingPrice: v.sellingPrice || 0,
          suggestedPrice: suggested,
        };
      });
    }
    return [];
  });

  const [variantExpanded, setVariantExpanded] = useState(true);
  const [paperExpanded, setPaperExpanded] = useState(true);
  const [finishingExpanded, setFinishingExpanded] = useState(true);
  const [bomExpanded, setBomExpanded] = useState(true);

  // Sync all state from item whenever it changes (covers edit flow)
  useEffect(() => {
    if (!item) return;
    setName(item?.name || '');
    setSku(item?.sku || '');
    setDescription(item?.description || '');
    setCategory(item?.category || (isStationery ? 'Stationery' : isProduct ? 'Products' : 'Printing Service'));
    setStatus(((item as any)?.status === 'Archived' ? 'Archived' : 'Active') as 'Active' | 'Archived');
    setFavorite(!!(item as any)?.favorite);
    setHasVariants(!!(item as any)?.hasVariants || !!((item as any)?.variants?.length > 0));
    setPages((item as any)?.smartPricing?.pages || (item as any)?.pages || 1);
    setSellingPrice(Number((item as any)?.sellingPrice || (item as any)?.price || 0));
    if (isStationery) {
      setUnit(item?.unit || 'pcs');
      setIsStationeryPack(!!(item as any)?.isStationeryPack);
      setCostPerPack(Number((item as any)?.costPerPack || 0));
      setUnitsPerPack(Number((item as any)?.unitsPerPack || 0));
      const c = (item as any)?.cost; const cp = (item as any)?.cost_price; const cpp = (item as any)?.costPerPiece;
      setStationeryCostPrice(c != null ? Number(c) : cp != null ? Number(cp) : cpp != null ? Number(cpp) : 0);
    }
    setSelectedPaperId((item as any)?.pricingConfig?.paperId || (item as any)?.smartPricing?.paperItemId || '');
    setSelectedTonerId((item as any)?.pricingConfig?.tonerId || (item as any)?.smartPricing?.tonerItemId || '');
    setPrintSides(((item as any)?.printSides || 'double') as 'single' | 'double');
    setPaperType(((item as any)?.paperType || 'paper') as 'paper' | 'cover');
    setFileType(((item as any)?.fileType || 'excel') as 'excel' | 'word');
    // Restore finishing options from saved data
    const savedFinishing = (item as any)?.printFinishing || (item as any)?.pricingConfig?.finishingOptions || [];
    if (savedFinishing.length > 0) {
      setFinishingOptions(prev => prev.map(o => ({
        ...o,
        enabled: savedFinishing.some((f: any) => f.id === o.id || f === o.name),
        price: savedFinishing.find((f: any) => f.id === o.id)?.price ?? o.price,
      })));
    }
    // Restore variants
    const existingVariants = (item as any)?.variants;
    if (existingVariants?.length > 0) {
      const targetPct = resolveMinimumMarkup();
      setSaveVariants(existingVariants.map((v: any) => {
        const bp = v.basePrice != null ? Number(v.basePrice) : 0;
        const suggested = bp > 0 ? parseFloat((bp * (1 + targetPct / 100)).toFixed(2)) : 0;
        return {
          id: `v${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          attribute: v.attribute || '',
          pages: v.pages || 1,
          basePrice: bp,
          sellingPrice: v.sellingPrice || 0,
          suggestedPrice: suggested,
        };
      }));
    } else {
      setSaveVariants([]);
    }
  }, [item?.id, isStationery]);

    const currency = companyConfig?.currencySymbol || currencyService.getCurrency(currencyService.getBaseCurrency())?.symbol || '$';

  useEffect(() => {
    (async () => {
      const configOptions = companyConfig?.productionSettings?.finishingOptions;
      if (configOptions?.length) {
        setFinishingOptions(prev => prev.map(o => ({
          ...o,
          price: configOptions.find(c => c.id === o.id)?.price ?? o.price,
        })));
        return;
      }
      try {
        const savedCosts = await dbService.getSetting<Record<string, number>>('finishingOptionCosts');
        if (savedCosts) {
          setFinishingOptions(prev => prev.map(o => ({ ...o, price: savedCosts[o.id] ?? o.price })));
        }
      } catch {}
    })();
  }, [companyConfig]);

  const isRawMat = (i: Item) => i.type === 'Raw Material' || i.type === 'Material';

  const paperItems = useMemo(() => inventory.filter(i => {
    if (!isRawMat(i)) return false;
    const cat = (i.category || '').toLowerCase();
    return cat.includes('paper') || cat.includes('bond') || cat.includes('sheet');
  }), [inventory]);

  const coverPaperItems = useMemo(() => inventory.filter(i => {
    if (!isRawMat(i)) return false;
    const cat = (i.category || '').toLowerCase();
    return cat.includes('cover') || cat.includes('card') || cat.includes('board');
  }), [inventory]);

  const tonerItems = useMemo(() => inventory.filter(i => {
    if (!isRawMat(i)) return false;
    const cat = (i.category || '').toLowerCase();
    return cat.includes('toner') || cat.includes('ink') || cat.includes('cartridge');
  }), [inventory]);

  const availablePaperItems = paperType === 'cover' && coverPaperItems.length > 0 ? coverPaperItems : paperItems;

  useEffect(() => {
    if (paperType === 'cover' && coverPaperItems.length > 0) {
      setSelectedPaperId(coverPaperItems[0].id);
    } else if (paperType === 'paper' && paperItems.length > 0) {
      const savedId = (item as any)?.pricingConfig?.paperId || (item as any)?.smartPricing?.paperItemId || '';
      setSelectedPaperId(savedId && paperItems.some(p => p.id === savedId) ? savedId : paperItems[0].id);
    }
  }, [paperType]);

  useEffect(() => {
    if (paperItems.length > 0 && !selectedPaperId && paperType === 'paper') {
      const savedId = (item as any)?.pricingConfig?.paperId || (item as any)?.smartPricing?.paperItemId || '';
      setSelectedPaperId(savedId && paperItems.some(p => p.id === savedId) ? savedId : paperItems[0].id);
    }
  }, [paperItems]);

  useEffect(() => {
    if (tonerItems.length > 0 && !selectedTonerId) {
      const savedId = (item as any)?.pricingConfig?.tonerId || (item as any)?.smartPricing?.tonerItemId || '';
      setSelectedTonerId(savedId && tonerItems.some(t => t.id === savedId) ? savedId : tonerItems[0].id);
    }
  }, [tonerItems]);

  const selectedPaper = useMemo(() => inventory.find(i => i.id === selectedPaperId), [inventory, selectedPaperId]);
  const selectedToner = useMemo(() => inventory.find(i => i.id === selectedTonerId), [inventory, selectedTonerId]);

  const getItemCost = (item: Item | undefined) => {
    if (!item) return 0;
    return Number(item.cost_price || item.cost_per_unit || item.cost || 0);
  };

  const totalSheets = Math.ceil(pages / 2);

  const calculateCosts = () => {
    if (isStationery) {
      const derivedCost = isStationeryPack && unitsPerPack > 0
        ? costPerPack / unitsPerPack
        : (stationeryCostPrice || 0);
      return {
        paperCost: 0,
        tonerCost: 0,
        finishingCost: 0,
        finishingInventoryCost: 0,
        baseCost: derivedCost,
      };
    }

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
        const chargeQty = o.batchSize ? Math.ceil(copies / o.batchSize) : copies;
        return sum + (o.price * chargeQty);
      }, 0);

    const finishingInventoryCostVal = finishingOptions
      .filter(o => o.enabled && o.items && o.items.length > 0)
      .reduce((sum, o) => {
        const optionInventoryCost = o.items.reduce((itemSum, itemConfig) => {
          const invItem = inventory.find(i => i.id === itemConfig.itemId);
          if (!invItem) return itemSum;
          const itemCost = Number(invItem.cost_price || invItem.cost_per_unit || invItem.cost || 0);
          return itemSum + (itemCost * itemConfig.quantity * copies);
        }, 0);
        return sum + optionInventoryCost;
      }, 0);

    return {
      paperCost: paperCostVal,
      tonerCost: tonerCostVal,
      finishingCost: finishingCostVal,
      finishingInventoryCost: finishingInventoryCostVal,
      baseCost: paperCostVal + tonerCostVal + finishingCostVal + finishingInventoryCostVal,
    };
  };

  const { paperCost, tonerCost, finishingCost, finishingInventoryCost, baseCost } = calculateCosts();
  const costPrice = isStationery
    ? (isStationeryPack && unitsPerPack > 0 ? costPerPack / unitsPerPack : stationeryCostPrice)
    : baseCost;
  const profit = calculateProfit(costPrice, sellingPrice);
  const profitMarkup = calculateMarkup(costPrice, sellingPrice);
  const validation = validateMinimumMarkup(costPrice, sellingPrice, item?.id ? { id: item.id, category: undefined } : undefined);

  const suggestedSellingPrice = useMemo(() => {
    if (costPrice <= 0) return 0;
    const minMarkup = Math.max(validation.minimumMarkup, resolveMinimumMarkup());
    return parseFloat((costPrice * (1 + minMarkup / 100)).toFixed(2));
  }, [costPrice, validation.minimumMarkup]);

  const pricingConfidence = useMemo(() => {
    if (sellingPrice <= 0) return { level: 'none' as const, label: 'Set a price', color: 'text-slate-400' };
    if (validation.valid) return { level: 'high' as const, label: 'Above minimum markup', color: 'text-emerald-500' };
    const ratio = sellingPrice > 0 ? profitMarkup / validation.minimumMarkup : 0;
    if (ratio >= 0.8) return { level: 'medium' as const, label: 'Near minimum markup', color: 'text-amber-500' };
    return { level: 'low' as const, label: 'Below minimum markup', color: 'text-red-500' };
  }, [sellingPrice, validation, profitMarkup]);

  const autoGenerateDescription = useCallback(() => {
    const parts: string[] = [];
    if (name) parts.push(name);
    if (paperType === 'cover') parts.push('with cover/card stock');
    else if (selectedPaper) parts.push(`on ${selectedPaper.name}`);
    parts.push(`${printSides === 'double' ? 'double-sided' : 'single-sided'} printing`);
    if (fileType) parts.push(`from ${fileType} files`);
    const enabledFinishing = finishingOptions.filter(o => o.enabled);
    if (enabledFinishing.length > 0) {
      parts.push(`with ${enabledFinishing.map(o => o.name.toLowerCase()).join(', ')}`);
    }
    return parts.join(', ') + '.';
  }, [name, paperType, selectedPaper, printSides, fileType, finishingOptions]);

  useEffect(() => {
    if (name.trim() && (!sku || !item?.sku)) {
      const generated = generateAutoSKU(entityType, name.trim(), undefined, inventory);
      setSku(generated);
    }
  }, [name]);

  const [generatedDescription, setGeneratedDescription] = useState(item?.description || description || '');
  const [showAiDescription, setShowAiDescription] = useState(false);

  const handleAiDescribe = async () => {
    const enabledFinishing = finishingOptions.filter(o => o.enabled).map(o => o.name.toLowerCase()).join(', ');
    const prompt = `Generate a short professional printing service description for: name="${name}", category="${category || 'General Printing'}", sides="${printSides}", paper="${selectedPaper?.name || paperType}", finishing="${enabledFinishing || 'none'}". 1-2 sentences only.`;
    try {
      const desc = await aiService.generateAIResponse(prompt);
      setDescription(desc);
      setGeneratedDescription(desc);
    } catch {
      const desc = autoGenerateDescription();
      setDescription(desc);
      setGeneratedDescription(desc);
    }
  };

  const handleStationeryAiDescribe = async () => {
    const prompt = `Generate a short professional stationery product description for: name="${name}", category="${category || 'Stationery'}", unit="${unit}"${isStationeryPack ? `, sold in packs of ${unitsPerPack}` : ''}. Include details about typical use cases. 1-2 sentences only.`;
    try {
      const desc = await aiService.generateAIResponse(prompt);
      setDescription(desc);
      setGeneratedDescription(desc);
    } catch {
      const desc = `${name} - Premium quality stationery item. Ideal for office, school, and professional use.`;
      setDescription(desc);
      setGeneratedDescription(desc);
    }
  };

  const formatCurrency = (value: number) => `${currency} ${value.toFixed(2)}`;

  const toggleFinishing = (id: string) => {
    setFinishingOptions(prev => prev.map(o => o.id === id ? { ...o, enabled: !o.enabled } : o));
  };

  const toggleAllFinishing = () => {
    const allEnabled = finishingOptions.every(o => o.enabled);
    setFinishingOptions(prev => prev.map(o => ({ ...o, enabled: !allEnabled })));
  };

  const addVariantRow = () => {
    if (saveVariants.length >= 5) return;
    const flatCost = isStationery ? (stationeryCostPrice || 0) : (paperCost + tonerCost + finishingCost + finishingInventoryCost);
    const targetPct = resolveMinimumMarkup();
    const suggested = flatCost > 0 ? parseFloat((flatCost * (1 + targetPct / 100)).toFixed(2)) : 0;
    setSaveVariants(prev => [...prev, {
      id: `v${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      attribute: '',
      pages: isStationery ? 0 : (pages || 1),
      basePrice: parseFloat(flatCost.toFixed(2)),
      sellingPrice: 0,
      suggestedPrice: suggested,
    }]);
  };

  const updateVariantRow = (id: string, field: string, value: any) => {
    setSaveVariants(prev => prev.map(v => {
      if (v.id !== id) return v;
      const updated = { ...v, [field]: value };
      if (field === 'pages') {
        const pageCost = (paperCost + tonerCost) / (pages || 1);
        const newBase = parseFloat((pageCost * (value as number) + finishingCost + finishingInventoryCost).toFixed(2));
        updated.basePrice = newBase;
        updated.suggestedPrice = newBase > 0 ? parseFloat((newBase * (1 + resolveMinimumMarkup() / 100)).toFixed(2)) : 0;
      }
      return updated;
    }));
  };

  const suggestVariantPrices = () => {
    setSaveVariants(prev => prev.map(v => ({
      ...v,
      sellingPrice: v.suggestedPrice || 0,
    })));
  };

  const removeVariantRow = (id: string) => {
    setSaveVariants(prev => prev.filter(v => v.id !== id));
  };

  const existingCategories = useMemo(() => {
    const cats = new Set<string>();
    allItems.forEach(item => { if (item.category) cats.add(item.category); });
    return Array.from(cats).sort();
  }, [allItems]);

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a name');
      return;
    }

    if (!isStationery && !hasVariants && !validation.valid && sellingPrice > 0) {
      alert(`Unable to save.\n\nCalculated markup: ${profitMarkup.toFixed(1)}%\nMinimum required markup: ${validation.minimumMarkup}%\n\n${validation.message}`);
      return;
    }

    setSaving(true);
    try {
      const enabledFinishingOptions = finishingOptions.filter(o => o.enabled);
      const finishingOptionCosts = enabledFinishingOptions.reduce<Record<string, number>>((acc, o) => {
        acc[o.id] = Number(o.price) || 0;
        return acc;
      }, {});

      const productId = item?.id || `SRV-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const nameTrimmed = name.trim();

      const finalItem: Item & Record<string, unknown> = {
        ...item,
        id: productId,
        name: nameTrimmed,
        sku: sku.trim() || generateAutoSKU(entityType, nameTrimmed, undefined, inventory),
        type: entityType as any,
        classification: isStationery ? 'Stationery' : isProduct ? 'Product' : 'printing_service',
        category: category || (isStationery ? 'Stationery' : isProduct ? 'Products' : 'Printing Service'),
        unit: isStationery ? unit : (item?.unit || 'Booklet'),
        description: description || generatedDescription || item?.description,
        status,
        favorite,
        stock: item?.stock || 0,
        hasVariants,
        ...(isStationery ? {
          cost: costPrice,
          cost_price: costPrice,
          costPrice,
          price: sellingPrice,
          selling_price: sellingPrice,
          sellingPrice,
          isStationeryPack,
          costPerPack: isStationeryPack ? costPerPack : 0,
          unitsPerPack: isStationeryPack ? unitsPerPack : 0,
          profitAmount: profit,
          profitMargin: profitMarkup,
          minimumMargin: validation.minimumMarkup,
          pricingValidated: validation.valid,
        } : {
          cost: hasVariants ? 0 : baseCost,
          cost_price: hasVariants ? 0 : baseCost,
          costPrice: hasVariants ? 0 : baseCost,
          price: hasVariants ? 0 : sellingPrice,
          selling_price: hasVariants ? 0 : sellingPrice,
          sellingPrice: hasVariants ? 0 : sellingPrice,
          pages: hasVariants ? 0 : pages,
          printSides,
          paperType,
          fileType,
          ...(!hasVariants ? {
            profitAmount: profit,
            profitMargin: profitMarkup,
            minimumMargin: validation.minimumMarkup,
            pricingValidated: validation.valid,
            validationTimestamp: new Date().toISOString(),
            aiDescription: generatedDescription,
            pricingConfig: {
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
              bomTemplateId: '',
              paperCost,
              tonerCost,
              finishingCost,
              finishingInventoryCost,
              baseCost,
            } as Item['smartPricing'],
          } : {}),
          ...(isProduct || isStationery ? {} : {
            printType: 'Digital' as const,
            printingServiceType: 'printing' as const,
            printFinishing: enabledFinishingOptions.map(o => ({ id: o.id, name: o.name, price: o.price })),
          }),
          paperCost: hasVariants ? 0 : paperCost,
          tonerCost: hasVariants ? 0 : tonerCost,
        }),
        variants: hasVariants ? saveVariants.filter(v => v.attribute.trim() && v.sellingPrice > 0).map(v => ({
          attribute: v.attribute.trim(),
          pages: isStationery ? undefined : v.pages,
          basePrice: v.basePrice,
          sellingPrice: v.sellingPrice,
        })) : [],
      } as unknown as Item & Record<string, unknown>;

      if (!isStationery && !hasVariants) {
        const bomId = `BOM-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const components: any[] = [];
        if (selectedPaper) {
          components.push({ itemId: selectedPaperId, name: selectedPaper.name, quantityFormula: `${Math.ceil(pages / 2)}`, unit: selectedPaper.unit || 'ream' });
        }
        if (selectedToner) {
          components.push({ itemId: selectedTonerId, name: selectedToner.name, quantityFormula: `${Math.ceil(pages / 20000 * 100)} / 100`, unit: selectedToner.unit || 'unit' });
        }
        enabledFinishingOptions.forEach(opt => {
          components.push({ itemId: opt.id, name: opt.name, quantityFormula: `${opt.id === 'coverPages' ? 2 : 1}`, unit: 'unit' });
        });
        await dbService.put('bomTemplates', {
          id: bomId,
          name: `${nameTrimmed} (${entityType})`,
          type: 'Custom',
          components,
          lastUpdated: new Date().toISOString(),
        });
        (finalItem as any).smartPricing.bomTemplateId = bomId;
      }

      await onSave(finalItem as Item);

      const variantsToSave = saveVariants.filter(v => v.attribute.trim() && v.sellingPrice > 0);
      if (variantsToSave.length > 0) {
        for (const variant of variantsToSave) {
          if (isStationery) {
            const varCost = variant.basePrice > 0 ? variant.basePrice : stationeryCostPrice;
            const varId = `VAR-${productId}-${variant.attribute.replace(/\s+/g, '')}-${Date.now()}`;
            const varProfit = parseFloat((variant.sellingPrice - varCost).toFixed(2));
            const varItem: Item = {
              id: varId,
              name: `${nameTrimmed} - ${variant.attribute.trim()}`,
              sku: generateAutoSKU(entityType, `${nameTrimmed} ${variant.attribute.trim()}`, undefined, inventory),
              type: entityType as any,
              classification: 'Stationery',
              category: category || 'Stationery',
              unit,
              status,
              favorite,
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
              isStationeryPack,
              costPerPack: isStationeryPack ? costPerPack : 0,
              unitsPerPack: isStationeryPack ? unitsPerPack : 0,
              description: description || generatedDescription,
            } as unknown as Item;
            await dbService.put('inventory', varItem);
          } else {
          const varPages = variant.pages;
          const varTotalSheets = Math.ceil(varPages / 2);
          const varPaperCost = parseFloat((paperCost * (varPages / (pages || 1))).toFixed(2));
          const varTonerCost = parseFloat((tonerCost * (varPages / (pages || 1))).toFixed(2));
          const varCost = parseFloat((varPaperCost + varTonerCost + finishingCost + finishingInventoryCost).toFixed(2));
          const varId = `VAR-${productId}-${variant.attribute.replace(/\s+/g, '')}-${Date.now()}`;
          const varBomId = `BOM-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

          const varProfit = parseFloat((variant.sellingPrice - varCost).toFixed(2));
          const varItem: Item = {
            id: varId,
            name: `${nameTrimmed} - ${variant.attribute.trim()}`,
            sku: generateAutoSKU(entityType, `${nameTrimmed} ${variant.attribute.trim()}`, undefined, inventory),
            type: entityType as any,
            classification: isStationery ? 'Stationery' : isProduct ? 'Product' : 'printing_service',
            category: category || (isStationery ? 'Stationery' : isProduct ? 'Products' : 'Printing Service'),
            unit: 'Booklet',
            status,
            favorite,
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
            printSides,
            paperType,
            fileType,
            description: description || generatedDescription,
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
              totalSheets: Math.ceil(varPages / 2),
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
            } as Item['smartPricing'],
            ...(isProduct || isStationery ? {} : {
              printType: 'Digital' as const,
              printingServiceType: 'printing' as const,
              printFinishing: enabledFinishingOptions.map(o => ({ id: o.id, name: o.name, price: o.price })),
            }),
            paperCost: varPaperCost,
            tonerCost: varTonerCost,
          } as unknown as Item;

          const varComponents: any[] = [];
          if (selectedPaper) {
            varComponents.push({ itemId: selectedPaperId, name: selectedPaper.name, quantityFormula: `${varTotalSheets}`, unit: selectedPaper.unit || 'ream' });
          }
          if (selectedToner) {
            varComponents.push({ itemId: selectedTonerId, name: selectedToner.name, quantityFormula: `${Math.ceil(varPages / 20000 * 100)} / 100`, unit: selectedToner.unit || 'unit' });
          }
          enabledFinishingOptions.forEach(opt => {
            varComponents.push({ itemId: opt.id, name: opt.name, quantityFormula: `${opt.id === 'coverPages' ? 2 : 1}`, unit: 'unit' });
          });

          await dbService.put('inventory', varItem);
          await dbService.put('bomTemplates', {
            id: varBomId,
            name: `${nameTrimmed} - ${variant.attribute.trim()} (${entityType})`,
            type: 'Custom',
            components: varComponents,
            lastUpdated: new Date().toISOString(),
          });
          }
        }
      }
    } catch (error) {
      alert('Failed to save printing service');
    } finally {
      setSaving(false);
    }
  };

  const cardClass = 'bg-white shadow-sm rounded-xl p-5';
  const inputClass = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none transition-all duration-150';
  const labelClass = 'block text-xs font-semibold text-slate-700 mb-1';

  const renderCardHeader = (icon: React.ReactNode, title: string, badge?: string, gradient = 'from-indigo-500 to-purple-600') => (
    <div className={`flex items-center gap-3 mb-4 p-3 -m-5 -mt-5 mb-5 bg-gradient-to-r ${gradient} rounded-t-xl text-white`}>
      <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
        {icon}
      </div>
      <h4 className="text-sm font-bold">{title}</h4>
      {badge && <span className="ml-auto text-[10px] bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-sm">{badge}</span>}
    </div>
  );

  const premiumCard = `${cardClass} backdrop-blur-sm border border-slate-200/80 hover:border-slate-300/80 transition-all duration-200`;
  const premiumInput = `${inputClass} bg-white/80 backdrop-blur-sm border-slate-200/80 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20`;
  const premiumSelect = `${inputClass} bg-white/80 backdrop-blur-sm appearance-none cursor-pointer`;
  const premiumLabel = `${labelClass} flex items-center gap-1.5 text-indigo-700`;
  const toggleActiveBg = 'bg-gradient-to-r from-indigo-500 to-purple-600';
  const toggleInactiveBg = 'bg-slate-300';

  const renderBasicInfoTab = () => (
    <div className="space-y-4">
      <div className={premiumCard}>
        {renderCardHeader(<FileText size={15} className="text-white" />, `${isStationery ? 'Stationery' : isProduct ? 'Product' : 'Service'} Information`)}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className={premiumLabel}><FileText size={12} /> {entityType} Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className={premiumInput} placeholder="e.g. A4 Full Colour Flyers" />
          </div>
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className={premiumLabel}><FileText size={12} /> Description</label>
              {isStationery && (
                <button type="button" onClick={handleStationeryAiDescribe}
                  className="flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 font-medium px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 transition-colors">
                  <Sparkles size={10} /> AI Generate
                </button>
              )}
            </div>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              className={`${premiumInput} resize-none`} rows={2} placeholder="Brief description..." />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className={premiumLabel}><Package size={12} /> SKU / {entityType} Code</label>
            <input type="text" value={sku} onChange={e => setSku(e.target.value)} className={premiumInput} placeholder="Auto-generated" />
          </div>
          <div>
            <label className={premiumLabel}><Info size={12} /> Category</label>
            {isAddingCategory ? (
              <div className="flex gap-2">
                <input type="text" value={newCategory} onChange={e => setNewCategory(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const t = newCategory.trim(); if (t) { setCategory(t); setNewCategory(''); setIsAddingCategory(false); } } else if (e.key === 'Escape') { setIsAddingCategory(false); setNewCategory(''); } }}
                  onBlur={() => { const t = newCategory.trim(); if (t) { setCategory(t); } setNewCategory(''); setIsAddingCategory(false); }}
                  className={`${premiumInput} flex-1`} autoFocus placeholder="New category name" />
                <button type="button" onClick={() => { const t = newCategory.trim(); if (t) { setCategory(t); } setNewCategory(''); setIsAddingCategory(false); }} className="px-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-xs font-medium shadow-lg shadow-indigo-200">Save</button>
                <button type="button" onClick={() => { setIsAddingCategory(false); setNewCategory(''); }} className="px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50">Cancel</button>
              </div>
            ) : (
              <div className="relative">
                <select value={category} onChange={e => { if (e.target.value === '__new__') { setNewCategory(''); setIsAddingCategory(true); } else setCategory(e.target.value); }} className={premiumSelect}>
                  <option value="">Select category</option>
                  {existingCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__new__">+ Add new category</option>
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            )}
          </div>
          <div>
            <label className={premiumLabel}><TrendingUp size={12} /> Status</label>
            <div className="flex gap-2">
              {(['Active', 'Archived'] as const).map(s => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border-2 transition-all ${
                    status === s ? 'border-indigo-500 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}>
                  {s === 'Active' ? <><CheckCircle size={12} className="inline mr-1" /> Active</> : <><X size={12} className="inline mr-1" /> Archived</>}
                </button>
              ))}
            </div>
          </div>
          {isStationery && (
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-200">
              <div>
                <label className={premiumLabel}><Package size={12} /> Unit</label>
                <select value={unit} onChange={e => setUnit(e.target.value)} className={premiumSelect}>
                  {['pcs', 'packs', 'boxes', 'reams'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200/60">
            <div className="flex items-center gap-2">
              <Star size={16} className="text-amber-500" />
              <div>
                <p className="text-sm font-medium text-amber-800">Favorite / Quick Access</p>
                <p className="text-xs text-amber-600/70">Show in quick-access menus</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={favorite} onChange={e => setFavorite(e.target.checked)} className="sr-only peer" />
              <div className={`w-10 h-5 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${favorite ? toggleActiveBg : toggleInactiveBg}`} />
            </label>
          </div>
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200/60">
            <div className="flex items-center gap-2">
              <Brain size={16} className="text-indigo-600" />
              <div>
                <p className="text-sm font-medium text-indigo-800">Variants</p>
                <p className="text-xs text-indigo-600/70">Create multiple size variations</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={hasVariants} onChange={e => { setHasVariants(e.target.checked); if (!e.target.checked) setSaveVariants([]); }} className="sr-only peer" />
              <div className={`w-10 h-5 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${hasVariants ? toggleActiveBg : toggleInactiveBg}`} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPricingTab = () => (
    <div className="space-y-4">
      <div className={premiumCard}>
        {renderCardHeader(<Calculator size={15} className="text-white" />, `Pricing (${entityType})`, '', 'from-emerald-500 to-teal-600')}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={premiumLabel}><Calculator size={12} /> Cost Price ({currency})</label>
            <input type="number" value={isStationeryPack ? '' : (stationeryCostPrice || '')}
              onChange={e => setStationeryCostPrice(parseFloat(e.target.value) || 0)}
              disabled={isStationeryPack}
              className={premiumInput} min={0} step={0.01} placeholder="Enter cost price..." />
          </div>
          <div>
            <label className={premiumLabel}><TrendingUp size={12} /> Selling Price ({currency})</label>
            <input type="number" value={sellingPrice || ''} onChange={e => setSellingPrice(parseFloat(e.target.value) || 0)}
              className={`${premiumInput} text-lg font-bold`} min={0} step={0.01} placeholder="Enter selling price..." />
          </div>
          <div className="col-span-2 flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200/60">
            <div className="flex items-center gap-2">
              <Package size={14} className="text-indigo-600" />
              <div>
                <p className="text-sm font-medium text-indigo-800">Pack-Based Pricing</p>
                <p className="text-xs text-indigo-600/70">Set cost per pack instead of per piece</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={isStationeryPack} onChange={e => setIsStationeryPack(e.target.checked)} className="sr-only peer" />
              <div className={`w-10 h-5 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${isStationeryPack ? toggleActiveBg : toggleInactiveBg}`} />
            </label>
          </div>
          {isStationeryPack && (
            <>
              <div>
                <label className={premiumLabel}><Calculator size={12} /> Cost per Pack ({currency})</label>
                <input type="number" value={costPerPack || ''} onChange={e => setCostPerPack(parseFloat(e.target.value) || 0)}
                  className={premiumInput} min={0} step={0.01} placeholder="Enter cost per pack..." />
              </div>
              <div>
                <label className={premiumLabel}><Package size={12} /> Units per Pack</label>
                <input type="number" value={unitsPerPack || ''} onChange={e => setUnitsPerPack(parseInt(e.target.value) || 0)}
                  className={premiumInput} min={1} placeholder="e.g. 10" />
              </div>
            </>
          )}
          <div className="col-span-2 flex items-center gap-4 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2.5">
            <span>Cost: <span className="font-semibold text-indigo-600">{formatCurrency(isStationery ? (isStationeryPack && unitsPerPack > 0 ? costPerPack / unitsPerPack : stationeryCostPrice) : costPrice)}</span></span>
            <span className="text-slate-300">|</span>
            <span className={`font-semibold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              Profit: {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
            </span>
            <span className="text-slate-300">|</span>
            <span className={`font-semibold ${validation.valid ? 'text-emerald-600' : 'text-red-500'}`}>
              {profitMarkup.toFixed(1)}% margin
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPrintSettingsTab = () => (
    <div className="space-y-4">
      <div className={premiumCard}>
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setPaperExpanded(!paperExpanded)}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg shadow-lg shadow-blue-200">
              <Calculator size={16} className="text-white" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">Print Settings</h4>
          </div>
          {paperExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
        {paperExpanded && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={premiumLabel}><Printer size={12} /> Print Sides</label>
                <div className="flex gap-2">
                  {(['single', 'double'] as const).map(s => (
                    <button key={s} type="button" onClick={() => setPrintSides(s)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border-2 transition-all ${
                        printSides === s ? 'border-indigo-500 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}>
                      {s === 'single' ? 'Single Side' : 'Double Side'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={premiumLabel}><Package size={12} /> Paper Type</label>
                <div className="flex gap-2">
                  {(['paper', 'cover'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setPaperType(t)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border-2 transition-all ${
                        paperType === t ? 'border-indigo-500 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}>
                      {t === 'paper' ? 'Paper' : 'Cover'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className={premiumLabel}><FileText size={12} /> File Type</label>
              <div className="flex gap-2">
                {(['excel', 'word'] as const).map(f => (
                  <button key={f} type="button" onClick={() => setFileType(f)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border-2 transition-all ${
                      fileType === f ? 'border-indigo-500 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}>
                    {f === 'excel' ? 'Excel' : 'Word'}
                  </button>
                ))}
              </div>
            </div>
            {hasVariants ? (
              <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <Brain size={14} className="text-amber-600" />
                  <p className="text-xs text-amber-700 font-medium">Variants mode active</p>
                </div>
                <p className="text-[10px] text-amber-600">Pages per Copy and Selling Price are set per variant. Parent groups all variants.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={premiumLabel}><FileText size={12} /> Pages per Copy</label>
                    <input type="number" value={pages} onChange={e => { const v = parseInt(e.target.value) || 1; if (v >= 1 && v <= 10000) setPages(v); }} className={premiumInput} min={1} max={10000} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <label className={premiumLabel}><TrendingUp size={12} /> Selling Price ({currency})</label>
                      {suggestedSellingPrice > 0 && sellingPrice !== suggestedSellingPrice && (
                        <button type="button" onClick={() => setSellingPrice(suggestedSellingPrice)}
                          className="text-[10px] flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium">
                          <Lightbulb size={10} /> Suggest {formatCurrency(suggestedSellingPrice)}
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input type="number" value={sellingPrice || ''} onChange={e => setSellingPrice(parseFloat(e.target.value) || 0)}
                        className={`${premiumInput} text-lg font-bold pr-8`} min={0} step={0.01} placeholder="Enter selling price..." />
                      {suggestedSellingPrice > 0 && sellingPrice === 0 && (
                        <button type="button" onClick={() => setSellingPrice(suggestedSellingPrice)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-indigo-100 rounded-md text-indigo-600 hover:bg-indigo-200 transition-colors">
                          <Lightbulb size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                  <span>Sheets: <span className="font-semibold text-slate-700">{totalSheets}</span></span>
                  <span className="text-slate-300">|</span>
                  <span>Cost: <span className="font-semibold text-indigo-600">{formatCurrency(costPrice)}</span></span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderBomMaterialsTab = () => (
    <div className="space-y-4">
      <div className={premiumCard}>
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setBomExpanded(!bomExpanded)}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg shadow-lg shadow-amber-200">
              <Package size={16} className="text-white" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">BOM Materials</h4>
            <span className="text-[10px] bg-gradient-to-r from-green-100 to-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Auto-selected</span>
          </div>
          {bomExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
        {bomExpanded && (
          <div className="mt-4 space-y-4">
            <div>
              <label className={premiumLabel}><FileText size={12} /> Paper {paperType === 'cover' && <span className="text-indigo-500 font-normal">(Cover mode)</span>}</label>
              {availablePaperItems.length > 0 ? (
                <div className="relative">
                  <select value={selectedPaperId} onChange={e => setSelectedPaperId(e.target.value)}
                    className={premiumSelect}>
                    {availablePaperItems.map(p => (
                      <option key={p.id} value={p.id}>{p.name} - {currency} {getItemCost(p).toFixed(2)}/{p.unit || 'unit'} (Stock: {p.stock || 0})</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              ) : (
                <div className="p-3 bg-gradient-to-r from-red-50 to-rose-50 text-red-600 rounded-xl text-xs border border-red-200">
                  {paperType === 'cover' ? 'No cover/card stock items found in inventory' : 'No paper items found'}
                </div>
              )}
              {selectedPaper && !hasVariants && (
                <div className="mt-2 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl space-y-1 border border-blue-200/60">
                  <div className="flex justify-between text-xs"><span className="text-slate-600">Sheets (double side):</span><span className="font-semibold text-slate-800">{totalSheets} sheets</span></div>
                  <div className="flex justify-between text-xs"><span className="text-slate-600">Paper cost:</span><span className="font-semibold text-blue-600">{formatCurrency(paperCost)}</span></div>
                </div>
              )}
            </div>
            <div>
              <label className={premiumLabel}><Calculator size={12} /> Toner / Ink</label>
              {tonerItems.length > 0 ? (
                <div className="relative">
                  <select value={selectedTonerId} onChange={e => setSelectedTonerId(e.target.value)}
                    className={premiumSelect}>
                    {tonerItems.map(t => (
                      <option key={t.id} value={t.id}>{t.name} - {currency} {getItemCost(t).toFixed(2)}/{t.unit || 'unit'} (Stock: {t.stock || 0})</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              ) : (
                <div className="p-3 bg-gradient-to-r from-red-50 to-rose-50 text-red-600 rounded-xl text-xs border border-red-200">No toner items found</div>
              )}
              {selectedToner && !hasVariants && (
                <div className="mt-2 p-3 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl space-y-1 border border-purple-200/60">
                  <div className="flex justify-between text-xs"><span className="text-slate-600">Pages to print:</span><span className="font-semibold text-slate-800">{pages} pages</span></div>
                  <div className="flex justify-between text-xs"><span className="text-slate-600">Toner cost:</span><span className="font-semibold text-purple-600">{formatCurrency(tonerCost)}</span></div>
                </div>
              )}
            </div>
            {hasVariants && (
              <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <Brain size={14} className="text-indigo-600" />
                  <p className="text-xs text-indigo-700">Materials applied per variant. Costs scale by page count.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderFinishingTab = () => (
    <div className="space-y-4">
      <div className={premiumCard}>
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setFinishingExpanded(!finishingExpanded)}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg shadow-lg shadow-purple-200">
              <Zap size={16} className="text-white" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">Finishing Options</h4>
            <span className="text-[10px] text-slate-400">({finishingOptions.filter(o => o.enabled).length} selected)</span>
          </div>
          {finishingExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
        {finishingExpanded && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-slate-400">Flat rate per copy</p>
              <button type="button" onClick={toggleAllFinishing} className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium">
                {finishingOptions.every(o => o.enabled) ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {finishingOptions.map(opt => (
                <label key={opt.id}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                    opt.enabled ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 shadow-sm' : 'bg-white/50 border-slate-100 hover:bg-slate-50'
                  }`}>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 text-sm">{opt.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{opt.description}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-xs font-semibold text-purple-600">{currency} {opt.price}</span>
                    <input type="checkbox" checked={opt.enabled} onChange={() => toggleFinishing(opt.id)} className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500" />
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderVariantsTab = () => (
    <div className="space-y-4">
      {!hasVariants ? (
        <div className="p-8 bg-gradient-to-r from-slate-50 to-indigo-50/30 border border-slate-200 rounded-xl text-center">
          <Brain size={32} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">Variants are disabled.</p>
          <p className="text-xs text-slate-400 mt-1">Go to Basic Info to enable variants.</p>
        </div>
      ) : (
        <div className={premiumCard}>
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setVariantExpanded(!variantExpanded)}>
            <div className="flex items-center gap-2">
              <Brain size={16} className="text-indigo-600" />
              <h4 className="text-sm font-bold text-slate-800">Variants ({saveVariants.length}/5)</h4>
            </div>
            <div className="flex items-center gap-2">
              {saveVariants.length > 0 && (
                <button type="button" onClick={suggestVariantPrices}
                  className="flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-800 font-medium px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors">
                  <Sparkles size={11} /> Suggest All
                </button>
              )}
              <button type="button" onClick={(e) => { e.stopPropagation(); addVariantRow(); }} disabled={saveVariants.length >= 5}
                className="flex items-center gap-1 text-xs text-white px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-slate-300 disabled:to-slate-300 shadow-lg shadow-indigo-200 transition-all">
                <Plus size={13} /> Add Variant
              </button>
              {variantExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </div>
          </div>
          {variantExpanded && (
            <div className="mt-4">
              {saveVariants.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No variants yet. Click "Add Variant" to create up to 5 variants.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2.5 pr-2 text-slate-500 font-semibold">Attribute</th>
                        {!isStationery && <th className="text-left py-2.5 px-2 text-slate-500 font-semibold">Pages</th>}
                        <th className="text-right py-2.5 px-2 text-slate-500 font-semibold">Base Price</th>
                        <th className="text-right py-2.5 px-2 text-slate-500 font-semibold">Selling Price</th>
                        <th className="text-right py-2.5 px-2 text-slate-500 font-semibold">Margin</th>
                        <th className="py-2.5 pl-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {saveVariants.map(v => {
                        const varMargin = v.sellingPrice > 0 && v.basePrice > 0 ? ((v.sellingPrice - v.basePrice) / v.sellingPrice * 100) : 0;
                        return (
                          <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                            <td className="py-1.5 pr-2">
                              <input type="text" value={v.attribute} onChange={e => updateVariantRow(v.id, 'attribute', e.target.value)}
                                className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white/80" placeholder="e.g. A4" />
                            </td>
                            {!isStationery && <td className="py-1.5 px-2">
                              <input type="number" value={v.pages} onChange={e => updateVariantRow(v.id, 'pages', parseInt(e.target.value) || 1)}
                                className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white/80" min={1} />
                            </td>}
                            <td className="py-1.5 px-2 text-right text-slate-500 font-mono text-[11px]">{formatCurrency(v.basePrice)}</td>
                            <td className="py-1.5 px-2">
                              <div className="flex items-center gap-1">
                                <input type="number" value={v.sellingPrice || ''} onChange={e => updateVariantRow(v.id, 'sellingPrice', parseFloat(e.target.value) || 0)}
                                  className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-right bg-white/80" min={0} step={0.01} placeholder="0.00" />
                                {v.suggestedPrice && v.sellingPrice === 0 && (
                                  <button type="button" onClick={() => updateVariantRow(v.id, 'sellingPrice', v.suggestedPrice)}
                                    className="p-1 bg-indigo-100 rounded text-indigo-600 hover:bg-indigo-200" title={`Suggest ${formatCurrency(v.suggestedPrice)}`}>
                                    <Lightbulb size={10} />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className={`py-1.5 px-2 text-right font-mono text-[11px] font-semibold ${varMargin >= resolveMinimumMarkup() ? 'text-emerald-600' : varMargin > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                              {v.sellingPrice > 0 ? `${varMargin.toFixed(1)}%` : '—'}
                            </td>
                            <td className="py-1.5 pl-2">
                              <button type="button" onClick={() => removeVariantRow(v.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                                <X size={12} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex items-center justify-between mt-3">
                <p className="text-[10px] text-slate-400">{isStationery ? 'Set selling price per variant attribute above cost.' : 'Base price auto-calculated (double-sided). Finishing flat per item.'}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderVariantSummarySidebar = () => {
    if (!hasVariants || saveVariants.length === 0) return null;
    const activeVariants = saveVariants.filter(v => v.attribute.trim());
    if (activeVariants.length === 0) return null;
    const totalBaseCost = activeVariants.reduce((s, v) => s + v.basePrice, 0);
    const totalSelling = activeVariants.reduce((s, v) => s + v.sellingPrice, 0);
    const totalProfit = totalSelling - totalBaseCost;
    const overallMargin = totalSelling > 0 ? (totalProfit / totalSelling) * 100 : 0;

    return (
      <div className={`${premiumCard}`}>
        <div className="p-3 -m-5 -mt-5 mb-3 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-t-xl">
          <div className="flex items-center gap-2 text-white">
            <Brain size={14} />
            <h4 className="text-sm font-bold">Variants Overview</h4>
          </div>
        </div>
        <div className="space-y-2">
          {activeVariants.map(v => {
            const varMargin = v.sellingPrice > 0 && v.basePrice > 0 ? ((v.sellingPrice - v.basePrice) / v.sellingPrice * 100) : 0;
            const marginColor = varMargin >= resolveMinimumMarkup() ? 'text-emerald-500' : varMargin > 0 ? 'text-amber-500' : 'text-slate-400';
            return (
              <div key={v.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-700">{v.attribute || 'Unnamed'}</span>
                  {!isStationery && <span className="text-[10px] text-slate-400">{v.pages} pages</span>}
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">CP: <span className="font-mono font-medium text-slate-700">{formatCurrency(v.basePrice)}</span></span>
                  <span className="text-slate-500">SP: <span className="font-mono font-medium text-indigo-600">{formatCurrency(v.sellingPrice)}</span></span>
                  <span className={`font-mono font-semibold ${marginColor}`}>{v.sellingPrice > 0 ? `${varMargin.toFixed(1)}%` : '—'}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-slate-200 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Total Cost</span>
            <span className="font-mono font-semibold text-slate-700">{formatCurrency(totalBaseCost)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Total Selling</span>
            <span className="font-mono font-semibold text-indigo-600">{formatCurrency(totalSelling)}</span>
          </div>
          <div className="flex justify-between text-xs font-medium">
            <span className={`${overallMargin >= resolveMinimumMarkup() ? 'text-emerald-600' : 'text-amber-600'}`}>Overall Margin</span>
            <span className={`font-mono font-semibold ${overallMargin >= resolveMinimumMarkup() ? 'text-emerald-600' : 'text-amber-600'}`}>{overallMargin.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    );
  };

  const tabContent: Record<PrintingTab, () => React.ReactNode> = {
    basicInfo: renderBasicInfoTab,
    pricing: renderPricingTab,
    printSettings: renderPrintSettingsTab,
    bomMaterials: renderBomMaterialsTab,
    finishing: renderFinishingTab,
    variants: renderVariantsTab,
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Premium Tabs */}
      <div className="relative flex items-center gap-0 shrink-0 flex-wrap border-b border-slate-200/80 -mx-4 px-4">
        {TABS.filter(tab => {
          if (isStationery) return tab.key === 'basicInfo' || tab.key === 'pricing' || tab.key === 'variants';
          return tab.key !== 'pricing';
        }).map(tab => (
          <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 px-4 py-3.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === tab.key ? 'border-indigo-600 text-indigo-700 bg-gradient-to-b from-indigo-50/50 to-transparent' : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'
            }`}>
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content + Sidebar */}
      <div className="flex-1 flex gap-6 overflow-hidden mt-4 min-h-0">
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex-1 overflow-auto custom-scrollbar pr-2 min-h-0">
            {tabContent[activeTab]()}

            {activeTab !== 'variants' && saveVariants.length > 0 && (
              <div className="mt-4 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl text-xs text-indigo-700 flex items-center gap-2">
                <Brain size={14} />
                <span className="font-semibold">{saveVariants.length} variant(s)</span> configured. Switch to <button type="button" onClick={() => setActiveTab('variants')} className="font-semibold underline">Variants tab</button> to manage.
              </div>
            )}

            <div className="flex gap-3 mt-6">
              {activeTab !== 'variants' && (
                <button type="button" onClick={handleSave} disabled={saving || (!isStationery && !hasVariants && (sellingPrice <= 0 || !validation.valid))}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-xs font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none flex items-center gap-2">
                  {saving ? <>Saving...</> : <><Zap size={14} /> Save {entityType}</>}
                </button>
              )}
              {activeTab === 'variants' && (
                <button type="button" onClick={handleSave} disabled={saving}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-xs font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none flex items-center gap-2">
                  {saving ? <>Saving...</> : <><Zap size={14} /> Save {entityType}</>}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Premium Summary */}
        <div className="w-72 shrink-0 hidden lg:flex flex-col gap-4 overflow-y-auto custom-scrollbar min-h-0">
          {/* Variant Overview (when variants enabled) */}
          {renderVariantSummarySidebar()}

          {/* Price Summary */}
          <div className={`${premiumCard} sticky top-0 shadow-md border border-slate-200`}>
            <div className="p-4 -m-5 mb-4 bg-gradient-to-r from-slate-800 to-slate-700 rounded-t-xl">
              <div className="flex items-center gap-2 text-white mb-1">
                <Calculator size={14} />
                <h4 className="text-sm font-bold">Cost Breakdown</h4>
              </div>
              {hasVariants ? (
                <p className="text-slate-400 text-[10px]">{saveVariants.length} variant(s) · Variant-based pricing</p>
              ) : (
                <p className="text-slate-400 text-[10px]">{isStationery ? `${unit} unit` : `${pages} pages`} · {formatCurrency(costPrice)} total cost</p>
              )}
            </div>
            {hasVariants ? (
              <div className="space-y-2.5">
                <p className="text-xs text-slate-500">Parent is a grouping item. Each variant has its own pricing.</p>
                {saveVariants.filter(v => v.attribute.trim()).length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Variant Prices</p>
                    {saveVariants.filter(v => v.attribute.trim()).map(v => (
                      <div key={v.id} className="flex justify-between text-xs">
                        <span className="text-slate-500">{v.attribute}</span>
                        <span className="font-mono font-medium text-slate-700">{formatCurrency(v.sellingPrice)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {isStationery ? (
                  <>
                    <div className="flex justify-between text-xs"><span className="text-slate-500">Unit</span><span className="font-mono font-medium text-slate-700">{unit}</span></div>
                    {isStationeryPack && <div className="flex justify-between text-xs"><span className="text-slate-500">Pack</span><span className="font-mono font-medium text-slate-700">{unitsPerPack} units @ {formatCurrency(costPerPack)}/pack</span></div>}
                    <div className="border-t border-slate-200 pt-2 flex justify-between font-semibold text-xs">
                      <span>Cost Price</span>
                      <span className="font-mono text-base text-indigo-600">{formatCurrency(costPrice)}</span>
                    </div>
                  </>
                ) : (
                <>
                <div className="flex justify-between text-xs"><span className="text-slate-500">{selectedPaper?.name?.replace(/\s*\d+gsm.*/i, '') || 'Paper'}</span><span className="font-mono font-medium text-slate-700">{formatCurrency(paperCost)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-slate-500">{selectedToner?.name?.replace(/\s*Universal\s*/i, '') || 'Toner'}</span><span className="font-mono font-medium text-slate-700">{formatCurrency(tonerCost)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-slate-500">Finishing</span><span className="font-mono font-medium text-slate-700">{formatCurrency(finishingCost)}</span></div>
                {finishingInventoryCost > 0 && <div className="flex justify-between text-xs"><span className="text-slate-500 pl-3">Materials</span><span className="font-mono font-medium text-slate-700">{formatCurrency(finishingInventoryCost)}</span></div>}
                <div className="border-t border-slate-200 pt-2 flex justify-between font-semibold text-xs">
                  <span>Cost Price</span>
                  <span className="font-mono text-base text-indigo-600">{formatCurrency(costPrice)}</span>
                </div>
                </>)}
                <div className="flex justify-between text-xs">
                  <span className="text-blue-600 font-semibold">Selling Price</span>
                  <span className="font-mono text-base font-bold text-blue-700">{formatCurrency(sellingPrice)}</span>
                </div>
                <div className={`flex justify-between font-semibold text-xs ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  <span>Profit</span>
                  <span className="font-mono">{profit >= 0 ? '+' : ''}{formatCurrency(profit)}</span>
                </div>
                <div className={`flex justify-between text-xs ${validation.valid ? 'text-emerald-600' : 'text-red-500'}`}>
                  <span>Margin</span>
                  <span className="font-mono font-semibold">{profitMarkup.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Target ({resolveMinimumMarkup()}%)</span>
                  <span className="font-medium">{validation.minimumMarkup}% min</span>
                </div>

                {/* Pricing Confidence Indicator */}
                <div className={`p-2.5 rounded-lg text-[10px] font-medium text-center border transition-all ${
                  pricingConfidence.level === 'high' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  pricingConfidence.level === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  pricingConfidence.level === 'low' ? 'bg-red-50 text-red-700 border-red-200' :
                  'bg-slate-50 text-slate-400 border-slate-200'
                }`}>
                  <div className="flex items-center justify-center gap-1.5">
                    {pricingConfidence.level === 'high' && <CheckCircle size={11} />}
                    {pricingConfidence.level === 'medium' && <AlertCircle size={11} />}
                    {pricingConfidence.level === 'low' && <AlertCircle size={11} />}
                    {pricingConfidence.level === 'none' && <Info size={11} />}
                    {pricingConfidence.label}
                  </div>
                </div>

                {!isStationery && (
                <>
                {/* AI Suggest Button */}
                {suggestedSellingPrice > 0 && sellingPrice !== suggestedSellingPrice && (
                  <button type="button" onClick={() => setSellingPrice(suggestedSellingPrice)}
                    className="w-full py-2 bg-gradient-to-r from-cyan-500 to-teal-600 text-white rounded-lg text-xs font-semibold hover:from-cyan-600 hover:to-teal-700 transition-all shadow-lg shadow-cyan-200 flex items-center justify-center gap-1.5">
                    <Sparkles size={13} /> AI Suggest: {formatCurrency(suggestedSellingPrice)}
                  </button>
                )}

                {/* Generate Description Button */}
                <button type="button" onClick={handleAiDescribe}
                  className="w-full py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-lg text-xs font-semibold hover:from-violet-600 hover:to-purple-700 transition-all shadow-lg shadow-violet-200 flex items-center justify-center gap-1.5">
                  <Sparkles size={13} /> Generate Description
                </button>
                </>
                )}
              </div>
            )}

            <button type="button" onClick={handleSave} disabled={saving || (!isStationery && !hasVariants && (sellingPrice <= 0 || !validation.valid))}
              className="w-full mt-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-xs font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2">
              {saving ? 'Saving...' : <><Zap size={14} /> Save</>}
            </button>
          </div>
        </div>
      </div>

      {/* Premium Footer */}
      <div className="flex items-center justify-between shrink-0 pt-4 mt-4 border-t border-slate-200 -mx-4 px-4">
        <button type="button" onClick={onClose}
          className="px-5 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all">
          Cancel
        </button>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          {isStationery ? (
            <span className="text-indigo-600 font-semibold">CP: {formatCurrency(costPrice)}</span>
          ) : hasVariants ? (
            <span className="flex items-center gap-1"><Brain size={12} /> {saveVariants.length} variant(s)</span>
          ) : (
            <>
              {sellingPrice > 0 && <span className="text-blue-600 font-medium">SP: {formatCurrency(sellingPrice)}</span>}
              <span className="text-indigo-600 font-semibold">CP: {formatCurrency(costPrice)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export { PrintingServiceModal };
export default PrintingServiceModal;
