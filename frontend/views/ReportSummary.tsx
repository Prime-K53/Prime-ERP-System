import React, { useState } from 'react';
import {
  TrendingUp, TrendingDown, FileText, Activity, BarChart3, DollarSign,
  Sparkles, Award, AlertTriangle, Package, ArrowUp, ArrowDown,
  ChevronDown, BrainCircuit, ChevronRight, HeartPulse, ShoppingCart, Target
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

const TABS: { key: ReportTab; label: string; icon: React.FC<{ size?: number }>; desc: string; color: string }[] = [
  { key: 'Executive Summary', label: 'Executive Summary', icon: FileText, desc: 'High-level business overview', color: '#6366f1' },
  { key: 'Financial Health', label: 'Financial Health', icon: HeartPulse, desc: 'Scorecard and risk analysis', color: '#10b981' },
  { key: 'Sales', label: 'Sales Report', icon: ShoppingCart, desc: 'Revenue and sales insights', color: '#06b6d4' },
  { key: 'Expenses', label: 'Expense Report', icon: DollarSign, desc: 'Spending and category breakdown', color: '#f59e0b' },
  { key: 'Inventory', label: 'Inventory Report', icon: Package, desc: 'Stock levels and turnover', color: '#7c3aed' },
];

const PERIODS = ['This Month', 'This Quarter', 'This Year', 'All Time'] as const;
type Period = typeof PERIODS[number];

const getDateRange = (period: Period): { start: string; end: string } => {
  const now = new Date();
  const end = now.toISOString();
  let start: Date;
  switch (period) {
    case 'This Month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'This Quarter': { const q = Math.floor(now.getMonth() / 3) * 3; start = new Date(now.getFullYear(), q, 1); break; }
    case 'This Year': start = new Date(now.getFullYear(), 0, 1); break;
    default: start = new Date(2000, 0, 1);
  }
  return { start: start.toISOString(), end };
};

const ReportSummary: React.FC = () => {
  const { companyConfig } = useAuth();
  const currency = companyConfig?.currencySymbol || 'MK';

  const [activeTab, setActiveTab] = useState<ReportTab>('Executive Summary');
  const [period, setPeriod] = useState<Period>('This Month');
  const [periodOpen, setPeriodOpen] = useState(false);
  const periodRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (periodRef.current && !periodRef.current.contains(e.target as Node)) setPeriodOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { sales } = useSales();
  const { invoices, expenses } = useFinance();
  const { inventory } = useInventory();

  const dateRange = getDateRange(period);

  const execSummary = generateExecutiveSummary({
    sales: sales || [], invoices: invoices || [], expenses: expenses || [], inventory: inventory || [], dateRange,
  });

  const totalRevenue = execSummary.metrics.find((m: any) => m.label === 'Total Revenue');
  const totalExpenses = execSummary.metrics.find((m: any) => m.label === 'Total Expenses');
  const revenue = parseFloat((totalRevenue?.value || '').replace(/[^0-9.-]/g, '')) || 0;
  const expensesVal = parseFloat((totalExpenses?.value || '').replace(/[^0-9.-]/g, '')) || 0;
  const profitMargin = revenue > 0 ? ((revenue - expensesVal) / revenue) * 100 : 0;

  const healthScore = generateFinancialHealthScore({
    revenue, expenses: expensesVal, assets: revenue * 1.5, liabilities: expensesVal * 0.6,
    equity: revenue, profitMargin, currentRatio: 1.8,
  });

  const salesSummary = generateSalesReportSummary(sales || [], invoices || [], period);
  const expenseSummary = generateExpenseReportSummary(expenses || [], period);
  const inventorySummary = generateInventoryReportSummary(inventory || [], []);

  const renderContent = () => {
    switch (activeTab) {
      case 'Executive Summary': return renderExecutiveSummary();
      case 'Financial Health': return renderFinancialHealth();
      case 'Sales': return renderSalesSummary();
      case 'Expenses': return renderExpenseSummary();
      case 'Inventory': return renderInventorySummary();
      default: return null;
    }
  };

  const renderExecutiveSummary = () => {
    if (!execSummary) return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <GlassCard>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: '0 0 8px', letterSpacing: '-0.01em' }}>{execSummary.title}</h3>
          <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.6 }}>{execSummary.summary}</p>
        </GlassCard>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {execSummary.metrics.filter((m: any) => m.label !== 'Top Category' && m.label !== 'Top Customer' && m.label !== 'Inventory Turnover').map((metric: any) => (
            <div key={metric.label} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: '1px solid #e2e8f0', borderLeft: '3px solid #6366f1' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 4px', letterSpacing: '0.02em' }}>{metric.label}</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{metric.value}</p>
              {metric.change && (
                <p style={{ fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, margin: '4px 0 0', color: metric.direction === 'up' ? '#16a34a' : metric.direction === 'down' ? '#dc2626' : '#94a3b8' }}>
                  {metric.direction === 'up' ? <ArrowUp size={11} /> : metric.direction === 'down' ? <ArrowDown size={11} /> : null}
                  {metric.change}
                </p>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <GlassCard>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={13} color="#f59e0b" /> Highlights
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {execSummary.highlights.map((h: string, i: number) => (
                <li key={i} style={{ fontSize: 13, color: '#475569', padding: '5px 0', display: 'flex', alignItems: 'flex-start', gap: 8, borderBottom: i < execSummary.highlights.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <span style={{ color: '#6366f1', flexShrink: 0, marginTop: 2 }}>&bull;</span>
                  {h}
                </li>
              ))}
              {execSummary.highlights.length === 0 && <li style={{ fontSize: 13, color: '#94a3b8', padding: '8px 0' }}>No highlights available.</li>}
            </ul>
          </GlassCard>
          <GlassCard>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Award size={13} color="#10b981" /> Recommendations
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {execSummary.recommendations.map((r: string, i: number) => (
                <li key={i} style={{ fontSize: 13, color: '#475569', padding: '5px 0', display: 'flex', alignItems: 'flex-start', gap: 8, borderBottom: i < execSummary.recommendations.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <span style={{ color: '#10b981', flexShrink: 0, marginTop: 2 }}>&rarr;</span>
                  {r}
                </li>
              ))}
              {execSummary.recommendations.length === 0 && <li style={{ fontSize: 13, color: '#94a3b8', padding: '8px 0' }}>No recommendations available.</li>}
            </ul>
          </GlassCard>
        </div>
      </div>
    );
  };

  const renderFinancialHealth = () => {
    if (!healthScore) return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <GlassCard style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>Financial Health Score</p>
          <div style={{ fontSize: 48, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1 }}>{healthScore.score}</div>
          <div style={{ fontSize: 40, fontWeight: 900, color: getGradeColor(healthScore.grade), marginTop: 4 }}>{healthScore.grade}</div>
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>Overall Financial Health Grade</p>
        </GlassCard>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {healthScore.breakdown.map((item: any) => (
            <GlassCard key={item.category}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0 }}>{item.category}</h4>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{item.score}/{item.maxScore}</span>
              </div>
              <div style={{ height: 8, backgroundColor: '#f1f5f9', borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', borderRadius: 999, backgroundColor: getProgressColor(item.score, item.maxScore), width: `${(item.score / item.maxScore) * 100}%`, transition: 'width 0.5s' }} />
              </div>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{item.comment}</p>
            </GlassCard>
          ))}
        </div>
      </div>
    );
  };

  const renderSalesSummary = () => {
    if (!salesSummary) return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <GlassCard>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: '0 0 8px', letterSpacing: '-0.01em' }}>{salesSummary.title}</h3>
          <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.6 }}>{salesSummary.summary}</p>
        </GlassCard>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <GlassCard>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <BarChart3 size={13} color="#06b6d4" /> Key Findings
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {salesSummary.keyFindings.map((f: string, i: number) => (
                <li key={i} style={{ fontSize: 13, color: '#475569', padding: '5px 0', display: 'flex', alignItems: 'flex-start', gap: 8, borderBottom: i < salesSummary.keyFindings.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <span style={{ color: '#06b6d4', flexShrink: 0, marginTop: 2 }}>&bull;</span>
                  {f}
                </li>
              ))}
              {salesSummary.keyFindings.length === 0 && <li style={{ fontSize: 13, color: '#94a3b8', padding: '8px 0' }}>No key findings available.</li>}
            </ul>
          </GlassCard>
          <GlassCard>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={13} color="#10b981" /> Trends
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {salesSummary.trends.map((t: string, i: number) => (
                <li key={i} style={{ fontSize: 13, color: '#475569', padding: '5px 0', display: 'flex', alignItems: 'flex-start', gap: 8, borderBottom: i < salesSummary.trends.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <span style={{ color: '#10b981', flexShrink: 0, marginTop: 2 }}>&rarr;</span>
                  {t}
                </li>
              ))}
              {salesSummary.trends.length === 0 && <li style={{ fontSize: 13, color: '#94a3b8', padding: '8px 0' }}>No trends identified.</li>}
            </ul>
          </GlassCard>
        </div>
        <GlassCard>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={13} color="#7c3aed" /> Suggested Charts
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {salesSummary.charts.map((chart: any, i: number) => (
              <div key={i} style={{ background: '#f8fafc', borderRadius: 10, padding: '14px', border: '1px solid #e2e8f0' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0 }}>{chart.title}</p>
                <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0' }}>{chart.description}</p>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', marginTop: 6, display: 'inline-block' }}>{chart.type} chart</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    );
  };

  const renderExpenseSummary = () => {
    if (!expenseSummary) return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <GlassCard>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: '0 0 8px', letterSpacing: '-0.01em' }}>{expenseSummary.title}</h3>
          <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.6 }}>{expenseSummary.summary}</p>
        </GlassCard>
        <GlassCard>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <BarChart3 size={13} color="#f59e0b" /> Key Findings
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {expenseSummary.keyFindings.map((f: string, i: number) => (
              <li key={i} style={{ fontSize: 13, color: '#475569', padding: '5px 0', display: 'flex', alignItems: 'flex-start', gap: 8, borderBottom: i < expenseSummary.keyFindings.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <span style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }}>&bull;</span>
                {f}
              </li>
            ))}
            {expenseSummary.keyFindings.length === 0 && <li style={{ fontSize: 13, color: '#94a3b8', padding: '8px 0' }}>No key findings available.</li>}
          </ul>
        </GlassCard>
        <GlassCard>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <DollarSign size={13} color="#dc2626" /> Category Breakdown
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Category</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Amount</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseSummary.categories.map((cat: any) => (
                    <tr key={cat.name} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fafbfc'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>{cat.name}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(cat.amount)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                          <div style={{ width: 60, height: 6, backgroundColor: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                            <div style={{ height: '100%', backgroundColor: '#dc2626', borderRadius: 999, width: `${Math.min(cat.percentOfTotal, 100)}%` }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>{formatPercent(cat.percentOfTotal)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {expenseSummary.categories.length === 0 && (
                    <tr><td colSpan={3} style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No expense categories found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </GlassCard>
        <GlassCard>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Award size={13} color="#10b981" /> Recommendations
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {expenseSummary.recommendations.map((r: string, i: number) => (
              <li key={i} style={{ fontSize: 13, color: '#475569', padding: '5px 0', display: 'flex', alignItems: 'flex-start', gap: 8, borderBottom: i < expenseSummary.recommendations.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <span style={{ color: '#10b981', flexShrink: 0, marginTop: 2 }}>&rarr;</span>
                {r}
              </li>
            ))}
            {expenseSummary.recommendations.length === 0 && <li style={{ fontSize: 13, color: '#94a3b8', padding: '8px 0' }}>No recommendations available.</li>}
          </ul>
        </GlassCard>
      </div>
    );
  };

  const renderInventorySummary = () => {
    if (!inventorySummary) return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <GlassCard>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: '0 0 8px', letterSpacing: '-0.01em' }}>{inventorySummary.title}</h3>
          <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.6 }}>{inventorySummary.summary}</p>
        </GlassCard>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: '1px solid #e2e8f0', borderLeft: '3px solid #6366f1' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 4px' }}>Total Items</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>{inventorySummary.totalItems}</p>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: '1px solid #e2e8f0', borderLeft: '3px solid #10b981' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 4px' }}>Total Value</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>{formatCurrency(inventorySummary.totalValue)}</p>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: '1px solid #e2e8f0', borderLeft: '3px solid #f59e0b' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 4px' }}>Low Stock</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#b45309', margin: 0 }}>{inventorySummary.lowStockItems}</p>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: '1px solid #e2e8f0', borderLeft: '3px solid #dc2626' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 4px' }}>Overstock</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#dc2626', margin: 0 }}>{inventorySummary.overstockItems}</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <GlassCard>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Package size={13} color="#6366f1" /> Top Moving Items
            </div>
            {inventorySummary.topMovingItems.length > 0 ? (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {inventorySummary.topMovingItems.map((item: string, i: number) => (
                  <li key={i} style={{ fontSize: 13, color: '#475569', padding: '6px 0', display: 'flex', alignItems: 'center', gap: 10, borderBottom: i < inventorySummary.topMovingItems.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    <span style={{ width: 22, height: 22, borderRadius: 999, backgroundColor: '#eef2ff', color: '#6366f1', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>No movement data available.</p>
            )}
          </GlassCard>
          <GlassCard>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Award size={13} color="#10b981" /> Recommendations
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {inventorySummary.recommendations.map((r: string, i: number) => (
                <li key={i} style={{ fontSize: 13, color: '#475569', padding: '5px 0', display: 'flex', alignItems: 'flex-start', gap: 8, borderBottom: i < inventorySummary.recommendations.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <span style={{ color: '#10b981', flexShrink: 0, marginTop: 2 }}>&rarr;</span>
                  {r}
                </li>
              ))}
              {inventorySummary.recommendations.length === 0 && <li style={{ fontSize: 13, color: '#94a3b8', padding: '8px 0' }}>No recommendations available.</li>}
            </ul>
          </GlassCard>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0f4f8 0%, #eef2ff 100%)',
      padding: '20px',
      fontFamily: "'Inter', -apple-system, sans-serif",
      color: '#1e293b',
    }}>
      <div style={{ maxWidth: 1520, width: '100%', margin: '0 auto', display: 'flex', gap: 16, alignItems: 'stretch' }}>
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', borderRadius: 16, padding: '20px 18px', color: '#fff', boxShadow: '0 8px 32px rgba(15,23,42,0.12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
                <BrainCircuit size={18} />
              </div>
              <div>
                <h1 style={{ fontSize: 15, fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>Report</h1>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', margin: 0, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Summary</p>
              </div>
            </div>
            <div ref={periodRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setPeriodOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '8px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#cbd5e1', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              >
                <FileText size={13} /> {period} <ChevronDown size={12} style={{ transition: 'transform 0.15s', transform: periodOpen ? 'rotate(180deg)' : 'none' }} />
              </button>
              {periodOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 50, overflow: 'hidden' }}>
                  {PERIODS.map(p => (
                    <button key={p} onClick={() => { setPeriod(p); setPeriodOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 12, fontWeight: period === p ? 700 : 500, color: period === p ? '#4F46E5' : '#475569', backgroundColor: period === p ? '#EEF2FF' : 'transparent', border: 'none', cursor: 'pointer', transition: 'background-color 0.1s' }}>
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '10px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            {TABS.map(tab => {
              const isActive = activeTab === tab.key;
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, border: 'none', background: isActive ? '#fff' : 'transparent', boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.06)' : 'none', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s', marginBottom: 2 }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: isActive ? `${tab.color}15` : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <tab.icon size={15} color={isActive ? tab.color : '#94a3b8'} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: isActive ? 700 : 600, color: isActive ? '#0f172a' : '#475569' }}>{tab.label}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tab.desc}</div>
                  </div>
                  {isActive && <ChevronRight size={14} color={tab.color} />}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <SidebarKpi label="Revenue" value={revenue > 0 ? formatCurrency(revenue) : '-'} color="#6366f1" sub="total" />
            <SidebarKpi label="Expenses" value={expensesVal > 0 ? formatCurrency(expensesVal) : '-'} color="#dc2626" sub="total" />
            <SidebarKpi label="Margin" value={profitMargin > 0 ? `${profitMargin.toFixed(1)}%` : '-'} color={profitMargin >= 0 ? '#16a34a' : '#dc2626'} sub="profit margin" />
            <SidebarKpi label="Health" value={healthScore ? `${healthScore.score}` : '-'} color={healthScore?.score >= 70 ? '#16a34a' : '#dc2626'} sub={`grade ${healthScore?.grade || '-'}`} />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '24px', overflow: 'auto' }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

const getGradeColor = (grade: string) => {
  switch (grade) {
    case 'A': return '#059669';
    case 'B': return '#2563eb';
    case 'C': return '#b45309';
    case 'D': return '#ea580c';
    case 'F': return '#dc2626';
    default: return '#64748b';
  }
};

const getProgressColor = (score: number, maxScore: number) => {
  const pct = (score / maxScore) * 100;
  if (pct >= 80) return '#10b981';
  if (pct >= 60) return '#3b82f6';
  if (pct >= 40) return '#f59e0b';
  return '#ef4444';
};

const GlassCard: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderRadius: 16, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid rgba(255,255,255,0.6)', ...style }}>
    {children}
  </div>
);

const SidebarKpi: React.FC<{ label: string; value: string; color: string; sub: string }> = ({ label, value, color, sub }) => (
  <div style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)', borderRadius: 12, padding: '12px', border: '1px solid rgba(255,255,255,0.6)', textAlign: 'center' }}>
    <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
    <div style={{ fontSize: 9, color: '#94a3b8' }}>{sub}</div>
  </div>
);

export default ReportSummary;