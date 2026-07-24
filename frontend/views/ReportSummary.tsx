import React, { useState } from 'react';
import {
  TrendingUp, TrendingDown, FileText, Activity, BarChart3, DollarSign,
  Sparkles, Award, AlertTriangle, Package, ShoppingCart, ArrowUp, ArrowDown,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSales } from '../context/SalesContext';
import { useFinance } from '../context/FinanceContext';
import { useInventory } from '../context/InventoryContext';
import {
  generateExecutiveSummary, generateFinancialHealthScore, generateSalesReportSummary,
  generateExpenseReportSummary, generateInventoryReportSummary, formatCurrency, formatPercent
} from '../services/reportSummaryService';

type ReportTab = 'Executive Summary' | 'Financial Health' | 'Sales' | 'Expenses' | 'Inventory';

const PERIODS = ['This Month', 'This Quarter', 'This Year', 'All Time'] as const;
type Period = typeof PERIODS[number];

const getDateRange = (period: Period): { start: string; end: string } => {
  const now = new Date();
  const end = now.toISOString();
  let start: Date;
  switch (period) {
    case 'This Month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'This Quarter': {
      const q = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), q, 1);
      break;
    }
    case 'This Year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = new Date(2000, 0, 1);
  }
  return { start: start.toISOString(), end };
};

const getGradeColor = (grade: string) => {
  switch (grade) {
    case 'A': return 'text-emerald-600';
    case 'B': return 'text-blue-600';
    case 'C': return 'text-amber-600';
    case 'D': return 'text-orange-600';
    case 'F': return 'text-red-600';
    default: return 'text-slate-600';
  }
};

const getProgressColor = (score: number, maxScore: number) => {
  const pct = (score / maxScore) * 100;
  if (pct >= 80) return 'bg-emerald-500';
  if (pct >= 60) return 'bg-blue-500';
  if (pct >= 40) return 'bg-amber-500';
  return 'bg-red-500';
};

const ReportSummary: React.FC = () => {
  const { companyConfig } = useAuth();
  const currency = companyConfig?.currencySymbol || 'MK';

  const [activeTab, setActiveTab] = useState<ReportTab>('Executive Summary');
  const [period, setPeriod] = useState<Period>('This Month');
  const [loading, setLoading] = useState(false);
  const [periodSelectorOpen, setPeriodSelectorOpen] = useState(false);

  const { sales } = useSales();
  const { invoices, expenses } = useFinance();
  const { inventory } = useInventory();

  const dateRange = getDateRange(period);

  const execSummary = generateExecutiveSummary({
    sales: sales || [],
    invoices: invoices || [],
    expenses: expenses || [],
    inventory: inventory || [],
    dateRange,
  });

  const totalRevenue = execSummary.metrics.find((m: any) => m.label === 'Total Revenue');
  const totalExpenses = execSummary.metrics.find((m: any) => m.label === 'Total Expenses');
  const revenue = parseFloat((totalRevenue?.value || '').replace(/[^0-9.-]/g, '')) || 0;
  const expensesVal = parseFloat((totalExpenses?.value || '').replace(/[^0-9.-]/g, '')) || 0;
  const profitMargin = revenue > 0 ? ((revenue - expensesVal) / revenue) * 100 : 0;

  const healthScore = generateFinancialHealthScore({
    revenue,
    expenses: expensesVal,
    assets: revenue * 1.5,
    liabilities: expensesVal * 0.6,
    equity: revenue,
    profitMargin,
    currentRatio: 1.8,
  });

  const salesSummary = generateSalesReportSummary(sales || [], invoices || [], period);
  const expenseSummary = generateExpenseReportSummary(expenses || [], period);
  const inventorySummary = generateInventoryReportSummary(inventory || [], []);

  const tabs: ReportTab[] = ['Executive Summary', 'Financial Health', 'Sales', 'Expenses', 'Inventory'];

  const renderExecutiveSummary = () => {
    if (!execSummary) return null;
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-lg text-slate-900 tracking-tight mb-2">{execSummary.title}</h3>
          <p className="text-slate-600 leading-relaxed">{execSummary.summary}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {execSummary.metrics.filter((m: any) => m.label !== 'Top Category' && m.label !== 'Top Customer' && m.label !== 'Inventory Turnover').map((metric: any) => (
            <div key={metric.label} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm border-l-4 border-l-blue-500">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight mb-1">{metric.label}</p>
              <p className="text-lg font-bold text-slate-900">{metric.value}</p>
              {metric.change && (
                <p className={`text-xs font-semibold flex items-center gap-1 mt-1 ${metric.direction === 'up' ? 'text-emerald-600' : metric.direction === 'down' ? 'text-red-600' : 'text-slate-400'}`}>
                  {metric.direction === 'up' ? <ArrowUp size={12} /> : metric.direction === 'down' ? <ArrowDown size={12} /> : null}
                  {metric.change}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Sparkles size={14} className="text-amber-500" /> Highlights
            </h4>
            <ul className="space-y-2">
              {execSummary.highlights.map((h: string, i: number) => (
                <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  {h}
                </li>
              ))}
              {execSummary.highlights.length === 0 && (
                <li className="text-sm text-slate-400">No highlights available.</li>
              )}
            </ul>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Award size={14} className="text-emerald-500" /> Recommendations
            </h4>
            <ul className="space-y-2">
              {execSummary.recommendations.map((r: string, i: number) => (
                <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">→</span>
                  {r}
                </li>
              ))}
              {execSummary.recommendations.length === 0 && (
                <li className="text-sm text-slate-400">No recommendations available.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  const renderFinancialHealth = () => {
    if (!healthScore) return null;
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Financial Health Score</p>
          <div className="text-6xl font-black tracking-tight mb-1">{healthScore.score}</div>
          <div className={`text-5xl font-black ${getGradeColor(healthScore.grade)}`}>{healthScore.grade}</div>
          <p className="text-sm text-slate-500 mt-2">Overall Financial Health Grade</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {healthScore.breakdown.map((item: any) => (
            <div key={item.category} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-slate-800 text-sm">{item.category}</h4>
                <span className="text-sm font-bold text-slate-900">{item.score}/{item.maxScore}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 mb-3">
                <div
                  className={`h-2.5 rounded-full transition-all duration-500 ${getProgressColor(item.score, item.maxScore)}`}
                  style={{ width: `${(item.score / item.maxScore) * 100}%` }}
                />
              </div>
              <p className="text-sm text-slate-500">{item.comment}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSalesSummary = () => {
    if (!salesSummary) return null;
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-lg text-slate-900 tracking-tight mb-2">{salesSummary.title}</h3>
          <p className="text-slate-600 leading-relaxed">{salesSummary.summary}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <BarChart3 size={14} className="text-blue-500" /> Key Findings
            </h4>
            <ul className="space-y-2">
              {salesSummary.keyFindings.map((f: string, i: number) => (
                <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  {f}
                </li>
              ))}
              {salesSummary.keyFindings.length === 0 && (
                <li className="text-sm text-slate-400">No key findings available.</li>
              )}
            </ul>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <TrendingUp size={14} className="text-emerald-500" /> Trends
            </h4>
            <ul className="space-y-2">
              {salesSummary.trends.map((t: string, i: number) => (
                <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">→</span>
                  {t}
                </li>
              ))}
              {salesSummary.trends.length === 0 && (
                <li className="text-sm text-slate-400">No trends identified.</li>
              )}
            </ul>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Activity size={14} className="text-purple-500" /> Suggested Charts
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {salesSummary.charts.map((chart: any, i: number) => (
              <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="font-bold text-slate-700 text-sm">{chart.title}</p>
                <p className="text-xs text-slate-500 mt-1">{chart.description}</p>
                <span className="text-[10px] font-semibold text-purple-600 uppercase mt-2 inline-block">{chart.type} chart</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderExpenseSummary = () => {
    if (!expenseSummary) return null;
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-lg text-slate-900 tracking-tight mb-2">{expenseSummary.title}</h3>
          <p className="text-slate-600 leading-relaxed">{expenseSummary.summary}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <BarChart3 size={14} className="text-blue-500" /> Key Findings
          </h4>
          <ul className="space-y-2">
            {expenseSummary.keyFindings.map((f: string, i: number) => (
              <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                {f}
              </li>
            ))}
            {expenseSummary.keyFindings.length === 0 && (
              <li className="text-sm text-slate-400">No key findings available.</li>
            )}
          </ul>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <DollarSign size={14} className="text-rose-500" /> Category Breakdown
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-slate-400 font-bold text-[10px] tracking-widest border-b border-slate-100 uppercase">
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {expenseSummary.categories.map((cat: any) => (
                  <tr key={cat.name} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-700">{cat.name}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">{formatCurrency(cat.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 bg-slate-100 rounded-full h-2">
                          <div className="bg-rose-400 h-2 rounded-full" style={{ width: `${Math.min(cat.percentOfTotal, 100)}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-600">{formatPercent(cat.percentOfTotal)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {expenseSummary.categories.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-slate-400">No expense categories found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Award size={14} className="text-emerald-500" /> Recommendations
          </h4>
          <ul className="space-y-2">
            {expenseSummary.recommendations.map((r: string, i: number) => (
              <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">→</span>
                {r}
              </li>
            ))}
            {expenseSummary.recommendations.length === 0 && (
              <li className="text-sm text-slate-400">No recommendations available.</li>
            )}
          </ul>
        </div>
      </div>
    );
  };

  const renderInventorySummary = () => {
    if (!inventorySummary) return null;
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-lg text-slate-900 tracking-tight mb-2">{inventorySummary.title}</h3>
          <p className="text-slate-600 leading-relaxed">{inventorySummary.summary}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm border-l-4 border-l-blue-500">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight mb-1">Total Items</p>
            <p className="text-lg font-bold text-slate-900">{inventorySummary.totalItems}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm border-l-4 border-l-emerald-500">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight mb-1">Total Value</p>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(inventorySummary.totalValue)}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm border-l-4 border-l-amber-500">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight mb-1">Low Stock</p>
            <p className="text-lg font-bold text-amber-600">{inventorySummary.lowStockItems}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm border-l-4 border-l-red-500">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight mb-1">Overstock</p>
            <p className="text-lg font-bold text-red-600">{inventorySummary.overstockItems}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Package size={14} className="text-blue-500" /> Top Moving Items
            </h4>
            {inventorySummary.topMovingItems.length > 0 ? (
              <ul className="space-y-2">
                {inventorySummary.topMovingItems.map((item: string, i: number) => (
                  <li key={i} className="text-sm text-slate-600 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">No movement data available.</p>
            )}
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Award size={14} className="text-emerald-500" /> Recommendations
            </h4>
            <ul className="space-y-2">
              {inventorySummary.recommendations.map((r: string, i: number) => (
                <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">→</span>
                  {r}
                </li>
              ))}
              {inventorySummary.recommendations.length === 0 && (
                <li className="text-sm text-slate-400">No recommendations available.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen w-full bg-[#f0f4f8] font-sans text-[13px] leading-[1.5] text-slate-700">
        <div className="flex items-center justify-center flex-1">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500 font-medium">Generating report summaries...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-[#f0f4f8] font-sans text-[13px] leading-[1.5] text-slate-700 overflow-hidden">
      <div className="bg-white border-b border-slate-200 shrink-0 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="font-bold text-2xl text-slate-900 tracking-tight">Report Summary</h2>
            <p className="text-slate-500 text-sm font-medium">AI-generated insights across all business areas</p>
          </div>
          <div className="relative">
            <button
              onClick={() => setPeriodSelectorOpen(!periodSelectorOpen)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
            >
              {period}
              <ChevronDown size={14} className={`transition-transform ${periodSelectorOpen ? 'rotate-180' : ''}`} />
            </button>
            {periodSelectorOpen && (
              <div className="absolute top-full right-0 mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                {PERIODS.map((p) => (
                  <button
                    key={p}
                    onClick={() => { setPeriod(p); setPeriodSelectorOpen(false); }}
                    className={`block w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors ${
                      period === p ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-1 mt-4 bg-slate-100 p-1 rounded-xl w-fit">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-6 custom-scrollbar bg-slate-50/50">
        <div className="max-w-[1600px] mx-auto">
          {activeTab === 'Executive Summary' && renderExecutiveSummary()}
          {activeTab === 'Financial Health' && renderFinancialHealth()}
          {activeTab === 'Sales' && renderSalesSummary()}
          {activeTab === 'Expenses' && renderExpenseSummary()}
          {activeTab === 'Inventory' && renderInventorySummary()}

          {!execSummary && !healthScore && !salesSummary && !expenseSummary && !inventorySummary && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <FileText size={48} className="mb-4 opacity-30" />
              <p className="text-lg font-semibold">No data available</p>
              <p className="text-sm">Select a different period or add some transactions.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportSummary;
