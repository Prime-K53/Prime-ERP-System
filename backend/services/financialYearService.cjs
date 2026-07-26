const BaseService = require('./baseService.cjs');

class FinancialYearService extends BaseService {
  async getFinancialYears(companyId) {
    return this._all(
      'SELECT * FROM financial_years WHERE company_id = ? ORDER BY start_date DESC',
      [companyId]
    );
  }

  async getFinancialYearById(id, companyId) {
    return this._get(
      'SELECT * FROM financial_years WHERE id = ? AND company_id = ?',
      [id, companyId]
    );
  }

  async getDefaultFinancialYear(companyId) {
    let fy = await this._get(
      'SELECT * FROM financial_years WHERE company_id = ? AND is_default = 1 AND status = \'Active\' LIMIT 1',
      [companyId]
    );
    if (!fy) {
      fy = await this._get(
        'SELECT * FROM financial_years WHERE company_id = ? AND status = \'Active\' ORDER BY start_date DESC LIMIT 1',
        [companyId]
      );
    }

    if (fy) {
      const today = new Date().toISOString().slice(0, 10);
      if (today > fy.end_date) {
        const nextStartDate = new Date(fy.end_date);
        nextStartDate.setDate(nextStartDate.getDate() + 1);
        const nextEndDate = new Date(nextStartDate);
        nextEndDate.setDate(nextEndDate.getDate() + 365);
        const nextYear = nextStartDate.getFullYear();

        await this.closeFinancialYear(fy.id, companyId);

        fy = await this.createFinancialYear({
          name: String(nextYear),
          code: `FY${nextYear}`,
          start_date: nextStartDate.toISOString().slice(0, 10),
          end_date: nextEndDate.toISOString().slice(0, 10),
          is_default: true,
          status: 'Active',
          is_closed: false
        }, companyId, '');
      }
    }

    return fy || null;
  }

  async getFinancialYearByDate(date, companyId) {
    const row = await this._get(
      `SELECT * FROM financial_years
       WHERE company_id = ? AND date(?) >= date(start_date) AND date(?) <= date(end_date)
       LIMIT 1`,
      [companyId, date, date]
    );
    return row || null;
  }

  async createFinancialYear(data, companyId, userId) {
    const id = data.id || require('crypto').randomUUID();
    const existing = await this._get(
      'SELECT id FROM financial_years WHERE company_id = ? AND status = \'Active\' AND date(start_date) <= date(?) AND date(end_date) >= date(?)',
      [companyId, data.end_date, data.start_date]
    );
    if (existing) {
      throw new Error('Overlapping financial year already exists for this period');
    }
    const hasAny = await this._get(
      'SELECT id FROM financial_years WHERE company_id = ? LIMIT 1',
      [companyId]
    );
    const isDefault = data.is_default !== undefined ? (data.is_default ? 1 : 0) : (!hasAny ? 1 : 0);
    if (isDefault) {
      await this._run(
        'UPDATE financial_years SET is_default = 0 WHERE company_id = ?',
        [companyId]
      );
    }
    await this._run(
      `INSERT INTO financial_years (id, name, code, start_date, end_date, is_default, is_closed, status, company_id, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        id,
        data.name,
        data.code || '',
        data.start_date,
        data.end_date,
        isDefault,
        data.is_closed ? 1 : 0,
        data.status || 'Active',
        companyId,
        userId || ''
      ]
    );
    return this.getFinancialYearById(id, companyId);
  }

  async updateFinancialYear(id, data, companyId) {
    const fy = await this.getFinancialYearById(id, companyId);
    if (!fy) throw new Error('Financial year not found');

    const fields = [];
    const params = [];

    if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name); }
    if (data.code !== undefined) { fields.push('code = ?'); params.push(data.code); }
    if (data.start_date !== undefined) { fields.push('start_date = ?'); params.push(data.start_date); }
    if (data.end_date !== undefined) { fields.push('end_date = ?'); params.push(data.end_date); }
    if (data.status !== undefined) { fields.push('status = ?'); params.push(data.status); }
    if (data.is_closed !== undefined) { fields.push('is_closed = ?'); params.push(data.is_closed ? 1 : 0); }
    if (data.is_default !== undefined) {
      if (data.is_default) {
        await this._run('UPDATE financial_years SET is_default = 0 WHERE company_id = ?', [companyId]);
      }
      fields.push('is_default = ?');
      params.push(data.is_default ? 1 : 0);
    }

    if (fields.length === 0) return fy;

    fields.push("updated_at = datetime('now')");
    params.push(id, companyId);

    await this._run(
      `UPDATE financial_years SET ${fields.join(', ')} WHERE id = ? AND company_id = ?`,
      params
    );
    return this.getFinancialYearById(id, companyId);
  }

  async closeFinancialYear(id, companyId) {
    const fy = await this.getFinancialYearById(id, companyId);
    if (!fy) throw new Error('Financial year not found');
    if (fy.is_closed) throw new Error('Financial year is already closed');

    await this._run(
      `UPDATE financial_years SET is_closed = 1, status = 'Closed', updated_at = datetime('now') WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );
    return this.getFinancialYearById(id, companyId);
  }

  async deleteFinancialYear(id, companyId) {
    const fy = await this.getFinancialYearById(id, companyId);
    if (!fy) throw new Error('Financial year not found');
    if (fy.is_default) {
      throw new Error('Cannot delete the default financial year. Set another year as default first.');
    }
    await this._run(
      'DELETE FROM financial_years WHERE id = ? AND company_id = ?',
      [id, companyId]
    );
    return { success: true };
  }

  async getOrCreateDefaultFinancialYear(companyId, userId) {
    let fy = await this.getDefaultFinancialYear(companyId);
    if (fy) return fy;

    const now = new Date();
    const year = now.getFullYear();
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    fy = await this.createFinancialYear({
      name: `${year}`,
      code: `FY${year}`,
      start_date: startDate,
      end_date: endDate,
      is_default: true,
      status: 'Active',
      is_closed: false
    }, companyId, userId);

    return fy;
  }

  async validateTransactionDate(date, companyId) {
    const fy = await this.getFinancialYearByDate(date, companyId);
    if (!fy) {
      throw new Error(`Selected date does not belong to any active Financial Year. Please switch Financial Year or choose a valid date.`);
    }
    if (fy.is_closed) {
      throw new Error(`Financial Year "${fy.name}" is closed. No new transactions can be created.`);
    }
    return fy;
  }
}

module.exports = FinancialYearService;