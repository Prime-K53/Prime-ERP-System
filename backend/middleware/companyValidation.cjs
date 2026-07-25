// ============================================================================
// Company Validation Middleware
// ============================================================================
// Validates cross-entity company consistency for inventory operations.
// This runs AFTER tenantContext has set req.companyId.
// ============================================================================

/**
 * Validate that an inventory item belongs to the current company.
 * Used before any inventory mutation.
 */
async function validateInventoryCompany(db, itemId, companyId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT id, company_id FROM inventory WHERE id = ? AND company_id = ?`,
      [itemId, companyId],
      (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error(`Inventory item ${itemId} not found or not in company ${companyId}`));
        resolve(row);
      }
    );
  });
}

/**
 * Validate that a warehouse belongs to the current company.
 */
async function validateWarehouseCompany(db, warehouseId, companyId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT id, company_id FROM warehouses WHERE id = ? AND company_id = ?`,
      [warehouseId, companyId],
      (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error(`Warehouse ${warehouseId} not found or not in company ${companyId}`));
        resolve(row);
      }
    );
  });
}

/**
 * Middleware: Validates that inventory transaction items belong to the same company.
 * Attach to routes that create inventory transactions.
 */
function requireInventoryTransactionCompany(db) {
  return async (req, res, next) => {
    try {
      const { itemId, inventoryId, fromWarehouseId, toWarehouseId } = req.body;
      const companyId = req.companyId || '';

      if (itemId) {
        await validateInventoryCompany(db, itemId, companyId);
      }
      if (inventoryId) {
        await validateInventoryCompany(db, inventoryId, companyId);
      }
      if (fromWarehouseId) {
        await validateWarehouseCompany(db, fromWarehouseId, companyId);
      }
      if (toWarehouseId) {
        await validateWarehouseCompany(db, toWarehouseId, companyId);
      }

      next();
    } catch (err) {
      return res.status(403).json({
        error: 'Cross-company reference denied',
        message: err.message
      });
    }
  };
}

module.exports = {
  validateInventoryCompany,
  validateWarehouseCompany,
  requireInventoryTransactionCompany
};
