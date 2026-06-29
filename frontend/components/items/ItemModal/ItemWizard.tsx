import React, { useRef, useEffect, useCallback } from 'react';
import type { Item, FinishingOption } from '../../../types';
import type { WizardStep, ItemFormData } from './types/itemFormTypes';
import { useItemForm } from './hooks/useItemForm';
import { useVariantManager } from './hooks/useVariantManager';
import { useAttributeStore } from '../../../stores/attributeStore';
import { useConversionManager } from './hooks/useConversionManager';
import { useAuth } from '../../../context/AuthContext';
import '../../../views/inventory/inventory-reference.css';
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
import { generateSku } from '../../../utils/helpers';
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
  } = useItemForm(item, currency);

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
    return generateSku(category || 'GEN', allItems || []);
  }, [allItems]);

  const SectionComponent = SECTION_COMPONENTS[currentStep];

  const sectionProps: Record<string, unknown> = {
    basic: { data: formData, onChange: updateField, errors: stepErrors, onGenerateSku: handleGenerateSku, classificationReadOnly: lockClassification },
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
    },
    pricing: { data: formData, onChange: updateField, pricingValidation },
    printing: { data: formData, onChange: updateField },
    recipe: { data: formData, onChange: updateField, onOpenRecipeEditor: () => setRecipeEditorOpen(true), allItems: allItems },
    purchasing: { data: formData, onChange: updateField },
  };

  const handleBackOrCancel = currentIndex === 0 ? onClose : goBack;

  return (
    <div className="flex gap-6 flex-1 min-h-0 overflow-hidden" onKeyDown={handleKeyDown} style={{ fontFamily: "'Inter',sans-serif", fontSize: 13.5, lineHeight: 1.45, color: '#1E2A24' }}>
      {/* Left: Wizard Content */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0" role="region" aria-label="Item Wizard">
        {/* Step Indicator */}
        <nav className="flex items-center gap-0 mb-3 shrink-0 flex-wrap" style={{ borderBottom: '1px solid #E5E8E1' }} role="tablist" aria-label="Wizard steps">
          {steps.map((step, idx) => {
            const isActive = currentStep === step;
            const isPast = idx < currentIndex;
            const StepIcon = STEP_META[step]?.icon || '○';
            return (
              <button
                key={step}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`${STEP_META[step]?.label || step} step`}
                tabIndex={isActive || isPast ? 0 : -1}
                onClick={() => isPast && goToStep(step)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '7px 12px', marginBottom: '-1px',
                  fontFamily: "'Inter',sans-serif", fontWeight: isActive ? 600 : 500, fontSize: 13,
                  lineHeight: 1.45, letterSpacing: '0.01em',
                  color: isActive ? '#128C72' : isPast ? '#1E2A24' : '#9CA59E',
                  borderBottom: isActive ? '2px solid #128C72' : '2px solid transparent',
                  transition: 'color .12s'
                }}
              >
                <span aria-hidden="true" className="mr-1" style={{ fontSize: 11 }}>{StepIcon}</span>
                <span>{STEP_META[step]?.label || step}</span>
              </button>
            );
          })}
        </nav>

        {/* Section Content */}
        <div
          ref={contentRef}
          tabIndex={-1}
          className="flex-1 overflow-auto custom-scrollbar focus:outline-none min-h-0"
          style={{ borderRadius: 0, padding: 0, marginBottom: 0 }}
          role="tabpanel"
          aria-label={`${STEP_META[currentStep]?.label || currentStep} content`}
        >
          <SectionComponent {...sectionProps[currentStep]} />
          {Object.keys(stepErrors).length > 0 && (
            <div className="mt-4" style={{ padding: '8px 10px', background: '#FBEAE8', border: '1px solid #B23A34', borderRadius: '6px' }} role="alert">
              <p style={{ fontSize: 12, fontWeight: 600, color: '#B23A34', margin: '0 0 4px', lineHeight: 1.45 }}>Please fix the following:</p>
              <ul style={{ fontSize: 12, color: '#B23A34', margin: 0, paddingLeft: 14 }}>
                {Object.values(stepErrors).map((msg, i) => (
                  <li key={i} style={{ lineHeight: 1.45 }}>{msg}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between shrink-0" style={{ paddingTop: 12, marginTop: 12 }}>
          <button
            type="button"
            onClick={handleBackOrCancel}
            style={{
              padding: '7px 14px', borderRadius: 7, border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 500,
              color: '#3B453F', background: 'white', cursor: 'pointer', lineHeight: 1.4
            }}
            aria-label={currentIndex === 0 ? 'Cancel and close' : 'Go to previous step'}
          >
            {currentIndex === 0 ? 'Cancel' : 'Back'}
          </button>
          <div className="flex items-center gap-2">
            {currentIndex === steps.length - 1 ? (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !isDirty}
                style={{
                  padding: '7px 14px', borderRadius: 7, border: 'none',
                  fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600,
                  color: 'white', background: saving || !isDirty ? '#9CA59E' : '#128C72',
                  cursor: saving || !isDirty ? 'not-allowed' : 'pointer', lineHeight: 1.4,
                  display: 'flex', alignItems: 'center', gap: 6
                }}
                aria-label={saving ? 'Saving item' : item?.id ? 'Update item' : 'Create item'}
              >
                {saving ? 'Saving...' : item?.id ? 'Update Item' : 'Create Item'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canGoNext}
                style={{
                  padding: '7px 14px', borderRadius: 7, border: 'none',
                  fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600,
                  color: 'white', background: canGoNext ? '#128C72' : '#9CA59E',
                  cursor: canGoNext ? 'pointer' : 'not-allowed', lineHeight: 1.4,
                  display: 'flex', alignItems: 'center', gap: 6
                }}
                aria-label="Go to next step"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right: Summary Panel */}
      <div className="w-72 shrink-0 hidden lg:flex flex-col overflow-y-auto custom-scrollbar min-h-0" role="complementary" aria-label="Item summary">
        <SummarySidebar
          formData={formData}
          variants={variantsManager.variants}
          pricingValidation={pricingValidation}
          currentStep={currentStep}
          steps={steps}
          onUpdateField={updateField}
        />
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

const STEP_META: Record<WizardStep, { label: string; icon: string }> = {
  basic: { label: 'Basic', icon: '◎' },
  inventory: { label: 'Inventory', icon: '▤' },
  units: { label: 'Units', icon: '⚖' },
  variants: { label: 'Variants', icon: '✦' },
  pricing: { label: 'Pricing', icon: '₿' },
  printing: { label: 'Printing', icon: '⎙' },
  recipe: { label: 'Recipe', icon: '⚗' },
  purchasing: { label: 'Purchasing', icon: '↔' },
};
