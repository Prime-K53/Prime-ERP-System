import React, { useState } from 'react';
import { Loader2, FileText, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useInventory } from '../../context/InventoryContext';
import { useProduction } from '../../context/ProductionContext';
import { generateBOM } from '../../services/aiAnalyticsUtils';
import { currencyService } from '../../services/currencyService';

const BOMGenerator: React.FC = () => {
  const navigate = useNavigate();
  const { companyConfig } = useAuth();
  const currency = companyConfig?.currencySymbol || currencyService.getCurrency(currencyService.getBaseCurrency())?.symbol || '$';
  const { inventory } = useInventory();
  const { boms } = useProduction();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState(100);

  const runGenerate = () => {
    if (!productName.trim()) return;
    setLoading(true);
    setTimeout(() => {
      const res = generateBOM(productName, quantity, inventory || [], boms || []);
      setResult(res);
      setLoading(false);
    }, 300);
  };

  return (
    <div className="h-full flex flex-col p-6 bg-slate-50/50 overflow-y-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/smart-operations/ai')} className="p-2 rounded-lg hover:bg-white"><ArrowLeft size={20} /></button>
        <FileText className="text-teal-500" size={28} />
        <div><h1 className="text-xl font-bold text-slate-800">BOM Generator</h1><p className="text-xs text-slate-500">Generate Bill of Materials from product specs</p></div>
      </div>

      <div className="flex gap-3 mb-6">
        <input value={productName} onChange={e => setProductName(e.target.value)} onKeyDown={e => e.key === 'Enter' && runGenerate()} placeholder="Product name (e.g., 'Exam Booklet A4')" className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
        <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} min={1} className="w-24 px-4 py-2.5 rounded-xl border border-slate-200 text-sm" />
        <button onClick={runGenerate} disabled={loading || !productName.trim()} className="px-6 py-2.5 bg-teal-500 text-white rounded-xl font-medium hover:bg-teal-600 disabled:opacity-50">Generate</button>
      </div>

      {loading && <div className="flex-1 flex items-center justify-center"><Loader2 size={40} className="animate-spin text-teal-500 mx-auto" /></div>}

      {result?.bom && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200"><div className="text-xs text-slate-500">Material</div><div className="text-lg font-bold text-slate-800">{currency}{(result.bom.materialCost || 0).toFixed(2)}</div></div>
            <div className="bg-white rounded-xl p-4 border border-slate-200"><div className="text-xs text-slate-500">Labor</div><div className="text-lg font-bold text-slate-800">{currency}{(result.bom.laborCost || 0).toFixed(2)}</div></div>
            <div className="bg-white rounded-xl p-4 border border-slate-200"><div className="text-xs text-slate-500">Total Cost</div><div className="text-lg font-bold text-slate-800">{currency}{(result.bom.totalCost || 0).toFixed(2)}</div></div>
            <div className="bg-white rounded-xl p-4 border border-emerald-200"><div className="text-xs text-emerald-500">Suggested Price</div><div className="text-lg font-bold text-emerald-600">{currency}{(result.bom.suggestedSellingPrice || 0).toFixed(2)}</div></div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between">
              <span className="font-semibold text-sm text-slate-700">{result.bom.name} v{result.bom.version}</span>
              <span className="text-xs bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full font-medium capitalize">{result.bom.status}</span>
            </div>
            <div className="p-3 border-b border-slate-100">
              <div className="text-xs text-slate-500 mb-2">Components</div>
              {result.bom.items?.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-1 text-sm"><span className="text-slate-700">{item.name}</span><span className="text-slate-500">{item.quantity} {item.unit} @ {currency}{(item.unitCost || 0).toFixed(2)}</span></div>
              ))}
            </div>
            <div className="p-3 text-xs text-slate-500 space-y-1">
              {result.bom.estimatedProductionHours && <div>Est. Hours: {result.bom.estimatedProductionHours}</div>}
              <div>Suggested Margin: {result.bom.suggestedProfitMargin}</div>
            </div>
          </div>

          {result.similarBoms?.length > 0 && (
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="font-semibold text-sm text-slate-700 mb-2">Similar BOMs</div>
              {result.similarBoms.map((b: any, i: number) => (
                <div key={i} className="text-sm text-slate-600 flex items-center gap-2 mb-1"><FileText size={14} className="text-slate-400" />{b.name} — {currency}{(b.totalCost || 0).toFixed(2)}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {!result && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <FileText size={48} className="mx-auto text-teal-300 mb-4" />
            <h2 className="text-lg font-semibold text-slate-700 mb-2">Generate a Bill of Materials</h2>
            <p className="text-sm text-slate-500">Enter a product name and quantity above. The AI analyzes your inventory and existing BOMs to suggest materials, costs, and pricing. {(inventory || []).length} inventory items, {(boms || []).length} existing BOMs loaded.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BOMGenerator;
