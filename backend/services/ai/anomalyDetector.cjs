const BaseAIService = require('./baseService.cjs');

class AnomalyDetector extends BaseAIService {
  async detect(companyId, options = {}) {
    const anomalies = [];
    const lookbackDays = options.lookbackDays || 90;

    const txAnomalies = await this._detectTransactionAnomalies(companyId, lookbackDays);
    anomalies.push(...txAnomalies);

    const pricingAnomalies = await this._detectPricingAnomalies(companyId);
    anomalies.push(...pricingAnomalies);

    const inventoryAnomalies = await this._detectInventoryAnomalies(companyId);
    anomalies.push(...inventoryAnomalies);

    const authAnomalies = await this._detectAuthAnomalies(companyId, lookbackDays);
    anomalies.push(...authAnomalies);

    const auditAnomalies = await this._detectAuditAnomalies(companyId, lookbackDays);
    anomalies.push(...auditAnomalies);

    anomalies.sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0));

    return {
      anomalies,
      totalCount: anomalies.length,
      highRiskCount: anomalies.filter(a => (a.risk_score || 0) >= 0.7).length,
      mediumRiskCount: anomalies.filter(a => (a.risk_score || 0) >= 0.4 && (a.risk_score || 0) < 0.7).length,
      lowRiskCount: anomalies.filter(a => (a.risk_score || 0) < 0.4).length,
      categories: [...new Set(anomalies.map(a => a.category))],
      generatedAt: new Date().toISOString()
    };
  }

  async _detectTransactionAnomalies(companyId, lookbackDays) {
    const anomalies = [];
    const entries = await this._all(
      `SELECT le.*, ac.name as account_name, ac.code as account_code
       FROM ledger_entries le
       LEFT JOIN chart_of_accounts ac ON le.account_id = ac.id
       WHERE le.company_id = ? AND le.entry_date >= date('now', ? || ' days')`,
      [companyId, String(-lookbackDays)]
    );

    const amounts = entries.map(e => this._safeNumber(e.amount)).filter(a => a > 0);
    if (amounts.length < 5) return anomalies;

    amounts.sort((a, b) => a - b);
    const q1 = amounts[Math.floor(amounts.length * 0.25)];
    const q3 = amounts[Math.floor(amounts.length * 0.75)];
    const iqr = q3 - q1;
    const upperBound = q3 + 3 * iqr;

    for (const entry of entries) {
      const amt = this._safeNumber(entry.amount);
      if (amt > upperBound && amt > 10000) {
        anomalies.push({
          id: `tx-${entry.id}`,
          category: 'transaction',
          type: 'unusual_amount',
          severity: amt > upperBound * 2 ? 'critical' : 'high',
          risk_score: Math.min(1, amt / (upperBound * 3)),
          description: `Unusual ${entry.entry_type} of ${amt} in "${entry.account_name || entry.account_code}"`,
          entityId: entry.id,
          entityType: 'ledger_entry',
          accountName: entry.account_name || entry.account_code,
          amount: amt,
          date: entry.entry_date,
          benchmark: upperBound
        });
      }
    }

    const duplicates = this._findDuplicateEntries(entries);
    anomalies.push(...duplicates);

    return anomalies;
  }

  _findDuplicateEntries(entries) {
    const anomalies = [];
    const seen = new Map();

    for (const entry of entries) {
      const key = `${entry.entry_type}-${this._safeNumber(entry.amount)}-${entry.entry_date}`;
      if (seen.has(key)) {
        anomalies.push({
          id: `dup-${entry.id}`,
          category: 'transaction',
          type: 'duplicate_entry',
          severity: 'high',
          risk_score: 0.8,
          description: `Possible duplicate ${entry.entry_type} of ${entry.amount} on ${entry.entry_date}`,
          entityId: entry.id,
          entityType: 'ledger_entry',
          amount: this._safeNumber(entry.amount),
          date: entry.entry_date,
          matchedEntryId: seen.get(key)
        });
      } else {
        seen.set(key, entry.id);
      }
    }
    return anomalies;
  }

  async _detectPricingAnomalies(companyId) {
    const anomalies = [];

    const auditData = await this._all(
      `SELECT * FROM examination_pricing_audit
       WHERE company_id = ? OR company_id IS NULL
       ORDER BY created_at DESC LIMIT 200`,
      [companyId]
    );

    const overrideAudits = auditData.filter(a =>
      a.event_type === 'MANUAL_OVERRIDE' && a.percentage_difference > 25
    );

    for (const a of overrideAudits) {
      anomalies.push({
        id: `price-${a.id}`,
        category: 'pricing',
        type: 'large_override',
        severity: a.percentage_difference > 50 ? 'critical' : 'high',
        risk_score: Math.min(1, (a.percentage_difference || 0) / 100),
        description: `Large pricing override: ${a.percentage_difference}% change from suggested`,
        entityId: a.batch_id,
        entityType: 'examination_batch',
        percentageDifference: a.percentage_difference,
        previousAmount: a.previous_cost_per_learner,
        newAmount: a.new_cost_per_learner,
        date: a.created_at
      });
    }

    const marginSettings = await this._all(
      `SELECT * FROM profit_margin_settings WHERE company_id = ? AND is_active = 1 AND margin_type = 'percentage'`,
      [companyId]
    );

    for (const ms of marginSettings) {
      if (ms.margin_value > 80) {
        anomalies.push({
          id: `margin-${ms.id}`,
          category: 'pricing',
          type: 'extreme_margin',
          severity: 'medium',
          risk_score: 0.6,
          description: `Extreme profit margin of ${ms.margin_value}% (scope: ${ms.scope})`,
          entityId: ms.id,
          entityType: 'profit_margin_setting',
          marginValue: ms.margin_value,
          scope: ms.scope
        });
      }
    }

    return anomalies;
  }

  async _detectInventoryAnomalies(companyId) {
    const anomalies = [];

    const items = await this._all(
      `SELECT * FROM inventory WHERE company_id = ?`,
      [companyId]
    );

    for (const item of items) {
      if (item.quantity < 0) {
        anomalies.push({
          id: `inv-neg-${item.id}`,
          category: 'inventory',
          type: 'negative_stock',
          severity: 'high',
          risk_score: 0.85,
          description: `Negative stock for "${item.material || item.name}" (qty: ${item.quantity})`,
          entityId: item.id,
          entityType: 'inventory',
          itemName: item.material || item.name,
          quantity: item.quantity
        });
      }
      if (item.reorder_point > 0 && item.quantity > 0 && item.quantity < item.reorder_point * 0.3) {
        anomalies.push({
          id: `inv-crit-${item.id}`,
          category: 'inventory',
          type: 'critical_stock',
          severity: 'high',
          risk_score: 0.75,
          description: `Critically low stock for "${item.material || item.name}" (${item.quantity} vs reorder ${item.reorder_point})`,
          entityId: item.id,
          entityType: 'inventory',
          itemName: item.material || item.name,
          quantity: item.quantity,
          reorderPoint: item.reorder_point
        });
      }
    }

    return anomalies;
  }

  async _detectAuthAnomalies(companyId, lookbackDays) {
    const anomalies = [];

    const auditLogs = await this._all(
      `SELECT * FROM audit_logs
       WHERE company_id = ? AND created_at >= datetime('now', ? || ' days')
       ORDER BY created_at DESC`,
      [companyId, String(-lookbackDays)]
    );

    const userActions = {};
    for (const log of auditLogs) {
      const uid = log.user_id || log.performed_by || 'unknown';
      if (!userActions[uid]) userActions[uid] = { count: 0, actions: [] };
      userActions[uid].count++;
      userActions[uid].actions.push(log.action);
    }

    for (const [userId, data] of Object.entries(userActions)) {
      if (data.count > 200) {
        anomalies.push({
          id: `auth-rate-${userId}`,
          category: 'authentication',
          type: 'high_action_rate',
          severity: 'medium',
          risk_score: Math.min(0.9, data.count / 500),
          description: `User ${userId} performed ${data.count} actions in ${lookbackDays} days`,
          entityId: userId,
          entityType: 'user',
          actionCount: data.count
        });
      }
    }

    return anomalies;
  }

  async _detectAuditAnomalies(companyId, lookbackDays) {
    const anomalies = [];
    const auditLogs = await this._all(
      `SELECT * FROM audit_logs
       WHERE company_id = ? AND created_at >= datetime('now', ? || ' days')
       ORDER BY created_at DESC`,
      [companyId, String(-lookbackDays)]
    );

    const deletePatterns = auditLogs.filter(l => l.action === 'DELETE' || l.action?.includes('delete'));
    if (deletePatterns.length > 20) {
      anomalies.push({
        id: `audit-mass-delete`,
        category: 'audit',
        type: 'mass_deletion',
        severity: 'high',
        risk_score: 0.7,
        description: `Unusual mass deletion activity: ${deletePatterns.length} delete operations in ${lookbackDays} days`,
        entityType: 'audit',
        count: deletePatterns.length
      });
    }
    return anomalies;
  }
}

module.exports = AnomalyDetector;
