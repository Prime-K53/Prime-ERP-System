import type { Item, ProductVariant, Warehouse, Supplier } from '../../../../types';
import type { ItemFormData, ItemClassification } from '../types/itemFormTypes';
import { CLASSIFICATION_MAP } from '../types/itemFormTypes';
import { dbService } from '../../../../services/db';
import { inventoryResourceService } from '../../../../services/inventoryResourceService';
import { validateMinimumMarkup, resolveMinimumMarkup, type ValidationResult } from '../../../../services/pricingValidationService';
import type { ServiceRecipe } from '../../../../types/service';

const generateId = (): string =>
  'ITM-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase();

export function formDataToItem(data: ItemFormData, existingId?: string, originalItem?: Item | null): Item {
  const classification = CLASSIFICATION_MAP[data.classification];
  const id = existingId || generateId();

  const isBom = data.recipeType === 'bom';

  return {
    id,
    name: data.name,
    classification: data.classification,
    sku: data.code,
    barcode: data.barcode || undefined,
    qrCode: data.qrCode || undefined,
    type: classification.type,
    category: data.category || undefined,
    description: data.description || undefined,
    unit: data.baseUnit,
    cost: data.costPrice,
    cost_price: data.costPrice,
    costPrice: data.costPrice,
    price: data.sellingPrice,
    selling_price: data.sellingPrice,
    sellingPrice: data.sellingPrice,
    stock: originalItem?.stock ?? 0,
    status: data.status,
    productType: isBom ? 'MANUFACTURED' : classification.productType,
    inventoryRole: classification.inventoryRole,
    resourceSubtype: classification.resourceSubtype || data.resourceSubtype || undefined,
    costingMethod: data.costingMethod,
    consumptionUnit: data.consumptionUnit || undefined,
    conversionFactor: data.conversionRate > 0 ? data.conversionRate : undefined,
    purchaseUnit: data.purchaseUnit || undefined,
    usageUnit: data.issueUnit || undefined,
    salesUnit: data.salesUnit || undefined,
    normalizedCP: data.normalizedCP || data.costPrice,
    minStockLevel: data.minStockLevel,
    maxStockLevel: data.maxStockLevel,
    reorderPoint: data.reorderPoint,
    preferredSupplierId: data.preferredSupplierId || undefined,
    leadTimeDays: data.purchaseLeadTime,
    minOrderQty: data.minOrderQty,
    binLocation: data.binLocation || data.bin || undefined,
    serviceRecipeId: data.serviceRecipeId || undefined,
    printingServiceType: data.printingServiceType || undefined,
    printType: data.printType || undefined,
    printColorMode: data.printColorMode || undefined,
    printSides: data.printSides || 'single',
    printPaperSize: data.printPaperSize || undefined,
    printFinishing: data.printFinishing?.length ? data.printFinishing : undefined,
    estimatedTime: data.estimatedTime || 0,
    defaultMachine: data.defaultMachine || undefined,
    defaultLabor: data.defaultLabor || undefined,
    productionDepartment: data.productionDepartment || undefined,
    bomTemplateId: isBom ? data.recipeId : undefined,
    smartPricing: isBom ? { bomTemplateId: data.recipeId } : undefined,
    variants: data.variantsEnabled && data.variants.length > 0 ? data.variants : undefined,
    marginPercent: data.marginPercent,
    minimumMargin: data.minimumMargin,
    profitAmount: originalItem?.profitAmount ?? 0,
    profitMargin: originalItem?.profitMargin ?? 0,
    pricingValidated: originalItem?.pricingValidated ?? false,

    storageLocation: data.storageLocation || undefined,
    shelf: data.shelf || undefined,
    hazardous: data.hazardous || undefined,
    lotTracking: data.lotTracking || undefined,
    serialTracking: data.serialTracking || undefined,
    expirationTracking: data.expirationTracking || undefined,
    temperatureControlled: data.temperatureControlled || undefined,
    batchControlled: data.batchControlled || undefined,

    purchaseLotIds: originalItem?.purchaseLotIds ?? [],
    locationStock: data.warehouseId
      ? [{ warehouseId: data.warehouseId, quantity: (originalItem?.locationStock ?? []).find(ls => ls.warehouseId === data.warehouseId)?.quantity ?? 0 }]
      : originalItem?.locationStock ?? [],
  } as Item;
}

export function itemToFormData(item: Item): ItemFormData {
  const classification = determineClassification(item);
  const conversions = parseConversions(item);

  return {
    id: item.id || '',
    classification,
    code: item.sku || '',
    name: item.name || '',
    description: item.description || '',
    brand: item.brand || '',
    category: item.category || '',
    tags: item.tags || '',
    status: item.status || 'Active',

    inventoryRole: item.inventoryRole || 'sellable',
    resourceSubtype: item.resourceSubtype || '',
    warehouseId: parseWarehouseId(item),
    stockTracking: item.type !== 'Service',
    minStockLevel: item.minStockLevel || 0,
    maxStockLevel: item.maxStockLevel || 0,
    reorderPoint: item.reorderPoint || 0,
    costingMethod: item.costingMethod || 'weighted_average',

    baseUnit: item.unit || 'pcs',
    purchaseUnit: item.purchaseUnit || item.purchaseUnit || '',
    issueUnit: item.usageUnit || item.usageUnit || '',
    consumptionUnit: item.consumptionUnit || item.consumptionUnit || '',
    salesUnit: item.salesUnit || '',
    conversionRate: item.conversionFactor || item.conversionRate || 1,
    conversions,

    variantsEnabled: !!(item.variants && item.variants.length > 0),
    variants: item.variants || [],

    costPrice: item.costPrice || item.cost || 0,
    normalizedCP: item.normalizedCP || item.costPrice || item.cost || 0,
    sellingPrice: item.sellingPrice || item.price || 0,
    marginPercent: item.marginPercent || 0,
    minimumMargin: resolveMinimumMarkup(item),
    currency: item.currency || 'KWD',

    printingServiceType: item.printingServiceType || '',
    estimatedTime: item.estimatedTime || 0,
    defaultMachine: item.defaultMachine || '',
    defaultLabor: item.defaultLabor || '',
    productionDepartment: item.productionDepartment || '',
    serviceRecipeId: item.serviceRecipeId || '',
    printType: item.printType || '',
    printColorMode: item.printColorMode || '',
    printSides: item.printSides || 'single',
    printPaperSize: item.printPaperSize || '',
    printFinishing: item.printFinishing || [],

    recipeType: item.serviceRecipeId ? 'service_recipe' : ((item.productType === 'MANUFACTURED' || item.smartPricing?.bomTemplateId) ? 'bom' : 'none'),
    recipeId: item.serviceRecipeId || item.bomTemplateId || item.smartPricing?.bomTemplateId || '',
    productionType: item.productionType || '',
    recipeSteps: item.recipeSteps || 0,
    bomItems: item.bomItems || 0,
    wastePercentage: item.wastePercentage || 0,
    batchSize: item.batchSize || 0,
    leadTime: item.leadTime || 0,

    preferredSupplierId: item.preferredSupplierId || '',
    preferredSupplier: item.preferredSupplier || '',
    supplierCode: item.supplierCode || '',
    supplierLeadTime: item.supplierLeadTime || 0,
    purchaseLeadTime: item.leadTimeDays || 0,
    purchaseUnit2: item.purchaseUnit || item.purchaseUnit || '',
    minOrderQty: item.minOrderQty || 1,
    lastPurchaseCost: item.lastPurchaseCost || 0,
    lastPurchasePrice: item.lastPurchasePrice || 0,
    purchaseNotes: item.purchaseNotes || '',

    storageLocation: item.storageLocation || '',
    bin: item.bin || '',
    binLocation: item.binLocation || item.binLocation || '',
    shelf: item.shelf || '',
    handlingInstructions: item.handlingInstructions || '',
    shelfLife: item.shelfLife || 0,
    stackingFactor: item.stackingFactor || 1,
    hazardous: !!item.hazardous,
    lotTracking: !!item.lotTracking,
    serialTracking: !!item.serialTracking,
    expirationTracking: !!item.expirationTracking,
    temperatureControlled: !!item.temperatureControlled,
    batchControlled: !!item.batchControlled,
    barcode: item.barcode || '',
    qrCode: item.qrCode || '',

    internalNotes: item.internalNotes || '',
    publicDescription: item.description || '',
    attachments: item.attachments || [],
    notes: item.notes || [],
  };
}

function parseWarehouseId(item: Item): string {
  if (item.warehouseId) return item.warehouseId;
  if (item.locationStock && item.locationStock.length > 0) {
    return item.locationStock[0].warehouseId;
  }
  return '';
}

function parseConversions(item: Item): { fromUnit: string; toUnit: string; factor: number }[] {
  const existing = item.conversions;
  if (Array.isArray(existing) && existing.length > 0) return existing as { fromUnit: string; toUnit: string; factor: number }[];

  const unitConversions = item.unitConversions;
  if (Array.isArray(unitConversions) && unitConversions.length > 0) {
    return unitConversions.map((uc: Record<string, unknown>) => ({
      fromUnit: (uc.fromUnit as string) || (uc.purchaseUnit as string) || '',
      toUnit: (uc.toUnit as string) || (uc.consumptionUnit as string) || '',
      factor: (uc.factor as number) || (uc.conversionFactor as number) || 1,
    }));
  }

  if (item.conversionFactor && item.conversionFactor > 0 && item.purchaseUnit && item.unit) {
    return [{ fromUnit: item.purchaseUnit, toUnit: item.unit, factor: item.conversionFactor }];
  }

  return [];
}

function determineClassification(item: Item): ItemClassification {
  if (item.type === 'Raw Material') return 'raw_material';
  if (item.type === 'Material') return 'consumable';
  if (item.type === 'Stationery') return 'stationery';
  if (item.type === 'Service') {
    const itemExt = item as Record<string, unknown>;
    const hasPrintingFields = !!(itemExt.printType || itemExt.printingServiceType || itemExt.printColorMode || itemExt.printFinishing?.length);
    if (hasPrintingFields) return 'printing_service';
    if (item.productType === 'SERVICE') return 'printing_service';
    if (item.stock) return 'printing_service';
    return 'non_stock_service';
  }
  return 'product';
}

export function calculatePricing(
  costPrice: number,
  sellingPrice: number,
  item?: { category?: string; id?: string },
): ValidationResult {
  return validateMinimumMarkup(costPrice, sellingPrice, item);
}

export async function loadWarehouses(): Promise<Warehouse[]> {
  try {
    return await dbService.getAll<Warehouse>('warehouses');
  } catch {
    return [];
  }
}

export async function loadSuppliers(): Promise<Supplier[]> {
  try {
    return await dbService.getAll<Supplier>('suppliers');
  } catch {
    return [];
  }
}

export async function loadServiceRecipes(): Promise<ServiceRecipe[]> {
  try {
    const { serviceRecipeService } = await import('../../../../services/serviceRecipeService');
    return serviceRecipeService.getAllRecipes();
  } catch {
    return [];
  }
}

export async function loadBomTemplates(): Promise<Item[]> {
  try {
    const [inventoryItems, bomRecords] = await Promise.all([
      dbService.getAll<Item>('inventory'),
      dbService.getAll<Record<string, unknown>>('bomTemplates'),
    ]);
    const fromInventory = inventoryItems.filter((i: Item) => i.productType === 'MANUFACTURED' || i.bomItems);
    const bomIds = new Set(fromInventory.map((i: Item) => i.bomTemplateId || i.id).filter(Boolean));
    const fromBomStore = bomRecords.filter((b: Record<string, unknown>) => !bomIds.has(b.id as string));
    return [...fromInventory, ...fromBomStore] as Item[];
  } catch {
    return [];
  }
}

export async function saveItem(item: Item): Promise<void> {
  await dbService.put('inventory', item);
}
