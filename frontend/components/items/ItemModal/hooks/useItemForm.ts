import { useState, useCallback, useMemo } from 'react';
import type { Item } from '../../../../types';
import type { ValidationResult } from '../../../../services/pricingValidationService';
import type { ItemFormData, WizardStep } from '../types/itemFormTypes';
import { EMPTY_FORM, CLASSIFICATION_STEPS } from '../types/itemFormTypes';
import { formDataToItem, itemToFormData, calculatePricing } from '../services/itemFormService';
import { canProceed } from '../validation/itemValidation';

export function useItemForm(existingItem?: Item | null, currency?: string) {
  const [formData, setFormData] = useState<ItemFormData>(() => {
    if (existingItem) return itemToFormData(existingItem);
    return { ...EMPTY_FORM, ...(currency ? { currency } : {}) };
  });
  const [currentStep, setCurrentStep] = useState<WizardStep>('basic');
  const [isDirty, setIsDirty] = useState(false);

  const updateField = useCallback(<K extends keyof ItemFormData>(key: K, value: ItemFormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  const classification = formData.classification;

  const steps = useMemo(() => {
    const base = CLASSIFICATION_STEPS[classification];
    if (formData.variantsEnabled) {
      return base.filter(s => s !== 'pricing');
    }
    return base;
  }, [classification, formData.variantsEnabled]);

  const currentIndex = useMemo(() => steps.indexOf(currentStep), [steps, currentStep]);

  const canGoNext = useMemo(() => canProceed(formData, currentStep), [formData, currentStep]);

  const goNext = useCallback(() => {
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  }, [currentIndex, steps]);

  const goBack = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  }, [currentIndex, steps]);

  const goToStep = useCallback((step: WizardStep) => {
    if (steps.includes(step)) setCurrentStep(step);
  }, [steps]);

  const pricingValidation = useMemo((): ValidationResult | null => {
    if (formData.sellingPrice > 0) {
      return calculatePricing(formData.costPrice, formData.sellingPrice);
    }
    return null;
  }, [formData.costPrice, formData.sellingPrice]);

  const toItem = useCallback((id?: string): Item => {
    return formDataToItem(formData, id, existingItem);
  }, [formData, existingItem]);

  const reset = useCallback(() => {
    setFormData({ ...EMPTY_FORM, ...(currency ? { currency } : {}) });
    setCurrentStep('basic');
    setIsDirty(false);
  }, [currency]);

  const loadItem = useCallback((item: Item) => {
    setFormData(itemToFormData(item));
    setCurrentStep('basic');
    setIsDirty(false);
  }, []);

  return {
    formData,
    setFormData,
    currentStep,
    setCurrentStep,
    steps,
    currentIndex,
    canGoNext,
    isDirty,
    pricingValidation,
    updateField,
    goNext,
    goBack,
    goToStep,
    toItem,
    reset,
    loadItem,
  };
}
