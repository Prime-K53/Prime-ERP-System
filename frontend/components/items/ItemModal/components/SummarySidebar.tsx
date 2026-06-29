import React, { useState, useMemo } from 'react';
import type { ItemFormData } from '../types/itemFormTypes';
import type { ProductVariant } from '../../../../types';
import type { ValidationResult } from '../../../../services/pricingValidationService';
import { aiService } from '../../../../services/ai/aiService';
import { CLASSIFICATION_OPTIONS } from '../types/itemFormTypes';
import '../../../../views/inventory/inventory-reference.css';

const STOCK_TRACKED = new Set(['raw_material', 'consumable', 'product', 'stationery']);

interface Props {
  formData: ItemFormData;
  variants: ProductVariant[];
  pricingValidation: ValidationResult | null;
  currentStep: string;
  steps: string[];
  onUpdateField?: <K extends keyof ItemFormData>(key: K, value: ItemFormData[K]) => void;
}

function missingFields(data: ItemFormData): string[] {
  const missing: string[] = [];
  if (!data.code) missing.push('Code/SKU');
  if (!data.name) missing.push('Name');
  if (!data.classification) missing.push('Classification');
  if (STOCK_TRACKED.has(data.classification)) {
    if (!data.baseUnit) missing.push('Base Unit');
    if (data.classification === 'product' || data.classification === 'stationery') {
      if (data.costPrice <= 0) missing.push('Cost Price');
      if (data.sellingPrice <= 0) missing.push('Selling Price');
    }
  }
  if (data.classification === 'product' || data.classification === 'printing_service') {
    if (!data.recipeId) missing.push(data.classification === 'printing_service' ? 'Service Recipe' : 'BOM');
  }
  return missing;
}

const INV = {
  ink: 'var(--inv-ink)',
  ink2: 'var(--inv-ink-2)',
  paper: 'var(--inv-paper)',
  paper2: 'var(--inv-paper-2)',
  line: 'var(--inv-line)',
  text: 'var(--inv-text)',
  muted: 'var(--inv-muted)',
  stamp: 'var(--inv-stamp)',
  stampDark: 'var(--inv-stamp-dark)',
  green: 'var(--inv-press-green)',
  red: 'var(--inv-press-red)',
  redBg: 'var(--inv-press-red-bg)',
};

export const SummarySidebar: React.FC<Props> = ({ formData, variants, pricingValidation, currentStep, steps, onUpdateField }) => {
  const completeness = useMemo(() => {
    const checks: boolean[] = [!!formData.code, !!formData.name, !!formData.classification];
    if (STOCK_TRACKED.has(formData.classification)) {
      checks.push(!!formData.binLocation || !!formData.storageLocation, !!formData.baseUnit);
      if (formData.classification === 'product' || formData.classification === 'stationery') {
        checks.push(formData.costPrice > 0, formData.sellingPrice > 0);
      }
    }
    if (formData.classification === 'product' || formData.classification === 'printing_service') {
      checks.push(!!formData.recipeId);
    }
    const filled = checks.filter(Boolean).length;
    return { score: Math.round((filled / checks.length) * 100), total: checks.length, filled };
  }, [formData]);

  const missing = useMemo(() => missingFields(formData), [formData]);
  const classificationLabel = CLASSIFICATION_OPTIONS.find(o => o.value === formData.classification)?.label || formData.classification;

  const validationStatus = useMemo(() => {
    const issues: string[] = [];
    const isRaw = formData.classification === 'raw_material';
    if (!isRaw && (!pricingValidation || formData.sellingPrice <= 0)) {
      issues.push('Pricing not configured');
    } else if (!isRaw && !pricingValidation.valid) {
      issues.push(pricingValidation.message || 'Below minimum markup');
    }
    if (!formData.code) issues.push('Missing SKU');
    if (!formData.name) issues.push('Missing name');
    return issues;
  }, [formData, pricingValidation]);

  const isComplete = validationStatus.length === 0;

  const [aiLoading, setAiLoading] = useState<'pricing' | 'description' | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiDescription, setAiDescription] = useState<string | null>(null);

  const handlePricingInsight = async () => {
    setAiLoading('pricing');
    setAiInsight(null);
    try {
      const result = await aiService.suggestProductPricing(
        formData.name || 'item', formData.costPrice || 1, formData.category || 'General',
      );
      const rec = result?.suggestedPrice
        ? `Recommended: ${result.suggestedPrice?.toFixed?.(2) ?? result.suggestedPrice} (${result.margin?.toFixed?.(1) ?? '?'}% markup)`
        : result?.reasoning || 'Analysis complete';
      setAiInsight(rec + (result?.reasoning ? ` - ${result.reasoning}` : ''));
    } catch {
      setAiInsight('AI unavailable. Configure AI provider in Settings.');
    } finally {
      setAiLoading(null);
    }
  };

  const handleGenerateDescription = async () => {
    setAiLoading('description');
    setAiDescription(null);
    try {
      const prompt = `Generate a short professional product description for: name="${formData.name}", brand="${formData.brand}", category="${formData.category}", type="${formData.classification}", tags="${formData.tags}". 1-2 sentences only.`;
      const desc = await aiService.generateAIResponse(prompt);
      setAiDescription(desc);
    } catch {
      setAiDescription('AI unavailable.');
    } finally {
      setAiLoading(null);
    }
  };

  const applyDescription = () => {
    if (aiDescription && onUpdateField) {
      onUpdateField('description', aiDescription);
      setAiDescription(null);
    }
  };

  const convCount = (formData.conversions || []).length;
  const variantCount = variants.length;

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, lineHeight: 1.45, color: '#1E2A24' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 16, color: '#1E2A24', margin: 0, lineHeight: 1.4 }}>Item Summary</h2>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
          background: isComplete ? '#E9F1EA' : '#FBEAE8',
          color: isComplete ? '#128C72' : '#B23A34'
        }}>{isComplete ? 'Ready' : 'Incomplete'}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Completeness */}
      <div style={{ display: 'flex', gap: 8, padding: '6px 0' }}>
        <div>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6C766F', marginBottom: 2 }}>Completeness</span>
          <span style={{ display: 'block', fontSize: 22, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#1E2A24', lineHeight: 1.3 }}>{completeness.score}%</span>
          <span style={{ fontSize: 11, color: '#9CA59E' }}>{completeness.filled}/{completeness.total} fields filled</span>
        </div>
      </div>

      {/* Step Progress */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: '#6C766F' }}>Step Progress</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: '#6C766F' }}>{steps.indexOf(currentStep) + 1}/{steps.length}</span>
        </div>
        <div style={{ width: '100%', height: 6, background: '#F0EFEA', borderRadius: 3 }}>
          <div style={{ width: `${((steps.indexOf(currentStep) + 1) / steps.length) * 100}%`, height: 6, background: '#128C72', borderRadius: 3 }} />
        </div>
      </div>

      <div style={{ height: 1, background: '#E5E8E1', margin: '2px 0' }} />

      {/* Classification / Status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ padding: '8px 10px', background: '#F6F7F2', borderRadius: 6 }}>
          <span style={{ display: 'block', fontSize: 12, color: '#6C766F', marginBottom: 2, fontWeight: 500 }}>Classification</span>
          <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#1E2A24' }}>{classificationLabel}</span>
        </div>
        <div style={{ padding: '8px 10px', background: '#F6F7F2', borderRadius: 6 }}>
          <span style={{ display: 'block', fontSize: 12, color: '#6C766F', marginBottom: 2, fontWeight: 500 }}>Status</span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
            background: formData.status === 'Active' ? '#E9F1EA' : '#F6F7F2',
            color: formData.status === 'Active' ? '#128C72' : '#6C766F'
          }}>{formData.status}</span>
        </div>
      </div>

      {/* Code / Name */}
      <div style={{ padding: 10, background: '#F6F7F2', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div>
          <span style={{ fontSize: 11, color: '#6C766F', textTransform: 'uppercase', fontWeight: 500, letterSpacing: '0.03em' }}>Code</span>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#1E2A24' }}>{formData.code || <span style={{ color: '#9CA59E', fontStyle: 'italic' }}>-</span>}</span>
        </div>
        <div>
          <span style={{ fontSize: 11, color: '#6C766F', textTransform: 'uppercase', fontWeight: 500, letterSpacing: '0.03em' }}>Name</span>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1E2A24' }}>{formData.name || <span style={{ color: '#9CA59E', fontStyle: 'italic' }}>-</span>}</span>
        </div>
      </div>

      {/* Units */}
      <div style={{ padding: 10, background: '#F6F7F2', borderRadius: 6 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#1E2A24', margin: '0 0 6px', lineHeight: 1.45 }}>Units</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', fontSize: 12, lineHeight: 1.5 }}>
          <span style={{ color: '#6C766F', fontWeight: 400 }}>Base:</span>
          <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#1E2A24', fontWeight: 500 }}>{formData.baseUnit || <span style={{ color: '#9CA59E' }}>-</span>}</span>
          <span style={{ color: '#6C766F', fontWeight: 400 }}>Purchase:</span>
          <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#1E2A24', fontWeight: 500 }}>{formData.purchaseUnit || <span style={{ color: '#9CA59E' }}>-</span>}</span>
          <span style={{ color: '#6C766F', fontWeight: 400 }}>Sales:</span>
          <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#1E2A24', fontWeight: 500 }}>{formData.salesUnit || <span style={{ color: '#9CA59E' }}>-</span>}</span>
          <span style={{ color: '#6C766F', fontWeight: 400 }}>Consumption:</span>
          <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#1E2A24', fontWeight: 500 }}>{formData.consumptionUnit || <span style={{ color: '#9CA59E' }}>-</span>}</span>
          <span style={{ color: '#6C766F', fontWeight: 400 }}>Conversions:</span>
          <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#1E2A24', fontWeight: 500 }}>{convCount || 0}</span>
        </div>
      </div>

      {/* Recipe Link */}
      {(formData.classification === 'product' || formData.classification === 'printing_service') && (
        <div style={{ padding: 10, background: '#F6F7F2', borderRadius: 6 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#1E2A24', margin: '0 0 4px', lineHeight: 1.45 }}>{formData.classification === 'printing_service' ? 'Service Recipe' : 'BOM'}</p>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
            background: formData.recipeId ? '#E9F1EA' : '#FBEAE8',
            color: formData.recipeId ? '#128C72' : '#B23A34'
          }}>
            {formData.recipeId ? 'Linked' : 'Not linked'}
          </span>
          {formData.recipeType && formData.recipeType !== 'none' && (
            <p style={{ fontSize: 11, color: '#6C766F', marginTop: 4 }}>{formData.recipeType === 'bom' ? 'Bill of Materials' : 'Service Recipe'}</p>
          )}
        </div>
      )}

      {/* Variants */}
      {variantCount > 0 && (
        <div style={{ padding: '6px 0' }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#6C766F', display: 'block', marginBottom: 2 }}>Variants</span>
          <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#1E2A24' }}>{variantCount}</span>
        </div>
      )}

      {/* Pricing Card */}
      {(formData.costPrice > 0 || formData.sellingPrice > 0) && pricingValidation && (
        <div style={{ padding: 10, border: '1px solid #E5E8E1', borderRadius: 6, background: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1E2A24', lineHeight: 1.45 }}>Pricing</span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
              background: pricingValidation.valid ? '#E9F1EA' : '#FBEAE8',
              color: pricingValidation.valid ? '#128C72' : '#B23A34'
            }}>
              {pricingValidation.valid ? 'Validated' : 'Below Min'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px', fontSize: 12, lineHeight: 1.5 }}>
            <span style={{ color: '#6C766F', fontWeight: 400 }}>Cost</span>
            <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: '#1E2A24' }}>{formData.costPrice.toFixed(2)}</span>
            <span style={{ color: '#6C766F', fontWeight: 400 }}>Sell</span>
            <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: '#1E2A24' }}>{formData.sellingPrice.toFixed(2)}</span>
            <span style={{ color: '#6C766F', fontWeight: 400 }}>Profit</span>
            <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: pricingValidation.profit >= 0 ? '#128C72' : '#B23A34' }}>{pricingValidation.profit.toFixed(2)}</span>
            <span style={{ color: '#6C766F', fontWeight: 400 }}>Markup</span>
            <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: pricingValidation.profitMarkup >= pricingValidation.minimumMarkup ? '#128C72' : '#B23A34' }}>{pricingValidation.profitMarkup.toFixed(1)}%</span>
            <span style={{ color: '#6C766F', fontWeight: 400 }}>Min Markup</span>
            <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: '#6C766F' }}>{pricingValidation.minimumMarkup}%</span>
          </div>
          {!pricingValidation.valid && pricingValidation.message && (
            <p style={{ fontSize: 11, color: '#B23A34', marginTop: 6, lineHeight: 1.4 }}>{pricingValidation.message}</p>
          )}
        </div>
      )}

      {/* Validation Status */}
      <div style={{ padding: 10, borderRadius: 6, background: isComplete ? '#E9F1EA' : '#FBEAE8' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#1E2A24', lineHeight: 1.45 }}>Ready to Save</span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
            background: isComplete ? '#128C72' : '#B23A34',
            color: 'white'
          }}>
            {isComplete ? 'Ready' : 'Incomplete'}
          </span>
        </div>
        {missing.length > 0 && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#B23A34', marginBottom: 4, lineHeight: 1.4 }}>Missing:</p>
            <ul style={{ fontSize: 11, color: '#B23A34', margin: 0, paddingLeft: 14 }}>
              {missing.map(m => <li key={m} style={{ lineHeight: 1.5 }}>{m}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* AI Section */}
      <div style={{ height: 1, background: '#E5E8E1', margin: '2px 0' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#1E2A24', margin: 0, lineHeight: 1.45 }}>AI Features</p>

        <button type="button" onClick={handlePricingInsight} disabled={aiLoading === 'pricing'}
          style={{
            width: '100%', padding: '7px 12px', borderRadius: 7, border: '1px solid #E5E8E1',
            fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 500,
            color: '#1E2A24', background: 'white', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, lineHeight: 1.4
          }}>
          {aiLoading === 'pricing' ? (
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          ) : <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" /></svg>}
          <span>{aiLoading === 'pricing' ? 'Analyzing...' : 'AI Pricing Insight'}</span>
        </button>
        {aiInsight && (
          <div style={{ padding: 8, borderRadius: 6, border: '1px solid #E5E8E1', fontSize: 12, color: '#1E2A24', background: '#F6F7F2', lineHeight: 1.45 }}>{aiInsight}</div>
        )}

        <button type="button" onClick={handleGenerateDescription} disabled={aiLoading === 'description'}
          style={{
            width: '100%', padding: '7px 12px', borderRadius: 7, border: '1px solid #E5E8E1',
            fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 500,
            color: '#1E2A24', background: 'white', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, lineHeight: 1.4
          }}>
          {aiLoading === 'description' ? (
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          ) : <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
          <span>{aiLoading === 'description' ? 'Generating...' : 'Auto-Generate Description'}</span>
        </button>
        {aiDescription && (
          <div>
            <div style={{ padding: 8, borderRadius: 6, border: '1px solid #E5E8E1', fontSize: 12, color: '#1E2A24', background: '#F6F7F2', lineHeight: 1.45 }}>{aiDescription}</div>
            {onUpdateField && (
              <button type="button" onClick={applyDescription} style={{
                background: 'none', border: 'none', color: '#128C72', fontWeight: 600, fontSize: 12,
                cursor: 'pointer', padding: '4px 0', fontFamily: "'Inter',sans-serif", marginTop: 4
              }}>
                Apply to Description
              </button>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
};
