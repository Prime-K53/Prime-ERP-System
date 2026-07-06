-- ============================================================================
-- Cascade Delete Company: Run this once in Supabase SQL Editor.
-- Creates a security-definer function that deletes ALL data for a company.
-- Usage: SELECT cascade_delete_company('company-id-here');
-- ============================================================================

CREATE OR REPLACE FUNCTION cascade_delete_company(target_company_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'sale_items', 'sales', 'invoices',
    'inventory_transactions', 'material_batches', 'warehouse_inventory',
    'material_categories', 'sales_orders', 'sales_exchanges',
    'sales_exchange_items', 'sales_exchange_approvals', 'reprint_jobs',
    'market_adjustments', 'market_adjustment_transactions',
    'transaction_adjustment_snapshots', 'audit_logs', 'documents',
    'tasks', 'classes', 'subjects',
    'examination_batches', 'examination_classes', 'examination_subjects',
    'examination_bom_calculations', 'examination_class_adjustments',
    'examination_pricing_audit', 'examination_batch_notifications',
    'notification_audit_logs', 'bom_default_materials',
    'profit_margin_settings', 'profit_margin_audit_logs',
    'work_centers', 'production_resources', 'work_orders',
    'production_batches', 'chart_of_accounts', 'ledger_entries',
    'budgets', 'transfers', 'expenses', 'income',
    'suppliers', 'purchase_orders', 'goods_receipts',
    'departments', 'employees', 'payroll_runs', 'payslips',
    'customer_payments', 'assets', 'settings',
    'schools', 'examinations', 'customers', 'inventory'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('DELETE FROM %I WHERE company_id = $1', tbl) USING target_company_id;
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE 'Table % does not exist, skipping', tbl;
    WHEN OTHERS THEN
      RAISE NOTICE 'Could not delete from %: %', tbl, SQLERRM;
    END;
  END LOOP;

  DELETE FROM profiles WHERE company_id = target_company_id;
  DELETE FROM companies WHERE id = target_company_id;
END;
$$;
