import { describe, expect, it, vi, beforeEach } from 'vitest';
import { jobTicketConversionService } from '../../services/jobTicketConversionService';

const executeAtomicOperation = vi.fn();
const createJobTicket = vi.fn();
const updateJobTicket = vi.fn();
const deleteJobTicket = vi.fn();

vi.mock('../../services/db', () => ({
  dbService: {
    executeAtomicOperation: (...args: any[]) => executeAtomicOperation(...args)
  }
}));

vi.mock('../../services/jobTicketService', () => ({
  jobTicketService: {
    create: (...args: any[]) => createJobTicket(...args),
    update: (...args: any[]) => updateJobTicket(...args),
    delete: (...args: any[]) => deleteJobTicket(...args)
  }
}));

const buildTx = (stores: Record<string, any>) => ({
  objectStore: (name: string) => stores[name]
});

describe('jobTicketConversionService', () => {
  beforeEach(() => {
    executeAtomicOperation.mockReset();
    createJobTicket.mockReset();
    updateJobTicket.mockReset();
    deleteJobTicket.mockReset();
    createJobTicket.mockResolvedValue({
      id: 'TKT-0001',
      ticketNumber: 'TKT-0001'
    });
    updateJobTicket.mockResolvedValue({
      id: 'TKT-0001',
      ticketNumber: 'TKT-0001'
    });
  });

  it('converts a general quotation into a job ticket', async () => {
    const quotation = {
      id: 'QTN-1',
      customerName: 'Prime School',
      quotationType: 'General',
      items: [{ id: 'ITM-1', name: 'Booklet', quantity: 10, price: 5 }]
    };

    const quotationStore = {
      get: vi.fn().mockResolvedValue(quotation),
      put: vi.fn()
    };
    const auditLogStore = { put: vi.fn() };
    const idempotencyStore = { get: vi.fn().mockResolvedValue(null), put: vi.fn() };

    executeAtomicOperation.mockImplementation(async (_stores: string[], op: any) =>
      op(buildTx({
        quotations: quotationStore,
        auditLogs: auditLogStore,
        idempotencyKeys: idempotencyStore
      }))
    );

    const result = await jobTicketConversionService.convertQuotationToJobTicket('QTN-1', {
      requestedBy: 'admin',
      requesterRole: 'Admin'
    });

    expect(result.success).toBe(true);
    expect(result.jobTicketId).toBe('TKT-0001');
    expect(createJobTicket).toHaveBeenCalled();
    expect(quotationStore.put).toHaveBeenCalled();
  });

  it('prevents duplicate conversion for quotations', async () => {
    const quotation = {
      id: 'QTN-2',
      customerName: 'Prime School',
      quotationType: 'General',
      items: [{ id: 'ITM-1', name: 'Booklet', quantity: 10, price: 5 }]
    };

    const quotationStore = { get: vi.fn().mockResolvedValue(quotation), put: vi.fn() };
    const auditLogStore = { put: vi.fn() };
    const idempotencyStore = { get: vi.fn().mockResolvedValue({ id: 'lock' }), put: vi.fn() };

    executeAtomicOperation.mockImplementation(async (_stores: string[], op: any) =>
      op(buildTx({
        quotations: quotationStore,
        auditLogs: auditLogStore,
        idempotencyKeys: idempotencyStore
      }))
    );

    await expect(
      jobTicketConversionService.convertQuotationToJobTicket('QTN-2', {
        requestedBy: 'admin',
        requesterRole: 'Admin'
      })
    ).rejects.toThrow('Conversion already in progress');
  });

  it('rejects conversion when quotation data is incomplete', async () => {
    const quotation = { id: 'QTN-3', customerName: '', quotationType: 'General', items: [] };
    const quotationStore = { get: vi.fn().mockResolvedValue(quotation), put: vi.fn() };
    const auditLogStore = { put: vi.fn() };
    const idempotencyStore = { get: vi.fn().mockResolvedValue(null), put: vi.fn() };

    executeAtomicOperation.mockImplementation(async (_stores: string[], op: any) =>
      op(buildTx({
        quotations: quotationStore,
        auditLogs: auditLogStore,
        idempotencyKeys: idempotencyStore
      }))
    );

    await expect(
      jobTicketConversionService.convertQuotationToJobTicket('QTN-3')
    ).rejects.toThrow('Customer name is required');
  });

  it('converts examination batch to job ticket with class items', async () => {
    const batch = {
      id: 'BATCH-1',
      name: 'Exam Batch',
      classes: [
        { id: 'CLS-1', class_name: 'Form 1', learners: 20, fee_per_learner: 10 },
        { id: 'CLS-2', class_name: 'Form 2', learners: 25, fee_per_learner: 12 }
      ]
    };

    const batchStore = { get: vi.fn().mockResolvedValue(batch), put: vi.fn() };
    const auditLogStore = { put: vi.fn() };
    const idempotencyStore = { get: vi.fn().mockResolvedValue(null), put: vi.fn() };

    executeAtomicOperation.mockImplementation(async (_stores: string[], op: any) =>
      op(buildTx({
        examinationBatches: batchStore,
        auditLogs: auditLogStore,
        idempotencyKeys: idempotencyStore
      }))
    );

    const result = await jobTicketConversionService.convertExaminationBatchToJobTicket('BATCH-1');
    expect(result.success).toBe(true);
    expect(result.jobTicketId).toBe('TKT-0001');
    expect(createJobTicket).toHaveBeenCalled();
  });

  it('rolls back conversion when source update fails after ticket creation', async () => {
    const quotation = {
      id: 'QTN-4',
      customerName: 'Prime School',
      quotationType: 'General',
      items: [{ id: 'ITM-1', name: 'Booklet', quantity: 10, price: 5 }]
    };

    const quotationStore = { get: vi.fn().mockResolvedValue(quotation), put: vi.fn().mockRejectedValue(new Error('fail')) };
    const auditLogStore = { put: vi.fn() };
    const idempotencyStore = { get: vi.fn().mockResolvedValue(null), put: vi.fn() };

    executeAtomicOperation.mockImplementation(async (_stores: string[], op: any) =>
      op(buildTx({
        quotations: quotationStore,
        auditLogs: auditLogStore,
        idempotencyKeys: idempotencyStore
      }))
    );

    await expect(jobTicketConversionService.convertQuotationToJobTicket('QTN-4')).rejects.toThrow('fail');
    expect(deleteJobTicket).toHaveBeenCalledWith('TKT-0001');
  });
});
