export const ISO_LENGTH = 40;
export const CODE_LENGTH = 64;
export const ID_LENGTH = 128;
export const NAME_LENGTH = 256;
export const ENUM_LENGTH = 24;
export const TAG_LENGTH = 128;
export const MODERATE_TEXT_LENGTH = 512;
export const LONG_TEXT_LENGTH = 2000;
export const MAX_TEXT_LENGTH = 4000;
export const CHECKSUM_LENGTH = 512;
export const URL_LENGTH = 4096;
export const UA_LENGTH = 2000;
export const MAX_DB_TEXT_LENGTH = 1000000;

export type IndexDefinition = string | string[];

export interface TableDefinition {
  name: string;
  primaryKey: string;
  indexes: IndexDefinition[];
  domain: Domain;
}

export type Domain = 'core' | 'finance' | 'inventory' | 'production' | 'examination' | 'analytics' | 'sync' | 'system';

export const TABLE_DEFINITIONS: Record<string, TableDefinition> = {
  settings: { name: 'settings', primaryKey: 'id', indexes: ['settingKey', ['category', 'updatedAt'], ['scope', 'updatedAt']], domain: 'core' },
  users: { name: 'users', primaryKey: 'id', indexes: ['username', 'email', ['role', 'status']], domain: 'core' },
  notifications: { name: 'notifications', primaryKey: 'id', indexes: [['userId', 'isRead'], ['category', 'updatedAt'], ['priority', 'updatedAt'], ['entityId', 'updatedAt']], domain: 'core' },
  auditLogs: { name: 'auditLogs', primaryKey: 'id', indexes: [['timestamp', 'entityType'], ['actorId', 'timestamp'], ['entityType', 'timestamp'], ['correlationId', 'timestamp']], domain: 'core' },
  syncOperations: { name: 'syncOperations', primaryKey: 'id', indexes: [['queueStatus', 'updatedAt'], ['entityType', 'updatedAt'], ['entityId', 'updatedAt'], ['nextRetryAt', 'queueStatus']], domain: 'sync' },
  syncConflicts: { name: 'syncConflicts', primaryKey: 'id', indexes: ['entityType', 'entityId', ['status', 'createdAt']], domain: 'sync' },
  syncLogs: { name: 'syncLogs', primaryKey: 'id', indexes: [['timestamp', 'entityType'], ['status', 'timestamp']], domain: 'sync' },
  syncQueue: { name: 'syncQueue', primaryKey: 'id', indexes: [['status', 'priority'], ['entityType', 'status'], ['nextRetryAt', 'status']], domain: 'sync' },
  syncSnapshots: { name: 'syncSnapshots', primaryKey: 'id', indexes: ['entityType', 'entityId', ['snapshotAt', 'entityType']], domain: 'sync' },
  customers: { name: 'customers', primaryKey: 'id', indexes: ['customerCode', 'name', ['status', 'updatedAt'], ['segment', 'updatedAt']], domain: 'finance' },
  suppliers: { name: 'suppliers', primaryKey: 'id', indexes: ['supplierCode', 'name', ['status', 'updatedAt']], domain: 'finance' },
  invoices: { name: 'invoices', primaryKey: 'id', indexes: ['invoiceNumber', ['customerId', 'issuedAt'], ['status', 'issuedAt'], ['originModule', 'issuedAt']], domain: 'finance' },
  payments: { name: 'payments', primaryKey: 'id', indexes: ['paymentNumber', 'invoiceId', 'customerId', ['status', 'processedAt']], domain: 'finance' },
  expenses: { name: 'expenses', primaryKey: 'id', indexes: ['expenseNumber', 'supplierId', 'category', ['status', 'incurredAt']], domain: 'finance' },
  products: { name: 'products', primaryKey: 'id', indexes: ['sku', 'barcode', ['productType', 'updatedAt'], ['status', 'updatedAt'], ['categoryId', 'updatedAt']], domain: 'inventory' },
  stockMovements: { name: 'stockMovements', primaryKey: 'id', indexes: ['productId', 'warehouseId', ['type', 'movedAt'], 'reference'], domain: 'inventory' },
  warehouses: { name: 'warehouses', primaryKey: 'id', indexes: ['warehouseCode', 'name', ['status', 'updatedAt']], domain: 'inventory' },
  inventoryBalances: { name: 'inventoryBalances', primaryKey: 'id', indexes: [['productId', 'warehouseId'], ['warehouseId', 'updatedAt'], ['status', 'updatedAt']], domain: 'inventory' },
  workCenters: { name: 'workCenters', primaryKey: 'id', indexes: ['centerCode', 'name', ['status', 'updatedAt']], domain: 'production' },
  productionResources: { name: 'productionResources', primaryKey: 'id', indexes: ['resourceCode', ['workCenterId', 'status'], ['status', 'updatedAt']], domain: 'production' },
  manufacturingJobs: { name: 'manufacturingJobs', primaryKey: 'id', indexes: ['jobNumber', ['status', 'scheduledStart'], ['module', 'updatedAt'], ['workCenterId', 'status']], domain: 'production' },
  examinationPricing: { name: 'examinationPricing', primaryKey: 'id', indexes: ['batchNumber', ['schoolId', 'updatedAt'], ['customerId', 'updatedAt'], ['status', 'updatedAt']], domain: 'examination' },
  examinationResults: { name: 'examinationResults', primaryKey: 'id', indexes: ['batchId', 'schoolId', ['status', 'updatedAt']], domain: 'examination' },
  analyticsCache: { name: 'analyticsCache', primaryKey: 'id', indexes: ['cacheKey', ['category', 'updatedAt']], domain: 'analytics' },
  kpiCache: { name: 'kpiCache', primaryKey: 'id', indexes: ['kpiKey', ['period', 'updatedAt']], domain: 'analytics' },
  dashboardSnapshots: { name: 'dashboardSnapshots', primaryKey: 'id', indexes: ['snapshotKey', ['generatedAt', 'snapshotKey']], domain: 'analytics' },
  referrals: { name: 'referrals', primaryKey: 'id', indexes: [['customerId', 'date'], ['referredById', 'date'], ['status', 'date'], 'referralCode'], domain: 'finance' },
  referralRewards: { name: 'referralRewards', primaryKey: 'id', indexes: ['referralId', 'customerId', 'invoiceId', ['status', 'date']], domain: 'finance' },
  referralTimeline: { name: 'referralTimeline', primaryKey: 'id', indexes: ['referralId', ['eventType', 'timestamp'], ['timestamp', 'referralId']], domain: 'finance' },
  referralAuditLogs: { name: 'referralAuditLogs', primaryKey: 'id', indexes: ['entityType', 'entityId', ['actorId', 'timestamp'], ['entityType', 'timestamp'], 'correlationId'], domain: 'finance' },
  referralCampaigns: { name: 'referralCampaigns', primaryKey: 'id', indexes: [['status', 'startDate'], ['startDate', 'endDate'], 'name'], domain: 'finance' },
  referralAnalytics: { name: 'referralAnalytics', primaryKey: 'id', indexes: [['period', 'periodStart'], 'generatedAt', 'cacheKey'], domain: 'analytics' },
  referralReversals: { name: 'referralReversals', primaryKey: 'id', indexes: ['rewardId', ['status', 'requestedAt']], domain: 'finance' },
  referralEventHistory: { name: 'referralEventHistory', primaryKey: 'id', indexes: ['eventType', 'entityId', ['correlationId', 'timestamp'], ['timestamp', 'eventType']], domain: 'finance' },
  engagementTimeline: { name: 'engagementTimeline', primaryKey: 'id', indexes: [['customerId', 'timestamp'], 'eventType', 'referenceType', 'referenceId'], domain: 'finance' },
  engagementAudit: { name: 'engagementAudit', primaryKey: 'id', indexes: ['entityType', 'entityId', ['actorId', 'timestamp'], ['entityType', 'timestamp'], 'correlationId'], domain: 'finance' },
  engagementPoints: { name: 'engagementPoints', primaryKey: 'id', indexes: [['customerId', 'createdAt'], ['type', 'createdAt'], 'expiresAt', ['referenceType', 'referenceId']], domain: 'finance' },
  engagementPointBalances: { name: 'engagementPointBalances', primaryKey: 'id', indexes: ['customerId', 'expiresAt'], domain: 'finance' },
  engagementCashback: { name: 'engagementCashback', primaryKey: 'id', indexes: ['customerId', 'status', 'campaignId', 'invoiceId'], domain: 'finance' },
  engagementMembershipTiers: { name: 'engagementMembershipTiers', primaryKey: 'id', indexes: ['level', 'status', 'name'], domain: 'finance' },
  engagementCustomerTiers: { name: 'engagementCustomerTiers', primaryKey: 'id', indexes: ['customerId', 'tierId', 'status'], domain: 'finance' },
  engagementGiftCards: { name: 'engagementGiftCards', primaryKey: 'id', indexes: ['code', 'customerId', 'status', 'expiresAt'], domain: 'finance' },
  engagementGiftCardTransactions: { name: 'engagementGiftCardTransactions', primaryKey: 'id', indexes: ['giftCardId', 'type', 'referenceType'], domain: 'finance' },
  engagementAffiliates: { name: 'engagementAffiliates', primaryKey: 'id', indexes: ['customerId', 'referralCode', 'status'], domain: 'finance' },
  engagementAffiliateCommissions: { name: 'engagementAffiliateCommissions', primaryKey: 'id', indexes: ['affiliateId', 'status', 'invoiceId', 'customerId'], domain: 'finance' },
  engagementPromotions: { name: 'engagementPromotions', primaryKey: 'id', indexes: ['status', 'type', ['startsAt', 'expiresAt'], 'campaignId'], domain: 'finance' },
  engagementCustomerRewards: { name: 'engagementCustomerRewards', primaryKey: 'id', indexes: ['customerId', 'type', 'status', 'campaignId', 'milestoneKey'], domain: 'finance' },
  engagementAnalytics: { name: 'engagementAnalytics', primaryKey: 'id', indexes: [['period', 'periodStart'], 'generatedAt'], domain: 'analytics' },

};

export const DOMAIN_TABLE_MAP: Record<Domain, string[]> = {} as Record<Domain, string[]>;
for (const [tableName, def] of Object.entries(TABLE_DEFINITIONS)) {
  if (!DOMAIN_TABLE_MAP[def.domain]) DOMAIN_TABLE_MAP[def.domain] = [];
  DOMAIN_TABLE_MAP[def.domain].push(tableName);
}

export const CORE_TABLES = DOMAIN_TABLE_MAP.core;
export const FINANCE_TABLES = DOMAIN_TABLE_MAP.finance;
export const INVENTORY_TABLES = DOMAIN_TABLE_MAP.inventory;
export const PRODUCTION_TABLES = DOMAIN_TABLE_MAP.production;
export const EXAMINATION_TABLES = DOMAIN_TABLE_MAP.examination;
export const ANALYTICS_TABLES = DOMAIN_TABLE_MAP.analytics;
export const SYNC_TABLES = DOMAIN_TABLE_MAP.sync;
export const SYSTEM_TABLES = ['system'];

export const ALL_TABLES = Object.keys(TABLE_DEFINITIONS);

export const buildDexieSchemaString = (tables: string[]): string => {
  return tables.map((tableName) => {
    const def = TABLE_DEFINITIONS[tableName];
    if (!def) return '';
    const indexParts = [def.primaryKey, ...def.indexes.map((idx) => {
      if (Array.isArray(idx)) return idx.join(',');
      return idx;
    })];
    return `${tableName}: ${indexParts.join(', ')}`;
  }).join(', ');
};
