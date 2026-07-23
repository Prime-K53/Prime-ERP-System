import { startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, startOfYear, endOfYear, format, parseISO, isWithinInterval } from 'date-fns';

export interface InterpretedQuery {
  type: 'unpaid_invoices' | 'sales_by_branch' | 'large_expenses' | 'top_customers' | 'sales_trend' | 'inventory_alert' | 'customer_history' | 'profit_analysis' | 'unknown';
  params: Record<string, any>;
}

export interface QueryResultColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'currency';
}

export interface QueryResult {
  type: string;
  title: string;
  description: string;
  data: any[];
  summary: string;
  columns: QueryResultColumn[];
}

export interface QuerySuggestion {
  query: string;
  description: string;
  icon: string;
}

const periodMap: Record<string, string> = {
  'this month': 'month',
  'this quarter': 'quarter',
  'this year': 'year',
  'last month': 'month',
  'last quarter': 'quarter',
  'last year': 'year',
  month: 'month',
  quarterly: 'quarter',
  quarter: 'quarter',
  yearly: 'year',
  year: 'year',
  weekly: 'week',
  week: 'week',
  today: 'day',
  daily: 'day',
  day: 'day',
};

const quarterRx = /q([1-4])/i;
const offsetRx = /last\s+(\d+)\s+(month|year|quarter|week|day)s?/i;

const extractPeriod = (query: string): { period: string; offset: number; quarter?: number } | null => {
  const lower = query.toLowerCase();
  const qMatch = lower.match(quarterRx);
  if (qMatch) return { period: 'quarter', offset: 0, quarter: parseInt(qMatch[1], 10) };

  const offsetMatch = lower.match(offsetRx);
  if (offsetMatch) return { period: offsetMatch[2], offset: parseInt(offsetMatch[1], 10) };

  for (const [phrase, period] of Object.entries(periodMap)) {
    if (lower.includes(phrase)) {
      const hasLast = lower.includes('last ') || lower.includes('previous ');
      return { period, offset: hasLast ? 1 : 0 };
    }
  }

  return null;
};

const extractCurrency = (query: string): string => {
  const currencies = ['MWK', 'USD', 'EUR', 'GBP', 'ZAR', 'KES', 'TZS', 'NGN', 'GHS'];
  for (const c of currencies) {
    if (query.includes(c)) return c;
  }
  return 'MWK';
};

const extractAmount = (query: string): number | null => {
  const numRx = /(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)/g;
  const matches = query.match(numRx);
  if (!matches) return null;
  const cleaned = matches[matches.length - 1].replace(/,/g, '');
  const val = parseFloat(cleaned);
  return Number.isFinite(val) ? val : null;
};

const extractLimit = (query: string): number => {
  const topRx = /top\s+(\d+)/i;
  const match = query.match(topRx);
  if (match) return parseInt(match[1], 10);
  return 10;
};

const extractCustomerName = (query: string): string | null => {
  const patterns = [
    /customer\s+(\w+(?:\s+\w+)?)/i,
    /client\s+(\w+(?:\s+\w+)?)/i,
    /did\s+(\w+(?:\s+\w+)?)\s+buy/i,
    /for\s+(\w+(?:\s+\w+)?)/i,
  ];
  for (const rx of patterns) {
    const match = query.match(rx);
    if (match) return match[1];
  }
  return null;
};

export const interpretQuery = (query: string): InterpretedQuery => {
  const lower = query.toLowerCase().trim();

  if (/unpaid\s+invoices?|outstanding\s+invoices?|pending\s+payments?|due\s+invoices?/.test(lower)) {
    return { type: 'unpaid_invoices', params: {} };
  }

  if (/sales\s+by\s+branch|branch.*sales|revenue\s+by\s+branch/.test(lower)) {
    const period = extractPeriod(query);
    return { type: 'sales_by_branch', params: { ...(period || { period: 'all', offset: 0 }) } };
  }

  if (/expenses?\s+(over|above|exceeding|greater\s+than|more\s+than)|large\s+expenses?|big\s+expenses?/.test(lower)) {
    const minAmount = extractAmount(query) || 500000;
    const currency = extractCurrency(query);
    return { type: 'large_expenses', params: { minAmount, currency } };
  }

  if (/top\s+\d+\s+customers?|best\s+customers?|highest.*customers?|leading\s+customers?/.test(lower)) {
    const limit = extractLimit(query);
    const period = extractPeriod(query);
    return { type: 'top_customers', params: { limit, ...(period || { period: 'all', offset: 0 }) } };
  }

  if (/sales?\s+trend|month.*sales|sales.*month|sales.*quarter|sales.*year|sales.*period|last month.*sales|sales.*last|trend/.test(lower)) {
    const period = extractPeriod(query) || { period: 'all', offset: 0 };
    return { type: 'sales_trend', params: period };
  }

  if (/inventory\s+(alert|below|low|reorder|shortage|stock)|low\s+stock|stock\s+alert|reorder\s+level/.test(lower)) {
    return { type: 'inventory_alert', params: {} };
  }

  if (/customer\s+history|what\s+did\s+\w+\s+buy|purchases?\s+by\s+\w+|client\s+history/.test(lower)) {
    const customerName = extractCustomerName(query) || 'Unknown';
    return { type: 'customer_history', params: { customerName } };
  }

  if (/profit\s+(margin|analysis|report)|profitability|gross\s+profit|margin\s+analysis/.test(lower)) {
    const period = extractPeriod(query);
    const quarterMatch = query.match(quarterRx);
    return {
      type: 'profit_analysis',
      params: {
        ...(period || { period: 'all', offset: 0 }),
        ...(quarterMatch ? { quarter: parseInt(quarterMatch[1], 10) } : {}),
      },
    };
  }

  if (/most\s+profitable\s+products?|top\s+products?|best\s+sellers?|high.*margin/.test(lower)) {
    return { type: 'profit_analysis', params: { focus: 'products' } };
  }

  return { type: 'unknown', params: {} };
};

const filterByPeriod = (items: any[], dateField: string, period: string, offset: number, quarter?: number): any[] => {
  if (!period || period === 'all') return items;

  const now = new Date();
  let start: Date;
  let end: Date;

  if (period === 'quarter' && quarter) {
    start = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
    end = new Date(now.getFullYear(), quarter * 3, 0);
  } else if (period === 'month') {
    const target = subMonths(now, offset || 0);
    start = startOfMonth(target);
    end = endOfMonth(target);
  } else if (period === 'quarter') {
    const q = Math.floor(now.getMonth() / 3) - (offset || 0);
    start = startOfQuarter(new Date(now.getFullYear(), q * 3, 1));
    end = endOfQuarter(new Date(now.getFullYear(), q * 3, 1));
  } else if (period === 'year') {
    const targetYear = now.getFullYear() - (offset || 0);
    start = startOfYear(new Date(targetYear, 0, 1));
    end = endOfYear(new Date(targetYear, 0, 1));
  } else {
    return items;
  }

  return items.filter((item: any) => {
    const d = parseISO(String(item[dateField] || ''));
    return isWithinInterval(d, { start, end });
  });
};

const formatCurrency = (amount: number, currency: string = 'MWK'): string => {
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const sumBy = (items: any[], field: string): number =>
  items.reduce((sum: number, item: any) => sum + (Number(item[field]) || 0), 0);

const groupBy = (items: any[], key: string): Record<string, any[]> =>
  items.reduce((acc: Record<string, any[]>, item: any) => {
    const k = String(item[key] || 'Unknown');
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});

const executeUnpaidInvoices = (invoices: any[]): QueryResult => {
  const unpaid = invoices.filter((inv: any) =>
    inv.status !== 'paid' && inv.status !== 'cancelled' && (Number(inv.balance) || Number(inv.amount) || 0) > 0
  );
  const total = sumBy(unpaid, 'balance') || sumBy(unpaid, 'amount');
  return {
    type: 'unpaid_invoices',
    title: 'Unpaid Invoices',
    description: `${unpaid.length} unpaid invoice(s) totaling ${formatCurrency(total)}`,
    data: unpaid,
    summary: `${unpaid.length} outstanding invoice(s) with a total balance of ${formatCurrency(total)}`,
    columns: [
      { key: 'invoiceNumber', label: 'Invoice #', type: 'string' },
      { key: 'customerName', label: 'Customer', type: 'string' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'dueDate', label: 'Due Date', type: 'date' },
      { key: 'amount', label: 'Amount', type: 'currency' },
      { key: 'balance', label: 'Balance', type: 'currency' },
      { key: 'status', label: 'Status', type: 'string' },
    ],
  };
};

const executeSalesByBranch = (sales: any[], params: Record<string, any>): QueryResult => {
  const filtered = filterByPeriod(sales, 'date', params.period, params.offset, params.quarter);
  const grouped = groupBy(filtered, 'branch' as string);
  const data = Object.entries(grouped).map(([branch, items]) => ({
    branch,
    count: items.length,
    total: items.reduce((s: number, i: any) => s + (Number(i.total) || Number(i.amount) || 0), 0),
  }));
  const grandTotal = sumBy(data, 'total');
  return {
    type: 'sales_by_branch',
    title: 'Sales by Branch',
    description: `Sales breakdown across ${data.length} branch(es)`,
    data,
    summary: `${data.length} branches, total sales ${formatCurrency(grandTotal)}`,
    columns: [
      { key: 'branch', label: 'Branch', type: 'string' },
      { key: 'count', label: 'Transactions', type: 'number' },
      { key: 'total', label: 'Total Sales', type: 'currency' },
    ],
  };
};

const executeLargeExpenses = (expenses: any[], params: Record<string, any>): QueryResult => {
  const minAmount = params.minAmount || 500000;
  const currency = params.currency || 'MWK';
  const large = expenses.filter((exp: any) => (Number(exp.amount) || 0) >= minAmount).sort((a: any, b: any) => (Number(b.amount) || 0) - (Number(a.amount) || 0));
  const total = sumBy(large, 'amount');
  return {
    type: 'large_expenses',
    title: `Large Expenses (>= ${formatCurrency(minAmount, currency)})`,
    description: `${large.length} expense(s) of ${formatCurrency(minAmount, currency)} or more`,
    data: large,
    summary: `${large.length} expense(s) totaling ${formatCurrency(total, currency)}`,
    columns: [
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'description', label: 'Description', type: 'string' },
      { key: 'category', label: 'Category', type: 'string' },
      { key: 'amount', label: 'Amount', type: 'currency' },
      { key: 'vendor', label: 'Vendor', type: 'string' },
    ],
  };
};

const executeTopCustomers = (sales: any[], params: Record<string, any>): QueryResult => {
  const limit = params.limit || 10;
  const filtered = filterByPeriod(sales, 'date', params.period, params.offset);
  const grouped = groupBy(filtered, 'customerName' as string);
  const data = Object.entries(grouped)
    .map(([name, items]) => ({
      customerName: name,
      transactionCount: items.length,
      totalSpent: items.reduce((s: number, i: any) => s + (Number(i.total) || Number(i.amount) || 0), 0),
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, limit);
  const grandTotal = sumBy(data, 'totalSpent');
  return {
    type: 'top_customers',
    title: `Top ${limit} Customers`,
    description: `${data.length} top customer(s) by spending`,
    data,
    summary: `Top ${data.length} customer(s) with total spending of ${formatCurrency(grandTotal)}`,
    columns: [
      { key: 'customerName', label: 'Customer', type: 'string' },
      { key: 'transactionCount', label: 'Transactions', type: 'number' },
      { key: 'totalSpent', label: 'Total Spent', type: 'currency' },
    ],
  };
};

const executeSalesTrend = (sales: any[], params: Record<string, any>): QueryResult => {
  const filtered = filterByPeriod(sales, 'date', params.period, params.offset, params.quarter);
  const grouped = groupBy(filtered, 'date' as string);
  const data = Object.entries(grouped)
    .map(([date, items]) => ({
      date,
      count: items.length,
      total: items.reduce((s: number, i: any) => s + (Number(i.total) || Number(i.amount) || 0), 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const grandTotal = sumBy(data, 'total');
  return {
    type: 'sales_trend',
    title: 'Sales Trend',
    description: `Sales trend over ${data.length} period(s)`,
    data,
    summary: `${data.length} data points, total ${formatCurrency(grandTotal)}`,
    columns: [
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'count', label: 'Transactions', type: 'number' },
      { key: 'total', label: 'Total', type: 'currency' },
    ],
  };
};

const executeInventoryAlert = (inventory: any[], purchases: any[]): QueryResult => {
  const reorderField = inventory.some((i: any) => 'reorderLevel' in i) ? 'reorderLevel' : 'minStock';
  const stockField = inventory.some((i: any) => 'currentStock' in i) ? 'currentStock' : 'quantity';
  const alerts = inventory.filter((item: any) => {
    const stock = Number(item[stockField]) || 0;
    const reorder = Number(item[reorderField]) || 0;
    return stock <= reorder;
  });
  return {
    type: 'inventory_alert',
    title: 'Inventory Alerts',
    description: `${alerts.length} item(s) at or below reorder level`,
    data: alerts,
    summary: `${alerts.length} item(s) need restocking`,
    columns: [
      { key: 'itemName', label: 'Item', type: 'string' },
      { key: 'sku', label: 'SKU', type: 'string' },
      { key: stockField, label: 'Current Stock', type: 'number' },
      { key: reorderField, label: 'Reorder Level', type: 'number' },
    ],
  };
};

const executeCustomerHistory = (sales: any[], params: Record<string, any>): QueryResult => {
  const name = params.customerName || 'Unknown';
  const lowerName = name.toLowerCase();
  const customerSales = sales.filter((s: any) =>
    (s.customerName || '').toLowerCase().includes(lowerName)
  );
  const total = sumBy(customerSales, 'total') || sumBy(customerSales, 'amount');
  return {
    type: 'customer_history',
    title: `Purchase History: ${name}`,
    description: `${customerSales.length} transaction(s) for ${name}`,
    data: customerSales,
    summary: `${customerSales.length} transaction(s), total ${formatCurrency(total)}`,
    columns: [
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'invoiceNumber', label: 'Invoice #', type: 'string' },
      { key: 'total', label: 'Amount', type: 'currency' },
      { key: 'status', label: 'Status', type: 'string' },
    ],
  };
};

const executeProfitAnalysis = (sales: any[], purchases: any[], params: Record<string, any>): QueryResult => {
  const filtered = filterByPeriod(sales, 'date', params.period, params.offset, params.quarter);

  if (params.focus === 'products') {
    const grouped = groupBy(filtered, 'itemName' as string);
    const data = Object.entries(grouped)
      .map(([itemName, items]) => {
        const revenue = sumBy(items, 'total') || sumBy(items, 'amount');
        const cost = sumBy(items, 'cost') || sumBy(items, 'materialCost');
        return { itemName, revenue, cost, profit: revenue - cost, margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0 };
      })
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 20);
    const totalProfit = sumBy(data, 'profit');
    return {
      type: 'profit_analysis',
      title: 'Most Profitable Products',
      description: `${data.length} products ranked by profitability`,
      data,
      summary: `Total profit from top products: ${formatCurrency(totalProfit)}`,
      columns: [
        { key: 'itemName', label: 'Product', type: 'string' },
        { key: 'revenue', label: 'Revenue', type: 'currency' },
        { key: 'cost', label: 'Cost', type: 'currency' },
        { key: 'profit', label: 'Profit', type: 'currency' },
        { key: 'margin', label: 'Margin %', type: 'number' },
      ],
    };
  }

  const totalRevenue = sumBy(filtered, 'total') || sumBy(filtered, 'amount');
  const totalCost = sumBy(filtered, 'cost') || sumBy(filtered, 'materialCost') || totalRevenue * 0.6;
  const totalProfit = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  return {
    type: 'profit_analysis',
    title: 'Profit Analysis',
    description: `Revenue: ${formatCurrency(totalRevenue)}, Cost: ${formatCurrency(totalCost)}, Profit: ${formatCurrency(totalProfit)}`,
    data: filtered,
    summary: `Net profit ${formatCurrency(totalProfit)} (${margin.toFixed(1)}% margin) on ${filtered.length} transaction(s)`,
    columns: [
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'customerName', label: 'Customer', type: 'string' },
      { key: 'total', label: 'Revenue', type: 'currency' },
      { key: 'cost', label: 'Cost', type: 'currency' },
    ],
  };
};

export const executeQuery = (
  query: string,
  data: { sales: any[]; invoices: any[]; expenses: any[]; customers: any[]; inventory: any[]; purchases: any[] }
): QueryResult => {
  const interpreted = interpretQuery(query);

  switch (interpreted.type) {
    case 'unpaid_invoices':
      return executeUnpaidInvoices(data.invoices);
    case 'sales_by_branch':
      return executeSalesByBranch(data.sales, interpreted.params);
    case 'large_expenses':
      return executeLargeExpenses(data.expenses, interpreted.params);
    case 'top_customers':
      return executeTopCustomers(data.sales, interpreted.params);
    case 'sales_trend':
      return executeSalesTrend(data.sales, interpreted.params);
    case 'inventory_alert':
      return executeInventoryAlert(data.inventory, data.purchases);
    case 'customer_history':
      return executeCustomerHistory(data.sales, interpreted.params);
    case 'profit_analysis':
      return executeProfitAnalysis(data.sales, data.purchases, interpreted.params);
    default:
      return {
        type: 'unknown',
        title: 'Unknown Query',
        description: `Could not interpret: "${query}"`,
        data: [],
        summary: 'No results. Try one of the suggested queries.',
        columns: [],
      };
  }
};

export const generateQuerySuggestions = (): QuerySuggestion[] => [
  { query: 'Show unpaid invoices', description: 'View all outstanding invoices that are still unpaid', icon: 'receipt' },
  { query: 'Sales by branch this quarter', description: 'Compare sales performance across branches for this quarter', icon: 'store' },
  { query: 'Expenses over MWK 500,000', description: 'Find large expenses exceeding MWK 500,000', icon: 'money_off' },
  { query: 'Top 10 customers this year', description: 'See your best customers ranked by total spending this year', icon: 'people' },
  { query: 'Sales this month vs last month', description: 'Compare current month sales with previous month', icon: 'trending_up' },
  { query: 'Inventory below reorder level', description: 'Check stock items that need to be reordered', icon: 'inventory' },
  { query: 'Most profitable products', description: 'Discover which products generate the highest profit margins', icon: 'bar_chart' },
];
