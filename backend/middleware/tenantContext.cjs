function tenantContext(req, res, next) {
  const rawCompanyId = req.headers['x-company-id'];
  req.companyId = (rawCompanyId && typeof rawCompanyId === 'string' && rawCompanyId.trim()) ? rawCompanyId.trim() : '';

  if (!req.user || !req.user.id) {
    return next();
  }

  // No company context required — pass through
  if (!req.companyId) {
    return next();
  }

  try {
    const { db } = require('../db.cjs');
    return db.get('SELECT 1 FROM user_companies WHERE user_id = ? AND company_id = ?', [req.user.id, req.companyId], (err, row) => {
      if (err) {
        // Table might not exist yet; allow through for bootstrapping
        return next();
      }
      if (!row) {
        return res.status(403).json({
          error: 'Cross-company access denied',
          message: 'You do not belong to this company'
        });
      }
      next();
    });
  } catch (err) {
    return next();
  }
}

module.exports = { tenantContext };
