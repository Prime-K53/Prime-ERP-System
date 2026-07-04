/**
 * Tenant Isolation Security Tests (Jest version)
 * Validates that cross-company data leakage is eliminated.
 */
const { db, initDb, getDatabase } = require('../db.cjs');
const { tenantContext } = require('../middleware/tenantContext.cjs');

const COMPANY_A = 'comp-a-test';
const COMPANY_B = 'comp-b-test';
const USER_A_ID = 'usr-test-a';
const USER_B_ID = 'usr-test-b';

const runQuery = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

const runAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

const runExec = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) reject(err);
    else resolve(this);
  });
});

const tables = [
  'sales', 'invoices', 'examinations', 'schools', 'customers',
  'inventory', 'inventory_transactions', 'material_batches',
  'warehouse_inventory', 'material_categories', 'sales_orders',
  'sales_exchanges', 'sales_exchange_items', 'sales_exchange_approvals',
  'reprint_jobs', 'market_adjustments', 'market_adjustment_transactions',
  'transaction_adjustment_snapshots', 'audit_logs', 'documents',
  'tasks', 'classes', 'subjects', 'examination_batches',
  'examination_classes', 'examination_subjects', 'examination_bom_calculations',
  'examination_class_adjustments', 'examination_pricing_audit',
  'examination_batch_notifications', 'notification_audit_logs',
  'bom_default_materials', 'profit_margin_settings',
  'profit_margin_audit_logs', 'work_centers', 'production_resources',
  'work_orders', 'production_batches', 'sale_items',
  'user_companies', 'chart_of_accounts', 'suppliers',
  'purchase_orders', 'goods_receipts'
];

beforeAll(async () => {
  await initDb();
});

afterAll(async () => {
  await runExec('DELETE FROM user_companies WHERE user_id IN (?, ?)', [USER_A_ID, USER_B_ID]);
  await runExec('DELETE FROM sales WHERE id LIKE \'sale-%\'');
  await runExec('DELETE FROM examination_batches WHERE id IN (\'batch-a1\', \'batch-b1\')');
  await runExec('DELETE FROM inventory WHERE id IN (\'inv-a1\', \'inv-b1\')');
});

describe('Tenant Isolation Security', () => {

  test('all business tables have company_id column', async () => {
    for (const table of tables) {
      const cols = await runAll(`PRAGMA table_info(${table})`);
      expect(cols.some(c => c.name === 'company_id')).toBe(true);
    }
  });

  test('data isolation: separate company records are separate', async () => {
    // Insert sample data
    await runExec('INSERT OR IGNORE INTO sales (id, date, total_amount, company_id) VALUES (?, datetime(\'now\'), ?, ?)',
      ['sale-a1', 100, COMPANY_A]);
    await runExec('INSERT OR IGNORE INTO sales (id, date, total_amount, company_id) VALUES (?, datetime(\'now\'), ?, ?)',
      ['sale-a2', 200, COMPANY_A]);
    await runExec('INSERT OR IGNORE INTO sales (id, date, total_amount, company_id) VALUES (?, datetime(\'now\'), ?, ?)',
      ['sale-b1', 300, COMPANY_B]);

    const salesA = await runAll('SELECT id, total_amount FROM sales WHERE company_id = ?', [COMPANY_A]);
    expect(salesA.length).toBe(2);
    expect(salesA.some(s => s.id === 'sale-b1')).toBe(false);

    const salesB = await runAll('SELECT id, total_amount FROM sales WHERE company_id = ?', [COMPANY_B]);
    expect(salesB.length).toBe(1);
    expect(salesB.some(s => s.id === 'sale-a1')).toBe(false);
  });

  test('examination batches isolation', async () => {
    await runExec('INSERT OR IGNORE INTO examination_batches (id, batch_number, school_id, name, company_id) VALUES (?, ?, ?, ?, ?)',
      ['batch-a1', 'BN-A001', 'sch-1', 'Batch A1', COMPANY_A]);
    await runExec('INSERT OR IGNORE INTO examination_batches (id, batch_number, school_id, name, company_id) VALUES (?, ?, ?, ?, ?)',
      ['batch-b1', 'BN-B001', 'sch-2', 'Batch B1', COMPANY_B]);

    const batchesA = await runAll('SELECT id FROM examination_batches WHERE company_id = ?', [COMPANY_A]);
    expect(batchesA.length).toBeGreaterThanOrEqual(1);
    expect(batchesA.some(b => b.id === 'batch-b1')).toBe(false);
  });

  test('inventory isolation', async () => {
    await runExec('INSERT OR IGNORE INTO inventory (id, name, cost_per_unit, quantity, company_id) VALUES (?, ?, ?, ?, ?)',
      ['inv-a1', 'Item A1', 10, 100, COMPANY_A]);
    await runExec('INSERT OR IGNORE INTO inventory (id, name, cost_per_unit, quantity, company_id) VALUES (?, ?, ?, ?, ?)',
      ['inv-b1', 'Item B1', 20, 200, COMPANY_B]);

    const invA = await runAll('SELECT id FROM inventory WHERE company_id = ?', [COMPANY_A]);
    expect(invA.length).toBeGreaterThanOrEqual(1);
    expect(invA.some(i => i.id === 'inv-b1')).toBe(false);
  });

  test('user-company membership validation', async () => {
    await runExec('INSERT OR IGNORE INTO user_companies (id, user_id, company_id, role) VALUES (?, ?, ?, ?)',
      ['uc-a', USER_A_ID, COMPANY_A, 'admin']);
    await runExec('INSERT OR IGNORE INTO user_companies (id, user_id, company_id, role) VALUES (?, ?, ?, ?)',
      ['uc-b', USER_B_ID, COMPANY_B, 'admin']);

    const membershipA = await runAll('SELECT company_id FROM user_companies WHERE user_id = ?', [USER_A_ID]);
    expect(membershipA.some(m => m.company_id === COMPANY_A)).toBe(true);
    expect(membershipA.some(m => m.company_id === COMPANY_B)).toBe(false);

    const membershipB = await runAll('SELECT company_id FROM user_companies WHERE user_id = ?', [USER_B_ID]);
    expect(membershipB.some(m => m.company_id === COMPANY_B)).toBe(true);
    expect(membershipB.some(m => m.company_id === COMPANY_A)).toBe(false);
  });

  test('UPDATE isolation prevents cross-company modification', async () => {
    await runExec('UPDATE sales SET total_amount = 999 WHERE id = ? AND company_id = ?', ['sale-b1', COMPANY_A]);
    const saleBAfter = await runQuery('SELECT total_amount FROM sales WHERE id = ?', ['sale-b1']);
    expect(saleBAfter.total_amount).toBe(300);

    await runExec('UPDATE sales SET total_amount = 999 WHERE id = ? AND company_id = ?', ['sale-b1', COMPANY_B]);
    const saleBAfterOwn = await runQuery('SELECT total_amount FROM sales WHERE id = ?', ['sale-b1']);
    expect(saleBAfterOwn.total_amount).toBe(999);
  });

  test('DELETE isolation prevents cross-company deletion', async () => {
    await runExec('DELETE FROM sales WHERE id = ? AND company_id = ?', ['sale-a1', COMPANY_B]);
    const saleAStillExists = await runQuery('SELECT id FROM sales WHERE id = ?', ['sale-a1']);
    expect(saleAStillExists).toBeDefined();

    await runExec('DELETE FROM sales WHERE id = ? AND company_id = ?', ['sale-a1', COMPANY_A]);
    const saleAGone = await runQuery('SELECT id FROM sales WHERE id = ?', ['sale-a1']);
    expect(saleAGone).toBeUndefined();
  });

  test('tenantContext middleware attaches companyId from header', () => {
    const mockReq = { headers: { 'x-company-id': COMPANY_A }, user: { id: USER_A_ID } };
    const mockRes = {};
    let calledNext = false;
    tenantContext(mockReq, mockRes, () => { calledNext = true; });
    expect(mockReq.companyId).toBe(COMPANY_A);
    expect(calledNext).toBe(true);
  });

  test('tenantContext defaults to empty string when no header', () => {
    const mockReqNoHeader = { headers: {}, user: { id: USER_A_ID } };
    tenantContext(mockReqNoHeader, {}, () => {});
    expect(mockReqNoHeader.companyId).toBe('');
  });
});
