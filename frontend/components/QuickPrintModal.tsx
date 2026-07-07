import React, { useState, useMemo } from 'react';
import { X, Copy, Printer, Calculator, FileText, TrendingUp, Sparkles, Package } from 'lucide-react';

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
  const inputClass = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none transition-all duration-150';
  const premiumCard = `${cardClass} backdrop-blur-sm border border-slate-200/80 hover:border-slate-300/80 transition-all duration-200`;
  const premiumInput = `${inputClass} bg-white/80 backdrop-blur-sm border-slate-200/80 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 tabular-nums`;
  const premiumLabel = 'block text-xs font-semibold text-indigo-700 mb-1.5 flex items-center gap-1.5';
  const toggleActiveBg = 'bg-gradient-to-r from-indigo-500 to-purple-600';
  const toggleInactiveBg = 'bg-slate-300';
  const isPhotocopy = type === 'photocopy';
  const accentGradient = isPhotocopy ? 'from-slate-600 to-slate-500' : 'from-blue-600 to-indigo-600';
  const iconBg = isPhotocopy ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-600';
  const Icon = isPhotocopy ? Copy : Printer;

  const renderCardHeader = (icon: React.ReactNode, title: string, badge?: string, gradient = 'from-indigo-500 to-purple-600') => (
    <div className={`flex items-center gap-3 mb-4 p-3 -m-5 -mt-5 mb-5 bg-gradient-to-r ${gradient} rounded-t-xl text-white`}>
      <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
        {icon}
      </div>
      <h4 className="text-sm font-bold">{title}</h4>
      {badge && <span className="ml-auto text-[10px] bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-sm">{badge}</span>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(22,32,27,.5)' }} role="dialog" aria-modal="true">
      <div className="bg-white rounded-[16px] w-full max-w-md max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(15,30,25,.04), 0 6px 18px rgba(15,30,25,.05)', fontFamily: "'Inter',sans-serif", fontSize: 13.5, lineHeight: 1.45, color: '#1E2A24' }}>
        <div className="flex items-center justify-between shrink-0" style={{ padding: '12px 16px', borderBottom: '1px solid #E5E8E1', background: 'white' }}>
          <div className="flex items-center gap-3">
            <div className={`w-[34px] h-[34px] rounded-[9px] flex items-center justify-center ${iconBg}`}>
              <Icon className="w-[18px] h-[18px]" />
            </div>
            <div>
              <h2 className="font-bold" style={{ fontSize: 20, color: '#1E2A24', margin: 0, lineHeight: 1.4 }}>
                {isPhotocopy ? 'Quick Photocopy' : 'Type & Printing'}
              </h2>
              <p style={{ fontSize: 13, color: '#6C766F', margin: 0, lineHeight: 1.45 }}>
                {currency}{pricePerPage} per {isPhotocopy ? 'sheet' : 'page'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ color: '#9CA59E', padding: 6 }} aria-label="Close modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden min-h-0" style={{ padding: '14px 16px' }}>
          <div className="flex-1 overflow-auto custom-scrollbar min-h-0 space-y-4">
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
                    <div className="p-1.5 rounded-lg bg-amber-100 text-amber-600">
                      <Package size={14} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">Stapling</p>
                      <p className="text-[11px] text-slate-500">{currency}{effectiveStaplePrice.toFixed(2)} per copy</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={enableStapling} onChange={e => setEnableStapling(e.target.checked)} className="sr-only peer" />
                    <div className={`w-10 h-5 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${enableStapling ? toggleActiveBg : toggleInactiveBg}`} />
                  </label>
                </div>
                {enableStapling && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Stapling ({currency}{effectiveStaplePrice.toFixed(2)} × {quantity} copies)</span>
                      <span className="font-mono font-medium text-slate-700">{currency}{pinningCost.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className={premiumCard}>
              {renderCardHeader(<TrendingUp size={15} className="text-white" />, 'Cost Summary', undefined, 'from-emerald-500 to-teal-600')}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Total {isPhotocopy ? 'Sheets' : 'Pages'}</span>
                  <span className="font-mono font-medium text-slate-700 tabular-nums">{isPhotocopy ? totalSheets : totalPages}</span>
                </div>
                {isPhotocopy && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Total Pages <span className="text-[10px] text-slate-400">(toner basis)</span></span>
                    <span className="font-mono font-medium text-slate-600 tabular-nums">{totalPages}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">{isPhotocopy ? 'Sheet' : 'Page'} Cost</span>
                  <span className="font-mono font-medium text-slate-700 tabular-nums">{currency}{printTotal.toFixed(2)}</span>
                </div>
                {costPerPage ? (
                  <>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Toner Cost ({currency}{costPerPage.toFixed(2)}/pg)</span>
                      <span className="font-mono font-medium text-slate-700 tabular-nums">{currency}{materialCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-emerald-600">Estimated Profit</span>
                      <span className="font-mono font-medium text-emerald-600 tabular-nums">+{currency}{(finalTotal - materialCost).toFixed(2)}</span>
                    </div>
                  </>
                ) : null}
                {enableStapling && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Stapling</span>
                    <span className="font-mono font-medium text-slate-700 tabular-nums">{currency}{pinningCost.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="text-sm font-semibold text-slate-700">Total</span>
                  <span className="font-mono font-bold text-emerald-600 tabular-nums" style={{ fontSize: 18 }}>{currency}{finalTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between shrink-0 pt-3 mt-3 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all">
              Cancel
            </button>
            <button type="button" onClick={handleConfirm} className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-xs font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2">
              <Sparkles size={13} /> Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickPrintModal;
