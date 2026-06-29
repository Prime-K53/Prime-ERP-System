import { useState, useCallback, useEffect, useRef } from 'react';
import type { ProductVariant } from '../../../../types';
import type { ProductAttribute, AttributeValue } from '../../../../types/attributes';
import { calculateProfit, calculateMarkup, resolveMinimumMarkup } from '../../../../services/pricingValidationService';
import { generateAutoSKU } from '../../../../utils/skuGenerator';

const generateVariantId = (): string =>
  'VAR-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase();

function cartesianProduct<T>(...arrays: T[][]): T[][] {
  if (arrays.length === 0) return [];
  return arrays.reduce((a, b) => a.flatMap((d) => b.map((e) => [...d, e])), [[]] as T[][]);
}

export interface SelectedAttribute {
  attributeId: string;
  valueIds: string[];
}

export function useVariantManager(productId: string) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedAttributes, setSelectedAttributes] = useState<SelectedAttribute[]>([]);
  const [excludedVariantIds, setExcludedVariantIds] = useState<Set<string>>(new Set());
  const [baseCost, setBaseCost] = useState(0);
  const [basePrice, setBasePrice] = useState(0);
  const [allAttributes, setAllAttributes] = useState<ProductAttribute[]>([]);
  const [itemName, setItemName] = useState('');

  const itemNameRef = useRef(itemName);
  itemNameRef.current = itemName;

  const regenerateVariants = useCallback((
    attrs: SelectedAttribute[],
    allAttrs: ProductAttribute[],
    baseC: number,
    baseP: number,
    excluded: Set<string>,
    existingVariants: ProductVariant[],
  ) => {
    const enabledAttrs = attrs.filter((a) => a.valueIds.length > 0);
    if (enabledAttrs.length === 0) {
      setVariants([]);
      return;
    }

    const attrDefs = enabledAttrs
      .map((sa) => {
        const def = allAttrs.find((a) => a.id === sa.attributeId);
        if (!def) return null;
        const values = def.values.filter((v) => sa.valueIds.includes(v.id));
        return { def, values };
      })
      .filter(Boolean) as { def: ProductAttribute; values: AttributeValue[] }[];

    if (attrDefs.some((a) => a.values.length === 0)) {
      setVariants([]);
      return;
    }

    const valueArrays = attrDefs.map((a) => a.values);
    const combinations = cartesianProduct(...valueArrays);

    const existingMap = new Map<string, ProductVariant>();
    for (const v of existingVariants) {
      if (v._attributeKey) existingMap.set(v._attributeKey, v);
    }

    const newVariants: ProductVariant[] = [];
    const baseLabel = itemNameRef.current;
    const globalMinMargin = resolveMinimumMarkup();

    for (const combo of combinations) {
      const attrsRecord: Record<string, string> = {};
      let nameSuffix = '';
      let totalExtra = 0;

      combo.forEach((val: AttributeValue, idx: number) => {
        const attrName = attrDefs[idx].def.name;
        attrsRecord[attrName] = val.label;
        nameSuffix += (nameSuffix ? ' / ' : '') + val.label;
        totalExtra += val.extraPrice || 0;
      });

      const attrKey = combo.map((v: AttributeValue) => v.id).sort().join('_');
      const existing = existingMap.get(attrKey);

      if (existing) {
        newVariants.push({
          ...existing,
          attributes: attrsRecord,
        });
      } else {
        const variantId = generateVariantId();
        const variantName = baseLabel ? `${baseLabel} — ${nameSuffix}` : nameSuffix;
        const costPrice = baseC + totalExtra * 0.6;
        const sellingPrice = baseP + totalExtra;
        const profit = calculateProfit(costPrice, sellingPrice);
        const markup = calculateMarkup(costPrice, sellingPrice);

        newVariants.push({
          id: variantId,
          productId,
          name: variantName,
          sku: generateAutoSKU('VAR', variantName, attrsRecord),
          attributes: attrsRecord,
          costPrice,
          sellingPrice,
          profitAmount: profit,
          profitMargin: markup,
          minimumMargin: globalMinMargin,
          pricingValidated: markup >= globalMinMargin,
          stock: 0,
          pages: 1,
          active: !excluded.has(attrKey),
          _attributeKey: attrKey,
        });
      }
    }

    setVariants(newVariants);
  }, [productId]);

  const setSelectedAttributesAndGenerate = useCallback((
    attrs: SelectedAttribute[],
    allAttrs: ProductAttribute[],
    baseC: number,
    baseP: number,
    excluded: Set<string>,
  ) => {
    setSelectedAttributes(attrs);
    regenerateVariants(attrs, allAttrs, baseC, baseP, excluded, []);
  }, [regenerateVariants]);

  const updateBasePricing = useCallback((cost: number, price: number) => {
    setBaseCost(cost);
    setBasePrice(price);
  }, []);

  const setAvailableAttributes = useCallback((attrs: ProductAttribute[]) => {
    setAllAttributes(attrs);
  }, []);

  const setProductName = useCallback((name: string) => {
    setItemName(name);
  }, []);

  const addVariant = useCallback(() => {
    const globalMinMargin = resolveMinimumMarkup();
    const v: ProductVariant = {
      id: generateVariantId(),
      productId,
      name: '',
      sku: '',
      costPrice: 0,
      sellingPrice: 0,
      profitAmount: 0,
      profitMargin: 0,
      minimumMargin: globalMinMargin,
      pricingValidated: false,
      stock: 0,
      pages: 1,
      active: true,
    };
    setVariants((prev) => [...prev, v]);
  }, [productId]);

  const removeVariant = useCallback((id: string) => {
    setVariants((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const updateVariant = useCallback((id: string, patch: Partial<ProductVariant>) => {
    const globalMinMargin = resolveMinimumMarkup();
    setVariants((prev) =>
      prev.map((v) => {
        if (v.id !== id) return v;
        const merged = { ...v, ...patch };
        const cp = Number(merged.costPrice ?? 0);
        const sp = Number(merged.sellingPrice ?? 0);
        const recalc = 'costPrice' in patch || 'sellingPrice' in patch;
        const profit = recalc ? calculateProfit(cp, sp) : merged.profitAmount;
        const markup = recalc ? calculateMarkup(cp, sp) : merged.profitMargin;
        return {
          ...merged,
          costPrice: cp,
          sellingPrice: sp,
          profitAmount: profit,
          profitMargin: markup,
          pricingValidated: markup >= (merged.minimumMargin || globalMinMargin),
        };
      }),
    );
  }, []);

  const toggleExcludeVariant = useCallback((attrKey: string) => {
    setExcludedVariantIds((prev) => {
      const next = new Set(prev);
      if (next.has(attrKey)) {
        next.delete(attrKey);
      } else {
        next.add(attrKey);
      }
      return next;
    });
  }, []);

  const importVariants = useCallback((items: ProductVariant[]) => {
    if (items.length > 0 && items[0]._attributeKey) {
      const excluded = new Set<string>();
      for (const v of items) {
        if (!v.active && v._attributeKey) {
          excluded.add(v._attributeKey);
        }
      }
      setExcludedVariantIds(excluded);
    }
    setVariants(items);
  }, []);

  const reset = useCallback(() => {
    setVariants([]);
    setSelectedAttributes([]);
    setExcludedVariantIds(new Set());
    setBaseCost(0);
    setBasePrice(0);
    setAllAttributes([]);
    setItemName('');
  }, []);

  return {
    variants,
    selectedAttributes,
    excludedVariantIds,
    baseCost,
    basePrice,
    allAttributes,

    setSelectedAttributesAndGenerate,
    updateBasePricing,
    setAvailableAttributes,
    setProductName,
    addVariant,
    removeVariant,
    updateVariant,
    toggleExcludeVariant,
    importVariants,
    reset,
    setVariants,
  };
}
