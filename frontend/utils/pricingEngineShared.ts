import { roundToCurrency } from './helpers';
import { dbService } from '../services/db';

type PricingAdjustmentLike = {
  name?: string;
  type?: string;
  value?: unknown;
  percentage?: unknown;
  calculatedAmount?: unknown;
  adjustmentId?: string;
  adjustmentCategory?: string;
  isActive?: boolean;
};

const isPercentageAdjustment = (type?: string, percentage?: unknown) => {
  return percentage !== undefined
    || type === 'PERCENTAGE'
    || type === 'PERCENT'
    || type === 'percentage';
};

export const normalizePricingSnapshot = (adjustment: PricingAdjustmentLike) => {
  const isPercent = isPercentageAdjustment(adjustment?.type, adjustment?.percentage);
  const value = Number(adjustment?.value);

  return {
    name: adjustment?.name || 'Adjustment',
    type: isPercent ? 'PERCENTAGE' : 'FIXED',
    value: Number.isFinite(value) ? value : 0,
    percentage: isPercent ? Number(adjustment?.percentage ?? adjustment?.value ?? 0) : undefined,
    calculatedAmount: roundToCurrency(Number(adjustment?.calculatedAmount) || 0),
    adjustmentId: adjustment?.adjustmentId,
    adjustmentCategory: adjustment?.adjustmentCategory,
    isActive: adjustment?.isActive !== false,
  };
};

export const normalizePricingSnapshots = (
  rawSnapshots: PricingAdjustmentLike[] | undefined,
  baseAmount?: number
) => {
  if (!rawSnapshots || rawSnapshots.length === 0) return [];

  return rawSnapshots.map((snapshot) => {
    const normalized = normalizePricingSnapshot(snapshot);
    if (baseAmount === undefined) {
      return normalized;
    }

    const calculatedAmount = normalized.type === 'PERCENTAGE'
      ? roundToCurrency((Number(baseAmount) || 0) * ((normalized.value || 0) / 100))
      : roundToCurrency(normalized.value || 0);

    return {
      ...normalized,
      calculatedAmount,
    };
  });
};

export const calculatePricingAdjustmentTotal = (
  snapshots: Array<{ calculatedAmount?: number }> | undefined
) => {
  return roundToCurrency(
    (snapshots || []).reduce((sum, snapshot) => sum + (snapshot.calculatedAmount || 0), 0)
  );
};

const VOLUME_TIERS_LOCAL_KEY = 'nexus_volume_discount_tiers';

export const DEFAULT_VOLUME_DISCOUNT_TIERS = [
  { minPages: 500, discountPercent: 25 },
  { minPages: 250, discountPercent: 15 },
  { minPages: 180, discountPercent: 10 },
];

export const getSavedVolumeDiscountTiers = (): Array<{ minPages: number; discountPercent: number }> => {
  try {
    const raw = localStorage.getItem(VOLUME_TIERS_LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return [];
  } catch {
    return [];
  }
};

export const saveVolumeDiscountTiers = async (
  tiers: Array<{ minPages: number; discountPercent: number }>
): Promise<void> => {
  try {
    await dbService.saveSetting(VOLUME_TIERS_LOCAL_KEY, tiers);
  } catch { /* non-fatal */ }
};

export const getVolumeDiscountTiers = (
  companyConfig?: any
): Array<{ minPages: number; discountPercent: number }> => {
  const saved = getSavedVolumeDiscountTiers();
  if (saved.length > 0) return saved;
  return companyConfig?.pricingSettings?.volumeDiscountTiers || DEFAULT_VOLUME_DISCOUNT_TIERS;
};

export const resolveVolumeMarginValue = (
  pages: number,
  tiers?: Array<{ minPages: number; discountPercent: number }>
): number => {
  const effectiveTiers = tiers || DEFAULT_VOLUME_DISCOUNT_TIERS;
  const sorted = [...effectiveTiers].sort((a, b) => b.minPages - a.minPages);
  for (const tier of sorted) {
    if (pages >= tier.minPages) return tier.discountPercent;
  }
  return 0;
};

export interface CostMaterialItem {
  cost_price?: number | null;
  cost_per_unit?: number | null;
  cost?: number | null;
  conversionRate?: number | null;
  conversion_rate?: number | null;
}

export interface FinishingOptionInput {
  enabled: boolean;
  price: number;
  batchSize?: number | null;
  items?: Array<{ itemId: string; quantity: number }>;
}

export interface MaterialCostInput {
  paper: CostMaterialItem | null | undefined;
  toner: CostMaterialItem | null | undefined;
  pages: number;
  copies: number;
  finishingOptions: FinishingOptionInput[];
  inventory?: Array<{ id: string; cost_price?: number | null; cost_per_unit?: number | null; cost?: number | null }>;
}

export interface MaterialCostResult {
  paperCost: number;
  tonerCost: number;
  finishingCost: number;
  finishingInventoryCost: number;
  baseCost: number;
}

const getItemUnitCost = (item: CostMaterialItem | null | undefined): number => {
  if (!item) return 0;
  return Number(item.cost_price ?? item.cost_per_unit ?? item.cost ?? 0);
};

const getItemConversionRate = (item: CostMaterialItem | null | undefined): number => {
  if (!item) return 500;
  return Number(item.conversionRate ?? item.conversion_rate ?? 500);
};

export function calculateMaterialCosts(input: MaterialCostInput): MaterialCostResult {
  let paperCostVal = 0;
  if (input.paper) {
    const sheetsPerCopy = Math.ceil(input.pages / 2);
    const totalSheetsVal = sheetsPerCopy * input.copies;
    const reamSize = getItemConversionRate(input.paper);
    const paperUnitCost = getItemUnitCost(input.paper);
    const costPerSheet = reamSize > 0 ? paperUnitCost / reamSize : 0;
    paperCostVal = Number((totalSheetsVal * costPerSheet).toFixed(2));
  }

  let tonerCostVal = 0;
  if (input.toner) {
    const capacity = 20000;
    const totalPagesVal = input.pages * input.copies;
    const tonerUnitCost = getItemUnitCost(input.toner);
    const costPerPage = tonerUnitCost / capacity;
    tonerCostVal = Number((totalPagesVal * costPerPage).toFixed(2));
  }

  const finishingCostVal = input.finishingOptions
    .filter(o => o.enabled)
    .reduce((sum, o) => {
      const chargeQty = o.batchSize ? Math.ceil(input.copies / o.batchSize) : input.copies;
      return sum + (o.price * chargeQty);
    }, 0);

  const finishingInventoryCostVal = input.finishingOptions
    .filter(o => o.enabled && o.items && o.items.length > 0)
    .reduce((sum, o) => {
      const optionInventoryCost = (o.items || []).reduce((itemSum, itemConfig) => {
        const item = (input.inventory || []).find(i => i.id === itemConfig.itemId);
        if (!item) return itemSum;
        const itemCost = Number(item.cost_price ?? item.cost_per_unit ?? item.cost ?? 0);
        return itemSum + (itemCost * itemConfig.quantity * input.copies);
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
}
