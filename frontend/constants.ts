
import { Item, User, Account, Warehouse, WorkCenter, ProductionResource, PermissionNode, UserGroup } from './types';

export const OFFLINE_MODE = false;

export const SEED_ITEM_IDS = [
  'RM-PAP-A4','RM-TON-HP','RM-PAP-GLS','RM-INK-CYA','RM-INK-MAG','RM-INK-YEL',
  'RM-INK-BLK','RM-BND-GLU','RM-BND-WIR','FG-BK-001','FG-FL-001','FG-BC-001',
];

export const ACCOUNT_IDS = {
  CASH_DRAWER: '1000',
  BANK: '1050',
  MOBILE_MONEY: '1060',
  RECEIVABLE: '1100',
  PAYABLE: '2000',
  EQUITY: '3000',
  SALES: '4000',
  COGS: '5000'
};

export const DEFAULT_ACCOUNTS: Account[] = [
  // --- Assets (1000-1999) ---
  { id: '1000', code: '1000', name: 'Cash Account', type: 'Asset' },
  { id: '1050', code: '1050', name: 'Bank Account', type: 'Asset' },
  { id: '1060', code: '1060', name: 'Mobile Money', type: 'Asset' },
  { id: '1100', code: '1100', name: 'Accounts Receivable', type: 'Asset' },
  { id: '1200', code: '1200', name: 'Inventory Asset', type: 'Asset' },
  { id: '1250', code: '1250', name: 'Inventory Asset', type: 'Asset' },
  { id: '1300', code: '1300', name: 'Work in Progress (WIP)', type: 'Asset' },
  { id: '1500', code: '1500', name: 'Machinery & Equipment', type: 'Asset' },

  // --- Liabilities (2000-2999) ---
  { id: '2000', code: '2000', name: 'Accounts Payable', type: 'Liability' },
  { id: '2100', code: '2100', name: 'Accounts Payable', type: 'Liability' },
  { id: '2300', code: '2300', name: 'Wages Payable', type: 'Liability' },

  // --- Equity (3000-3999) ---
  { id: '3000', code: '3000', name: 'Owner\'s Equity', type: 'Equity' },

  // --- Revenue (4000-4999) ---
  { id: '4000', code: '4000', name: 'Sales Revenue', type: 'Revenue' },

  // --- Expenses (5000-6999) ---
  { id: '5000', code: '5000', name: 'Cost of Goods Sold', type: 'Expense' },
  { id: '6100', code: '6100', name: 'Maintenance Expense', type: 'Expense' },
  { id: '6200', code: '6200', name: 'Utilities', type: 'Expense' },
  { id: '6300', code: '6300', name: 'Labor Wages', type: 'Expense' },
];

export const AVAILABLE_PERMISSIONS: PermissionNode[] = [
  // Dashboard & Analytics
  { id: 'dashboard.view', label: 'View Dashboard', module: 'Analytics' },
  { id: 'reports.view', label: 'View Financial Reports', module: 'Analytics' },
  { id: 'audit.view', label: 'View Audit Logs', module: 'System' },

  // Sales & POS
  { id: 'sales.view', label: 'View Sales Modules', module: 'Sales' },
  { id: 'sale.process', label: 'Process Sales', module: 'Sales' },
  { id: 'sale.refund', label: 'Process Refunds', module: 'Sales' },
  { id: 'sale.void', label: 'Void Transactions', module: 'Sales' },
  { id: 'quotation.manage', label: 'Manage Quotations', module: 'Sales' },

  // Inventory & Procurement
  { id: 'inventory.view', label: 'View Inventory', module: 'Inventory' },
  { id: 'inventory.adjust', label: 'Adjust Stock', module: 'Inventory' },
  { id: 'inventory.receive', label: 'Receive Goods (GRN)', module: 'Inventory' },
  { id: 'procurement.view', label: 'View Procurement', module: 'Procurement' },
  { id: 'procurement.manage', label: 'Manage Purchase Orders', module: 'Procurement' },

  // Production
  { id: 'production.view', label: 'View Production', module: 'Production' },
  { id: 'production.manage', label: 'Manage Work Orders', module: 'Production' },
  { id: 'production.log', label: 'Log Production Progress', module: 'Production' },
  { id: 'examination.cost.override', label: 'Override Examination Cost', module: 'Production' },

  // Finance
  { id: 'accounts.view', label: 'View Accounts', module: 'Finance' },
  { id: 'ledger.view', label: 'View General Ledger', module: 'Finance' },
  { id: 'ledger.post', label: 'Post Journal Entries', module: 'Finance' },
  { id: 'banking.manage', label: 'Manage Bank Accounts', module: 'Finance' },
  { id: 'payroll.manage', label: 'Process Payroll', module: 'Finance' },

  // System
  { id: 'admin.settings', label: 'Manage System Settings', module: 'System' },
  { id: 'admin.users', label: 'Manage Users & Groups', module: 'System' },
  { id: 'settings.manage', label: 'Manage System Settings', module: 'System' },
  { id: 'users.manage', label: 'Manage Users & Groups', module: 'System' },
];

export const INITIAL_USER_GROUPS: UserGroup[] = [
  {
    id: 'GRP-ADMIN',
    name: 'Administrators',
    description: 'Full system access with all permissions',
    permissions: ['all']
  },
  {
    id: 'GRP-ACCOUNTANT',
    name: 'Accountants',
    description: 'Financial management, reporting, and ledger access',
    permissions: [
      'dashboard.view', 'reports.view', 'ledger.view', 'ledger.post',
      'banking.manage', 'sale.process', 'sale.refund', 'inventory.view',
      'examination.cost.override'
    ]
  },
  {
    id: 'GRP-CASHIER',
    name: 'Cashiers',
    description: 'Front-end sales and basic inventory viewing',
    permissions: ['dashboard.view', 'sale.process', 'sale.refund', 'inventory.view']
  },
  {
    id: 'GRP-MANAGER',
    name: 'Managers',
    description: 'Operational managers with sales, inventory, and report visibility',
    permissions: ['dashboard.view', 'reports.view', 'sales.view', 'sale.process', 'inventory.view', 'inventory.adjust', 'procurement.view']
  },
  {
    id: 'GRP-SALES',
    name: 'Sales Staff',
    description: 'Sales users who can manage customers, quotations, invoices, and receipts',
    permissions: ['dashboard.view', 'sales.view', 'sale.process', 'quotation.manage', 'inventory.view']
  },
  {
    id: 'GRP-USER',
    name: 'Standard Users',
    description: 'Baseline authenticated access',
    permissions: ['dashboard.view']
  },
  {
    id: 'GRP-OPERATOR',
    name: 'Production Operators',
    description: 'Production logging and work order execution',
    permissions: ['dashboard.view', 'production.log', 'inventory.view']
  }
];

export const MOCK_WAREHOUSES: Warehouse[] = [
  { id: 'WH-MAIN', name: 'Main Warehouse', type: 'Physical', location: 'Lilongwe' },
  { id: 'WH-SHOP', name: 'Front Shop', type: 'Store', location: 'Lilongwe' },
  { id: 'WH-VIR', name: 'Virtual/Transit', type: 'Virtual', location: 'System' },
];

export const MOCK_WORK_CENTERS: WorkCenter[] = [
  { id: 'WC-PRN-01', name: 'Offset Printing Line 1', hourlyRate: 45.00, capacityPerDay: 8 },
  { id: 'WC-BND-01', name: 'Perfect Binding Station', hourlyRate: 35.00, capacityPerDay: 8 },
  { id: 'WC-CUT-01', name: 'Hydraulic Cutting Station', hourlyRate: 25.00, capacityPerDay: 8 },
];

export const MOCK_RESOURCES: ProductionResource[] = [
  { id: 'RES-PRN-01', name: 'Heidelberg Speedmaster', workCenterId: 'WC-PRN-01', status: 'Active' },
  { id: 'RES-BND-01', name: 'Horizon Binder', workCenterId: 'WC-BND-01', status: 'Active' },
  { id: 'RES-CUT-01', name: 'Polar Cutter', workCenterId: 'WC-CUT-01', status: 'Active' },
];
