const FinancialYearService = require('../services/financialYearService.cjs');

const financialYearService = new FinancialYearService();

async function injectFinancialYear(req, res, next) {
  try {
    const companyId = req.companyId || '';
    if (!companyId) return next();

    const financialYearId = req.query?.financial_year_id || req.headers['x-financial-year-id'] || req.financialYearId || '';

    if (!financialYearId) {
      const defaultFy = await financialYearService.getDefaultFinancialYear(companyId);
      if (defaultFy) {
        req.financialYearId = defaultFy.id;
        req.fyStartDate = defaultFy.start_date;
        req.fyEndDate = defaultFy.end_date;
        req.fyIsClosed = defaultFy.is_closed === 1;
        req.fyName = defaultFy.name;
      }
      return next();
    }

    const fy = await financialYearService.getFinancialYearById(financialYearId, companyId);
    if (fy) {
      req.financialYearId = fy.id;
      req.fyStartDate = fy.start_date;
      req.fyEndDate = fy.end_date;
      req.fyIsClosed = fy.is_closed === 1;
      req.fyName = fy.name;
    }
    next();
  } catch (err) {
    console.error('[FY Middleware] Error:', err.message);
    next();
  }
}

function addFyDateFilter(sql, params, req, dateColumn = 'date') {
  if (req.fyStartDate && req.fyEndDate) {
    sql += ` AND date(${dateColumn}) >= date(?) AND date(${dateColumn}) <= date(?)`;
    params.push(req.fyStartDate, req.fyEndDate);
  }
  return { sql, params };
}

module.exports = { injectFinancialYear, addFyDateFilter };