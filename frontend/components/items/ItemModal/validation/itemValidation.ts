import type { ItemFormData } from '../types/itemFormTypes';
import { CLASSIFICATION_STEPS } from '../types/itemFormTypes';

export interface ValidationErrors {
  [key: string]: string;
}

export function validateStep(data: ItemFormData, step: string): ValidationErrors {
  switch (step) {
    case 'basic': return validateBasic(data);
    case 'inventory': return validateInventory(data);
    case 'units': return validateUnits(data);
    case 'variants': return validateVariants(data);
    case 'pricing': return validatePricing(data);
    case 'printing': return validatePrinting(data);
    case 'recipe': return validateRecipe(data);
    case 'purchasing': return validatePurchasing(data);
    default: return {};
  }
}

function validateBasic(data: ItemFormData): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!data.classification) errors.classification = 'Classification is required';
  if (!data.name.trim()) errors.name = 'Name is required';
  if (!data.code.trim()) errors.code = 'Code/SKU is required';
  return errors;
}

function validateInventory(data: ItemFormData): ValidationErrors {
  const errors: ValidationErrors = {};
  const steps = CLASSIFICATION_STEPS[data.classification];
  if (!steps.includes('inventory')) return errors;
  if (data.minStockLevel < 0) errors.minStockLevel = 'Cannot be negative';
  if (data.maxStockLevel < 0) errors.maxStockLevel = 'Cannot be negative';
  if (data.reorderPoint < 0) errors.reorderPoint = 'Cannot be negative';
  if (data.maxStockLevel > 0 && data.minStockLevel > data.maxStockLevel) {
    errors.minStockLevel = 'Min stock cannot exceed max stock';
  }
  return errors;
}

function validateUnits(data: ItemFormData): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!data.baseUnit.trim()) errors.baseUnit = 'Base unit is required';
  return errors;
}

function validateVariants(data: ItemFormData): ValidationErrors {
  const errors: ValidationErrors = {};
  const steps = CLASSIFICATION_STEPS[data.classification];
  if (!steps.includes('variants')) return errors;
  if (data.variantsEnabled && data.variants.length > 0) {
    const skus = new Set<string>();
    const names = new Set<string>();
    data.variants.forEach((v, i) => {
      if (!v.name.trim()) errors[`variant_${i}_name`] = `Variant ${i + 1} name is required`;
      if (!v.sku.trim()) errors[`variant_${i}_sku`] = `Variant ${i + 1} SKU is required`;
      if (skus.has(v.sku)) errors[`variant_${i}_sku_dup`] = `SKU "${v.sku}" is duplicated`;
      if (names.has(v.name)) errors[`variant_${i}_name_dup`] = `Name "${v.name}" is duplicated`;
      skus.add(v.sku);
      names.add(v.name);
      if (v.costPrice < 0) errors[`variant_${i}_cp`] = `Cost price cannot be negative`;
      if (v.sellingPrice < 0) errors[`variant_${i}_sp`] = `Selling price cannot be negative`;
    });
  }
  return errors;
}

function validatePricing(data: ItemFormData): ValidationErrors {
  const errors: ValidationErrors = {};
  const steps = CLASSIFICATION_STEPS[data.classification];
  if (!steps.includes('pricing')) return errors;
  if (data.costPrice < 0) errors.costPrice = 'Cost Price cannot be negative';
  if (data.sellingPrice < 0) errors.sellingPrice = 'Selling Price cannot be negative';
  if (data.costPrice === 0 && data.sellingPrice === 0) {
    const pricingRequired = ['product', 'stationery', 'printing_service'].includes(data.classification);
    if (pricingRequired) {
      errors.costPrice = 'Cost Price is required';
      errors.sellingPrice = 'Selling Price is required';
    }
  }
  if (data.minimumMargin < 0) errors.minimumMargin = 'Minimum margin cannot be negative';
  if (data.minimumMargin > 100) errors.minimumMargin = 'Minimum margin cannot exceed 100%';
  return errors;
}

function validatePrinting(data: ItemFormData): ValidationErrors {
  const errors: ValidationErrors = {};
  const steps = CLASSIFICATION_STEPS[data.classification];
  if (!steps.includes('printing')) return errors;
  if (!data.printType) errors.printType = 'Print type is required';
  if (!data.printColorMode) errors.printColorMode = 'Color mode is required';
  return errors;
}

function validateRecipe(data: ItemFormData): ValidationErrors {
  const errors: ValidationErrors = {};
  const steps = CLASSIFICATION_STEPS[data.classification];
  if (!steps.includes('recipe')) return errors;
  if (!data.recipeId) {
    if (data.classification === 'product') errors.recipeId = 'BOM is required for manufactured products';
    if (data.classification === 'printing_service') errors.recipeId = 'Service recipe is required for printing services';
  }
  return errors;
}

function validatePurchasing(data: ItemFormData): ValidationErrors {
  const errors: ValidationErrors = {};
  const steps = CLASSIFICATION_STEPS[data.classification];
  if (!steps.includes('purchasing')) return errors;
  if (data.minOrderQty < 1) errors.minOrderQty = 'Minimum order must be at least 1';
  if (data.purchaseLeadTime < 0) errors.purchaseLeadTime = 'Lead time cannot be negative';
  return errors;
}

export function canProceed(data: ItemFormData, step: string): boolean {
  const errors = validateStep(data, step);
  return Object.keys(errors).length === 0;
}
