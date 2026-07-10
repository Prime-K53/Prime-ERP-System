const crypto = require('crypto');

class ProcurementService {
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

  async postGoodsReceiptLedger(grn, companyId, currency = 'USD') {
    const items = await this._all('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?', [grn.purchase_order_id]);
    const totalAmount = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
    if (totalAmount <= 0) return;
    const inventoryAccount = await this._get(
      "SELECT * FROM chart_of_accounts WHERE company_id = ? AND type = 'asset' AND (name LIKE '%inventory%' OR code = '1200')",
      [companyId]
    );
    const apAccount = await this._get(
      "SELECT * FROM chart_of_accounts WHERE company_id = ? AND type = 'liability' AND (name LIKE '%payable%' OR code = '2000')",
      [companyId]
    );
    if (inventoryAccount && apAccount) {
      const po = await this._get('SELECT * FROM purchase_orders WHERE id = ?', [grn.purchase_order_id]);
      const poCurrency = po?.currency || currency;
      await this._saveLedgerEntry({
        account_id: inventoryAccount.id, entry_type: 'debit', amount: totalAmount,
        currency: poCurrency, description: 'Inventory receipt',
        reference_type: 'goods_receipt', reference_id: grn.id
      }, companyId);
      await this._saveLedgerEntry({
        account_id: apAccount.id, entry_type: 'credit', amount: totalAmount,
        currency: poCurrency, description: 'AP accrual',
        reference_type: 'goods_receipt', reference_id: grn.id
      }, companyId);
    }
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

  // ── Suppliers ──────────────────────────────────────────────────────
  async getSuppliers(companyId) {
    return this._all(
      'SELECT * FROM suppliers WHERE company_id = ? ORDER BY name', [companyId]
    );
  }

  async getSupplierById(id, companyId) {
    return this._get(
      'SELECT * FROM suppliers WHERE id = ? AND company_id = ?', [id, companyId]
    );
  }

  async createSupplier(data, companyId) {
    const id = data.id || crypto.randomUUID();
    await this._run(
      `INSERT INTO suppliers (id, name, email, phone, address, city, status, category, payment_terms, company_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.email || null, data.phone || null,
       data.address || null, data.city || null,
       data.status || 'Active', data.category || null,
       data.payment_terms || null, companyId]
    );
    return this.getSupplierById(id, companyId);
  }

  async updateSupplier(id, data, companyId) {
    const fields = [];
    const params = [];
    const allowed = ['name', 'email', 'phone', 'address', 'city', 'status', 'category', 'payment_terms'];
    for (const field of allowed) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        params.push(data[field] === null ? null : data[field]);
      }
    }
    if (!fields.length) return this.getSupplierById(id, companyId);
    params.push(id, companyId);
    await this._run(
      `UPDATE suppliers SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?`,
      params
    );
    return this.getSupplierById(id, companyId);
  }

  async deleteSupplier(id, companyId) {
    await this._run(
      'DELETE FROM suppliers WHERE id = ? AND company_id = ?', [id, companyId]
    );
    return { success: true };
  }

  // ── Purchase Orders ────────────────────────────────────────────────
  async getPurchases(companyId) {
    return this._all(
      `SELECT po.*, s.name as supplier_name
       FROM purchase_orders po
       LEFT JOIN suppliers s ON po.supplier_id = s.id
       WHERE po.company_id = ? ORDER BY po.created_at DESC`, [companyId]
    );
  }

  async getPurchaseById(id, companyId) {
    return this._get(
      `SELECT po.*, s.name as supplier_name
       FROM purchase_orders po
       LEFT JOIN suppliers s ON po.supplier_id = s.id
       WHERE po.id = ? AND po.company_id = ?`, [id, companyId]
    );
  }

  async getPurchaseItems(purchaseId) {
    return this._all(
      'SELECT * FROM purchase_order_items WHERE purchase_order_id = ?', [purchaseId]
    );
  }

  async createPurchase(data, companyId, userId) {
    const id = data.id || crypto.randomUUID();
    const items = data.items || [];
    try {
      await this._run("BEGIN TRANSACTION");
      await this._run(
        `INSERT INTO purchase_orders (id, supplier_id, order_date, expected_date, status, currency, notes, company_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.supplier_id, data.order_date || new Date().toISOString(),
         data.expected_date || null, data.status || 'Draft',
         data.currency || 'USD', data.notes || null, companyId, userId]
      );
      for (const item of items) {
        await this._run(
          `INSERT INTO purchase_order_items (id, purchase_order_id, item_id, item_name, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [item.id || crypto.randomUUID(), id, item.item_id || null, item.item_name || '',
           item.quantity || 0, item.unit_price || 0, (item.quantity || 0) * (item.unit_price || 0)]
        );
      }
      await this._run("COMMIT");
      return this.getPurchaseById(id, companyId);
    } catch (err) {
      await this._run("ROLLBACK");
      throw err;
    }
  }

  async updatePurchaseStatus(id, status, companyId) {
    await this._run(
      `UPDATE purchase_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?`,
      [status, id, companyId]
    );
    return this.getPurchaseById(id, companyId);
  }

  // ── Goods Receipts ────────────────────────────────────────────────
  async getGoodsReceipts(companyId) {
    return this._all(
      `SELECT gr.*, po.supplier_id, s.name as supplier_name
       FROM goods_receipts gr
       LEFT JOIN purchase_orders po ON gr.purchase_order_id = po.id
       LEFT JOIN suppliers s ON po.supplier_id = s.id
       WHERE gr.company_id = ? ORDER BY gr.created_at DESC`, [companyId]
    );
  }

  async createGoodsReceipt(data, companyId, userId, currency = 'USD') {
    const id = data.id || crypto.randomUUID();
    await this._run(
      `INSERT INTO goods_receipts (id, purchase_order_id, received_date, status, notes, company_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.purchase_order_id, data.received_date || new Date().toISOString(),
       'Received', data.notes || null, companyId, userId]
    );
    const grn = await this._get('SELECT * FROM goods_receipts WHERE id = ?', [id]);
    await this.postGoodsReceiptLedger(grn, companyId, currency);
    return grn;
  }
}

module.exports = ProcurementService;
