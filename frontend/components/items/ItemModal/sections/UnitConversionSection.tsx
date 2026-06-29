import React from 'react';
import type { ItemFormData } from '../types/itemFormTypes';
import type { Conversion } from '../hooks/useConversionManager';

interface Props {
  data: ItemFormData;
  onChange: <K extends keyof ItemFormData>(key: K, value: ItemFormData[K]) => void;
  conversions?: Conversion[];
  onAddConversion?: () => void;
  onRemoveConversion?: (id: string) => void;
  onUpdateConversion?: (id: string, patch: Partial<Conversion>) => void;
}

export const UnitConversionSection: React.FC<Props> = ({
  data, onChange,
  conversions = [], onAddConversion, onRemoveConversion, onUpdateConversion,
}) => {
  const hasConversionManager = !!(onAddConversion && onRemoveConversion && onUpdateConversion);

  const allUnits = [data.baseUnit, data.purchaseUnit, data.issueUnit, data.consumptionUnit, data.salesUnit]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);

  const hasDuplicates = (fromUnit: string, toUnit: string, excludeId?: string): boolean => {
    return conversions.some(c =>
      c.id !== excludeId &&
      ((c.fromUnit === fromUnit && c.toUnit === toUnit) ||
       (c.fromUnit === toUnit && c.toUnit === fromUnit)),
    );
  };

  const hasCircular = (fromUnit: string, toUnit: string): boolean => {
    if (!fromUnit || !toUnit) return false;
    const chain = new Set<string>();
    const walk = (unit: string, target: string): boolean => {
      if (unit === target) return true;
      if (chain.has(unit)) return false;
      chain.add(unit);
      return conversions.some(c =>
        (c.fromUnit === unit && walk(c.toUnit, target)) ||
        (c.toUnit === unit && walk(c.fromUnit, target)),
      );
    };
    return walk(fromUnit, toUnit) || walk(toUnit, fromUnit);
  };

  const validateConversion = (c: Conversion): string | null => {
    if (!c.fromUnit.trim()) return 'From unit is required';
    if (!c.toUnit.trim()) return 'To unit is required';
    if (c.fromUnit === c.toUnit) return 'Cannot convert to the same unit';
    if (c.factor <= 0) return 'Conversion factor must be positive';
    if (hasDuplicates(c.fromUnit, c.toUnit, c.id)) return 'Duplicate conversion already exists';
    if (hasCircular(c.fromUnit, c.toUnit)) return 'Circular conversion detected';
    return null;
  };

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 13.5, lineHeight: 1.45, color: '#1E2A24' }}>
      <h3 style={{ fontSize: 20, fontWeight: 600, color: '#1E2A24', margin: '0 0 14px', lineHeight: 1.4 }}>Units & Conversions</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Base Unit</label>
          <input
            type="text"
            value={data.baseUnit}
            onChange={e => onChange('baseUnit', e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
            placeholder="e.g. Sheet, pcs, kg"
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Purchase Unit</label>
          <input
            type="text"
            value={data.purchaseUnit}
            onChange={e => onChange('purchaseUnit', e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
            placeholder="e.g. Ream, Box"
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Issue Unit</label>
          <input
            type="text"
            value={data.issueUnit}
            onChange={e => onChange('issueUnit', e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
            placeholder="e.g. Sheet"
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Consumption Unit</label>
          <input
            type="text"
            value={data.consumptionUnit}
            onChange={e => onChange('consumptionUnit', e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
            placeholder="e.g. Sheet"
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Sales Unit</label>
          <input
            type="text"
            value={data.salesUnit}
            onChange={e => onChange('salesUnit', e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
            placeholder="e.g. Each"
          />
        </div>
      </div>

      {/* Multiple Conversions */}
      <div style={{ borderTop: '1px solid #E5E8E1', paddingTop: 12, marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#6C766F' }}>Unit Conversions</label>
          {hasConversionManager && (
            <button
              type="button"
              onClick={onAddConversion}
              style={{
                padding: '7px 12px', fontSize: 12, fontWeight: 600, borderRadius: 7,
                border: 'none', background: '#128C72', color: 'white', cursor: 'pointer', lineHeight: 1.45
              }}
            >
              + Add Conversion
            </button>
          )}
        </div>

        {!hasConversionManager && data.purchaseUnit && data.baseUnit && (
          <div style={{ borderRadius: 12, padding: 10, background: '#F6F7F2', color: '#6C766F', fontSize: 13 }}>
            1 {data.purchaseUnit} = {data.conversionRate} {data.baseUnit}
          </div>
        )}

        {conversions.length === 0 ? (
          <p style={{ fontSize: 13, fontStyle: 'italic', padding: '14px 0', textAlign: 'center', color: '#9CA59E', margin: 0 }}>No conversions defined</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {conversions.map((conv) => {
              const error = validateConversion(conv);
              const isPurchasing = conv.fromUnit === data.purchaseUnit || conv.toUnit === data.purchaseUnit;
              const isSelling = conv.fromUnit === data.salesUnit || conv.toUnit === data.salesUnit;
              const isConsuming = conv.fromUnit === data.consumptionUnit || conv.toUnit === data.consumptionUnit;

              return (
                <div key={conv.id} style={{
                  borderRadius: 12, padding: 10,
                  border: error ? '1px solid #B23A34' : '1px solid #E5E8E1',
                  background: error ? '#FBEAE8' : 'white'
                }}>
                  <div className="grid grid-cols-3" style={{ gap: 6 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#6C766F', marginBottom: 3, lineHeight: 1.4 }}>From</label>
                      <input
                        type="text"
                        value={conv.fromUnit}
                        onChange={e => onUpdateConversion?.(conv.id, { fromUnit: e.target.value })}
                        list="unit-suggestions"
                        style={{
                          width: '100%', padding: '5px 8px', borderRadius: 6,
                          border: '1px solid #E5E8E1',
                          fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 400,
                          color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
                        }}
                        placeholder="Unit"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#6C766F', marginBottom: 3, lineHeight: 1.4 }}>To</label>
                      <input
                        type="text"
                        value={conv.toUnit}
                        onChange={e => onUpdateConversion?.(conv.id, { toUnit: e.target.value })}
                        list="unit-suggestions"
                        style={{
                          width: '100%', padding: '5px 8px', borderRadius: 6,
                          border: '1px solid #E5E8E1',
                          fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 400,
                          color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
                        }}
                        placeholder="Unit"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#6C766F', marginBottom: 3, lineHeight: 1.4 }}>Factor</label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={conv.factor}
                        onChange={e => onUpdateConversion?.(conv.id, { factor: Number(e.target.value) })}
                        style={{
                          width: '100%', padding: '5px 8px', borderRadius: 6,
                          border: '1px solid #E5E8E1',
                          fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 400,
                          color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
                        }}
                      />
                    </div>
                  </div>

                  {error && (
                    <p style={{ fontSize: 11, color: '#B23A34', margin: '4px 0 0', lineHeight: 1.4 }}>{error}</p>
                  )}

                  {!error && conv.fromUnit && conv.toUnit && (
                    <p style={{ fontSize: 11, color: '#6C766F', margin: '4px 0 0', lineHeight: 1.4 }}>
                      1 {conv.fromUnit} = {conv.factor} {conv.toUnit}
                      {isPurchasing && <span style={{ marginLeft: 6, fontWeight: 600, color: '#128C72' }}>Purchasing</span>}
                      {isSelling && <span style={{ marginLeft: 6, fontWeight: 600, color: '#128C72' }}>Selling</span>}
                      {isConsuming && <span style={{ marginLeft: 6, fontWeight: 600, color: '#B76E00' }}>Consumption</span>}
                    </p>
                  )}

                  {onRemoveConversion && (
                    <button
                      type="button"
                      onClick={() => onRemoveConversion(conv.id)}
                      style={{
                        fontSize: 11, fontWeight: 600, color: '#9CA59E',
                        background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', lineHeight: 1.4
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <datalist id="unit-suggestions">
          {allUnits.map(u => <option key={u} value={u} />)}
        </datalist>
      </div>
    </div>
  );
};
