import React, { useEffect } from 'react';
import type { ItemFormData } from '../types/itemFormTypes';
import { validateMinimumMarkup } from '../../../../services/pricingValidationService';
import { useAuth } from '../../../../context/AuthContext';

interface Props {
  data: ItemFormData;
  onChange: <K extends keyof ItemFormData>(key: K, value: ItemFormData[K]) => void;
  pricingValidation?: { valid: boolean; profit: number; profitMarkup: number; minimumMarkup: number; message?: string } | null;
}

export const PricingSection: React.FC<Props> = ({ data, onChange, pricingValidation }) => {
  const { companyConfig } = useAuth();
  const settingsCurrency = companyConfig?.currencySymbol || 'KWD';
  const isRawMaterial = data.classification === 'raw_material';

  useEffect(() => {
    if (!data.currency || data.currency === 'KWD') {
      onChange('currency', settingsCurrency);
    }
  }, [settingsCurrency]);

  const displayValidation = pricingValidation || (data.sellingPrice > 0
    ? validateMinimumMarkup(data.costPrice, data.sellingPrice, {})
    : null);

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 13.5, lineHeight: 1.45, color: '#1E2A24' }}>
      <h3 style={{ fontSize: 20, fontWeight: 600, color: '#1E2A24', margin: '0 0 14px', lineHeight: 1.4 }}>Pricing</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Cost Price</label>
          <input
            type="number"
            min={0}
            step="any"
            value={data.costPrice}
            onChange={e => onChange('costPrice', Number(e.target.value))}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
          />
        </div>
        {!isRawMaterial && (
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Selling Price</label>
            <input
              type="number"
              min={0}
              step="any"
              value={data.sellingPrice}
              onChange={e => onChange('sellingPrice', Number(e.target.value))}
              style={{
                width: '100%', padding: '7px 10px', borderRadius: 7,
                border: '1px solid #E5E8E1',
                fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
                color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
              }}
            />
          </div>
        )}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 5, lineHeight: 1.45 }}>Currency</label>
          <input
            type="text"
            value={data.currency}
            onChange={e => onChange('currency', e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 7,
              border: '1px solid #E5E8E1',
              fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 400,
              color: '#1E2A24', background: 'white', outline: 'none', lineHeight: 1.45
            }}
            placeholder={settingsCurrency}
          />
        </div>
      </div>

      {!isRawMaterial && displayValidation && (
        <div style={{
          borderRadius: 12, padding: 14,
          background: displayValidation.valid ? '#E9F1EA' : '#FBEAE8',
          border: `1px solid ${displayValidation.valid ? '#128C72' : '#B23A34'}`
        }}>
          <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 10, fontSize: 13 }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#6C766F', display: 'block', marginBottom: 2 }}>Profit</span>
              <p style={{ fontWeight: 600, color: '#1E2A24', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{displayValidation.profit.toFixed(2)}</p>
            </div>
            <div>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#6C766F', display: 'block', marginBottom: 2 }}>Markup</span>
              <p style={{ fontWeight: 600, color: displayValidation.valid ? '#128C72' : '#B23A34', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                {displayValidation.profitMarkup.toFixed(1)}%
              </p>
            </div>
            <div>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#6C766F', display: 'block', marginBottom: 2 }}>Min Markup</span>
              <p style={{ fontWeight: 600, color: '#1E2A24', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{displayValidation.minimumMarkup}%</p>
            </div>
            <div>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#6C766F', display: 'block', marginBottom: 2 }}>Status</span>
              <p style={{ fontWeight: 600, color: displayValidation.valid ? '#128C72' : '#B23A34', margin: 0 }}>
                {displayValidation.valid ? 'Valid' : 'Below Minimum'}
              </p>
            </div>
          </div>
          {!displayValidation.valid && displayValidation.message && (
            <p style={{ fontSize: 12, color: '#B23A34', margin: '6px 0 0', lineHeight: 1.4 }}>{displayValidation.message}</p>
          )}
        </div>
      )}
    </div>
  );
};
