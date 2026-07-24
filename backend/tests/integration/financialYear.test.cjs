const { createTestDb, generateTestId } = require('../setup.cjs');
const { TEST_COMPANY_ID, TEST_USER_ID } = require('../helpers.cjs');

describe('Financial Year Integration', () => {
  let db, financialYear;

  beforeAll(async () => {
    jest.setTimeout(30000);
    db = await createTestDb();
    // Create required tables
    const tables = [
      `CREATE TABLE IF NOT EXISTS financial_years (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT,
        start_date TEXT NOT NULL, end_date TEXT NOT NULL,
        is_default INTEGER DEFAULT 0, is_closed INTEGER DEFAULT 0,
        status TEXT DEFAULT 'Active' CHECK(status IN ('Active','Closed')),
        company_id TEXT NOT NULL, created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY, date TEXT NOT NULL, customer_id TEXT,
        customer_name TEXT, total_amount REAL DEFAULT 0,
        status TEXT DEFAULT 'Draft', items_json TEXT,
        company_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY, customer_id TEXT, customer_name TEXT,
        total_amount REAL DEFAULT 0, status TEXT DEFAULT 'unpaid',
        company_id TEXT NOT NULL, invoice_date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY, category TEXT, vendor_name TEXT,
        amount REAL NOT NULL, expense_date TEXT, status TEXT,
        company_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS customer_payments (
        id TEXT PRIMARY KEY, date TEXT NOT NULL, customer_id TEXT,
        customer_name TEXT, amount REAL DEFAULT 0,
        company_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    ];
    await Promise.all(tables.map(sql =>
      new Promise((resolve, reject) => {
        db.run(sql, err => err ? reject(err) : resolve());
      })
    ));
    const FinancialYearService = require('../../services/financialYearService.cjs');
    financialYear = new FinancialYearService(db);
  }, 30000);

  afterAll(() => { try { db.close(); } catch {} });

  const fyId = () => generateTestId('fy');

  // ── CRUD Operations ──
  describe('CRUD Operations', () => {
    test('create a financial year', async () => {
      const fy = await financialYear.createFinancialYear({
        id: fyId(), name: 'FY 2026', code: 'FY2026',
        start_date: '2026-01-01', end_date: '2026-12-31',
      }, TEST_COMPANY_ID, TEST_USER_ID);
      expect(fy).toBeDefined();
      expect(fy.name).toBe('FY 2026');
      expect(fy.start_date).toBe('2026-01-01');
      expect(fy.end_date).toBe('2026-12-31');
      expect(fy.is_default).toBe(1);
    });

    test('get financial year by id', async () => {
      const id = fyId();
      await financialYear.createFinancialYear({
        id, name: 'FY 2025', code: 'FY2025',
        start_date: '2025-01-01', end_date: '2025-12-31',
      }, TEST_COMPANY_ID, TEST_USER_ID);
      const fy = await financialYear.getFinancialYearById(id, TEST_COMPANY_ID);
      expect(fy).toBeDefined();
      expect(fy.name).toBe('FY 2025');
    });

    test('update a financial year', async () => {
      const id = fyId();
      await financialYear.createFinancialYear({
        id, name: 'FY 2024', code: 'FY2024',
        start_date: '2024-01-01', end_date: '2024-12-31',
      }, TEST_COMPANY_ID, TEST_USER_ID);
      const updated = await financialYear.updateFinancialYear(id, { name: 'FY 2024 Updated' }, TEST_COMPANY_ID);
      expect(updated.name).toBe('FY 2024 Updated');
    });

    test('close a financial year', async () => {
      const id = fyId();
      await financialYear.createFinancialYear({
        id, name: 'FY 2023', code: 'FY2023',
        start_date: '2023-01-01', end_date: '2023-12-31',
      }, TEST_COMPANY_ID, TEST_USER_ID);
      const closed = await financialYear.closeFinancialYear(id, TEST_COMPANY_ID);
      expect(closed.is_closed).toBe(1);
      expect(closed.status).toBe('Closed');
    });

    test('delete a financial year', async () => {
      const id = fyId();
      await financialYear.createFinancialYear({
        id, name: 'FY 2022', code: 'FY2022',
        start_date: '2022-01-01', end_date: '2022-12-31',
      }, TEST_COMPANY_ID, TEST_USER_ID);
      const defaultId = fyId();
      await financialYear.createFinancialYear({
        id: defaultId, name: 'FY Default', code: 'FYDefault',
        start_date: '2021-01-01', end_date: '2021-12-31', is_default: true,
      }, TEST_COMPANY_ID, TEST_USER_ID);
      const result = await financialYear.deleteFinancialYear(id, TEST_COMPANY_ID);
      expect(result.success).toBe(true);
    });
  });

  // ── Default FY ──
  describe('Default Financial Year', () => {
    test('getDefaultFinancialYear returns null when none exists', async () => {
      const fy = await financialYear.getDefaultFinancialYear('other-company');
      expect(fy).toBeNull();
    });

    test('getOrCreateDefaultFinancialYear auto-creates a FY', async () => {
      const fy = await financialYear.getOrCreateDefaultFinancialYear('new-company', TEST_USER_ID);
      expect(fy).toBeDefined();
      expect(fy.is_default).toBe(1);
      expect(fy.status).toBe('Active');
      expect(fy.start_date).toBeDefined();
      expect(fy.end_date).toBeDefined();
    });
  });

  const DATE_VALIDATION_COMPANY = 'company-date-validation';

  // ── Date Validation ──
  describe('Date Validation', () => {
    test('passes for date within open FY', async () => {
      await financialYear.createFinancialYear({
        id: fyId(), name: 'FY 2026', code: 'FY2026',
        start_date: '2026-01-01', end_date: '2026-12-31',
      }, DATE_VALIDATION_COMPANY, TEST_USER_ID);
      const result = await financialYear.validateTransactionDate('2026-06-15', DATE_VALIDATION_COMPANY);
      expect(result).toBeDefined();
    });

    test('rejects date outside any FY', async () => {
      await expect(
        financialYear.validateTransactionDate('2099-01-01', DATE_VALIDATION_COMPANY)
      ).rejects.toThrow(/does not belong/);
    });

    test('rejects date in closed FY', async () => {
      const id = fyId();
      await financialYear.createFinancialYear({
        id, name: 'FY 2020', code: 'FY2020',
        start_date: '2020-01-01', end_date: '2020-12-31',
      }, DATE_VALIDATION_COMPANY, TEST_USER_ID);
      await financialYear.closeFinancialYear(id, DATE_VALIDATION_COMPANY);
      await expect(
        financialYear.validateTransactionDate('2020-06-15', DATE_VALIDATION_COMPANY)
      ).rejects.toThrow(/closed/);
    });
  });

  const SQL_FILTERING_COMPANY = 'company-sql-filtering';

  // ── SQL-level filtering ──
  describe('SQL Filtering', () => {
    test('getFinancialYearByDate uses SQL date comparison', async () => {
      const id = fyId();
      await financialYear.createFinancialYear({
        id, name: 'FY 2026', code: 'FY2026',
        start_date: '2026-01-01', end_date: '2026-12-31',
      }, SQL_FILTERING_COMPANY, TEST_USER_ID);
      const fy = await financialYear.getFinancialYearByDate('2026-06-01', SQL_FILTERING_COMPANY);
      expect(fy).toBeDefined();
      expect(fy.id).toBe(id);
    });

    test('returns null for out-of-range date', async () => {
      const fy = await financialYear.getFinancialYearByDate('2025-06-01', 'company-with-no-fy');
      expect(fy).toBeNull();
    });
  });

  const OVERLAP_COMPANY = 'company-overlap';

  // ── Overlap Detection ──
  describe('Overlap Detection', () => {
    test('rejects overlapping financial years', async () => {
      await financialYear.createFinancialYear({
        id: fyId(), name: 'FY 2025', code: 'FY2025',
        start_date: '2025-01-01', end_date: '2025-12-31',
      }, OVERLAP_COMPANY, TEST_USER_ID);
      await expect(
        financialYear.createFinancialYear({
          id: fyId(), name: 'Overlap FY', code: 'Overlap',
          start_date: '2025-06-01', end_date: '2026-06-01',
        }, OVERLAP_COMPANY, TEST_USER_ID)
      ).rejects.toThrow(/Overlapping/);
    });
  });

  const CLOSED_FY_COMPANY = 'company-closed-fy';

  // ── Closed FY Rejection ──
  describe('Closed FY Rejection', () => {
    test('closeFinancialYear throws if already closed', async () => {
      const id = fyId();
      await financialYear.createFinancialYear({
        id, name: 'FY 2021', code: 'FY2021',
        start_date: '2021-01-01', end_date: '2021-12-31',
      }, CLOSED_FY_COMPANY, TEST_USER_ID);
      await financialYear.closeFinancialYear(id, CLOSED_FY_COMPANY);
      await expect(
        financialYear.closeFinancialYear(id, CLOSED_FY_COMPANY)
      ).rejects.toThrow(/already closed/);
    });
  });
});