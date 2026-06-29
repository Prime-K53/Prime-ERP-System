import type { ItemType, Item, ProductVariant, InventoryRole, ResourceSubtype, CostingMethod, ProductType, PricingConfig } from '../../../../types';
import { resolveMinimumMarkup } from '../../../../services/pricingValidationService';

export type WizardStep =
  | 'basic'
  | 'inventory'
  | 'units'
  | 'variants'
  | 'pricing'
  | 'printing'
  | 'recipe'
  | 'purchasing';

export type ItemClassification =
  | 'raw_material'
  | 'consumable'
  | 'product'
  | 'stationery'
  | 'printing_service'
  | 'non_stock_service';

export const CLASSIFICATION_MAP: Record<ItemClassification, { type: ItemType; productType: ProductType; inventoryRole: InventoryRole; resourceSubtype?: ResourceSubtype }> = {
  raw_material: { type: 'Raw Material', productType: 'INVENTORY', inventoryRole: 'internal', resourceSubtype: 'raw_material' },
  consumable: { type: 'Material', productType: 'INVENTORY', inventoryRole: 'internal', resourceSubtype: 'consumable' },
  product: { type: 'Product', productType: 'MANUFACTURED', inventoryRole: 'sellable' },
  stationery: { type: 'Stationery', productType: 'INVENTORY', inventoryRole: 'both' },
  printing_service: { type: 'Service', productType: 'SERVICE', inventoryRole: 'sellable' },
  non_stock_service: { type: 'Service', productType: 'SERVICE', inventoryRole: 'sellable' },
};

export const CLASSIFICATION_OPTIONS: { value: ItemClassification; label: string; description: string }[] = [
  { value: 'raw_material', label: 'Raw Material', description: 'Base material consumed in production' },
  { value: 'consumable', label: 'Consumable', description: 'Supplies and consumable items' },
  { value: 'product', label: 'Product', description: 'Finished manufactured product' },
  { value: 'stationery', label: 'Stationery', description: 'Stationery with optional pack variants' },
  { value: 'printing_service', label: 'Printing Service', description: 'Printing / binding / finishing service' },
  { value: 'non_stock_service', label: 'Non-Stock Service', description: 'Service item, no inventory tracking' },
];

export const CLASSIFICATION_STEPS: Record<ItemClassification, WizardStep[]> = {
  raw_material: ['basic', 'inventory', 'units', 'pricing', 'purchasing'],
  consumable: ['basic', 'inventory', 'units', 'pricing', 'purchasing'],
  product: ['basic', 'inventory', 'units', 'recipe', 'pricing', 'variants'],
  stationery: ['basic', 'inventory', 'units', 'variants', 'pricing', 'purchasing'],
  printing_service: ['basic', 'printing', 'pricing', 'recipe', 'variants'],
  non_stock_service: ['basic', 'pricing'],
};

export interface ItemAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface ItemNote {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ItemFormData {
  id: string;
  classification: ItemClassification;
  code: string;
  name: string;
  description: string;
  brand: string;
  category: string;
  tags: string;
  status: 'Active' | 'Inactive' | 'Pending';

  inventoryRole: InventoryRole;
  resourceSubtype: ResourceSubtype | '';
  warehouseId: string;
  stockTracking: boolean;
  minStockLevel: number;
  maxStockLevel: number;
  reorderPoint: number;
  costingMethod: CostingMethod;

  baseUnit: string;
  purchaseUnit: string;
  issueUnit: string;
  consumptionUnit: string;
  salesUnit: string;
  conversionRate: number;
  conversions: { fromUnit: string; toUnit: string; factor: number }[];

  variantsEnabled: boolean;
  variants: ProductVariant[];

  costPrice: number;
  normalizedCP: number;
  sellingPrice: number;
  marginPercent: number;
  minimumMargin: number;
  currency: string;

  printingServiceType: string;
  estimatedTime: number;
  defaultMachine: string;
  defaultLabor: string;
  productionDepartment: string;
  serviceRecipeId: string;
  printType: string;
  printColorMode: string;
  printSides: string;
  printPaperSize: string;
  printFinishing: string[];

  recipeType: 'bom' | 'service_recipe' | 'none';
  recipeId: string;
  productionType: string;
  recipeSteps: number;
  bomItems: number;
  wastePercentage: number;
  batchSize: number;
  leadTime: number;

  preferredSupplierId: string;
  preferredSupplier: string;
  supplierCode: string;
  supplierLeadTime: number;
  purchaseLeadTime: number;
  purchaseUnit2: string;
  minOrderQty: number;
  lastPurchaseCost: number;
  lastPurchasePrice: number;
  purchaseNotes: string;

  storageLocation: string;
  bin: string;
  binLocation: string;
  shelf: string;
  handlingInstructions: string;
  shelfLife: number;
  stackingFactor: number;
  hazardous: boolean;
  lotTracking: boolean;
  serialTracking: boolean;
  expirationTracking: boolean;
  temperatureControlled: boolean;
  batchControlled: boolean;
  barcode: string;
  qrCode: string;

  internalNotes: string;
  publicDescription: string;
  attachments: ItemAttachment[];
  notes: ItemNote[];
}

export const EMPTY_FORM: ItemFormData = {
  id: '',
  classification: 'product',
  code: '',
  name: '',
  description: '',
  brand: '',
  category: '',
  tags: '',
  status: 'Active',

  inventoryRole: 'sellable',
  resourceSubtype: '',
  warehouseId: '',
  stockTracking: true,
  minStockLevel: 0,
  maxStockLevel: 0,
  reorderPoint: 0,
  costingMethod: 'weighted_average',

  baseUnit: 'pcs',
  purchaseUnit: '',
  issueUnit: '',
  consumptionUnit: '',
  salesUnit: '',
  conversionRate: 1,
  conversions: [],

  variantsEnabled: false,
  variants: [],

  costPrice: 0,
  normalizedCP: 0,
  sellingPrice: 0,
  marginPercent: 0,
  minimumMargin: resolveMinimumMarkup(),
  currency: 'KWD',

  printingServiceType: '',
  estimatedTime: 0,
  defaultMachine: '',
  defaultLabor: '',
  productionDepartment: '',
  serviceRecipeId: '',
  printType: '',
  printColorMode: '',
  printSides: 'single',
  printPaperSize: '',
  printFinishing: [],

  recipeType: 'none',
  recipeId: '',
  productionType: '',
  recipeSteps: 0,
  bomItems: 0,
  wastePercentage: 0,
  batchSize: 0,
  leadTime: 0,

  preferredSupplierId: '',
  preferredSupplier: '',
  supplierCode: '',
  supplierLeadTime: 0,
  purchaseLeadTime: 0,
  purchaseUnit2: '',
  minOrderQty: 1,
  lastPurchaseCost: 0,
  lastPurchasePrice: 0,
  purchaseNotes: '',

  storageLocation: '',
  bin: '',
  binLocation: '',
  shelf: '',
  handlingInstructions: '',
  shelfLife: 0,
  stackingFactor: 1,
  hazardous: false,
  lotTracking: false,
  serialTracking: false,
  expirationTracking: false,
  temperatureControlled: false,
  batchControlled: false,
  barcode: '',
  qrCode: '',

  internalNotes: '',
  publicDescription: '',
  attachments: [],
  notes: [],
};
