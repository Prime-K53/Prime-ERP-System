
import React, { useMemo } from 'react';
import { TrendingUp, DollarSign, PieChart, AlertTriangle, ArrowRight, Recycle, BarChart3, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/Dialog';
import { Invoice, WorkOrder } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { useInventory } from '../../../context/InventoryContext';
import { useProduction } from '../../../context/ProductionContext';
import { currencyService } from '../../../services/currencyService';

interface ProfitAnalysisModalProps {
  invoice: Invoice;
  onClose: () => void;
}

export const ProfitAnalysisModal: React.FC<ProfitAnalysisModalProps> = ({ invoice, onClose }) => {
  const { companyConfig } = useAuth(); const { boms = [], workOrders = [] } = useProduction(); const { inventory = [] } = useInventory();
  const currency = companyConfig?.currencySymbol || currencyService.getCurrency(currencyService.getBaseCurrency())?.symbol || '$';

  const analysis = useMemo(() => {
    let totalWasteCost = 0;

    // Use snapshot adjustments if available on the invoice/sale
    const snapshots = invoice.adjustmentSnapshots || [];

    const itemsData = (invoice.items || []).map(item => {
        const grossTotal = (item.price || 0) * (item.quantity || 0);
        const netTotal = grossTotal; 
        
        // Attempt to calculate cost from BOM or Stationery cost price
        // RULE: Prefer cost from item snapshot if available
        let unitCost = item.cost || 0;
        let scrapCost = 0;
        
        const bom = boms.find((b: any) => b.productId === item.id);
        
        if (item.type === 'Stationery') {
            unitCost = item.cost || 0;
        } else if (bom) {
            let bomMaterialCost = 0;
            bom.components.forEach((comp: any) => {
                const mat = inventory.find((inv: any) => inv.id === comp.materialId);
                const matPrice = mat?.cost || mat?.price || 0;
                bomMaterialCost += (comp.quantity * matPrice);
            });
            unitCost = bomMaterialCost + (bom.laborCost || 0);

            // LOGIC LINK: Integrate actual production waste
            const relatedWOs = (workOrders as WorkOrder[]).filter(wo => wo.productId === item.id && wo.customerName === invoice.customerName);
            const totalQty = relatedWOs.reduce((s, w) => s + (w.quantityPlanned || 0), 0);
            const totalWaste = relatedWOs.reduce((s, w) => s + (w.quantityWaste || 0), 0);
            
            if (totalQty > 0) {
                const wasteFactor = totalWaste / totalQty;
                scrapCost = unitCost * wasteFactor;
                totalWasteCost += (scrapCost * (item.quantity || 0));
            }
        }

        const totalCost = (unitCost + scrapCost) * (item.quantity || 0);
        const profit = netTotal - totalCost;
        const margin = netTotal > 0 ? (profit / netTotal) * 100 : 0;
        
        return {
            ...item,
            grossTotal,
            netTotal,
            totalCost,
            scrapCost,
            profit,
            margin
        };
    });

    const totalRevenue = itemsData.reduce((sum, i) => sum + (i.netTotal || 0), 0);
    const totalCost = itemsData.reduce((sum, i) => sum + (i.totalCost || 0), 0);
    const totalProfit = totalRevenue - totalCost;
    const totalMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return { items: itemsData, totalRevenue, totalCost, totalProfit, totalMargin, totalWasteCost, snapshots };
  }, [invoice, boms, inventory, workOrders]);

  return (
    <Dialog open={true} onClose={onClose} title="P&L Performance Audit" className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <p className="text-xs text-slate-500 font-mono -mt-2 mb-2">Voucher Tracking ID: {invoice.id}</p>
        <div className="space-y-6 custom-scrollbar overflow-y-auto flex-1 pr-1">
            
            {/* KPI Cards (QBO Style) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-start gap-4 border-l-4 border-l-blue-500 hover:bg-slate-50 transition-all duration-200">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                        <DollarSign size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">Net Billings</p>
                        <p className="text-lg md:text-xl font-semibold text-slate-900 finance-nums">{currency}{(analysis.totalRevenue || 0).toLocaleString()}</p>
                    </div>
                </div>
                <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-start gap-4 border-l-4 border-l-slate-700 hover:bg-slate-50 transition-all duration-200">
                    <div className="p-2.5 bg-slate-100 text-slate-700 rounded-lg shrink-0">
                        <TrendingUp size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">True COGS</p>
                        <p className="text-lg md:text-xl font-semibold text-slate-900 finance-nums">{currency}{(analysis.totalCost || 0).toLocaleString()}</p>
                        <p className="text-[9px] font-semibold text-slate-400 mt-0.5 uppercase">Includes Material & Labor</p>
                    </div>
                </div>
                <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-start gap-4 border-l-4 border-l-emerald-500 hover:bg-slate-50 transition-all duration-200">
                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                        <BarChart3 size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">Gross Result</p>
                        <p className={`text-lg md:text-xl font-semibold finance-nums ${analysis.totalProfit >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>{currency}{(analysis.totalProfit || 0).toLocaleString()}</p>
                    </div>
                </div>
                <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-start gap-4 border-l-4 border-l-purple-500 hover:bg-slate-50 transition-all duration-200">
                    <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg shrink-0">
                        <PieChart size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">Net Yield</p>
                        <p className={`text-lg md:text-xl font-semibold finance-nums ${analysis.totalMargin >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>{ (analysis.totalMargin || 0).toFixed(1) }%</p>
                    </div>
                </div>
            </div>

            {/* Market Adjustment Snapshots (New) */}
            {analysis.snapshots.length > 0 && (
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center gap-2 bg-indigo-50/30">
                        <ShieldCheck size={16} className="text-indigo-600"/>
                        <h3 className="font-black text-indigo-900 uppercase text-[10px] tracking-widest">Market Adjustment Audit (Snapshot)</h3>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                        {analysis.snapshots.map((adj, idx) => (
                            <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{adj.name}</div>
                                    <div className="text-[11px] font-bold text-slate-600">{adj.type === 'PERCENTAGE' ? `${adj.value}% of Cost` : 'Fixed Amount'}</div>
                                </div>
                                <div className="text-lg font-black text-slate-900">
                                    {currency}{adj.calculatedAmount.toLocaleString()}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Waste Impact Warning */}
            {analysis.totalWasteCost > 0 && (
                <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 shadow-inner">
                        <Recycle size={32}/>
                    </div>
                    <div>
                        <h4 className="font-black text-amber-900 uppercase text-xs tracking-widest">Wastage Impact Detected</h4>
                        <p className="text-sm text-amber-800 mt-1 leading-relaxed">Manufacturing records show production scrap for this job. We have added <span className="font-bold">{currency}{(analysis.totalWasteCost || 0).toFixed(2)}</span> to the COGS to reflect actual raw material loss.</p>
                    </div>
                </div>
            )}

            {/* Detailed Table */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                    <BarChart3 size={16} className="text-slate-400"/>
                    <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-widest">Line Item Attribution</h3>
                </div>
                <table className="w-full text-left text-sm border-collapse">
                    <thead>
                        <tr className="bg-slate-50 text-slate-400 font-black uppercase text-[9px] tracking-widest border-b border-slate-100">
                            <th className="p-5">Specification</th>
                            <th className="p-5 text-center">Volume</th>
                            <th className="p-5 text-right">Net Unit</th>
                            <th className="p-5 text-right">Yield</th>
                            <th className="p-5 text-right">P&L Contribution</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-medium">
                        {analysis.items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="p-5">
                                    <div className="font-bold text-slate-800">{item.name}</div>
                                    <div className="text-[10px] text-slate-400 font-mono uppercase tracking-tighter">{item.type}</div>
                                </td>
                                <td className="p-5 text-center text-slate-600 font-mono">{item.quantity}</td>
                                <td className="p-5 text-right text-slate-500 font-mono">{currency}{( (item.netTotal || 0) / (item.quantity || 1) ).toFixed(2)}</td>
                                <td className="p-5 text-right">
                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${item.margin >= 20 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : item.margin > 0 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                                        {(item.margin || 0).toFixed(1)}%
                                    </span>
                                </td>
                                <td className={`p-5 text-right font-black ${item.profit >= 0 ? 'text-slate-900' : 'text-rose-600'} font-mono`}>
                                    {currency}{(item.profit || 0).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {analysis.totalProfit < 0 && (
                <div className="bg-rose-50 text-rose-800 p-6 rounded-[2rem] text-sm flex items-center gap-4 font-bold border border-rose-100 animate-pulse">
                    <AlertTriangle size={24}/> 
                    <div>
                        <h4 className="uppercase text-xs font-black tracking-widest">Negative Liquidity Warning</h4>
                        <p className="font-medium mt-1">Transaction is currently operating at a loss. Strategic pricing review recommended for this SKU.</p>
                    </div>
                </div>
            )}
        </div>
    </Dialog>
  );
};

export default ProfitAnalysisModal;
