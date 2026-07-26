import { initDB } from './db';

type TableAccessor = {
  toArray: <T>() => Promise<T[]>;
  get: <T>(id: string) => Promise<T | undefined>;
  put: <T>(value: T) => Promise<void>;
  delete: (id: string) => Promise<void>;
};

const createTable = (storeName: string): TableAccessor => ({
  toArray: async <T>() => { const db = await initDB(); return db.getAll(storeName) as T[]; },
  get: async <T>(id: string) => { const db = await initDB(); return db.get(storeName, id) as T | undefined; },
  put: async <T>(value: T) => { const db = await initDB(); await db.put(storeName, value as any); },
  delete: async (id: string) => { const db = await initDB(); await db.delete(storeName, id); },
});

export const productionDb = {
  batches: createTable('batches'),
  workOrders: createTable('workOrders'),
  workCenters: createTable('workCenters'),
  resources: createTable('resources'),
  resourceAllocations: createTable('resourceAllocations'),
  maintenanceLogs: createTable('maintenanceLogs'),
  boms: createTable('boms'),
  bomTemplates: createTable('bomTemplates'),
  jobTickets: createTable('jobTickets'),
  jobTicketSettings: createTable('jobTicketSettings'),
  serviceRecipes: createTable('serviceRecipes'),
  serviceJobs: createTable('serviceJobs'),
  serviceResources: createTable('serviceResources'),
  serviceConsumptions: createTable('serviceConsumptions'),
};

export const getProductionDb = () => productionDb;
