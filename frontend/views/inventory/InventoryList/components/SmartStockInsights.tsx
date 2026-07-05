import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, X, AlertTriangle, TrendingUp, Package, RefreshCw, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { detectInventoryRisks } from '../../../../services/geminiService';
import type { Item } from '../../../../types';
import { useAuth } from '../../../../context/AuthContext';
import { currencyService } from '../../../../services/currencyService';

interface RiskItem {
  sku?: string;
  name: string;
  risk: 'stockout' | 'low_stock' | 'zero_stock' | 'overstock';
  currentStock: number;
  suggestedAction: string;
  costPrice?: number;
  sellingPrice?: number;
}

interface Props {
  items: Item[];
  onClose: () => void;
}

function localFallbackAnalysis(items: Item[]): RiskItem[] {
  const risks: RiskItem[] = [];
  for (const item of items) {
    const stock = item.stock || 0;
    const minStock = item.minStockLevel || item.reorderPoint || 0;
    const name = item.name || 'Unknown';
    const sku = item.sku;
    const costPrice = item.costPrice || item.cost || 0;
    const sellingPrice = item.sellingPrice || item.price || 0;

    if (stock <= 0) {
      risks.push({ sku, name, risk: 'zero_stock', currentStock: 0, suggestedAction: 'Place urgent reorder — item is out of stock', costPrice, sellingPrice });
    } else if (minStock > 0 && stock <= minStock) {
      risks.push({ sku, name, risk: 'low_stock', currentStock: stock, suggestedAction: `Reorder soon — stock (${stock}) is at or below minimum (${minStock})`, costPrice, sellingPrice });
    } else if (stock <= 5) {
      risks.push({ sku, name, risk: 'stockout', currentStock: stock, suggestedAction: `Critical — only ${stock} units remaining`, costPrice, sellingPrice });
    } else if (stock > 500) {
      risks.push({ sku, name, risk: 'overstock', currentStock: stock, suggestedAction: `Overstocked — ${stock} units, consider promotion or transfer`, costPrice, sellingPrice });
    }
  }
  return risks.slice(0, 30);
}

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; Icon: React.FC<any> }> = {
  zero_stock: { label: 'Out of Stock', color: '#DC2626', bg: '#FEF2F2', border: '#DC2626', Icon: AlertCircle },
  low_stock: { label: 'Low Stock', color: '#D97706', bg: '#FFFBEB', border: '#D97706', Icon: AlertTriangle },
  stockout: { label: 'Critical', color: '#DC2626', bg: '#FEF2F2', border: '#DC2626', Icon: AlertCircle },
  overstock: { label: 'Overstocked', color: '#2563EB', bg: '#EFF6FF', border: '#2563EB', Icon: TrendingUp },
};

export const SmartStockInsights: React.FC<Props> = ({ items, onClose }) => {
  const { companyConfig } = useAuth();
  const cs = companyConfig?.currencySymbol || currencyService.getCurrency(currencyService.getBaseCurrency())?.symbol || '$';
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'ai' | 'local'>('ai');

  const analyze = useCallback(async () => {
    setLoading(true);
    try {
      const aiResult = await detectInventoryRisks(items);
      if (Array.isArray(aiResult) && aiResult.length > 0) {
        setRisks(aiResult);
        setMode('ai');
      } else {
        setRisks(localFallbackAnalysis(items));
        setMode('local');
      }
    } catch {
      setRisks(localFallbackAnalysis(items));
      setMode('local');
    } finally {
      setLoading(false);
    }
  }, [items]);

  useEffect(() => { analyze(); }, [analyze]);

  const grouped = risks.reduce<Record<string, RiskItem[]>>((acc, r) => {
    if (!acc[r.risk]) acc[r.risk] = [];
    acc[r.risk].push(r);
    return acc;
  }, {});

  const riskOrder = ['zero_stock', 'stockout', 'low_stock', 'overstock'];
  const sortedGroups = riskOrder.filter(k => grouped[k]).map(k => ({ key: k, items: grouped[k] }));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center" style={{ background: '#EFF6FF', color: '#2563EB' }}>
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold" style={{ color: '#0F172A' }}>Smart Stock Insights</h2>
              <p className="text-[12px]" style={{ color: '#94A3B8' }}>
                {loading ? 'Analyzing inventory...' : mode === 'ai' ? 'AI-powered analysis' : 'Rule-based analysis'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F8FAFC] transition-colors" style={{ color: '#94A3B8' }}>
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 size={36} className="animate-spin" style={{ color: '#2563EB' }} />
              <p className="text-[13px] mt-3" style={{ color: '#94A3B8' }}>AI is scanning your inventory...</p>
            </div>
          ) : risks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <CheckCircle size={40} style={{ color: '#16A34A' }} />
              <p className="text-[15px] font-semibold mt-3" style={{ color: '#0F172A' }}>No issues detected</p>
              <p className="text-[13px] mt-1" style={{ color: '#94A3B8' }}>Your inventory looks healthy</p>
            </div>
          ) : (
            <div className="space-y-4">
              {mode === 'local' && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px]" style={{ background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' }}>
                  <AlertTriangle size={14} />
                  <span>AI analysis unavailable — showing rule-based results. <button onClick={analyze} className="underline font-medium">Retry AI</button></span>
                </div>
              )}

              <div className="flex items-center gap-2 text-[13px] font-medium" style={{ color: '#0F172A' }}>
                <Package size={16} />
                <span>{risks.length} item{risks.length !== 1 ? 's' : ''} flagged for attention</span>
                <button onClick={analyze} className="ml-auto flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors" style={{ background: '#EFF6FF', color: '#2563EB' }}>
                  <RefreshCw size={13} /> Refresh
                </button>
              </div>

              {sortedGroups.map(group => {
                const cfg = RISK_CONFIG[group.key] || RISK_CONFIG.low_stock;
                const Icon = cfg.Icon;
                return (
                  <div key={group.key} className="rounded-xl border overflow-hidden" style={{ borderColor: cfg.border }}>
                    <div className="px-4 py-2 flex items-center gap-2 text-[12px] font-semibold" style={{ background: cfg.bg, color: cfg.color }}>
                      <Icon size={14} />
                      {cfg.label}
                      <span className="ml-auto">{group.items.length} item{group.items.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="divide-y divide-[#F1F5F9]">
                      {group.items.map((r, i) => (
                        <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                          <div>
                            <div className="text-[13px] font-medium" style={{ color: '#0F172A' }}>{r.name}</div>
                            <div className="text-[11.5px] mt-0.5" style={{ color: '#94A3B8' }}>
                              Stock: <span className="font-semibold" style={{ color: r.currentStock <= 0 ? '#DC2626' : '#334155' }}>{r.currentStock}</span>
                              {r.sku ? ` · SKU: ${r.sku}` : ''}
                              {r.costPrice ? ` · Cost: ${cs} ${r.costPrice.toLocaleString()}` : ''}
                            </div>
                            <div className="text-[11.5px] mt-0.5" style={{ color: cfg.color }}>
                              {r.suggestedAction}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[#E2E8F0] flex justify-end shrink-0">
          <button onClick={onClose}
            className="px-5 py-2 text-[12.5px] font-semibold rounded-xl transition-all"
            style={{ background: '#0F172A', color: 'white' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
