import { initDB } from './db';

type TableAccessor = {
  toArray: <T>() => Promise<T[]>;
  get: <T>(id: string) => Promise<T | undefined>;
  put: <T>(value: T) => Promise<void>;
  delete: (id: string) => Promise<void>;
  bulkPut: <T>(items: T[]) => Promise<void>;
};

const createTable = (storeName: string): TableAccessor => ({
  toArray: async <T>() => {
    const db = await initDB();
    return db.getAll(storeName) as T[];
  },
  get: async <T>(id: string) => {
    const db = await initDB();
    return db.get(storeName, id) as T | undefined;
  },
  put: async <T>(value: T) => {
    const db = await initDB();
    await db.put(storeName, value as any);
  },
  delete: async (id: string) => {
    const db = await initDB();
    await db.delete(storeName, id);
  },
  bulkPut: async <T>(items: T[]) => {
    if (items.length === 0) return;
    const db = await initDB();
    await db.bulkPut(storeName, items as any[]);
  },
});

export const examinationDb = {
  examinationBatches: createTable('examinationBatches'),
  examinationBatchNotifications: createTable('examinationBatchNotifications'),
  examinationJobs: createTable('examinationJobs'),
  examinationJobSubjects: createTable('examinationJobSubjects'),
  examinationInvoiceGroups: createTable('examinationInvoiceGroups'),
  examinationRecurringProfiles: createTable('examinationRecurringProfiles'),
  examinationInventoryDeductions: createTable('examinationInventoryDeductions'),
  notificationAuditLogs: createTable('notificationAuditLogs'),
};

export const getExaminationDb = () => null;