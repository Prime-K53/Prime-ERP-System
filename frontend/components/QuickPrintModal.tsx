import React, { useState, useMemo } from 'react';
import { Copy, Printer, Sparkles } from 'lucide-react';
import { Dialog } from './Dialog';

interface QuickPrintModalProps {
  open: boolean;
  onClose: () => void;
  type: 'photocopy' | 'printing';
  pricePerPage: number;
  costPerPage?: number;
  currency: string;
  staplePrice?: number;
  onConfirm: (quantity: number, pages: number, total: number, type: 'photocopy' | 'printing', pinningCost?: number, pinningCount?: number) => void;
  pinningItem?: {
    costPerUnit: number;
    conversionRate: number;
    materialId?: string;
  } | null;
}

const QuickPrintModal: React.FC<QuickPrintModalProps> = ({
  open, onClose, type, pricePerPage, costPerPage, currency,
  onConfirm, pinningItem, staplePrice
}) => {
  const [quantity, setQuantity] = useState(1);
  const [pagesPerCopy, setPagesPerCopy] = useState(1);
  const [enableStapling, setEnableStapling] = useState(false);
  const [pricingMethod, setPricingMethod] = useState<'per_page' | 'per_sheet'>(type === 'photocopy' ? 'per_sheet' : 'per_page');

  const totalPages = quantity * pagesPerCopy;
  const totalSheets = type === 'photocopy' ? quantity * Math.ceil(pagesPerCopy / 2) : totalPages;
  const printTotal = (type === 'photocopy' ? totalSheets : (pricingMethod === 'per_page' ? totalPages : totalSheets)) * pricePerPage;
  const materialCost = costPerPage ? (pricingMethod === 'per_page' ? totalPages : totalSheets) * costPerPage : 0;

  const effectiveStaplePrice = useMemo(() => {
    if (typeof staplePrice === 'number' && staplePrice > 0) return staplePrice;
    if (pinningItem && pinningItem.conversionRate > 0) {
      return pinningItem.costPerUnit / pinningItem.conversionRate;
    }
    return null;
  }, [staplePrice, pinningItem]);

  const pinningCost = useMemo(() => {
    if (!enableStapling || !effectiveStaplePrice) return 0;
    return Number((quantity * effectiveStaplePrice).toFixed(2));
  }, [quantity, enableStapling, effectiveStaplePrice]);

  const finalTotal = printTotal + pinningCost;
  const profit = finalTotal - materialCost;
  const profitMarginPct = materialCost > 0 ? ((profit / materialCost) * 100).toFixed(1) : '—';

  const handleConfirm = () => {
    if (pinningCost > 0) {
      onConfirm(quantity, pagesPerCopy, finalTotal, type, pinningCost, quantity);
    } else {
      onConfirm(quantity, pagesPerCopy, finalTotal, type, undefined, undefined);
    }
    setQuantity(1);
    setPagesPerCopy(1);
    setEnableStapling(false);
    setPricingMethod(type === 'photocopy' ? 'per_sheet' : 'per_page');
    onClose();
  };

  if (!open) return null;

  const isPhotocopy = type === 'photocopy';
  const Icon = isPhotocopy ? Copy : Printer;
  const ink900 = '#16191c', ink700 = '#3a4046', ink500 = '#6b7178', ink300 = '#aeb3b8', line = '#e7e5e1', canvas = '#eeece7', amber = '#b8742f', good = '#3f7d52', goodTint = '#eef6ef';

  const fc = (v: number) => `${currency}${v.toFixed(2)}`;

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <div className="-m-4">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 20px 14px 20px', borderBottom: `1px solid ${line}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: canvas, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ink700 }}>
              <Icon size={18} />
            </div>
            <div>
              <div style={{ fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: amber, marginBottom: 4 }}>
                {isPhotocopy ? 'Photocopy Service' : 'Printing Service'}
              </div>
              <div style={{ fontSize: 19, color: ink900, lineHeight: 1.1, fontWeight: 700 }}>
                {isPhotocopy ? 'Quick Photocopy' : 'Type & Printing'}
              </div>
              <div style={{ fontSize: 12.5, color: ink500, marginTop: 3 }}>
                {fc(pricePerPage)} per {type === 'photocopy' ? 'sheet' : (pricingMethod === 'per_page' ? 'page' : 'sheet')}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: 'transparent', color: ink500, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginTop: 2 }}
            onMouseOver={e => { e.currentTarget.style.background = canvas; e.currentTarget.style.color = ink900; }}
            onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = ink500; }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Two-column body */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr' }}>
          {/* Left column — Inputs */}
          <div className="custom-scrollbar" style={{ padding: '16px 20px', maxHeight: '64vh', overflowY: 'auto' }}>

            <div style={{ fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: ink500, marginBottom: 9 }}>Quantities</div>
            <div style={{ display: 'flex', border: `1px solid ${line}`, borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ flex: 1, padding: '8px 10px', borderRight: `1px solid ${line}` }}>
                <div style={{ fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: ink500, marginBottom: 3 }}>Pages per Copy</div>
                <input type="number" min={1} value={pagesPerCopy}
                  onChange={e => setPagesPerCopy(Math.max(1, parseInt(e.target.value || '1', 10) || 1))}
                  style={{ border: 'none', padding: 0, fontSize: 14, fontWeight: 700, color: ink900, width: '100%', background: 'transparent', outline: 'none' }} />
              </div>
              <div style={{ flex: 1, padding: '8px 10px', background: canvas, textAlign: 'center' }}>
                <div style={{ fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: ink500, marginBottom: 3 }}>Copies</div>
                <input type="number" min={1} value={quantity}
                  onChange={e => setQuantity(Math.max(1, parseInt(e.target.value || '1', 10) || 1))}
                  style={{ border: 'none', padding: 0, fontSize: 14, fontWeight: 700, color: ink900, width: '100%', background: 'transparent', outline: 'none', textAlign: 'center' }} />
              </div>
            </div>

            <div style={{ fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: ink500, marginBottom: 9 }}>Pricing Method</div>
            <div style={{ display: 'flex', border: `1px solid ${line}`, borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
              <button type="button" onClick={() => setPricingMethod('per_page')}
                style={{ flex: 1, padding: '8px 10px', border: 'none', cursor: 'pointer', textAlign: 'center', fontSize: 12, fontWeight: 600, fontFamily: "inherit", background: pricingMethod === 'per_page' ? ink900 : '#fff', color: pricingMethod === 'per_page' ? '#fff' : ink700, transition: 'all .12s' }}>
                Per Page
              </button>
              <button type="button" onClick={() => setPricingMethod('per_sheet')}
                style={{ flex: 1, padding: '8px 10px', border: 'none', cursor: 'pointer', textAlign: 'center', fontSize: 12, fontWeight: 600, fontFamily: "inherit", background: pricingMethod === 'per_sheet' ? ink900 : '#fff', color: pricingMethod === 'per_sheet' ? '#fff' : ink700, transition: 'all .12s' }}>
                Per Sheet
              </button>
            </div>

            {effectiveStaplePrice !== null && (
              <>
                <div style={{ fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: ink500, marginBottom: 9 }}>Finishing Options</div>
                <button type="button" onClick={() => setEnableStapling(!enableStapling)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', background: enableStapling ? '#fbf2e6' : canvas, transition: 'all .12s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: enableStapling ? amber : ink300 }}></div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: ink900 }}>Stapling</span>
                  </div>
                  <span style={{ fontSize: 11, color: enableStapling ? amber : ink500 }}>{fc(effectiveStaplePrice)}/copy</span>
                </button>
                {enableStapling && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', fontSize: 12.5 }}>
                    <span style={{ color: ink500 }}>Stapling ({fc(effectiveStaplePrice)} × {quantity})</span>
                    <span style={{ fontWeight: 600, color: ink900 }}>{fc(pinningCost)}</span>
                  </div>
                )}
              </>
            )}

          </div>

          {/* Vertical divider */}
          <div style={{ background: line }}></div>

          {/* Right column — Costing */}
          <div className="custom-scrollbar" style={{ padding: '16px 20px', maxHeight: '64vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: ink500, marginBottom: 9 }}>Cost Breakdown</div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', fontSize: 12.5 }}>
              <span style={{ color: ink500 }}>Total {pricingMethod === 'per_page' ? 'Pages' : 'Sheets'}</span>
              <span style={{ fontWeight: 600, color: ink900 }}>{pricingMethod === 'per_page' ? totalPages : totalSheets}</span>
            </div>
            {pricingMethod !== 'per_page' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', fontSize: 12.5 }}>
                <span style={{ color: ink500 }}>Total Pages <span style={{ fontSize: 10, color: ink300 }}>(toner basis)</span></span>
                <span style={{ fontWeight: 600, color: ink500 }}>{totalPages}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', fontSize: 12.5 }}>
              <span style={{ color: ink500 }}>{pricingMethod === 'per_page' ? 'Page' : 'Sheet'} Cost</span>
              <span style={{ fontWeight: 600, color: ink900 }}>{fc(printTotal)}</span>
            </div>

            {costPerPage ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', fontSize: 12.5 }}>
                  <span style={{ color: ink500 }}>Toner Cost ({fc(costPerPage)}/pg)</span>
                  <span style={{ fontWeight: 600, color: ink900 }}>{fc(materialCost)}</span>
                </div>
                <div style={{ borderTop: `1px dashed ${line}`, margin: '4px 0' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', fontSize: 12.5 }}>
                  <span style={{ color: ink500 }}>Cost Price</span>
                  <span style={{ fontWeight: 600, color: ink900 }}>{fc(materialCost)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', fontSize: 12.5 }}>
                  <span style={{ color: ink500 }}>Selling Price</span>
                  <span style={{ fontWeight: 600, color: ink900 }}>{fc(printTotal)}</span>
                </div>
                {enableStapling && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', fontSize: 12.5 }}>
                    <span style={{ color: ink500 }}>Stapling</span>
                    <span style={{ fontWeight: 600, color: ink900 }}>{fc(pinningCost)}</span>
                  </div>
                )}
                <div style={{ background: goodTint, borderRadius: 8, padding: '9px 12px', marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 11.5, color: good, fontWeight: 700 }}>
                    Profit <span>+{fc(profit)}</span>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: good, background: '#fff', padding: '3px 9px', borderRadius: 999 }}>{profitMarginPct}% margin</div>
                </div>
              </>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px 18px 20px', borderTop: `1px solid ${line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: ink500 }}>Total Due</div>
            <div style={{ fontSize: 23, color: ink900, lineHeight: 1.15, fontWeight: 700 }}>{fc(finalTotal)}</div>
            <div style={{ fontSize: 10, color: ink500 }}>
              {totalPages} page{totalPages !== 1 ? 's' : ''} · {totalSheets} sheet{totalSheets !== 1 ? 's' : ''} · {fc(quantity > 0 ? finalTotal / quantity : 0)}/copy
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={onClose}
              style={{ border: `1px solid ${line}`, borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#fff', color: ink700, whiteSpace: 'nowrap', transition: 'all .15s' }}
              onMouseOver={e => e.currentTarget.style.background = canvas}
              onMouseOut={e => e.currentTarget.style.background = '#fff'}>
              Cancel
            </button>
            <button onClick={handleConfirm}
              style={{ border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: ink900, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap', transition: 'all .15s', fontFamily: "inherit" }}
              onMouseOver={e => e.currentTarget.style.background = '#000'}
              onMouseOut={e => e.currentTarget.style.background = ink900}>
              <Sparkles size={14} /> Add to Cart
            </button>
          </div>
        </div>

      </div>
    </Dialog>
  );
};

export default QuickPrintModal;
