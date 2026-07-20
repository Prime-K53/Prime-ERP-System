import React, { useState, useMemo } from 'react';
import { X, Copy, Printer, Calculator, FileText, TrendingUp, Sparkles, Package } from 'lucide-react';
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from './Dialog';

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
  open,
  onClose,
  type,
  pricePerPage,
  costPerPage,
  currency,
  onConfirm,
  pinningItem,
  staplePrice
}) => {
  const [quantity, setQuantity] = useState(1);
  const [pagesPerCopy, setPagesPerCopy] = useState(1);
  const [enableStapling, setEnableStapling] = useState(false);

  const totalPages = quantity * pagesPerCopy;
  const totalSheets = type === 'photocopy' ? quantity * Math.ceil(pagesPerCopy / 2) : totalPages;
  const printTotal = totalSheets * pricePerPage;
  const materialCost = costPerPage ? totalPages * costPerPage : 0;

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

  const handleConfirm = () => {
    if (pinningCost > 0) {
      onConfirm(quantity, pagesPerCopy, finalTotal, type, pinningCost, quantity);
    } else {
      onConfirm(quantity, pagesPerCopy, finalTotal, type, undefined, undefined);
    }
    setQuantity(1);
    setPagesPerCopy(1);
    setEnableStapling(false);
    onClose();
  };

  if (!open) return null;

  const cardClass = 'bg-white shadow-sm rounded-xl p-5';
  const inputClass = 'w-full px-3 py-2 rounded-lg border border-[#E2DED3] text-sm focus:outline-none transition-all duration-150';
  const premiumCard = `${cardClass} backdrop-blur-sm border border-[#E2DED3]/80 hover:border-[#D4CFC2]/80 transition-all duration-200`;
  const premiumInput = `${inputClass} bg-white/80 backdrop-blur-sm border-[#E2DED3]/80 focus:border-[#5FA8A0] focus:ring-2 focus:ring-[#5FA8A0]/20 tabular-nums`;
  const premiumLabel = 'block text-xs font-semibold text-[#2C6F67] mb-1.5 flex items-center gap-1.5';
  const toggleActiveBg = 'bg-[#3D8B82]';
  const toggleInactiveBg = 'bg-[#D4CFC2]';
  const isPhotocopy = type === 'photocopy';
  const accentGradient = isPhotocopy ? 'from-[#3D8B82] to-[#2C6F67]' : 'from-[#2C6F67] to-[#183F3B]';
  const iconBg = isPhotocopy ? 'bg-[#F0F7F6] text-[#2C6F67]' : 'bg-[#F0F7F6] text-[#2C6F67]';
  const Icon = isPhotocopy ? Copy : Printer;

  const renderCardHeader = (icon: React.ReactNode, title: string, badge?: string, gradient = 'from-[#2C6F67] to-[#183F3B]') => (
    <div className={`flex items-center gap-3 mb-4 p-3 -m-5 -mt-5 mb-5 bg-gradient-to-r ${gradient} rounded-t-xl text-white`}>
      <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
        {icon}
      </div>
      <h4 className="text-sm font-bold">{title}</h4>
      {badge && <span className="ml-auto text-[10px] bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-sm">{badge}</span>}
    </div>
  );

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogHeader className="flex items-center justify-between" style={{ padding: '12px 16px', borderBottom: '1px solid #E2DED3', background: 'white' }}>
        <div className="flex items-center gap-3">
          <div className={`w-[34px] h-[34px] rounded-[9px] flex items-center justify-center ${iconBg}`}>
            <Icon className="w-[18px] h-[18px]" />
          </div>
          <div>
            <DialogTitle style={{ fontSize: 20, color: '#23282A', margin: 0, lineHeight: 1.4 }}>
              {isPhotocopy ? 'Quick Photocopy' : 'Type & Printing'}
            </DialogTitle>
            <p style={{ fontSize: 13, color: '#8A8578', margin: 0, lineHeight: 1.45 }}>
              {currency}{pricePerPage} per {isPhotocopy ? 'sheet' : 'page'}
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} style={{ color: '#B8B2A2', padding: 6 }} aria-label="Close modal">
          <X className="w-5 h-5" />
        </button>
      </DialogHeader>

      <div className="space-y-4">
        <div className={premiumCard}>
          {renderCardHeader(<Calculator size={15} className="text-white" />, 'Order Details', isPhotocopy ? 'Double-sided' : 'Single-sided', accentGradient)}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={premiumLabel}><FileText size={12} /> Pages per Copy</label>
              <input type="number" min={1} value={pagesPerCopy} onChange={(e) => setPagesPerCopy(Math.max(1, parseInt(e.target.value) || 1))} className={premiumInput} />
            </div>
            <div>
              <label className={premiumLabel}><Package size={12} /> Number of Copies</label>
              <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} className={premiumInput} />
            </div>
          </div>
        </div>

        {effectiveStaplePrice !== null && (
          <div className={premiumCard}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-[#F7EFDF] text-[#B8863B]">
                  <Package size={14} />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#23282A]">Stapling</p>
                  <p className="text-[11px] text-[#8A8578]">{currency}{effectiveStaplePrice.toFixed(2)} per copy</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={enableStapling} onChange={e => setEnableStapling(e.target.checked)} className="sr-only peer" />
                <div className={`w-10 h-5 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#87C1BB] rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${enableStapling ? toggleActiveBg : toggleInactiveBg}`} />
              </label>
            </div>
            {enableStapling && (
              <div className="mt-3 pt-3 border-t border-[#F0EFE8]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8A8578]">Stapling ({currency}{effectiveStaplePrice.toFixed(2)} × {quantity} copies)</span>
                  <span className="font-mono font-medium text-[#23282A]">{currency}{pinningCost.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className={premiumCard}>
          {renderCardHeader(<TrendingUp size={15} className="text-white" />, 'Cost Summary', undefined, 'from-[#2C6F67] to-[#183F3B]')}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#8A8578]">Total {isPhotocopy ? 'Sheets' : 'Pages'}</span>
              <span className="font-mono font-medium text-[#23282A] tabular-nums">{isPhotocopy ? totalSheets : totalPages}</span>
            </div>
            {isPhotocopy && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#8A8578]">Total Pages <span className="text-[10px] text-[#B8B2A2]">(toner basis)</span></span>
                <span className="font-mono font-medium text-[#6B6659] tabular-nums">{totalPages}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#8A8578]">{isPhotocopy ? 'Sheet' : 'Page'} Cost</span>
              <span className="font-mono font-medium text-[#23282A] tabular-nums">{currency}{printTotal.toFixed(2)}</span>
            </div>
            {costPerPage ? (
              <>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#8A8578]">Toner Cost ({currency}{costPerPage.toFixed(2)}/pg)</span>
                  <span className="font-mono font-medium text-[#23282A] tabular-nums">{currency}{materialCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-[#2C6F67]">Estimated Profit</span>
                  <span className="font-mono font-medium text-[#2C6F67] tabular-nums">+{currency}{(finalTotal - materialCost).toFixed(2)}</span>
                </div>
              </>
            ) : null}
            {enableStapling && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#8A8578]">Stapling</span>
                <span className="font-mono font-medium text-[#23282A] tabular-nums">{currency}{pinningCost.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-[#E2DED3]">
              <span className="text-sm font-semibold text-[#23282A]">Total</span>
              <span className="font-mono font-bold text-[#2C6F67] tabular-nums" style={{ fontSize: 18 }}>{currency}{finalTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter className="flex items-center justify-between" style={{ borderTop: '1px solid #E2DED3' }}>
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[#E2DED3] text-xs font-medium text-[#6B6659] hover:bg-[#F8F7F2] hover:border-[#D4CFC2] transition-all">
          Cancel
        </button>
        <button type="button" onClick={handleConfirm} className="px-4 py-2 bg-gradient-to-br from-[#2C6F67] to-[#183F3B] text-white rounded-lg text-xs font-semibold hover:shadow-[0_4px_14px_rgba(44,111,103,0.35)] transition-all shadow-[0_4px_14px_rgba(44,111,103,0.25)] flex items-center gap-2">
          <Sparkles size={13} /> Add to Cart
        </button>
      </DialogFooter>
    </Dialog>
  );
};

export default QuickPrintModal;
