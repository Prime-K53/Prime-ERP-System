import { beforeEach, describe, expect, it, vi } from 'vitest';
import { paymentService } from '../../services/paymentService';

const getAll = vi.fn();

vi.mock('../../services/db', () => ({
  dbService: {
    getAll: (...args: any[]) => getAll(...args)
  }
}));

describe('paymentService.getCustomerLedger', () => {
  beforeEach(() => {
    getAll.mockReset();
  });

  it('uses service invoice numbers for examination invoices in customer statements', async () => {
    getAll.mockImplementation(async (store: string) => {
      if (store === 'invoices') {
        return [
          {
            id: 'EXM-2026-000001',
            customerId: 'CUST-1',
            customerName: 'Prime School',
            date: '2026-04-01T08:00:00.000Z',
            totalAmount: 2500,
            paidAmount: 0,
            reference: 'EXM-BATCH-BATCH-9',
            invoiceNumber: 'EXM-2026-000001',
            originModule: 'examination',
            documentTitle: 'Service Invoice'
          }
        ];
      }

      if (store === 'customerPayments') {
        return [];
      }

      return [];
    });

    const entries = await paymentService.getCustomerLedger('CUST-1', '2026-04-01', '2026-04-30');

    expect(entries).toHaveLength(1);
    expect(entries[0].reference_no).toBe('EXM-2026-000001');
  });
});
