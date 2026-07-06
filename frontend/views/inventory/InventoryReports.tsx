import React, { useMemo, useState } from 'react';
import { Package, AlertTriangle, DollarSign, TrendingUp, Box, Layers, BarChart3, ArrowUpDown, Search, Warehouse as WarehouseIcon, Coins, Award } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { useSalesStore } from '../../stores/salesStore';
import { useAuth } from '../../context/AuthContext';
import { currencyService } from '../../services/currencyService';
import type { Item, Sale as SaleType } from '../../types';
import './inventory-reference.css';

type ReportTab = 'overview' | 'stock-levels' | 'low-stock' | 'valuation' | 'reorder' | 'financials' | 'top-products';

const TABS: { id: ReportTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <BarChart3 size={14} /> },
  { id: 'stock-levels', label: 'Stock Levels', icon: <Box size={14} /> },
  { id: 'low-stock', label: 'Low Stock', icon: <AlertTriangle size={14} /> },
  { id: 'valuation', label: 'Valuation', icon: <DollarSign size={14} /> },
  { id: 'financials', label: 'Financials', icon: <Coins size={14} /> },
  { id: 'top-products', label: 'Top Products', icon: <Award size={14} /> },
  { id: 'reorder', label: 'Reorder', icon: <ArrowUpDown size={14} /> },
];

export const InventoryReports: React.FC = () => {
  const { inventory, warehouses } = useInventory();
  const { sales } = useSalesStore();
  const { companyConfig } = useAuth();
  const currency = companyConfig?.currencySymbol || currencyService.getCurrency(currencyService.getBaseCurrency())?.symbol || 'KWD';
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const categories = useMemo(() => {
    const cats = new Set<string>();
    inventory.forEach((i: Item) => { if (i.category) cats.add(i.category); });
    return ['all', ...Array.from(cats).sort()];
  }, [inventory]);

  const activeItems = useMemo(() => inventory.filter((i: Item) => i.status !== 'Inactive') as Item[], [inventory]);

  const totalValue = useMemo(() =>
    activeItems.reduce((s, i) => s + (i.costPrice || 0) * Math.max(i.stock || 0, 0), 0),
    [activeItems]);

  const lowStockItems = useMemo(() =>
    activeItems.filter((i: Item) => (i.reorderPoint ?? 0) > 0 && (i.stock ?? 0) <= (i.reorderPoint ?? 0)),
    [activeItems]);

  const outOfStock = useMemo(() =>
    activeItems.filter((i: Item) => (i.stock ?? 0) === 0 && (i.reorderPoint ?? 0) > 0),
    [activeItems]);

  const valuationByCategory = useMemo(() => {
    const map = new Map<string, { count: number; value: number; cost: number }>();
    activeItems.forEach((i: Item) => {
      const cat = i.category || 'Uncategorized';
      const entry = map.get(cat) || { count: 0, value: 0, cost: 0 };
      entry.count++;
      entry.cost += i.costPrice || 0;
      entry.value += (i.costPrice || 0) * Math.max(i.stock || 0, 0);
      map.set(cat, entry);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].value - a[1].value);
  }, [activeItems]);

  const valuationByWarehouse = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    activeItems.forEach((i: Item) => {
      const locs = i.locationStock || [];
      if (locs.length === 0) {
        const entry = map.get('Unassigned') || { count: 0, value: 0 };
        entry.count++;
        entry.value += (i.costPrice || 0) * Math.max(i.stock || 0, 0);
        map.set('Unassigned', entry);
      } else {
        locs.forEach((ls: { warehouseId: string; quantity: number }) => {
          const wh = warehouses.find((w: any) => w.id === ls.warehouseId);
          const label = wh ? wh.name : ls.warehouseId;
          const entry = map.get(label) || { count: 0, value: 0 };
          entry.count++;
          entry.value += (i.costPrice || 0) * Math.max(ls.quantity || 0, 0);
          map.set(label, entry);
        });
      }
    });
    return Array.from(map.entries()).sort((a, b) => b[1].value - a[1].value);
  }, [activeItems, warehouses]);

  const totalPotentialRevenue = useMemo(() =>
    activeItems.reduce((s, i) => s + (i.sellingPrice || 0) * Math.max(i.stock || 0, 0), 0),
    [activeItems]);

  const grossProfitPotential = totalPotentialRevenue - totalValue;

  const overallMarkupPct = useMemo(() => {
    const totalCost = activeItems.reduce((s, i) => s + (i.costPrice || 0), 0);
    const totalSell = activeItems.reduce((s, i) => s + (i.sellingPrice || 0), 0);
    return totalCost > 0 ? ((totalSell - totalCost) / totalCost) * 100 : 0;
  }, [activeItems]);

  const markupDistribution = useMemo(() => {
    const buckets: { label: string; min: number; max: number; items: number; value: number }[] = [
      { label: '0-10%', min: 0, max: 10, items: 0, value: 0 },
      { label: '10-20%', min: 10, max: 20, items: 0, value: 0 },
      { label: '20-30%', min: 20, max: 30, items: 0, value: 0 },
      { label: '30-50%', min: 30, max: 50, items: 0, value: 0 },
      { label: '50-100%', min: 50, max: 100, items: 0, value: 0 },
      { label: '100%+', min: 100, max: Infinity, items: 0, value: 0 },
    ];
    activeItems.forEach((i: Item) => {
      const cp = i.costPrice || 0;
      const sp = i.sellingPrice || 0;
      if (cp <= 0) return;
      const markup = ((sp - cp) / cp) * 100;
      for (const b of buckets) {
        if (markup >= b.min && markup < b.max) {
          b.items++;
          b.value += cp * Math.max(i.stock || 0, 0);
          break;
        }
      }
    });
    return buckets;
  }, [activeItems]);

  const negativeMarkupItems = useMemo(() =>
    activeItems.filter((i: Item) => (i.costPrice || 0) > 0 && (i.sellingPrice || 0) < (i.costPrice || 0)),
    [activeItems]);

  const productSalesAggregated = useMemo(() => {
    const map = new Map<string, { name: string; sku: string; qty: number; revenue: number; cost: number; profit: number }>();
    if (!sales) return Array.from(map.values()).sort((a, b) => b.profit - a.profit);
    sales.forEach((sale: any) => {
      if (sale.status !== 'Paid' && sale.status !== 'Completed') return;
      (sale.items || []).forEach((item: any) => {
        const id = item.productId || item.itemId || item.id || '';
        const name = item.productName || item.name || 'Unknown';
        const qty = item.quantity || 0;
        const price = item.price || item.selling_price || item.unitPrice || 0;
        const cost = item.cost || item.cost_price || 0;
        const key = `${id}:${name}`;
        const existing = map.get(key) || { name, sku: item.sku || '', qty: 0, revenue: 0, cost: 0, profit: 0 };
        existing.qty += qty;
        existing.revenue += price * qty;
        existing.cost += cost * qty;
        existing.profit += (price - cost) * qty;
        map.set(key, existing);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.profit - a.profit);
  }, [sales]);

  const filteredItems = useMemo(() => {
    let items = activeItems;
    if (activeTab === 'low-stock') items = lowStockItems;
    else if (activeTab === 'reorder') items = [...lowStockItems].sort((a, b) => ((a.stock ?? 0) / Math.max(a.reorderPoint ?? 1, 1)) - ((b.stock ?? 0) / Math.max(b.reorderPoint ?? 1, 1)));
    if (categoryFilter !== 'all') items = items.filter((i: Item) => i.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((i: Item) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
    }
    return items;
  }, [activeItems, lowStockItems, activeTab, categoryFilter, search]);

  const statusBadge = (item: Item) => {
    const stock = item.stock ?? 0;
    const rop = item.reorderPoint ?? 0;
    if (stock === 0 && rop > 0) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Out of Stock</span>;
    if (rop > 0 && stock <= rop) return <span className="text-[10px] font-bold px-2 py.5 rounded-full bg-amber-100 text-amber-700">Low Stock</span>;
    if (stock === 0) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Zero</span>;
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">In Stock</span>;
  };

  const searchAndFilter = (
    <div className="flex items-center gap-3 mb-4">
      <div className="relative flex-1 max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
        <input type="text" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-xl border text-sm outline-none transition-all"
          style={{ borderColor: '#E2E8F0', color: '#0F172A' }} />
      </div>
      <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
        className="px-3 py-2 rounded-xl border text-sm outline-none"
        style={{ borderColor: '#E2E8F0', color: '#0F172A' }}>
        {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
      </select>
    </div>
  );

  const renderTable = (items: Item[], showRop = false) => (
    <div className="pp-panel" style={{ padding: 0 }}>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="pp-table">
          <thead>
            <tr>
              <th className="text-left">Item</th>
              <th className="text-left">SKU</th>
              <th className="num">Stock</th>
              {showRop && <th className="num">Reorder Point</th>}
              <th className="num">Cost Price</th>
              <th className="num">Stock Value</th>
              <th className="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={showRop ? 7 : 6} className="px-4 py-12 text-center text-xs font-medium" style={{ color: '#94A3B8' }}>No items match your filters.</td></tr>
            ) : items.map((item: Item, idx: number) => (
              <tr key={`${item.id}-${idx}`} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ fontWeight: 600, color: '#0F172A' }}>{item.name}</td>
                <td style={{ fontSize: 12, fontFamily: "'IBM Plex Mono',monospace", color: '#94A3B8' }}>{item.sku}</td>
                <td className="num" style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: (item.stock ?? 0) <= (item.reorderPoint ?? -1) ? '#DC2626' : '#0F172A' }}>
                  {item.stock ?? 0}
                </td>
                {showRop && <td className="num" style={{ color: '#64748B' }}>{item.reorderPoint ?? '-'}</td>}
                <td className="num" style={{ fontVariantNumeric: 'tabular-nums', color: '#1E293B' }}>
                  {currency}{(item.costPrice ?? 0).toFixed(2)}
                </td>
                <td className="num" style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#0F172A' }}>
                  {currency}{((item.costPrice ?? 0) * Math.max(item.stock ?? 0, 0)).toFixed(2)}
                </td>
                <td style={{ textAlign: 'center' }}>{statusBadge(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col p-6 max-w-[1280px] mx-auto" style={{ color: '#0F172A' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-[40px] h-[40px] rounded-[10px] flex items-center justify-center" style={{ background: '#EFF6FF', color: '#2563EB' }}>
            <Package size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: '#0F172A' }}>Inventory Reports</h1>
            <p className="text-xs font-medium" style={{ color: '#64748B' }}>{activeItems.length} active items · {currency}{totalValue.toFixed(2)} total value</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 bg-white rounded-t-xl mb-6">
        <div className="flex items-center gap-6 px-4 overflow-x-auto custom-scrollbar">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`py-3 text-[13px] font-bold transition-all border-b-2 relative whitespace-nowrap flex items-center gap-1.5 ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="flex-1 overflow-y-auto space-y-6">
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Items', value: activeItems.length, icon: <Box size={20} />, color: 'blue', border: 'border-l-blue-500', iconBg: 'bg-blue-50', iconText: 'text-blue-600' },
              { label: 'Top Product', value: productSalesAggregated[0]?.name || 'N/A', sub: productSalesAggregated[0] ? `${currency}${productSalesAggregated[0].profit.toFixed(2)} profit` : '', icon: <Award size={20} />, color: 'emerald', border: 'border-l-emerald-500', iconBg: 'bg-emerald-50', iconText: 'text-emerald-600' },
              { label: 'Low Stock Items', value: lowStockItems.length, icon: <AlertTriangle size={20} />, color: 'amber', border: 'border-l-amber-500', iconBg: 'bg-amber-50', iconText: 'text-amber-600' },
              { label: 'Out of Stock', value: outOfStock.length, icon: <TrendingUp size={20} />, color: 'red', border: 'border-l-red-500', iconBg: 'bg-red-50', iconText: 'text-red-600' },
            ].map((kpi: any) => (
              <div key={kpi.label} className={`bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 ${kpi.border} hover:bg-slate-50 transition-all`}>
                <div className={`p-2.5 ${kpi.iconBg} ${kpi.iconText} rounded-lg`}>{kpi.icon}</div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">{kpi.label}</p>
                  <p className="text-lg md:text-xl font-semibold text-slate-900 finance-nums">{kpi.value}</p>
                  {kpi.sub && <p className="text-[10px] text-emerald-600 mt-0.5">{kpi.sub}</p>}
                </div>
              </div>
            ))}
          </div>

          {/* Valuation by Category */}
          <div className="pp-panel">
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: '#0F172A' }}>
              <Layers size={16} style={{ color: '#2563EB' }} /> Inventory Value by Category
            </h3>
            <div className="space-y-2">
              {valuationByCategory.map(([cat, data]) => {
                const pct = totalValue > 0 ? (data.value / totalValue) * 100 : 0;
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="w-32 text-xs font-semibold truncate" style={{ color: '#1E293B' }}>{cat}</span>
                    <div className="flex-1 h-2.5 rounded-full bg-[#F1F5F9] overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct > 50 ? '#2563EB' : pct > 20 ? '#3B82F6' : '#94A3B8' }} />
                    </div>
                    <span className="w-24 text-xs font-semibold text-right finance-nums" style={{ color: '#0F172A' }}>{currency}{data.value.toFixed(2)}</span>
                    <span className="w-16 text-[10px] text-right" style={{ color: '#94A3B8' }}>{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Valuation by Warehouse */}
          <div className="pp-panel">
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: '#0F172A' }}>
              <WarehouseIcon size={16} style={{ color: '#2563EB' }} /> Inventory Value by Warehouse
            </h3>
            <div className="space-y-2">
              {valuationByWarehouse.map(([wh, data]) => {
                const pct = totalValue > 0 ? (data.value / totalValue) * 100 : 0;
                return (
                  <div key={wh} className="flex items-center gap-3">
                    <span className="w-40 text-xs font-semibold truncate" style={{ color: '#1E293B' }}>{wh}</span>
                    <div className="flex-1 h-2.5 rounded-full bg-[#F1F5F9] overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#2563EB' }} />
                    </div>
                    <span className="w-24 text-xs font-semibold text-right finance-nums" style={{ color: '#0F172A' }}>{currency}{data.value.toFixed(2)}</span>
                    <span className="w-16 text-[10px] text-right" style={{ color: '#94A3B8' }}>{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'stock-levels' && (
        <div className="flex-1 overflow-y-auto">
          {searchAndFilter}
          {renderTable(filteredItems as Item[])}
        </div>
      )}

      {activeTab === 'low-stock' && (
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 mb-4 p-3 rounded-[8px]" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
            <AlertTriangle size={16} style={{ color: '#D97706' }} />
            <span className="text-xs font-medium" style={{ color: '#92400E' }}>
              {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} at or below reorder point. {outOfStock.length} item{outOfStock.length !== 1 ? 's' : ''} out of stock.
            </span>
          </div>
          {searchAndFilter}
          {renderTable(filteredItems as Item[], true)}
        </div>
      )}

      {activeTab === 'valuation' && (
        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Classification Breakdown */}
          <div className="pp-panel">
            <h3 className="text-sm font-bold mb-4" style={{ color: '#0F172A' }}>Value by Classification</h3>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="pp-table">
                <thead>
                  <tr>
                    <th>Classification</th>
                    <th className="num">Items</th>
                    <th className="num">Cost Value</th>
                    <th className="num">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const cats = ['Raw Material', 'Consumable', 'Product', 'Stationery'];
                    const breakdown = cats.map(label => {
                      const items = activeItems.filter(i => (i.type || i.classification) === label);
                      const value = items.reduce((s, i) => s + (i.costPrice || 0) * Math.max(i.stock || 0, 0), 0);
                      return { label, items: items.length, value };
                    });
                    const total = breakdown.reduce((s, c) => s + c.value, 0);
                    return breakdown.map((c: { label: string; items: number; value: number }) => (
                      <tr key={c.label}>
                        <td style={{ fontWeight: 600, color: '#0F172A' }}>{c.label}</td>
                        <td className="num" style={{ color: '#64748B' }}>{c.items}</td>
                        <td className="num" style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#0F172A' }}>{currency}{c.value.toFixed(2)}</td>
                        <td className="num">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                            <div style={{ flex: 1, maxWidth: 120, height: 8, borderRadius: 4, background: '#F1F5F9', overflow: 'hidden' }}>
                              <div style={{ height: '100%', borderRadius: 4, background: total > 0 ? (c.value / total > 0.5 ? '#2563EB' : c.value / total > 0.2 ? '#3B82F6' : '#94A3B8') : '#94A3B8', width: `${total > 0 ? (c.value / total * 100) : 0}%` }} />
                            </div>
                            <span className="text-xs font-semibold finance-nums" style={{ color: '#64748B', width: 48, textAlign: 'right' }}>{total > 0 ? (c.value / total * 100).toFixed(1) : '0.0'}%</span>
                          </div>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
          {/* By Category */}
          <div className="pp-panel">
            <h3 className="text-sm font-bold mb-4" style={{ color: '#0F172A' }}>Value by Category</h3>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="pp-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="num">Items</th>
                    <th className="num">Total Cost</th>
                    <th className="num">Stock Value</th>
                    <th className="num">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {valuationByCategory.map(([cat, data]) => (
                    <tr key={cat}>
                      <td style={{ fontWeight: 600, color: '#0F172A' }}>{cat}</td>
                      <td className="num" style={{ color: '#64748B' }}>{data.count}</td>
                      <td className="num" style={{ fontVariantNumeric: 'tabular-nums', color: '#1E293B' }}>{currency}{data.cost.toFixed(2)}</td>
                      <td className="num" style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#0F172A' }}>{currency}{data.value.toFixed(2)}</td>
                      <td className="num" style={{ color: '#64748B' }}>{totalValue > 0 ? ((data.value / totalValue) * 100).toFixed(1) : '0.0'}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {/* By Warehouse */}
          <div className="pp-panel">
            <h3 className="text-sm font-bold mb-4" style={{ color: '#0F172A' }}>Value by Warehouse</h3>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="pp-table">
                <thead>
                  <tr>
                    <th>Warehouse</th>
                    <th className="num">Items</th>
                    <th className="num">Stock Value</th>
                    <th className="num">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {valuationByWarehouse.map(([wh, data]) => (
                    <tr key={wh}>
                      <td style={{ fontWeight: 600, color: '#0F172A' }}>{wh}</td>
                      <td className="num" style={{ color: '#64748B' }}>{data.count}</td>
                      <td className="num" style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#0F172A' }}>{currency}{data.value.toFixed(2)}</td>
                      <td className="num" style={{ color: '#64748B' }}>{totalValue > 0 ? ((data.value / totalValue) * 100).toFixed(1) : '0.0'}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {/* Total */}
          <div className="pp-panel">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold" style={{ color: '#0F172A' }}>Total Inventory Value</span>
              <span className="text-lg font-bold finance-nums" style={{ color: '#2563EB' }}>{currency}{totalValue.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'financials' && (
        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Financial Basis KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Cost Basis', value: currency + totalValue.toFixed(2), icon: <DollarSign size={20} />, border: 'border-l-emerald-500', iconBg: 'bg-emerald-50', iconText: 'text-emerald-600' },
              { label: 'Potential Revenue', value: currency + totalPotentialRevenue.toFixed(2), icon: <TrendingUp size={20} />, border: 'border-l-blue-500', iconBg: 'bg-blue-50', iconText: 'text-blue-600' },
              { label: 'Gross Profit Potential', value: currency + grossProfitPotential.toFixed(2), icon: <Coins size={20} />, border: grossProfitPotential >= 0 ? 'border-l-emerald-500' : 'border-l-red-500', iconBg: grossProfitPotential >= 0 ? 'bg-emerald-50' : 'bg-red-50', iconText: grossProfitPotential >= 0 ? 'text-emerald-600' : 'text-red-600' },
              { label: 'Avg Markup', value: overallMarkupPct.toFixed(1) + '%', icon: <BarChart3 size={20} />, border: overallMarkupPct >= 20 ? 'border-l-emerald-500' : 'border-l-amber-500', iconBg: 'bg-amber-50', iconText: 'text-amber-600' },
            ].map(kpi => (
              <div key={kpi.label} className={`bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 ${kpi.border} hover:bg-slate-50 transition-all`}>
                <div className={`p-2.5 ${kpi.iconBg} ${kpi.iconText} rounded-lg`}>{kpi.icon}</div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none mb-1.5">{kpi.label}</p>
                  <p className="text-lg md:text-xl font-semibold text-slate-900 finance-nums">{kpi.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Markup Distribution */}
          <div className="pp-panel">
            <h3 className="text-sm font-bold mb-4" style={{ color: '#0F172A' }}>Markup Distribution</h3>
            <div className="space-y-3">
              {markupDistribution.map(b => {
                const totalInvValue = markupDistribution.reduce((s, x) => s + x.value, 0);
                const pct = totalInvValue > 0 ? (b.value / totalInvValue) * 100 : 0;
                return (
                  <div key={b.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold" style={{ color: '#1E293B' }}>{b.label}</span>
                      <span style={{ color: '#64748B' }}>{b.items} items · {currency}{b.value.toFixed(2)}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-[#F1F5F9] overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${pct}%`,
                        background: b.label === '100%+' ? '#2563EB' : b.label === '0-10%' ? '#EF4444' : b.label === '10-20%' ? '#F59E0B' : '#3B82F6'
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Negative / Low Markup Warning */}
          {negativeMarkupItems.length > 0 && (
            <div className="pp-panel">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} style={{ color: '#EF4444' }} />
                <h3 className="text-sm font-bold" style={{ color: '#0F172A' }}>Items Selling Below Cost ({negativeMarkupItems.length})</h3>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="pp-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="num">Cost</th>
                      <th className="num">Selling Price</th>
                      <th className="num">Loss/Unit</th>
                      <th className="num">Stock</th>
                      <th className="num">Total Loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {negativeMarkupItems.map((i: Item, idx: number) => {
                      const loss = (i.costPrice || 0) - (i.sellingPrice || 0);
                      return (
                        <tr key={`${i.id}-${idx}`}>
                          <td style={{ fontWeight: 600, color: '#0F172A' }}>{i.name}</td>
                          <td className="num" style={{ fontVariantNumeric: 'tabular-nums', color: '#1E293B' }}>{currency}{(i.costPrice || 0).toFixed(2)}</td>
                          <td className="num" style={{ fontVariantNumeric: 'tabular-nums', color: '#DC2626' }}>{currency}{(i.sellingPrice || 0).toFixed(2)}</td>
                          <td className="num" style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#DC2626' }}>-{currency}{loss.toFixed(2)}</td>
                          <td className="num" style={{ color: '#64748B' }}>{i.stock ?? 0}</td>
                          <td className="num" style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#DC2626' }}>-{currency}{(loss * Math.max(i.stock || 0, 0)).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'top-products' && (
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 mb-4 p-3 rounded-[8px]" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <Award size={16} style={{ color: '#16A34A' }} />
            <span className="text-xs font-medium" style={{ color: '#166534' }}>
              Top {productSalesAggregated.length} income-generating products ranked by total profit.
            </span>
          </div>
          <div className="pp-panel" style={{ padding: 0 }}>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="pp-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th className="num">Units Sold</th>
                    <th className="num">Revenue</th>
                    <th className="num">Cost</th>
                    <th className="num">Total Profit</th>
                    <th className="num">Markup</th>
                  </tr>
                </thead>
                <tbody>
                  {productSalesAggregated.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-xs font-medium" style={{ color: '#94A3B8' }}>No sales data available to compute product profitability.</td></tr>
                  ) : productSalesAggregated.slice(0, 100).map((p, i) => {
                    const markupPct = p.cost > 0 ? (p.profit / p.cost) * 100 : 0;
                    return (
                      <tr key={`${p.name}-${i}`}>
                        <td style={{ color: '#94A3B8', fontWeight: 600 }}>{i + 1}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#0F172A' }}>{p.name}</div>
                          {p.sku && <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono',monospace", color: '#94A3B8' }}>{p.sku}</div>}
                        </td>
                        <td className="num" style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#0F172A' }}>{p.qty}</td>
                        <td className="num" style={{ fontVariantNumeric: 'tabular-nums', color: '#1E293B' }}>{currency}{p.revenue.toFixed(2)}</td>
                        <td className="num" style={{ fontVariantNumeric: 'tabular-nums', color: '#1E293B' }}>{currency}{p.cost.toFixed(2)}</td>
                        <td className="num" style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: p.profit >= 0 ? '#059669' : '#DC2626' }}>{currency}{p.profit.toFixed(2)}</td>
                        <td className="num">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            markupPct >= 30 ? 'bg-emerald-100 text-emerald-700' :
                            markupPct >= 15 ? 'bg-blue-100 text-blue-700' :
                            markupPct >= 0 ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>{markupPct.toFixed(1)}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reorder' && (
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 mb-4 p-3 rounded-[8px]" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
            <ArrowUpDown size={16} style={{ color: '#2563EB' }} />
            <span className="text-xs font-medium" style={{ color: '#1E40AF' }}>
              {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} need reorder. Sorted by urgency (stock vs reorder point ratio).
            </span>
          </div>
          {searchAndFilter}
          {renderTable(filteredItems as Item[], true)}
        </div>
      )}
    </div>
  );
};

export default InventoryReports;
