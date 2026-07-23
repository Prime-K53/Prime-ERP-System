import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Table2, Search, Filter, Download, FileSpreadsheet, FileText,
  ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown,
  Eye, EyeOff, Columns, PieChart, X, RotateCcw, Loader2
} from 'lucide-react';
import { useSales } from '../context/SalesContext';
import { useFinance } from '../context/FinanceContext';
import { useInventory } from '../context/InventoryContext';
import {
  exportToCsv, exportToPdf, filterData, paginateData, sortData, searchData,
  getColumnDefinitions, aggregateData, pivotData
} from '../services/advancedDataTableService';
import { useAuth } from '../context/AuthContext';

type DataSource = 'Sales' | 'Invoices' | 'Expenses' | 'Inventory' | 'Payments' | 'Customers';
type AggregateFn = 'sum' | 'avg' | 'count';
type TabMode = 'table' | 'pivot';

const DATA_SOURCES: DataSource[] = ['Sales', 'Invoices', 'Expenses', 'Inventory', 'Payments', 'Customers'];
const PAGE_SIZES = [10, 25, 50, 100];

const toSafeString = (v: unknown): string => v == null ? '' : String(v);

const formatCellValue = (value: unknown, type: string): string => {
  if (value == null) return '-';
  if (type === 'date') {
    const d = new Date(toSafeString(value));
    return isNaN(d.getTime()) ? toSafeString(value) : d.toLocaleDateString();
  }
  if (type === 'currency') return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (type === 'number') return Number(value).toLocaleString();
  if (type === 'boolean') return value ? 'Yes' : 'No';
  return toSafeString(value);
};

const AdvancedDataTable: React.FC = () => {
  const { notify } = useAuth();
  const { sales, customers } = useSales();
  const { invoices, expenses } = useFinance();
  const { inventory } = useInventory();

  const getDataSource = (source: string) => {
    switch (source) {
      case 'Sales': return sales || [];
      case 'Invoices': return invoices || [];
      case 'Expenses': return expenses || [];
      case 'Inventory': return inventory || [];
      case 'Payments': return [];
      case 'Customers': return customers || [];
      default: return [];
    }
  };

  const [dataSource, setDataSource] = useState<DataSource>('Sales');
  const rawData = useMemo(() => getDataSource(dataSource), [dataSource, sales, invoices, expenses, inventory, customers]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [showColumnPanel, setShowColumnPanel] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filters, setFilters] = useState<Record<string, any>>({});

  const [tabMode, setTabMode] = useState<TabMode>('table');
  const [pivotRowField, setPivotRowField] = useState('');
  const [pivotColField, setPivotColField] = useState('');
  const [pivotValueField, setPivotValueField] = useState('');
  const [pivotAggFn, setPivotAggFn] = useState<AggregateFn>('sum');

  const columns = useMemo(() => getColumnDefinitions(rawData), [rawData]);

  useEffect(() => {
    const vis: Record<string, boolean> = {};
    columns.forEach(c => { vis[c.key] = true; });
    setColumnVisibility(prev => {
      const merged = { ...vis };
      Object.keys(prev).forEach(k => { if (k in vis) merged[k] = prev[k]; });
      return merged;
    });
  }, [columns]);

  useEffect(() => {
    setPage(1);
  }, [dataSource, searchQuery, filters, sortBy, sortDir]);

  const searched = useMemo(() => searchData(rawData as any[], searchQuery), [rawData, searchQuery]);
  const filtered = useMemo(() => filterData(searched, filters), [searched, filters]);
  const sorted = useMemo(() => sortData(filtered, sortBy, sortDir), [filtered, sortBy, sortDir]);
  const paginated = useMemo(() => paginateData(sorted, page, pageSize), [sorted, page, pageSize]);

  const handleSort = useCallback((key: string) => {
    setSortBy(prev => {
      if (prev === key) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  const handleExportCsv = useCallback(() => {
    const visible = columns.filter(c => columnVisibility[c.key]);
    exportToCsv(filtered, `${dataSource}_export`, visible);
    notify?.('CSV exported successfully', 'success');
  }, [filtered, columns, columnVisibility, dataSource, notify]);

  const handleExportPdf = useCallback(() => {
    const visible = columns.filter(c => columnVisibility[c.key]);
    exportToPdf(filtered, `${dataSource} Report`, visible);
    notify?.('PDF report generated', 'success');
  }, [filtered, columns, columnVisibility, dataSource, notify]);

  const aggregationRow = useMemo(() => {
    if (filtered.length === 0) return null;
    const numericCols = columns.filter(c => c.type === 'number' || c.type === 'currency');
    const row: Record<string, string> = {};
    numericCols.forEach(col => {
      const values = filtered.map(r => Number(r[col.key])).filter(v => !isNaN(v));
      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        row[col.key] = col.type === 'currency'
          ? `${sum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (avg: ${avg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
          : `${sum.toLocaleString()} (avg: ${Math.round(avg).toLocaleString()})`;
      }
    });
    return row;
  }, [filtered, columns]);

  const pivotResult = useMemo(() => {
    if (!pivotRowField || !pivotColField || !pivotValueField || tabMode !== 'pivot') return [];
    try {
      return pivotData(filtered, [pivotRowField], [pivotColField], pivotValueField, pivotAggFn);
    } catch {
      return [];
    }
  }, [filtered, pivotRowField, pivotColField, pivotValueField, pivotAggFn, tabMode]);

  const pivotColValues = useMemo(() => {
    if (pivotResult.length === 0) return [];
    return Object.keys(pivotResult[0]).filter(k => k !== pivotRowField);
  }, [pivotResult, pivotRowField]);

  const visibleColumns = useMemo(() => columns.filter(c => columnVisibility[c.key]), [columns, columnVisibility]);

  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev: Record<string, any>) => {
      const next = { ...prev };
      if (value === null || value === undefined || value === '' || (typeof value === 'object' && !value.min && !value.max && !value.start && !value.end)) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
    setPage(1);
  };

  const hasActiveFilters = Object.keys(filters).length > 0 || searchQuery.length > 0;

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto flex flex-col h-full relative w-full">
      <div className="mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2 tracking-tight">
            <Table2 className="text-blue-600" size={20} /> Advanced Data Table
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Explore, filter, sort, and export your business data</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-white/70 backdrop-blur-md p-1 rounded-2xl border border-white/50 shadow-sm">
            <button
              onClick={() => setTabMode('table')}
              className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all ${tabMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'}`}
            >
              <Table2 size={14} className="inline mr-1" /> Table
            </button>
            <button
              onClick={() => setTabMode('pivot')}
              className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all ${tabMode === 'pivot' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'}`}
            >
              <PieChart size={14} className="inline mr-1" /> Pivot
            </button>
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-col md:flex-row gap-3 shrink-0">
        <select
          value={dataSource}
          onChange={e => setDataSource(e.target.value as DataSource)}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition-colors shadow-sm"
        >
          {DATA_SOURCES.map(ds => <option key={ds} value={ds}>{ds}</option>)}
        </select>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="text"
            placeholder="Search across all fields..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs w-full outline-none focus:ring-4 focus:ring-blue-500/5 shadow-sm transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <div className="relative">
            <button
              onClick={() => setShowColumnPanel(!showColumnPanel)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-xs font-bold ${showColumnPanel ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'}`}
            >
              <Columns size={14} /> Columns
            </button>
            {showColumnPanel && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Toggle Columns</label>
                  <button onClick={() => setShowColumnPanel(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
                  {columns.map(col => (
                    <label key={col.key} className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition-colors group">
                      <input
                        type="checkbox"
                        checked={columnVisibility[col.key] !== false}
                        onChange={() => setColumnVisibility(prev => ({ ...prev, [col.key]: prev[col.key] === false ? true : false }))}
                        className="w-4 h-4 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-[12px] font-medium text-slate-600 group-hover:text-blue-600 transition-colors">{col.label}</span>
                      <span className="ml-auto text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded">{col.type}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-xs font-bold ${showFilterPanel || hasActiveFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'}`}
          >
            <Filter size={14} /> Filters {hasActiveFilters && <span className="bg-blue-600 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">{Object.keys(filters).length + (searchQuery ? 1 : 0)}</span>}
          </button>

          <button onClick={handleExportCsv} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 shadow-sm transition-all">
            <FileSpreadsheet size={14} /> CSV
          </button>
          <button onClick={handleExportPdf} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 shadow-sm transition-all">
            <FileText size={14} /> PDF
          </button>

          {hasActiveFilters && (
            <button onClick={clearFilters} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 shadow-sm transition-all">
              <RotateCcw size={14} /> Reset
            </button>
          )}
        </div>
      </div>

      {showFilterPanel && (
        <div className="mb-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm animate-in fade-in slide-in-from-top-2 shrink-0">
          <div className="flex justify-between items-center mb-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Filter size={12} /> Filter By Column</label>
            <button onClick={() => setShowFilterPanel(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {columns.map(col => {
              const currentVal = filters[col.key];
              if (col.type === 'string') {
                return (
                  <div key={col.key} className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{col.label}</label>
                    <input
                      type="text"
                      placeholder={`Contains "${col.label}"...`}
                      value={typeof currentVal === 'string' ? currentVal : ''}
                      onChange={e => handleFilterChange(col.key, e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                );
              }
              if (col.type === 'number' || col.type === 'currency') {
                const rangeVal = currentVal as { min?: string; max?: string } | undefined;
                return (
                  <div key={col.key} className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{col.label}</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Min"
                        value={rangeVal?.min ?? ''}
                        onChange={e => handleFilterChange(col.key, { ...(rangeVal || {}), min: e.target.value ? Number(e.target.value) : undefined })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 transition-colors"
                      />
                      <input
                        type="number"
                        placeholder="Max"
                        value={rangeVal?.max ?? ''}
                        onChange={e => handleFilterChange(col.key, { ...(rangeVal || {}), max: e.target.value ? Number(e.target.value) : undefined })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>
                );
              }
              if (col.type === 'date') {
                const dateVal = currentVal as { start?: string; end?: string } | undefined;
                return (
                  <div key={col.key} className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{col.label}</label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={dateVal?.start ?? ''}
                        onChange={e => handleFilterChange(col.key, { ...(dateVal || {}), start: e.target.value || undefined })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 transition-colors"
                      />
                      <input
                        type="date"
                        value={dateVal?.end ?? ''}
                        onChange={e => handleFilterChange(col.key, { ...(dateVal || {}), end: e.target.value || undefined })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>
                );
              }
              if (col.type === 'boolean') {
                return (
                  <div key={col.key} className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{col.label}</label>
                    <select
                      value={currentVal === undefined ? '' : currentVal ? 'true' : 'false'}
                      onChange={e => {
                        const v = e.target.value;
                        handleFilterChange(col.key, v === '' ? undefined : v === 'true');
                      }}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 transition-colors"
                    >
                      <option value="">All</option>
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>
      )}

      {tabMode === 'pivot' && (
        <div className="mb-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Row Field</label>
              <select
                value={pivotRowField}
                onChange={e => setPivotRowField(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">Select row field...</option>
                {columns.map(col => <option key={col.key} value={col.key}>{col.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Column Field</label>
              <select
                value={pivotColField}
                onChange={e => setPivotColField(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">Select column field...</option>
                {columns.map(col => <option key={col.key} value={col.key}>{col.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Value Field</label>
              <select
                value={pivotValueField}
                onChange={e => setPivotValueField(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">Select value field...</option>
                {columns.filter(c => c.type === 'number' || c.type === 'currency').map(col => <option key={col.key} value={col.key}>{col.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aggregate</label>
              <select
                value={pivotAggFn}
                onChange={e => setPivotAggFn(e.target.value as AggregateFn)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-blue-500 transition-colors"
              >
                <option value="sum">Sum</option>
                <option value="avg">Average</option>
                <option value="count">Count</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="animate-spin text-blue-600" size={32} />
            <p className="text-sm font-bold">Loading data...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-rose-500">
            <p className="text-sm font-bold">Failed to load data</p>
            <p className="text-xs text-slate-400">{error}</p>
          </div>
        </div>
      ) : tabMode === 'pivot' ? (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm">
          {pivotResult.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <PieChart size={48} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm font-bold">Configure pivot fields above</p>
                <p className="text-xs mt-1">Select row, column, and value fields to generate the pivot table</p>
              </div>
            </div>
          ) : (
            <div className="overflow-auto custom-scrollbar flex-1">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 font-bold text-[10px] tracking-widest border-b border-slate-100 uppercase bg-slate-50">
                    <th className="px-4 py-3 sticky left-0 bg-slate-50 shadow-sm z-10">{pivotRowField}</th>
                    {pivotColValues.map(col => <th key={col} className="px-4 py-3 text-right">{col}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pivotResult.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-700 sticky left-0 bg-white shadow-sm">{row[pivotRowField]}</td>
                      {pivotColValues.map(col => (
                        <td key={col} className="px-4 py-3 text-right tabular-nums text-slate-600">{Number(row[col] ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm">
          {rawData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <Table2 size={48} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm font-bold">No data available</p>
                <p className="text-xs mt-1">Select a different data source or adjust your filters</p>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-auto custom-scrollbar flex-1">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-400 font-bold text-[10px] tracking-widest border-b border-slate-100 uppercase bg-slate-50">
                      {visibleColumns.map(col => (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          className="px-4 py-3 cursor-pointer hover:text-slate-700 transition-colors whitespace-nowrap select-none"
                        >
                          <span className="flex items-center gap-1">
                            {col.label}
                            {sortBy === col.key ? (
                              sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                            ) : (
                              <ArrowUpDown size={10} className="opacity-30" />
                            )}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginated.data.length === 0 ? (
                      <tr>
                        <td colSpan={visibleColumns.length} className="px-4 py-12 text-center text-slate-400">
                          <p className="text-sm font-bold">No matching records</p>
                          <p className="text-xs mt-1">Try adjusting your filters or search terms</p>
                        </td>
                      </tr>
                    ) : (
                      paginated.data.map((row, rowIdx) => (
                        <tr key={rowIdx} className={`hover:bg-slate-50 transition-colors ${rowIdx % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                          {visibleColumns.map(col => (
                            <td key={col.key} className="px-4 py-3 text-slate-600 whitespace-nowrap max-w-[300px] truncate">
                              {formatCellValue(row[col.key], col.type)}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                  {aggregationRow && (
                    <tfoot>
                      <tr className="bg-blue-50/70 border-t-2 border-blue-200 font-semibold text-slate-800">
                        {visibleColumns.map(col => (
                          <td key={col.key} className="px-4 py-3 whitespace-nowrap text-xs">
                            {(col.type === 'number' || col.type === 'currency') && aggregationRow[col.key]
                              ? <span className="tabular-nums">{aggregationRow[col.key]}</span>
                              : col === visibleColumns[0] ? 'Totals (Sum / Avg)' : '-'}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              <div className="shrink-0 flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-white rounded-b-2xl">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-500 font-medium">
                    {paginated.totalItems > 0
                      ? `${(paginated.currentPage - 1) * pageSize + 1}-${Math.min(paginated.currentPage * pageSize, paginated.totalItems)} of ${paginated.totalItems} items`
                      : '0 items'}
                  </span>
                  <select
                    value={pageSize}
                    onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-600 outline-none focus:border-blue-500 transition-colors"
                  >
                    {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={!paginated.hasPrev}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: Math.min(paginated.totalPages, 5) }, (_, i) => {
                    const start = Math.max(1, paginated.currentPage - 2);
                    const pageNum = start + i;
                    if (pageNum > paginated.totalPages) return null;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${paginated.currentPage === pageNum ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 border border-slate-200'}`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(paginated.totalPages, p + 1))}
                    disabled={!paginated.hasNext}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedDataTable;
