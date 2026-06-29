import Dexie, { type Table } from 'dexie';

export class ProductionDexieDB extends Dexie {
  batches!: Table<any, string>;
  workOrders!: Table<any, string>;
  workCenters!: Table<any, string>;
  resources!: Table<any, string>;
  resourceAllocations!: Table<any, string>;
  maintenanceLogs!: Table<any, string>;
  boms!: Table<any, string>;
  bomTemplates!: Table<any, string>;
  jobTickets!: Table<any, string>;
  jobTicketSettings!: Table<any, string>;
  serviceRecipes!: Table<any, string>;
  serviceJobs!: Table<any, string>;
  serviceResources!: Table<any, string>;
  serviceConsumptions!: Table<any, string>;

  constructor() {
    super('PrimeERP_Production_v2');
    this.version(2).stores({
      batches: 'id, status, created_at',
      workOrders: 'id, status, priority, dueDate, startDate, bomId',
      workCenters: 'id, name',
      resources: 'id, name, workCenterId',
      resourceAllocations: 'id, resourceId, startTime, endTime',
      maintenanceLogs: 'id, resourceId, created_at',
      boms: 'id, name',
      bomTemplates: 'id, name',
      jobTickets: 'id, status, type, customerId, priority, dueDate',
      jobTicketSettings: 'id',
      serviceRecipes: 'id, variantId, version, active',
      serviceJobs: 'id, status, variantId, itemId, assignedEmployeeId, assignedMachineId, sourceId, priority, dueDate',
      serviceResources: 'id, type, workCenterId, active',
      serviceConsumptions: 'id, jobId, resourceId',
    }).upgrade(async tx => {
      await tx.table('serviceJobs').toCollection().modify(job => {
        if (!job.materials) job.materials = [];
        if (!job.labor) job.labor = [];
        if (!job.machine) job.machine = [];
        if (!job.itemSku) job.itemSku = '';
      });
    });
  }
}

let _instance: ProductionDexieDB | null = null;

let _indexedDbAvailable: boolean | null = null;

const canUseIndexedDB = (): boolean => {
  if (_indexedDbAvailable !== null) return _indexedDbAvailable;
  if (typeof window === 'undefined') { _indexedDbAvailable = false; return false; }
  if (typeof indexedDB === 'undefined') { _indexedDbAvailable = false; return false; }
  _indexedDbAvailable = true;
  return true;
};

export const getProductionDb = (): ProductionDexieDB | null => {
  if (!canUseIndexedDB()) return null;
  if (!_instance) {
    _instance = new ProductionDexieDB();
  }
  return _instance;
};

export const productionDb = new Proxy({} as ProductionDexieDB, {
  get(_target, prop: string | symbol) {
    const db = getProductionDb();
    if (!db) {
      throw new Error('IndexedDB is not available. Production Dexie database cannot be accessed.');
    }
    return db[prop as keyof ProductionDexieDB];
  }
});
