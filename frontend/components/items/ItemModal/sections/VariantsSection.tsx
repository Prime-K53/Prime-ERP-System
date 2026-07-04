import React, { useEffect, useMemo } from 'react';
import type { ProductVariant } from '../../../../types';
import type { ProductAttribute, AttributeValue } from '../../../../types/attributes';
import type { ItemClassification } from '../types/itemFormTypes';
import { calculateMarkup, resolveMinimumMarkup } from '../../../../services/pricingValidationService';
import { Layers, X, Plus } from 'lucide-react';

interface Props {
  variants: ProductVariant[];
  selectedAttributes: { attributeId: string; valueIds: string[] }[];
  excludedVariantIds: Set<string>;
  allAttributes: ProductAttribute[];
  baseCost: number;
  basePrice: number;
  recipeCost: number;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<ProductVariant>) => void;
  onAttributeSelect: (attrId: string, valueIds: string[]) => void;
  onToggleExclude: (attrKey: string) => void;
  onBaseCostChange: (cost: number) => void;
  onBasePriceChange: (price: number) => void;
  onRegenerate: () => void;
  errors: Record<string, string>;
  classification?: ItemClassification;
  basePages?: number;
}

const isProduct = (c?: ItemClassification) => c === 'product';

const supportsAttributeVariants = (c?: ItemClassification) => c === 'product' || c === 'stationery' || c === 'printing_service';

const showPages = (c?: ItemClassification) => isProduct(c) || c === 'printing_service';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 9px', borderRadius: 6,
  border: '1px solid #E5E8E1',
  fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 400,
  color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45,
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 500, color: '#6C766F', marginBottom: 3, lineHeight: 1.4,
};

const readonlyStyle: React.CSSProperties = {
  width: '100%', padding: '6px 9px', borderRadius: 6, fontSize: 12, fontWeight: 400,
  fontFamily: "'IBM Plex Mono','Courier New',monospace",
  color: '#6C766F', background: '#F6F7F2', lineHeight: 1.45, border: '1px solid #E5E8E1',
};

const monoValueStyle: React.CSSProperties = {
  ...readonlyStyle,
  fontWeight: 600,
  color: '#1E2A24',
};

export const VariantsSection: React.FC<Props> = ({
  variants,
  selectedAttributes,
  excludedVariantIds,
  allAttributes,
  baseCost,
  basePrice,
  recipeCost,
  onAdd,
  onRemove,
  onUpdate,
  onAttributeSelect,
  onToggleExclude,
  onBaseCostChange,
  onBasePriceChange,
  onRegenerate,
  errors,
  classification,
  basePages = 1,
}) => {
  const hasAttributesSelected = selectedAttributes.some((a) => a.valueIds.length > 0);

  const handleToggleValue = (attrId: string, valueId: string) => {
    const sa = selectedAttributes.find((a) => a.attributeId === attrId);
    const currentIds = sa?.valueIds || [];
    const nextIds = currentIds.includes(valueId)
      ? currentIds.filter((id) => id !== valueId)
      : [...currentIds, valueId];
    onAttributeSelect(attrId, nextIds);
  };

  const generatedVariants = useMemo(() => {
    return variants.filter((v) => v._attributeKey);
  }, [variants]);

  const manualVariants = useMemo(() => {
    return variants.filter((v) => !v._attributeKey);
  }, [variants]);

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 13.5, lineHeight: 1.45, color: '#1E2A24' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 600, color: '#1E2A24', margin: 0, lineHeight: 1.4 }}>Variants</h3>
          <p style={{ fontSize: 12, color: '#6C766F', margin: '2px 0 0', lineHeight: 1.45 }}>Select attributes to auto-generate variant combinations</p>
        </div>
      </div>

      {supportsAttributeVariants(classification) && allAttributes.length === 0 && (
        <div style={{ borderRadius: 12, padding: 12, background: '#FFF3E0', border: '1px solid #FFE0B2' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#B76E00', margin: 0, lineHeight: 1.45 }}>No attributes defined</p>
          <p style={{ fontSize: 12, color: '#B76E00', margin: '4px 0 0', lineHeight: 1.45 }}>
            Go to Settings → Product Data → Attributes to create attributes like Size, Color, Material before adding variants.
          </p>
        </div>
      )}

      {supportsAttributeVariants(classification) && allAttributes.length > 0 && (
        <div style={{ borderRadius: 12, padding: 12, background: 'white', border: '1px solid #E5E8E1', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1E2A24' }}>Select Attributes</span>
            <button
              type="button"
              onClick={onRegenerate}
              style={{ fontSize: 12, fontWeight: 600, background: 'none', border: 'none', color: '#128C72', cursor: 'pointer', lineHeight: 1.45 }}
            >
              Regenerate Variants
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 10 }}>
            {allAttributes.map((attr) => {
              const sa = selectedAttributes.find((a) => a.attributeId === attr.id);
              const selectedIds = sa?.valueIds || [];

              return (
                <div key={attr.id} style={{ borderRadius: 7, padding: 10, border: '1px solid #E5E8E1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#6C766F' }}>{attr.name}</span>
                    <span style={{ fontSize: 12, color: '#9CA59E' }}>
                      {selectedIds.length}/{attr.values.length} selected
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {attr.values.map((val) => {
                      const isSelected = selectedIds.includes(val.id);
                      return (
                        <button
                          key={val.id}
                          type="button"
                          onClick={() => handleToggleValue(attr.id, val.id)}
                          style={{
                            padding: '4px 9px', fontSize: 12, fontWeight: 500, borderRadius: 6,
                            border: isSelected ? 'none' : '1px solid #E5E8E1',
                            background: isSelected ? '#128C72' : 'white',
                            color: isSelected ? 'white' : '#6C766F',
                            cursor: 'pointer', lineHeight: 1.45
                          }}
                        >
                          {val.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2" style={{ gap: 10, paddingTop: 8, marginTop: 10, borderTop: '1px solid #E5E8E1' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 3, lineHeight: 1.45 }}>Base Cost</label>
              <input
                type="number"
                min={0}
                step="any"
                value={baseCost}
                onChange={(e) => onBaseCostChange(Number(e.target.value))}
                style={{
                  width: '100%', padding: '6px 9px', borderRadius: 6,
                  border: '1px solid #E5E8E1',
                  fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 400,
                  color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 3, lineHeight: 1.45 }}>Base Price</label>
              <input
                type="number"
                min={0}
                step="any"
                value={basePrice}
                onChange={(e) => onBasePriceChange(Number(e.target.value))}
                style={{
                  width: '100%', padding: '6px 9px', borderRadius: 6,
                  border: '1px solid #E5E8E1',
                  fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 400,
                  color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
                }}
              />
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 480, overflowY: 'auto', paddingRight: 4 }}>
        {generatedVariants.map((v, idx) => {
          const cp = Number(v.costPrice ?? 0);
          const sp = Number(v.sellingPrice ?? 0);
          const markup = calculateMarkup(cp, sp);
          const globalMinMargin = resolveMinimumMarkup();
          const minMargin = v.minimumMargin || globalMinMargin;
          const isValid = markup >= minMargin;
          const attrKey = v._attributeKey || '';
          const isExcluded = excludedVariantIds.has(attrKey);

          return (
            <div
              style={{
                borderRadius: 12, padding: 12,
                border: isExcluded ? '1px solid #B23A34' : '1px solid #E5E8E1',
                background: isExcluded ? '#FBEAE8' : 'white'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#9CA59E' }}>#{idx + 1}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1E2A24' }}>{v.name}</span>
                  {isExcluded && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 999, background: '#FBEAE8', color: '#B23A34' }}>Excluded</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(v.id)}
                  style={{ fontSize: 12, fontWeight: 600, background: 'none', border: 'none', color: '#9CA59E', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                >
                  <X size={14} />
                </button>
              </div>

              {v.attributes && Object.keys(v.attributes).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                  {Object.entries(v.attributes).map(([k, val]) => (
                    <span key={k} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 999, background: '#F6F7F2', color: '#6C766F', lineHeight: 1.4 }}>
                      {k}: {String(val)}
                    </span>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-5" style={{ gap: 8 }}>
                <div>
                  <label style={labelStyle}>SKU</label>
                  <div style={readonlyStyle}>{v.sku || '\u2014'}</div>
                </div>
                {showPages(classification) && (
                  <div>
                    <label style={labelStyle}>Pages</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={v.pages ?? 1}
                      onChange={(e) => {
                        const pages = Math.max(1, parseInt(e.target.value) || 1);
                        const unitCost = recipeCost > 0 && basePages > 0 ? recipeCost / basePages : 0;
                        const newCP = unitCost > 0 ? Math.round(unitCost * pages * 100) / 100 : cp;
                        onUpdate(v.id, { pages, costPrice: newCP });
                      }}
                      style={inputStyle}
                    />
                  </div>
                )}
                <div>
                  <label style={labelStyle}>CP</label>
                  <div style={monoValueStyle}>
                    {cp.toFixed(2)}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>SP</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={v.sellingPrice}
                    onChange={(e) => onUpdate(v.id, { sellingPrice: Number(e.target.value) })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Markup</label>
                  <div style={{
                    width: '100%', padding: '6px 9px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    display: 'flex', alignItems: 'center',
                    background: cp > 0 ? (isValid ? '#E9F1EA' : '#FBEAE8') : '#F6F7F2',
                    color: cp > 0 ? (isValid ? '#128C72' : '#B23A34') : '#9CA59E',
                    lineHeight: 1.45
                  }}>
                    {cp > 0 ? `${markup.toFixed(1)}%` : '\u2014'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginTop: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', lineHeight: 1.45 }}>
                  <input
                    type="checkbox"
                    checked={!isExcluded}
                    onChange={() => onToggleExclude(attrKey)}
                    style={{ borderRadius: 3, accentColor: '#128C72', margin: 0 }}
                  />
                  <span style={{ color: '#6C766F' }}>{isExcluded ? 'Disabled' : 'Active'}</span>
                </label>
              </div>
            </div>
          );
        })}

        {supportsAttributeVariants(classification) && !hasAttributesSelected && manualVariants.length === 0 && (
          <div style={{ textAlign: 'center', padding: '28px 0' }}>
            <Layers size={36} style={{ color: '#9CA59E', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 13, fontStyle: 'italic', color: '#9CA59E', margin: 0, lineHeight: 1.45 }}>Select attributes above to generate variants, or add one manually</p>
          </div>
        )}

        {!supportsAttributeVariants(classification) && variants.length === 0 && (
          <div style={{ textAlign: 'center', padding: '28px 0' }}>
            <Layers size={36} style={{ color: '#9CA59E', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 13, fontStyle: 'italic', color: '#9CA59E', margin: 0, lineHeight: 1.45 }}>No variants added yet</p>
          </div>
        )}

        {manualVariants.length > 0 && (
          <div style={{ paddingTop: 6 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#6C766F', margin: '0 0 8px', lineHeight: 1.45 }}>Manual Variants</p>
            {manualVariants.map((v, idx) => {
              const cp = Number(v.costPrice ?? 0);
              const sp = Number(v.sellingPrice ?? 0);
              const markup = calculateMarkup(cp, sp);
              const globalMinMargin = resolveMinimumMarkup();
              const isValid = markup >= (v.minimumMargin || globalMinMargin);

              return (
                <div key={v.id} style={{ borderRadius: 12, padding: 12, border: '1px solid #E5E8E1', background: 'white', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#9CA59E' }}>Manual #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => onRemove(v.id)}
                      style={{ fontSize: 12, fontWeight: 600, background: 'none', border: 'none', color: '#9CA59E', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="grid grid-cols-2 sm:grid-cols-5" style={{ gap: 8 }}>
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={labelStyle}>Name</label>
                        <input
                          type="text"
                          value={v.name}
                          onChange={(e) => onUpdate(v.id, { name: e.target.value })}
                          style={inputStyle}
                          placeholder="e.g. Custom variant"
                        />
                      </div>
                      {showPages(classification) && (
                        <div>
                          <label style={labelStyle}>Pages</label>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={v.pages ?? 1}
                          onChange={(e) => {
                            const pages = Math.max(1, parseInt(e.target.value) || 1);
                            const unitCost = recipeCost > 0 && basePages > 0 ? recipeCost / basePages : 0;
                            const newCP = unitCost > 0 ? Math.round(unitCost * pages * 100) / 100 : Number(v.costPrice ?? 0);
                            onUpdate(v.id, { pages, costPrice: newCP });
                          }}
                            style={inputStyle}
                          />
                        </div>
                      )}
                      <div>
                        <label style={labelStyle}>CP</label>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={v.costPrice}
                          onChange={(e) => onUpdate(v.id, { costPrice: Number(e.target.value) })}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>SP</label>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={v.sellingPrice}
                          onChange={(e) => onUpdate(v.id, { sellingPrice: Number(e.target.value) })}
                          style={inputStyle}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, maxWidth: 120 }}>
                        <label style={labelStyle}>Markup</label>
                        <div style={{
                          width: '100%', padding: '6px 9px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                          display: 'flex', alignItems: 'center',
                          background: cp > 0 ? (isValid ? '#E9F1EA' : '#FBEAE8') : '#F6F7F2',
                          color: cp > 0 ? (isValid ? '#128C72' : '#B23A34') : '#9CA59E',
                          lineHeight: 1.45
                        }}>
                          {cp > 0 ? `${markup.toFixed(1)}%` : '\u2014'}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginTop: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', lineHeight: 1.45 }}>
                      <input
                        type="checkbox"
                        checked={v.active}
                        onChange={(e) => onUpdate(v.id, { active: e.target.checked })}
                        style={{ borderRadius: 3, accentColor: '#128C72', margin: 0 }}
                      />
                      <span style={{ color: '#6C766F' }}>Active</span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 10 }}>
        <button
          type="button"
          onClick={onAdd}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 12px', fontSize: 12, fontWeight: 600, borderRadius: 7,
            border: 'none', background: '#128C72', color: 'white', cursor: 'pointer', lineHeight: 1.45
          }}
        >
          <Plus size={14} />
          Add Manual Variant
        </button>
      </div>
    </div>
  );
};
