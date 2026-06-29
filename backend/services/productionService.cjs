const crypto = require('crypto');

class ProductionService {
  constructor(db) {
    this.db = db;
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

  async updateWorkOrder(id, data, companyId) {
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
    return this.getWorkOrderById(id, companyId);
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
