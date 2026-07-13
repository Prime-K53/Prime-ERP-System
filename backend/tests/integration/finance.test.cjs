const { createTestDb, createTestApp, createTestSchema, generateTestId } = require('../setup.cjs');
const { TEST_COMPANY_ID } = require('../helpers.cjs');

describe('Finance API Integration', () => {
  let db, finance;

  beforeAll(async () => {
    db = await createTestDb();
    await createTestSchema(db);
    const app = createTestApp(db);
    finance = app.services.finance;
  });

  afterAll(() => db.close());

  describe('Chart of Accounts', () => {
    test('create and retrieve an account', async () => {
      const data = {
        code: '1000',
        name: 'Cash',
        type: 'asset',
        category: 'Current Asset'
      };
      const acct = await finance.createAccount(data, TEST_COMPANY_ID);
      expect(acct).toBeDefined();
      expect(acct.code).toBe('1000');
      expect(acct.name).toBe('Cash');
      expect(acct.type).toBe('asset');

      const fetched = await finance.getAccountById(acct.id, TEST_COMPANY_ID);
      expect(fetched).toBeDefined();
      expect(fetched.id).toBe(acct.id);
    });

    test('update an account', async () => {
      const acct = await finance.createAccount({
        code: '2000', name: 'Old Name', type: 'liability'
      }, TEST_COMPANY_ID);

      const updated = await finance.updateAccount(acct.id, { name: 'New Name' }, TEST_COMPANY_ID);
      expect(updated.name).toBe('New Name');
    });

    test('delete an account', async () => {
      const acct = await finance.createAccount({
        code: '3000', name: 'To Delete', type: 'equity'
      }, TEST_COMPANY_ID);

      await finance.deleteAccount(acct.id, TEST_COMPANY_ID);
      const fetched = await finance.getAccountById(acct.id, TEST_COMPANY_ID);
      expect(fetched).toBeUndefined();
    });

    test('list all accounts', async () => {
      const accounts = await finance.getAccounts(TEST_COMPANY_ID);
      expect(Array.isArray(accounts)).toBe(true);
    });
  });

  describe('Ledger', () => {
    test('save and retrieve ledger entries', async () => {
      const entry = {
        account_id: 'acct-001',
        entry_type: 'debit',
        amount: 500,
        entry_date: new Date().toISOString(),
        description: 'Test entry'
      };
      const saved = await finance.saveLedgerEntry(entry, TEST_COMPANY_ID);
      expect(saved).toBeDefined();
      expect(saved.amount).toBe(500);

      const entries = await finance.getLedger(TEST_COMPANY_ID);
      expect(entries.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Expenses', () => {
    test('CRUD expense', async () => {
      const expense = await finance.createExpense({
        category: 'Office Supplies',
        amount: 250,
        expense_date: new Date().toISOString()
      }, TEST_COMPANY_ID);
      expect(expense).toBeDefined();
      expect(expense.amount).toBe(250);

      const updated = await finance.updateExpense(expense.id, { amount: 300 }, TEST_COMPANY_ID);
      expect(updated.amount).toBe(300);

      const expenses = await finance.getExpenses(TEST_COMPANY_ID);
      expect(expenses.length).toBeGreaterThanOrEqual(1);
      expect(expenses.find(e => e.id === expense.id)).toBeDefined();
    });
  });

  describe('Income', () => {
    test('CRUD income', async () => {
      const income = await finance.createIncome({
        source: 'Sales Revenue',
        amount: 5000,
        income_date: new Date().toISOString()
      }, TEST_COMPANY_ID);
      expect(income).toBeDefined();
      expect(income.amount).toBe(5000);

      const incomes = await finance.getIncome(TEST_COMPANY_ID);
      expect(incomes.length).toBeGreaterThanOrEqual(1);

      await finance.deleteIncome(income.id, TEST_COMPANY_ID);
    });
  });

  describe('Budgets', () => {
    test('CRUD budget', async () => {
      const budget = await finance.createBudget({
        name: 'Annual Operations',
        fiscal_year: '2026',
        period: 'yearly',
        amount: 100000
      }, TEST_COMPANY_ID);
      expect(budget).toBeDefined();

      const updated = await finance.updateBudget(budget.id, { amount: 120000 }, TEST_COMPANY_ID);
      expect(updated.amount).toBe(120000);

      const budgets = await finance.getBudgets(TEST_COMPANY_ID);
      expect(budgets.length).toBeGreaterThanOrEqual(1);

      await finance.deleteBudget(budget.id, TEST_COMPANY_ID);
    });
  });

  describe('Transfers', () => {
    test('create transfer between accounts', async () => {
      const fromAcct = await finance.createAccount({
        code: '4000', name: 'Checking', type: 'asset'
      }, TEST_COMPANY_ID);
      const toAcct = await finance.createAccount({
        code: '5000', name: 'Savings', type: 'asset'
      }, TEST_COMPANY_ID);

      await new Promise((resolve, reject) => {
        db.run('UPDATE chart_of_accounts SET balance = 5000 WHERE id = ?', [fromAcct.id], (err) => {
          if (err) reject(err); else resolve();
        });
      });

      const transfer = await finance.createTransfer({
        from_account_id: fromAcct.id,
        to_account_id: toAcct.id,
        amount: 1000,
        description: 'Monthly savings transfer'
      }, TEST_COMPANY_ID, 'test-user');

      expect(transfer).toBeDefined();
      expect(transfer.amount).toBe(1000);
      expect(transfer.status).toBe('completed');

      const transfers = await finance.getTransfers(TEST_COMPANY_ID);
      expect(transfers.length).toBeGreaterThanOrEqual(1);
    });
  });
});
