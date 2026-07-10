const crypto = require('crypto');

class HRService {
  constructor(db) {
    this.db = db;
  }

  async _saveLedgerEntry(entry, companyId) {
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO ledger_entries (id, account_id, entry_type, amount, currency, description, reference_type, reference_id, entry_date, company_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, entry.account_id, entry.entry_type, entry.amount, entry.currency || 'USD',
         entry.description || null, entry.reference_type || null,
         entry.reference_id || null, entry.entry_date || new Date().toISOString(), companyId],
        function(err) {
          if (err) reject(err);
          else resolve(id);
        }
      );
    });
  }

  async postPayrollLedger(run, companyId, currency = 'USD') {
    let expenseAccount = await this._get(
      "SELECT * FROM chart_of_accounts WHERE company_id = ? AND type = 'expense' AND (name LIKE '%wage%' OR name LIKE '%salary%' OR name LIKE '%payroll%' OR code = '6300')",
      [companyId]
    );
    let liabilityAccount = await this._get(
      "SELECT * FROM chart_of_accounts WHERE company_id = ? AND type = 'liability' AND (name LIKE '%payable%' OR name LIKE '%accrued%')",
      [companyId]
    );
    const totalAmount = (run.total_gross || 0);
    if (totalAmount <= 0 || !expenseAccount || !liabilityAccount) return;
    await this._saveLedgerEntry({
      account_id: expenseAccount.id, entry_type: 'debit', amount: totalAmount, currency,
      description: `Payroll ${run.name || run.id}`,
      reference_type: 'payroll', reference_id: run.id
    }, companyId);
    await this._saveLedgerEntry({
      account_id: liabilityAccount.id, entry_type: 'credit', amount: totalAmount, currency,
      description: `Payroll liability ${run.name || run.id}`,
      reference_type: 'payroll', reference_id: run.id
    }, companyId);
  }

  _run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ changes: this.changes, lastID: this.lastID });
      });
    });
  }

  _get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  _all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getEmployees(companyId) {
    return this._all('SELECT * FROM employees WHERE company_id = ? ORDER BY name', [companyId]);
  }

  async createEmployee(data, companyId) {
    const id = data.id || crypto.randomUUID();
    await this._run(
      `INSERT INTO employees (id, name, email, phone, department, role, status, salary, company_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.email || null, data.phone || null,
       data.department || null, data.role || null,
       data.status || 'Active', data.salary || 0, companyId]
    );
    return this._get('SELECT * FROM employees WHERE id = ?', [id]);
  }

  async updateEmployee(id, data, companyId) {
    const fields = [];
    const params = [];
    const allowed = ['name', 'email', 'phone', 'department', 'role', 'status', 'salary'];
    for (const field of allowed) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        params.push(data[field]);
      }
    }
    if (!fields.length) return this._get('SELECT * FROM employees WHERE id = ? AND company_id = ?', [id, companyId]);
    params.push(id, companyId);
    await this._run(`UPDATE employees SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?`, params);
    return this._get('SELECT * FROM employees WHERE id = ?', [id]);
  }

  async deleteEmployee(id, companyId) {
    await this._run('DELETE FROM employees WHERE id = ? AND company_id = ?', [id, companyId]);
    return { success: true };
  }

  async getPayrollRuns(companyId) {
    return this._all('SELECT * FROM payroll_runs WHERE company_id = ? ORDER BY created_at DESC', [companyId]);
  }

  async createPayrollRun(data, companyId, currency = 'USD') {
    const id = data.id || crypto.randomUUID();
    await this._run(
      `INSERT INTO payroll_runs (id, name, period_start, period_end, status, total_gross, total_deductions, total_net, employee_count, company_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.period_start, data.period_end, data.status || 'Draft',
       data.total_gross || 0, data.total_deductions || 0, data.total_net || 0,
       data.employee_count || 0, companyId]
    );
    const run = await this._get('SELECT * FROM payroll_runs WHERE id = ?', [id]);
    await this.postPayrollLedger(run, companyId, currency);
    return run;
  }

  async getPayslips(companyId) {
    return this._all('SELECT * FROM payslips WHERE company_id = ? ORDER BY created_at DESC', [companyId]);
  }

  async createPayslip(data, companyId) {
    const id = data.id || crypto.randomUUID();
    await this._run(
      `INSERT INTO payslips (id, employee_id, payroll_run_id, gross_pay, deductions, net_pay, pay_period, status, company_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.employee_id, data.payroll_run_id, data.gross_pay || 0,
       data.deductions || 0, data.net_pay || 0, data.pay_period,
       data.status || 'Draft', companyId]
    );
    return this._get('SELECT * FROM payslips WHERE id = ?', [id]);
  }
}

module.exports = HRService;
