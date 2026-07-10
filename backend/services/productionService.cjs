const crypto = require('crypto');

class ProductionService {
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

  async postWipLedger(workOrder, companyId, currency = 'USD') {
    const accounts = await this._all(
      "SELECT * FROM chart_of_accounts WHERE company_id = ? AND type = 'asset' AND (name LIKE '%wip%' OR name LIKE '%work in progress%')",
      [companyId]
    );
    const wipAccount = accounts && accounts.length > 0 ? accounts[0] : null;
    const invAccount = await this._get(
      "SELECT * FROM chart_of_accounts WHERE company_id = ? AND type = 'asset' AND (name LIKE '%inventory%' OR name LIKE '%stock%')",
      [companyId]
    );
    if (!wipAccount || !invAccount) return;
    const qty = workOrder.quantity_planned || 0;
    const unitCost = workOrder.unit_cost || workOrder.estimated_unit_cost || 0;
    let totalAmount = qty * unitCost || workOrder.total_estimated_cost || workOrder.total_cost || qty;
    if (qty > 0 && totalAmount === qty) {
      console.warn(`[Production] WIP ledger amount equals quantity (${totalAmount}) — no cost data for work order ${workOrder.id}`);
    }
    if (totalAmount <= 0) return;
    await this._saveLedgerEntry({
      account_id: wipAccount.id, entry_type: 'debit', amount: totalAmount, currency,
      description: `WIP for Work Order ${workOrder.id}`,
      reference_type: 'work_order', reference_id: workOrder.id
    }, companyId);
    await this._saveLedgerEntry({
      account_id: invAccount.id, entry_type: 'credit', amount: totalAmount, currency,
      description: `Raw materials for Work Order ${workOrder.id}`,
      reference_type: 'work_order', reference_id: workOrder.id
    }, companyId);
  }

  async postCogsLedger(workOrder, companyId, currency = 'USD') {
    const cogsAccount = await this._get(
      "SELECT * FROM chart_of_accounts WHERE company_id = ? AND type = 'expense' AND (name LIKE '%cogs%' OR name LIKE '%cost of goods%' OR code = '5000')",
      [companyId]
    );
    const accounts = await this._all(
      "SELECT * FROM chart_of_accounts WHERE company_id = ? AND type = 'asset' AND (name LIKE '%wip%' OR name LIKE '%work in progress%')",
      [companyId]
    );
    const wipAccount = accounts && accounts.length > 0 ? accounts[0] : null;
    if (!cogsAccount || !wipAccount) return;
    const qty = workOrder.quantity_completed || workOrder.quantity_planned || 0;
    const unitCost = workOrder.unit_cost || workOrder.actual_unit_cost || 0;
    let totalAmount = qty * unitCost || workOrder.total_actual_cost || workOrder.total_cost || qty;
    if (qty > 0 && totalAmount === qty) {
      console.warn(`[Production] COGS ledger amount equals quantity (${totalAmount}) — no cost data for work order ${workOrder.id}`);
    }
    if (totalAmount <= 0) return;
    await this._saveLedgerEntry({
      account_id: cogsAccount.id, entry_type: 'debit', amount: totalAmount, currency,
      description: `COGS for Work Order ${workOrder.id}`,
      reference_type: 'work_order_cogs', reference_id: workOrder.id
    }, companyId);
    await this._saveLedgerEntry({
      account_id: wipAccount.id, entry_type: 'credit', amount: totalAmount, currency,
      description: `WIP reversal for Work Order ${workOrder.id}`,
      reference_type: 'work_order_cogs', reference_id: workOrder.id
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

  // ── Work Centers ───────────────────────────────────────────────────
  async getWorkCenters(companyId) {
    return this._all(
      'SELECT * FROM work_centers WHERE company_id = ? ORDER BY name', [companyId]
    );
  }

  async createWorkCenter(data, companyId) {
    const id = data.id || crypto.randomUUID();
    await this._run(
      `INSERT INTO work_centers (id, name, description, hourly_rate, capacity_per_day, status, location, company_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.description || null, data.hourly_rate || 0,
       data.capacity_per_day || 8, data.status || 'Active',
       data.location || null, companyId]
    );
    return this._get('SELECT * FROM work_centers WHERE id = ?', [id]);
  }

  // ── Resources ──────────────────────────────────────────────────────
  async getResources(companyId) {
    return this._all(
      'SELECT * FROM production_resources WHERE company_id = ? ORDER BY name', [companyId]
    );
  }

  async createResource(data, companyId) {
    const id = data.id || crypto.randomUUID();
    await this._run(
      `INSERT INTO production_resources (id, name, work_center_id, status, resource_type, description, company_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.work_center_id, data.status || 'Active',
       data.resource_type || null, data.description || null, companyId]
    );
    return this._get('SELECT * FROM production_resources WHERE id = ?', [id]);
  }

  // ── Work Orders ────────────────────────────────────────────────────
  async getWorkOrders(companyId) {
    return this._all(
      'SELECT * FROM work_orders WHERE company_id = ? ORDER BY created_at DESC', [companyId]
    );
  }

  async getWorkOrderById(id, companyId) {
    return this._get(
      'SELECT * FROM work_orders WHERE id = ? AND company_id = ?', [id, companyId]
    );
  }

  async createWorkOrder(data, companyId, userId) {
    const id = data.id || crypto.randomUUID();
    await this._run(
      `INSERT INTO work_orders (id, customer_name, product_name, quantity_planned, status, due_date, start_date, priority, work_center_id, linked_batch_id, company_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.customer_name || '', data.product_name || '', data.quantity_planned || 0,
       data.status || 'Draft', data.due_date || null, data.start_date || null,
       data.priority || 'Medium', data.work_center_id || null,
       data.linked_batch_id || null, companyId, userId]
    );
    return this.getWorkOrderById(id, companyId);
  }

  async updateWorkOrder(id, data, companyId, currency = 'USD') {
    const fields = [];
    const params = [];
    const allowed = ['customer_name', 'product_name', 'quantity_planned', 'quantity_completed',
      'quantity_waste', 'status', 'due_date', 'start_date', 'priority', 'work_center_id',
      'linked_batch_id', 'bom_id'];
    for (const field of allowed) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        params.push(data[field]);
      }
    }
    if (!fields.length) return this.getWorkOrderById(id, companyId);
    params.push(id, companyId);
    await this._run(
      `UPDATE work_orders SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?`,
      params
    );
    const workOrder = await this.getWorkOrderById(id, companyId);
    if (data.status === 'In Progress') {
      await this.postWipLedger(workOrder, companyId, currency);
    } else if (data.status === 'Completed') {
      await this.postCogsLedger(workOrder, companyId, currency);
    }
    return workOrder;
  }

  async deleteWorkOrder(id, companyId) {
    await this._run('DELETE FROM work_orders WHERE id = ? AND company_id = ?', [id, companyId]);
    return { success: true };
  }

  // ── Production Batches ─────────────────────────────────────────────
  async getBatches(companyId) {
    return this._all(
      'SELECT * FROM production_batches WHERE company_id = ? ORDER BY created_at DESC', [companyId]
    );
  }

  async createBatch(data, companyId) {
    const id = data.id || crypto.randomUUID();
    await this._run(
      `INSERT INTO production_batches (id, work_order_id, customer_name, name, status, total_amount, quantity_produced, unit_cost, total_cost, company_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.work_order_id || null, data.customer_name || '', data.name || '',
       data.status || 'Pending', data.total_amount || 0, data.quantity_produced || 0,
       data.unit_cost || 0, data.total_cost || 0, companyId]
    );
    return this._get('SELECT * FROM production_batches WHERE id = ?', [id]);
  }
}

module.exports = ProductionService;
