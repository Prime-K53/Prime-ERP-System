export interface AppearanceConfig {
  theme: 'Light' | 'Dark' | 'System';
  density: 'Compact' | 'Comfortable' | 'Spacious';
  glassmorphism: boolean;
  borderRadius: 'Small' | 'Medium' | 'Large';
  enableAnimations: boolean;
}

export interface TransactionSettingsConfig {
  // Basic transaction controls
  allowBackdating: boolean;
  backdatingLimitDays: number;
  allowFutureDating: boolean;
  allowPartialFulfillment: boolean;
  voidingWindowHours: number;
  enforceCreditLimit: 'None' | 'Warning' | 'Strict';
  defaultPaymentTermsDays: number;
  quotationExpiryDays: number;
  autoPrintReceipt: boolean;
  quickItemEntry: boolean;
  defaultPOSWarehouse: string;
  posDefaultCustomer: string;

  // POS specific settings
  pos: {
    showItemImages: boolean;
    enableShortcuts: boolean;
    allowReturns: boolean;
    allowDiscounts: boolean;
    gridColumns: number;
    showCategoryFilters: boolean;
    photocopyPrice: number;
    typePrintingPrice: number;
    receiptFooter: string;
  };

  // Numbering rules (dynamic by transaction type)
  numbering: Record<string, {
    prefix: string;
    padding: number;
    startNumber: number;
    resetInterval: 'Never' | 'Daily' | 'Monthly' | 'Yearly';
  }>;

  // Approval thresholds (dynamic by transaction type)
  approvalThresholds: Record<string, number>;
}

export interface IntegrationSettingsConfig {
  externalApis: Array<{
    id?: string;
    baseUrl: string;
    apiKey: string;
    enabled: boolean;
  }>;
  webhooks: Array<{
    id: string;
    url: string;
    events: string[];
    enabled: boolean;
  }>;
}

export interface InvoiceTemplatesConfig {
  engine: 'Standard' | 'Advanced' | 'Custom';
  accentColor: string;
  companyNameFontSize: number;
  [key: string]: any; // Dynamic boolean flags for template options
}

export interface GLMappingConfig {
  [key: string]: string; // Dynamic mapping of accounts
}

export interface ProductionSettingsConfig {
  autoConsumeMaterials: boolean;
  requireQAApproval: boolean;
  trackMachineDownTime: boolean;
  defaultWorkCenterId: string;
  defaultExamBomId: string;
  allowOverproduction: boolean;
  showKioskSummary: boolean;
}

export interface InventorySettingsConfig {
  valuationMethod: 'FIFO' | 'LIFO' | 'WeightedAverage' | 'StandardCost';
  allowNegativeStock: boolean;
  autoBarcode: boolean;
  trackBatches: boolean;
  defaultWarehouseId: string;
  trackSerialNumbers: boolean;
  lowStockAlerts: boolean;
}

export interface CloudSyncConfig {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
}

export interface SecuritySettingsConfig {
  sessionTimeoutMinutes: number;
  forcePasswordChangeDays: number;
  requireTwoFactor: boolean;
  auditLogLevel: 'Minimal' | 'Standard' | 'Detailed';
  lockoutAttempts: number;
  passwordProtectionEnabled?: boolean;
  enforcePasswordComplexity?: boolean;
}

export interface VATConfig {
  enabled: boolean;
  rate: number;
  filingFrequency: 'Monthly' | 'Quarterly' | 'Annually';
  pricingMode: 'VAT' | 'MarketAdjustment';
}

export interface RoundingRulesConfig {
  method: 'Nearest' | 'Up' | 'Down' | 'Truncate';
  precision: number;
}

export interface CompanyConfig {
  // Basic company info
  companyName: string;
  tagline?: string;
  email: string;
  phone: string;
  addressLine1: string;
  city?: string;
  country?: string;
  currencySymbol: string;
  dateFormat: string;
  logo?: string;
  signature?: string;

  // Configuration sections
  appearance: AppearanceConfig;
  transactionSettings: TransactionSettingsConfig;
  integrationSettings: IntegrationSettingsConfig;
  invoiceTemplates: InvoiceTemplatesConfig;
  glMapping: GLMappingConfig;
  productionSettings: ProductionSettingsConfig;
  inventorySettings: InventorySettingsConfig;
  cloudSync: CloudSyncConfig;
  securitySettings: SecuritySettingsConfig;
  security?: {
    passwordRequired?: boolean;
    enforceComplexity?: boolean;
  };
  vat: VATConfig;
  roundingRules: RoundingRulesConfig;
  notificationSettings: {
    customerActivityNotifications: boolean;
    smsGatewayEnabled: boolean;
    emailGatewayEnabled: boolean;
  };

  // Dynamic module enablement
  enabledModules: Record<string, boolean>;

  // Backup configuration
  backupFrequency: 'Daily' | 'Weekly' | 'Monthly' | 'Never';
  backupSettings?: {
    autoBackupEnabled: boolean;
    backupFrequency: 'Daily' | 'Weekly' | 'Monthly';
    retentionCount: number;
    cloudBackupEnabled: boolean;
  };

  // Pricing settings (from Phase 0-1)
  pricingSettings?: {
    roundingMethod: string;
    defaultMarkup: number;
    categoryOverrides: Array<{
      category: string;
      markup: number;
      roundingMethod?: string;
    }>;
    bulkDiscounts: Array<{
      minQty: number;
      discountPercent: number;
    }>;
    seasonalAdjustments: Array<{
      startDate: string;
      endDate: string;
      adjustmentPercent: number;
      categories?: string[];
    }>;
    [key: string]: any;
  };
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  total: number;
  tax?: number;
  notes?: string;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  date: string;
  status: string;
  items: any[];
  total: number;
  [key: string]: any;
}

export interface SalesOrder extends Order {
  quotationId?: string | null;
  deliveryDate?: string | null;
}

export interface Quotation extends Order {
  expiryDate?: string;
  reference?: string;
}

export interface Invoice extends Order {
  due_date?: string;
  balance?: number;
  reference?: string;
}

export interface DeliveryNote extends Order {
  invoiceId?: string;
  deliveredAt?: string;
}

export interface RecurringInvoice extends Order {
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly' | 'Custom';
  nextRunDate: string;
  lastRunDate?: string;
  startDate: string;
  endDate?: string;
}

export interface SalesExchange extends Order {
  originalInvoiceId: string;
  reason?: string;
}

export interface JobOrder extends Order {
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  dueDate?: string;
}

// Examination Batch Notification Types
export type NotificationType = 'BATCH_CREATED' | 'BATCH_CALCULATED' | 'BATCH_APPROVED' | 'BATCH_INVOICED' | 'DEADLINE_REMINDER';
export type NotificationPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface ExaminationBatchNotification {
  id: string;
  batch_id: string;
  user_id: string;
  notification_type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  batch_details: {
    batchId: string;
    batchName: string;
    examinationDate: string;
    numberOfStudents: number;
    schoolName?: string;
    academicYear?: string;
    term?: string;
    examType?: string;
    totalAmount?: number;
    status?: string;
  };
  is_read: boolean;
  read_at: string | null;
  delivered_at: string;
  created_at: string;
  expires_at?: string;
}

export interface NotificationAuditLog {
  id: string;
  notification_id: string | null;
  user_id: string;
  action: 'CREATED' | 'DELIVERED' | 'READ' | 'DISMISSED' | 'EXPIRED' | 'FAILED';
  details_json: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// Notification Types consolidate if needed or keep existing definitions below

// ============================================
// PRINT JOB TICKET TYPES - For Printing Services
// ============================================

export type JobTicketType = 'Photocopy' | 'Printing' | 'Binding' | 'Scan' | 'Lamination' | 'Other';
export type JobTicketPriority = 'Normal' | 'Rush' | 'Express' | 'Urgent';
export type JobTicketStatus = 'Received' | 'Processing' | 'Ready' | 'Delivered' | 'Cancelled';

export interface JobTicketFinishing {
  staple?: boolean;
  fold?: boolean;
  collate?: boolean;
  trim?: boolean;
  punch?: boolean;
  bindingType?: 'None' | 'Spiral' | 'Perfect' | 'Wire' | 'Tape';
  lamination?: boolean;
}

export interface JobTicket {
  id: string;
  ticketNumber: string;
  type: JobTicketType;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  description: string;
  quantity: number;
  priority: JobTicketPriority;
  status: JobTicketStatus;
  paperSize?: 'A4' | 'A3' | 'A5' | 'Legal' | 'Letter' | 'Custom';
  paperType?: string;
  colorMode?: 'BlackWhite' | 'Color';
  sides?: 'Single' | 'Double';
  finishing: JobTicketFinishing;
  unitPrice: number;
  rushFee: number;
  finishingCost: number;
  discount: number;
  subtotal: number;
  tax: number;
  total: number;
  dateReceived: string;
  dueDate?: string;
  dueTime?: string;
  expectedCompletionDate?: string;
  expectedCompletionTime?: string;
  completedAt?: string;
  deliveredAt?: string;
  operatorId?: string;
  operatorName?: string;
  machineId?: string;
  machineName?: string;
  progressPercent: number;
  attachments?: Array<{ id: string; name: string; url: string; fileId?: string; type: string; size: number }>;
  notes?: string;
  internalNotes?: string;
  createdBy?: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface JobTicketBulkDiscount {
  minQuantity: number;
  maxQuantity: number;
  discountPercent: number;
}

// ============================================
// CORE TRANSACTION TYPES
// ============================================

export interface Sale extends Order {
  cashierId?: string;
  paymentMethod: 'Cash' | 'Card' | 'Mobile Money' | 'Wallet' | 'Split';
  payments?: Array<{ method: string; amount: number }>;
  totalAmount: number;
}

export interface CustomerPayment {
  id: string;
  date: string;
  customerId: string;
  customerName: string;
  amount: number;
  paymentMethod: string;
  accountId?: string;
  subAccountName?: string;
  reference?: string;
  notes?: string;
  allocations?: InvoiceAllocation[];
}

export interface InvoiceAllocation {
  invoiceId: string;
  amount: number;
}

export interface LedgerEntry {
  id: string;
  date: string;
  debitAccountId: string;
  creditAccountId: string;
  amount: number;
  description: string;
  reference?: string;
  customerId?: string;
  supplierId?: string;
  subAccountName?: string;
}

export interface Expense {
  id: string;
  date: string;
  accountId: string;
  amount: number;
  description: string;
  status: 'Draft' | 'Pending' | 'Approved' | 'Rejected';
  category?: string;
  reference?: string;
}

export interface Income {
  id: string;
  date: string;
  accountId: string;
  amount: number;
  description: string;
  source: string;
}

export interface WalletTransaction {
  id: string;
  customerId: string;
  date: string;
  amount: number;
  type: 'Credit' | 'Debit';
  description: string;
  reference?: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  billingAddress?: string;
  shippingAddress?: string;
  balance?: number;
  walletBalance?: number;
  creditLimit?: number;
  notes?: string;
  status: 'Active' | 'Inactive' | 'Lead' | 'VIP' | 'Suspended' | 'Prospect' | 'Credit Hold';
  segment: 'Individual' | 'School Account' | 'Institution' | 'Government';
  paymentTerms?: string;
  assignedSalesperson?: string;
  creditHold?: boolean;
  tags?: string[];
  avgPaymentDays?: number;
  subAccounts?: SubAccount[];
}

export interface SubAccount {
  id: string;
  name: string;
  balance: number;
  walletBalance: number;
  status: 'Active' | 'Inactive';
}

export interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  balance?: number;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  balance: number;
}

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

export interface Purchase extends Order {
  supplierId: string;
  paymentStatus: 'Paid' | 'Partial' | 'Unpaid';
}

export interface SupplierPayment {
  id: string;
  date: string;
  supplierId: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
}

export interface ReprintJob {
  id: string;
  originalId: string;
  date: string;
  reason: string;
}

export interface ZReport {
  id: string;
  date: string;
  totalSales: number;
  cashCollected: number;
}

// ============================================
// SETTINGS
// ============================================

export interface JobTicketSettings {
  bulkDiscounts: JobTicketBulkDiscount[];
  defaultRushFeePercent: number;
  expressFeePercent: number;
  urgentFeePercent: number;
  enableNotifications: boolean;
  notifyOnReceived: boolean;
  notifyOnReady: boolean;
  notifyOnDelivered: boolean;
}
