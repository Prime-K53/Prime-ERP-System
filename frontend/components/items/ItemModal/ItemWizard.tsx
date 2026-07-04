import React, { useRef, useEffect, useCallback } from 'react';
import { FileText, Package, Scale, Layers, DollarSign, Printer, Beaker, ShoppingCart, Zap, Calculator, TrendingUp, CheckCircle, Sparkles, Brain } from 'lucide-react';
import type { Item, FinishingOption } from '../../../types';
import type { WizardStep, ItemFormData } from './types/itemFormTypes';
import { useItemForm } from './hooks/useItemForm';
import { useVariantManager } from './hooks/useVariantManager';
import { useAttributeStore } from '../../../stores/attributeStore';
import { useConversionManager } from './hooks/useConversionManager';
import { useAuth } from '../../../context/AuthContext';
import { BasicInformation } from './sections/BasicInformation';
import { InventorySection } from './sections/InventorySection';
import { UnitConversionSection } from './sections/UnitConversionSection';
import { VariantsSection } from './sections/VariantsSection';
import { PricingSection } from './sections/PricingSection';
import { PrintingSection } from './sections/PrintingSection';
import { RecipeSection } from './sections/RecipeSection';
import { PurchasingSection } from './sections/PurchasingSection';
import { SummarySidebar } from './components/SummarySidebar';
import { RecipeEditorModal } from './components/RecipeEditorModal';
import { validateStep } from './validation/itemValidation';
import { generateAutoSKU, generateSku } from '../../../utils/skuGenerator';
import { dbService } from '../../../services/db';

interface Props {
  item?: Item | null;
  onSave: (item: Item) => Promise<void>;
  onClose: () => void;
  onOpenRecipeEditor?: () => void;
  allItems?: Item[];
  lockClassification?: boolean;
}

const SECTION_COMPONENTS: Record<WizardStep, React.FC<Record<string, unknown>>> = {
  basic: BasicInformation,
  inventory: InventorySection,
  units: UnitConversionSection,
  variants: VariantsSection,
  pricing: PricingSection,
  printing: PrintingSection,
  recipe: RecipeSection,
  purchasing: PurchasingSection,
};

export const ItemWizard: React.FC<Props> = ({ item, onSave, onClose, onOpenRecipeEditor, allItems, lockClassification }) => {
  const { companyConfig } = useAuth();
  const currency = companyConfig?.currencySymbol;
  const {
    formData, setFormData, currentStep, setCurrentStep,
    steps, currentIndex, canGoNext, isDirty, pricingValidation,
    updateField, goNext, goBack, goToStep,
    toItem, loadItem,
  } = useItemForm(item, currency, allItems);

  const variantsManager = useVariantManager(formData.id || 'new');
  const conversionsManager = useConversionManager();
  const [saving, setSaving] = React.useState(false);
  const [clickedNext, setClickedNext] = React.useState(false);
  const [recipeEditorOpen, setRecipeEditorOpen] = React.useState(false);
  const stepErrors = React.useMemo(
    () => (clickedNext || currentIndex > 0 ? validateStep(formData, currentStep) : {}),
    [formData, currentStep, clickedNext, currentIndex],
  );
  const contentRef = useRef<HTMLDivElement>(null);

  const attributeStore = useAttributeStore();

  useEffect(() => {
    if (item) loadItem(item);
  }, [item]);

  useEffect(() => {
    if (attributeStore.attributes.length === 0) {
      attributeStore.fetchAttributes();
    }
  }, []);

  useEffect(() => {
    variantsManager.setAvailableAttributes(attributeStore.attributes);
  }, [attributeStore.attributes]);

  useEffect(() => {
    if (item && item.variants) {
      variantsManager.importVariants(item.variants);
      const itemExt = item as Item & Record<string, unknown>;
      if (itemExt.selectedAttributes) {
        const restored = itemExt.selectedAttributes;
        setTimeout(() => {
          variantsManager.setSelectedAttributesAndGenerate(
            restored,
            variantsManager.allAttributes,
            variantsManager.baseCost || formData.costPrice,
            variantsManager.basePrice || formData.sellingPrice,
            new Set((itemExt.excludedVariantKeys || []) as string[]),
          );
        }, 100);
      }
    }
  }, [item?.id, variantsManager.allAttributes.length]);

  useEffect(() => {
    variantsManager.setProductName(formData.name);
  }, [formData.name]);

  useEffect(() => {
    if (item) {
      const itemExt = item as Item & Record<string, unknown>;
      const convs = (itemExt.conversions || itemExt.unitConversions || []) as Record<string, unknown>[];
      if (convs.length > 0) {
        conversionsManager.importConversions(
          convs.map((c, i: number) => ({
            id: c.id || `CONV-${i}`,
            fromUnit: c.fromUnit || c.purchaseUnit || '',
            toUnit: c.toUnit || c.consumptionUnit || '',
            factor: c.factor || c.conversionFactor || 1,
          })),
        );
      }
    }
  }, [item?.id]);

  useEffect(() => {
    contentRef.current?.focus();
    setClickedNext(false);
  }, [currentStep]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const isInternal = formData.inventoryRole === 'internal';
      const isStationery = formData.classification === 'stationery';
      const isRawMaterial = formData.classification === 'raw_material';

      if (!isInternal && !isStationery && !isRawMaterial && pricingValidation && !pricingValidation.valid) {
        alert(`Cannot save: ${pricingValidation.message}`);
        setSaving(false);
        return;
      }

      const finalItem = toItem(item?.id) as Item & Record<string, unknown>;
      finalItem.variants = variantsManager.variants.map((v) => {
        const clean: Record<string, unknown> = { ...v };
        if (!clean._attributeKey) delete clean._attributeKey;
        return clean;
      });
      finalItem.selectedAttributes = variantsManager.selectedAttributes;
      finalItem.excludedVariantKeys = Array.from(variantsManager.excludedVariantIds);
      finalItem.conversions = conversionsManager.toSimpleConversions();
      finalItem.unitConversions = conversionsManager.toSimpleConversions();
      await onSave(finalItem);
    } finally {
      setSaving(false);
    }
  };

  const handleNext = useCallback(() => {
    setClickedNext(true);
    const errs = validateStep(formData, currentStep);
    if (Object.keys(errs).length === 0) {
      goNext();
    }
  }, [formData, currentStep, goNext]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'TEXTAREA' && target.tagName !== 'BUTTON' && target.tagName !== 'SELECT') {
        e.preventDefault();
        if (currentIndex === steps.length - 1) {
          handleSave();
        } else if (canGoNext) {
          goNext();
        }
      }
    }
  };

  const handleRecipeEditorSave = useCallback(async (recipe: {
    pages: number; paperId: string; tonerId: string;
    finishingOptions: FinishingOption[]; baseCost: number;
    paperCost: number; tonerCost: number; finishingCost: number;
  }) => {
    updateField('costPrice', recipe.baseCost);
    setFormData((prev) => ({
      ...prev,
      smartPricing: {
        pages: recipe.pages,
        paperItemId: recipe.paperId,
        tonerItemId: recipe.tonerId,
        finishingOptions: recipe.finishingOptions,
        paperCost: recipe.paperCost,
        tonerCost: recipe.tonerCost,
        finishingCost: recipe.finishingCost,
        baseCost: recipe.baseCost,
      },
    }) as unknown as ItemFormData);
    const recipeId = `RECIPE-${Date.now()}`;
    updateField('recipeId', recipeId);
    updateField('recipeType', 'bom');
    const enabledFinishing = recipe.finishingOptions.filter(o => o.enabled);
    const bomEntry = {
      id: recipeId,
      name: formData.name || 'New Recipe',
      type: 'Custom',
      components: [
        ...(recipe.paperId ? [{ itemId: recipe.paperId, quantityFormula: `${Math.ceil(recipe.pages / 2)}`, unit: 'sheet' }] : []),
        ...(recipe.tonerId ? [{ itemId: recipe.tonerId, quantityFormula: `${Math.ceil(recipe.pages / 20000 * 100) / 100}`, unit: 'unit' }] : []),
        ...enabledFinishing.map(o => ({ itemId: o.id, name: o.name, quantityFormula: '1', unit: 'unit' })),
      ],
      lastUpdated: new Date().toISOString(),
    };
    try { await dbService.put('bomTemplates', bomEntry); } catch {}
  }, [formData.name, updateField]);

  const handleGenerateSku = useCallback((category: string) => {
    const classificationToType: Record<string, string> = {
      raw_material: 'Raw Material',
      product: 'Product',
      stationery: 'Stationery',
      printing_service: 'Service',
      non_stock_service: 'Service',
    };
    const type = classificationToType[formData.classification] || 'ITEM';
    return generateAutoSKU(type, formData.name || category || 'UNK', undefined, allItems || []);
  }, [allItems, formData.classification, formData.name]);

  const SectionComponent = SECTION_COMPONENTS[currentStep];

  const sectionProps: Record<string, unknown> = {
    basic: { data: formData, onChange: updateField, errors: stepErrors, onGenerateSku: handleGenerateSku, classificationReadOnly: lockClassification, allItems },
    inventory: { data: formData, onChange: updateField, errors: stepErrors },
    units: {
      data: formData,
      onChange: updateField,
      conversions: conversionsManager.conversions,
      onAddConversion: conversionsManager.addConversion,
      onRemoveConversion: conversionsManager.removeConversion,
      onUpdateConversion: conversionsManager.updateConversion,
    },
    variants: {
      variants: variantsManager.variants,
      selectedAttributes: variantsManager.selectedAttributes,
      excludedVariantIds: variantsManager.excludedVariantIds,
      allAttributes: variantsManager.allAttributes,
      baseCost: variantsManager.baseCost || formData.costPrice,
      basePrice: variantsManager.basePrice || formData.sellingPrice,
      recipeCost: formData.costPrice,
      onAdd: variantsManager.addVariant,
      onRemove: variantsManager.removeVariant,
      onUpdate: variantsManager.updateVariant,
      onAttributeSelect: (attrId: string, valueIds: string[]) => {
        const next = variantsManager.selectedAttributes.map((a) =>
          a.attributeId === attrId ? { ...a, valueIds } : a,
        );
        if (!next.find((a) => a.attributeId === attrId)) {
          next.push({ attributeId: attrId, valueIds });
        }
        if (!formData.variantsEnabled) {
          updateField('variantsEnabled', true);
        }
        variantsManager.setSelectedAttributesAndGenerate(
          next,
          variantsManager.allAttributes,
          variantsManager.baseCost || formData.costPrice,
          variantsManager.basePrice || formData.sellingPrice,
          variantsManager.excludedVariantIds,
        );
      },
      onToggleExclude: variantsManager.toggleExcludeVariant,
      onBaseCostChange: (cost: number) => variantsManager.updateBasePricing(cost, variantsManager.basePrice || formData.sellingPrice),
      onBasePriceChange: (price: number) => variantsManager.updateBasePricing(variantsManager.baseCost || formData.costPrice, price),
      onRegenerate: () => {
        variantsManager.setSelectedAttributesAndGenerate(
          variantsManager.selectedAttributes,
          variantsManager.allAttributes,
          variantsManager.baseCost || formData.costPrice,
          variantsManager.basePrice || formData.sellingPrice,
          variantsManager.excludedVariantIds,
        );
      },
      errors: stepErrors,
      classification: formData.classification,
      basePages: (formData as ItemFormData & Record<string, unknown>).smartPricing?.pages as number | undefined || 1,
    },
    pricing: { data: formData, onChange: updateField, pricingValidation },
    printing: { data: formData, onChange: updateField },
    recipe: { data: formData, onChange: updateField, onOpenRecipeEditor: () => setRecipeEditorOpen(true), allItems: allItems },
    purchasing: { data: formData, onChange: updateField },
  };

  const handleBackOrCancel = currentIndex === 0 ? onClose : goBack;

  const cardClass = 'bg-white shadow-sm rounded-xl p-5';
  const inputClass = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none transition-all duration-150';
  const labelClass = 'block text-xs font-semibold text-slate-700 mb-1';
  const premiumCard = `${cardClass} backdrop-blur-sm border border-slate-200/80 hover:border-slate-300/80 transition-all duration-200`;
  const premiumInput = `${inputClass} bg-white/80 backdrop-blur-sm border-slate-200/80 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20`;
  const premiumSelect = `${inputClass} bg-white/80 backdrop-blur-sm appearance-none cursor-pointer`;

  const renderCardHeader = (icon: React.ReactNode, title: string, badge?: string, gradient = 'from-indigo-500 to-purple-600') => (
    <div className={`flex items-center gap-3 mb-4 p-3 -m-5 -mt-5 mb-5 bg-gradient-to-r ${gradient} rounded-t-xl text-white`}>
      <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">{icon}</div>
      <h4 className="text-sm font-bold">{title}</h4>
      {badge && <span className="ml-auto text-[10px] bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-sm">{badge}</span>}
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden" onKeyDown={handleKeyDown}>
      {/* Premium Tabs */}
      <div className="relative flex items-center gap-0 shrink-0 flex-wrap border-b border-slate-200/80 -mx-4 px-4">
        {TABS.map(tab => (
          <button key={tab.key} type="button" onClick={() => goToStep(tab.key)}
            className={`shrink-0 px-4 py-3.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              currentStep === tab.key ? 'border-indigo-600 text-indigo-700 bg-gradient-to-b from-indigo-50/50 to-transparent' : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'
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
            <SectionComponent {...sectionProps[currentStep]} />
            {Object.keys(stepErrors).length > 0 && (
              <div className="mt-4 p-3 bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-xl" role="alert">
                <p className="text-xs font-semibold text-red-700 mb-1">Please fix the following:</p>
                <ul className="text-[11px] text-red-600 list-disc pl-4 space-y-0.5">
                  {Object.values(stepErrors).map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between shrink-0 mt-6">
              <button type="button" onClick={handleBackOrCancel}
                className="px-5 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all">
                {currentIndex === 0 ? 'Cancel' : 'Back'}
              </button>
              {currentIndex === steps.length - 1 ? (
                <button type="button" onClick={handleSave} disabled={saving || !isDirty}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-xs font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none flex items-center gap-2">
                  {saving ? 'Saving...' : <><Zap size={14} /> {item?.id ? 'Update Item' : 'Create Item'}</>}
                </button>
              ) : (
                <button type="button" onClick={handleNext} disabled={!canGoNext}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-xs font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none">
                  Next
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Premium Summary */}
        <div className="w-72 shrink-0 hidden lg:flex flex-col gap-4 overflow-y-auto custom-scrollbar min-h-0">
          <div className={`${premiumCard} sticky top-0 shadow-md border border-slate-200`}>
            <div className="p-4 -m-5 mb-4 bg-gradient-to-r from-slate-800 to-slate-700 rounded-t-xl">
              <div className="flex items-center gap-2 text-white mb-1">
                <Calculator size={14} />
                <h4 className="text-sm font-bold">Item Summary</h4>
              </div>
              <p className="text-slate-400 text-[10px]">{steps.indexOf(currentStep) + 1} of {steps.length} steps</p>
            </div>
            <SummarySidebar
              formData={formData}
              variants={variantsManager.variants}
              pricingValidation={pricingValidation}
              currentStep={currentStep}
              steps={steps}
              onUpdateField={updateField}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between shrink-0 pt-4 mt-4 border-t border-slate-200 -mx-4 px-4">
        <button type="button" onClick={onClose}
          className="px-5 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all">
          Cancel
        </button>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          {formData.name && <span className="text-indigo-600 font-medium">{formData.name}</span>}
          {pricingValidation && pricingValidation.profitMarkup > 0 && (
            <span className={pricingValidation.valid ? 'text-emerald-600' : 'text-amber-600'}>
              {pricingValidation.profitMarkup.toFixed(1)}% margin
            </span>
          )}
        </div>
      </div>

      <RecipeEditorModal
        open={recipeEditorOpen}
        onClose={() => setRecipeEditorOpen(false)}
        onSave={handleRecipeEditorSave}
        inventory={allItems || []}
        initialPages={(formData as ItemFormData & Record<string, unknown>).smartPricing?.pages as number | undefined || 1}
        initialPaperId={(formData as ItemFormData & Record<string, unknown>).smartPricing?.paperItemId as string | undefined || ''}
        initialTonerId={(formData as ItemFormData & Record<string, unknown>).smartPricing?.tonerItemId as string | undefined || ''}
        initialFinishingOptions={(formData as ItemFormData & Record<string, unknown>).smartPricing?.finishingOptions as FinishingOption[] | undefined || []}
      />
    </div>
  );
};

const TABS: { key: WizardStep; label: string; icon: React.ReactNode }[] = [
  { key: 'basic', label: 'Basic', icon: <FileText size={13} /> },
  { key: 'inventory', label: 'Inventory', icon: <Package size={13} /> },
  { key: 'units', label: 'Units', icon: <Scale size={13} /> },
  { key: 'variants', label: 'Variants', icon: <Layers size={13} /> },
  { key: 'pricing', label: 'Pricing', icon: <DollarSign size={13} /> },
  { key: 'printing', label: 'Printing', icon: <Printer size={13} /> },
  { key: 'recipe', label: 'Recipe', icon: <Beaker size={13} /> },
  { key: 'purchasing', label: 'Purchasing', icon: <ShoppingCart size={13} /> },
];
