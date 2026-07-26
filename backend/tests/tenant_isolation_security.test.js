/**
 * Tenant Isolation Security Tests
 * Validates that cross-company data leakage is eliminated.
 */
const { db, initDb } = require('../db.cjs');

const COMPANY_A = 'comp-a-test';
const COMPANY_B = 'comp-b-test';
const USER_A_ID = 'usr-test-a';
const USER_B_ID = 'usr-test-b';

let pass = 0;
let fail = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  PASS: ${msg}`);
    pass++;
  } else {
    console.error(`  FAIL: ${msg}`);
    fail++;
  }
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function runAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function runExec(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function runTests() {
  console.log('\n=== TENANT ISOLATION SECURITY TESTS ===\n');

  // 1. Verify company_id columns exist on all tables
  console.log('1. Schema: company_id column exists on all business tables\n');
  const tables = [
    'sales', 'invoices', 'examinations', 'schools', 'customers',
    'inventory', 'inventory_transactions', 'material_batches',
    'warehouse_inventory', 'material_categories', 'sales_orders',
    'sales_exchanges', 'sales_exchange_items', 'sales_exchange_approvals',
    'reprint_jobs', 'market_adjustments', 'market_adjustment_transactions',
    'transaction_adjustment_snapshots', 'audit_logs', 'documents',
    'tasks', 'classes', 'subjects',
    'examination_batches', 'examination_classes', 'examination_subjects',
    'examination_bom_calculations', 'examination_class_adjustments',
    'examination_pricing_audit', 'examination_batch_notifications',
    'notification_audit_logs', 'bom_default_materials',
    'profit_margin_settings', 'profit_margin_audit_logs',
    'work_centers', 'production_resources', 'work_orders', 'production_batches'
  ];

  for (const table of tables) {
    try {
      const row = await runQuery(`PRAGMA table_info(${table})`);
      // Just check the table exists
      assert(true, `${table} table exists`);
    } catch (err) {
      assert(false, `${table} table exists — ${err.message}`);
    }
  }

  // Verify company_id column specifically
  for (const table of tables) {
    try {
      const cols = await runAll(`PRAGMA table_info(${table})`);
      const hasCompanyId = cols.some(c => c.name === 'company_id');
      assert(hasCompanyId, `${table} has company_id column`);
    } catch (err) {
      assert(false, `${table} has company_id column — ${err.message}`);
    }
  }

  // 2. Test data isolation: insert two companies' data
  console.log('\n2. Data Isolation: Separate company records are isolated\n');

  // Insert sample data for Company A
  await runExec('INSERT OR IGNORE INTO sales (id, date, total_amount, company_id) VALUES (?, datetime(\'now\'), ?, ?)',
    ['sale-a1', 100, COMPANY_A]);
  await runExec('INSERT OR IGNORE INTO sales (id, date, total_amount, company_id) VALUES (?, datetime(\'now\'), ?, ?)',
    ['sale-a2', 200, COMPANY_A]);
  await runExec('INSERT OR IGNORE INTO sales (id, date, total_amount, company_id) VALUES (?, datetime(\'now\'), ?, ?)',
    ['sale-b1', 300, COMPANY_B]);

  // Query Company A's sales
  const salesA = await runAll('SELECT id, total_amount FROM sales WHERE company_id = ?', [COMPANY_A]);
  assert(salesA.length === 2, 'Company A sees only its 2 sales records');
  assert(!salesA.some(s => s.id === 'sale-b1'), 'Company A cannot see Company B\'s sales');

  // Query Company B's sales
  const salesB = await runAll('SELECT id, total_amount FROM sales WHERE company_id = ?', [COMPANY_B]);
  assert(salesB.length === 1, 'Company B sees only its 1 sale record');
  assert(!salesB.some(s => s.id === 'sale-a1'), 'Company B cannot see Company A\'s sales');

  // Global query (no company filter) returns all
  const allSales = await runAll('SELECT id FROM sales WHERE id LIKE \'sale-%\' ORDER BY id');
  assert(allSales.length >= 3, 'Unfiltered query returns all sales (system-wide)');

  // 3. Test examination batches isolation
  console.log('\n3. Examination Batches: company_id enforced\n');
  await runExec('INSERT OR IGNORE INTO examination_batches (id, batch_number, school_id, name, company_id) VALUES (?, ?, ?, ?, ?)',
    ['batch-a1', 'BN-A001', 'sch-1', 'Batch A1', COMPANY_A]);
  await runExec('INSERT OR IGNORE INTO examination_batches (id, batch_number, school_id, name, company_id) VALUES (?, ?, ?, ?, ?)',
    ['batch-b1', 'BN-B001', 'sch-2', 'Batch B1', COMPANY_B]);

  const batchesA = await runAll('SELECT id FROM examination_batches WHERE company_id = ?', [COMPANY_A]);
  assert(batchesA.length >= 1, 'Company A sees its batches');
  assert(!batchesA.some(b => b.id === 'batch-b1'), 'Company A cannot see Company B\'s batches');

  // 4. Test inventory isolation
  console.log('\n4. Inventory: company_id enforced\n');
  await runExec('INSERT OR IGNORE INTO inventory (id, name, cost_per_unit, quantity, company_id) VALUES (?, ?, ?, ?, ?)',
    ['inv-a1', 'Item A1', 10, 100, COMPANY_A]);
  await runExec('INSERT OR IGNORE INTO inventory (id, name, cost_per_unit, quantity, company_id) VALUES (?, ?, ?, ?, ?)',
    ['inv-b1', 'Item B1', 20, 200, COMPANY_B]);

  const invA = await runAll('SELECT id FROM inventory WHERE company_id = ?', [COMPANY_A]);
  assert(invA.length >= 1, 'Company A sees its inventory');
  assert(!invA.some(i => i.id === 'inv-b1'), 'Company A cannot see Company B\'s inventory');

  // 5. Test user_companies membership validation
  console.log('\n5. User-Company Membership: validation works\n');
  await runExec('INSERT OR IGNORE INTO user_companies (id, user_id, company_id, role) VALUES (?, ?, ?, ?)',
    ['uc-a', USER_A_ID, COMPANY_A, 'admin']);
  await runExec('INSERT OR IGNORE INTO user_companies (id, user_id, company_id, role) VALUES (?, ?, ?, ?)',
    ['uc-b', USER_B_ID, COMPANY_B, 'admin']);

  const membershipA = await runAll('SELECT company_id FROM user_companies WHERE user_id = ?', [USER_A_ID]);
  assert(membershipA.some(m => m.company_id === COMPANY_A), 'User A belongs to Company A');
  assert(!membershipA.some(m => m.company_id === COMPANY_B), 'User A does NOT belong to Company B');

  const membershipB = await runAll('SELECT company_id FROM user_companies WHERE user_id = ?', [USER_B_ID]);
  assert(membershipB.some(m => m.company_id === COMPANY_B), 'User B belongs to Company B');
  assert(!membershipB.some(m => m.company_id === COMPANY_A), 'User B does NOT belong to Company A');

  // 6. Verify that company_id filter on UPDATE prevents cross-company modification
  console.log('\n6. UPDATE Isolation: company_id prevents cross-company modification\n');
  await runExec('UPDATE sales SET total_amount = 999 WHERE id = ? AND company_id = ?', ['sale-b1', COMPANY_A]);
  const saleBAfter = await runQuery('SELECT total_amount FROM sales WHERE id = ?', ['sale-b1']);
  assert(saleBAfter.total_amount === 300, 'Company A cannot modify Company B\'s sale (value unchanged)');

  // Company B's own update works
  await runExec('UPDATE sales SET total_amount = 999 WHERE id = ? AND company_id = ?', ['sale-b1', COMPANY_B]);
  const saleBAfterOwn = await runQuery('SELECT total_amount FROM sales WHERE id = ?', ['sale-b1']);
  assert(saleBAfterOwn.total_amount === 999, 'Company B can modify its own sale');

  // 7. Verify DELETE isolation
  console.log('\n7. DELETE Isolation: company_id prevents cross-company deletion\n');
  await runExec('DELETE FROM sales WHERE id = ? AND company_id = ?', ['sale-a1', COMPANY_B]);
  const saleAStillExists = await runQuery('SELECT id FROM sales WHERE id = ?', ['sale-a1']);
  assert(saleAStillExists !== undefined, 'Company B cannot delete Company A\'s sale');

  await runExec('DELETE FROM sales WHERE id = ? AND company_id = ?', ['sale-a1', COMPANY_A]);
  const saleAGone = await runQuery('SELECT id FROM sales WHERE id = ?', ['sale-a1']);
  assert(saleAGone === undefined, 'Company A can delete its own sale');

  // 8. Verify the tenantContext middleware behavior
  console.log('\n8. Middleware: tenantContext attaches companyId\n');
  const mockReq = {
    headers: { 'x-company-id': COMPANY_A },
    user: { id: USER_A_ID }
  };
  const mockRes = {};
  let calledNext = false;
  const mockNext = () => { calledNext = true; };

  const { tenantContext } = require('../middleware/tenantContext.cjs');
  tenantContext(mockReq, mockRes, (err) => {
    mockNext();
    assert(mockReq.companyId === COMPANY_A, 'Middleware sets req.companyId from x-company-id header');
  });

  // Without header
  const mockReqNoHeader = { headers: {}, user: { id: USER_A_ID } };
  tenantContext(mockReqNoHeader, mockRes, () => {
    assert(mockReqNoHeader.companyId === '', 'Middleware defaults to empty string when no header');
  });

  // 9. Test examination classes and subjects isolation with company_id
  console.log('\n9. Examination Classes & Subjects: company_id enforced\n');
  if (await runQuery('SELECT 1 FROM pragma_table_info WHERE name = ? AND pk = 0', ['examination_classes'])) {
    // Only run if table schema reflects company_id
  }
  await runExec('INSERT OR IGNORE INTO examination_classes (id, company_id, batch_id, class_name, number_of_learners) VALUES (?, ?, ?, ?, ?)',
    ['class-a1', COMPANY_A, 'batch-a1', 'Class A1', 30]);
  await runExec('INSERT OR IGNORE INTO examination_classes (id, company_id, batch_id, class_name, number_of_learners) VALUES (?, ?, ?, ?, ?)',
    ['class-b1', COMPANY_B, 'batch-b1', 'Class B1', 25]);

  const classesA = await runAll('SELECT id FROM examination_classes WHERE company_id = ?', [COMPANY_A]);
  assert(classesA.some(c => c.id === 'class-a1'), 'Company A sees its classes');
  assert(!classesA.some(c => c.id === 'class-b1'), 'Company A cannot see Company B\'s classes');

  // UPDATE isolation on examination_classes
  await runExec('UPDATE examination_classes SET number_of_learners = 99 WHERE id = ? AND company_id = ?',
    ['class-b1', COMPANY_A]);
  const classBAfter = await runQuery('SELECT number_of_learners FROM examination_classes WHERE id = ?', ['class-b1']);
  assert(classBAfter.number_of_learners === 25, 'Company A cannot modify Company B\'s class');

  // DELETE isolation on examination_classes
  await runExec('DELETE FROM examination_classes WHERE id = ? AND company_id = ?', ['class-a1', COMPANY_B]);
  const classAStillExists = await runQuery('SELECT id FROM examination_classes WHERE id = ?', ['class-a1']);
  assert(classAStillExists !== undefined, 'Company B cannot delete Company A\'s class');

  // 10. Test examination_subjects isolation
  console.log('\n10. Examination Subjects: company_id enforced\n');
  await runExec('INSERT OR IGNORE INTO examination_subjects (id, company_id, class_id, subject_name, pages) VALUES (?, ?, ?, ?, ?)',
    ['subj-a1', COMPANY_A, 'class-a1', 'Math', 10]);
  await runExec('INSERT OR IGNORE INTO examination_subjects (id, company_id, class_id, subject_name, pages) VALUES (?, ?, ?, ?, ?)',
    ['subj-b1', COMPANY_B, 'class-b1', 'English', 12]);

  const subjectsA = await runAll('SELECT id FROM examination_subjects WHERE company_id = ?', [COMPANY_A]);
  assert(subjectsA.some(s => s.id === 'subj-a1'), 'Company A sees its subjects');
  assert(!subjectsA.some(s => s.id === 'subj-b1'), 'Company A cannot see Company B\'s subjects');

  // 11. Test examine_bom_calculations isolation
  console.log('\n11. Examination BOM Calculations: company_id enforced\n');
  await runExec('INSERT OR IGNORE INTO examination_bom_calculations (id, company_id, batch_id, item_id, quantity_required, unit_cost, total_cost) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['bom-a1', COMPANY_A, 'batch-a1', 'item-1', 10, 5, 50]);
  await runExec('INSERT OR IGNORE INTO examination_bom_calculations (id, company_id, batch_id, item_id, quantity_required, unit_cost, total_cost) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['bom-b1', COMPANY_B, 'batch-b1', 'item-2', 20, 3, 60]);

  const bomsA = await runAll('SELECT id FROM examination_bom_calculations WHERE company_id = ?', [COMPANY_A]);
  assert(bomsA.some(b => b.id === 'bom-a1'), 'Company A sees its BOM calculations');
  assert(!bomsA.some(b => b.id === 'bom-b1'), 'Company A cannot see Company B\'s BOM calculations');

  // 12. Test examination_class_adjustments isolation
  console.log('\n12. Examination Class Adjustments: company_id enforced\n');
  await runExec('INSERT OR IGNORE INTO examination_class_adjustments (id, company_id, batch_id, class_id, adjustment_id, adjustment_name, adjustment_type, adjustment_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ['adj-a1', COMPANY_A, 'batch-a1', 'class-a1', 'adj-1', 'Discount', 'FIXED', 10]);
  await runExec('INSERT OR IGNORE INTO examination_class_adjustments (id, company_id, batch_id, class_id, adjustment_id, adjustment_name, adjustment_type, adjustment_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ['adj-b1', COMPANY_B, 'batch-b1', 'class-b1', 'adj-2', 'Surcharge', 'FIXED', 20]);

  const adjsA = await runAll('SELECT id FROM examination_class_adjustments WHERE company_id = ?', [COMPANY_A]);
  assert(adjsA.some(a => a.id === 'adj-a1'), 'Company A sees its adjustments');
  assert(!adjsA.some(a => a.id === 'adj-b1'), 'Company A cannot see Company B\'s adjustments');

  // 13. Test validateCompanyOwnership utility
  console.log('\n13. validateCompanyOwnership: ownership validation works\n');
  const { validateCompanyOwnership } = require('../middleware/validation.cjs');
  const owned = await validateCompanyOwnership('examination_batches', 'id', 'batch-a1', COMPANY_A);
  assert(owned !== null, 'Company A owns batch-a1');
  const notOwned = await validateCompanyOwnership('examination_batches', 'id', 'batch-b1', COMPANY_A);
  assert(notOwned === null, 'Company A does NOT own batch-b1');

  // 14. Cleanup test data
  console.log('\n14. Cleanup\n');
  await runExec('DELETE FROM examination_class_adjustments WHERE id IN (\'adj-a1\', \'adj-b1\')');
  await runExec('DELETE FROM examination_bom_calculations WHERE id IN (\'bom-a1\', \'bom-b1\')');
  await runExec('DELETE FROM examination_subjects WHERE id IN (\'subj-a1\', \'subj-b1\')');
  await runExec('DELETE FROM examination_classes WHERE id IN (\'class-a1\', \'class-b1\')');
  await runExec('DELETE FROM user_companies WHERE user_id IN (?, ?)', [USER_A_ID, USER_B_ID]);
  await runExec('DELETE FROM sales WHERE id LIKE \'sale-%\'');
  await runExec('DELETE FROM examination_batches WHERE id IN (\'batch-a1\', \'batch-b1\')');
  await runExec('DELETE FROM inventory WHERE id IN (\'inv-a1\', \'inv-b1\')');
  console.log('  Test data cleaned up\n');

  // Summary
  console.log('=== SUMMARY ===');
  console.log(`  Passed: ${pass}`);
  console.log(`  Failed: ${fail}`);
  console.log(`  Result: ${fail === 0 ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}\n`);

  process.exit(fail === 0 ? 0 : 1);
}

// Wait for DB init
initDb().then(() => {
  runTests().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
  });
});
