-- ============================================================================
-- TRIGGERS: Cross-Company Validation & Company ID Enforcement
-- ============================================================================
-- These triggers ensure:
-- 1. Every INSERT gets company_id from the user's context if omitted
-- 2. Cross-company references are rejected
-- 3. Inventory transactions validate item/warehouse company match
-- 4. Stock movements maintain ledger integrity
-- ============================================================================

-- ============================================================================
-- PART 1: Auto-Set company_id on INSERT (When Omitted)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_set_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL OR NEW.company_id = '' THEN
    NEW.company_id := public.get_user_company_id();
  END IF;
  RETURN NEW;
END;
$$;

-- Apply to all tenant tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT t.tablename::text FROM pg_tables t
    WHERE t.schemaname = 'public'
      AND EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = t.tablename
          AND c.column_name = 'company_id'
      )
      AND t.tablename NOT IN ('companies', 'profiles', 'company_users', 'idempotency_keys')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_company_id ON %I;', tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_set_company_id
       BEFORE INSERT ON %I
       FOR EACH ROW
       WHEN (NEW.company_id IS NULL OR NEW.company_id = '')
       EXECUTE FUNCTION public.trigger_set_company_id();',
      tbl
    );
  END LOOP;
END $$;

-- ============================================================================
-- PART 2: Cross-Company Reference Validation
-- ============================================================================

-- Validates that inventory transactions reference items from the same company
CREATE OR REPLACE FUNCTION public.trigger_validate_inventory_txn_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_company TEXT;
  item_name TEXT;
BEGIN
  -- Extract referenced item_id
  IF NEW.data IS NOT NULL AND (NEW.data->>'item_id') IS NOT NULL THEN
    SELECT i.company_id, (i.data->>'name') INTO item_company, item_name
    FROM public.inventory i
    WHERE i.id = (NEW.data->>'item_id');

    IF item_company IS NOT NULL AND NEW.company_id IS DISTINCT FROM item_company THEN
      RAISE EXCEPTION 'Company mismatch: inventory transaction company (%) does not match item "%" company (%)',
        NEW.company_id, COALESCE(item_name, (NEW.data->>'item_id')), item_company;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_inventory_txn_company ON public.inventory_transactions;
CREATE TRIGGER trg_validate_inventory_txn_company
  BEFORE INSERT OR UPDATE ON public.inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_validate_inventory_txn_company();

-- Validates that warehouse_inventory records match item and warehouse companies
CREATE OR REPLACE FUNCTION public.trigger_validate_warehouse_inventory_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_company TEXT;
  wh_company TEXT;
BEGIN
  -- Check item company
  IF NEW.data IS NOT NULL AND (NEW.data->>'item_id') IS NOT NULL THEN
    SELECT i.company_id INTO item_company
    FROM public.inventory i WHERE i.id = (NEW.data->>'item_id');

    IF item_company IS NOT NULL AND NEW.company_id IS DISTINCT FROM item_company THEN
      RAISE EXCEPTION 'Company mismatch: warehouse_inventory (%) does not match item (%)',
        NEW.company_id, item_company;
    END IF;
  END IF;

  -- Check warehouse company
  IF NEW.data IS NOT NULL AND (NEW.data->>'warehouse_id') IS NOT NULL THEN
    SELECT w.company_id INTO wh_company
    FROM public.warehouses w WHERE w.id = (NEW.data->>'warehouse_id');

    IF wh_company IS NOT NULL AND NEW.company_id IS DISTINCT FROM wh_company THEN
      RAISE EXCEPTION 'Company mismatch: warehouse_inventory (%) does not match warehouse (%)',
        NEW.company_id, wh_company;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_warehouse_inv_company ON public.warehouse_inventory;
CREATE TRIGGER trg_validate_warehouse_inv_company
  BEFORE INSERT OR UPDATE ON public.warehouse_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_validate_warehouse_inventory_company();

-- Validates sale_items match product company
CREATE OR REPLACE FUNCTION public.trigger_validate_sale_item_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product_company TEXT;
BEGIN
  IF NEW.data IS NOT NULL AND (NEW.data->>'product_id') IS NOT NULL THEN
    SELECT p.company_id INTO product_company
    FROM public.products p WHERE p.id = (NEW.data->>'product_id');

    IF product_company IS NOT NULL AND NEW.company_id IS DISTINCT FROM product_company THEN
      RAISE EXCEPTION 'Company mismatch: sale_item (%) does not match product (%)',
        NEW.company_id, product_company;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_sale_item_company ON public.sale_items;
CREATE TRIGGER trg_validate_sale_item_company
  BEFORE INSERT OR UPDATE ON public.sale_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_validate_sale_item_company();

-- Validates goods_receipts match purchase_order company
CREATE OR REPLACE FUNCTION public.trigger_validate_gr_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  po_company TEXT;
BEGIN
  IF NEW.data IS NOT NULL AND (NEW.data->>'purchase_order_id') IS NOT NULL THEN
    SELECT po.company_id INTO po_company
    FROM public.purchase_orders po WHERE po.id = (NEW.data->>'purchase_order_id');

    IF po_company IS NOT NULL AND NEW.company_id IS DISTINCT FROM po_company THEN
      RAISE EXCEPTION 'Company mismatch: goods_receipt (%) does not match purchase_order (%)',
        NEW.company_id, po_company;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_gr_company ON public.goods_receipts;
CREATE TRIGGER trg_validate_gr_company
  BEFORE INSERT OR UPDATE ON public.goods_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_validate_gr_company();

-- ============================================================================
-- PART 3: Immutable Inventory Movement Audit
-- ============================================================================

-- After an inventory_transaction is inserted, update the inventory stock level
-- and create an immutable audit log entry.
CREATE TABLE IF NOT EXISTS public.inventory_audit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL,
  inventory_id TEXT NOT NULL,
  company_id TEXT NOT NULL REFERENCES public.companies(id),
  previous_stock NUMERIC(15,2) NOT NULL,
  new_stock NUMERIC(15,2) NOT NULL,
  quantity_change NUMERIC(15,2) NOT NULL,
  movement_type TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT fk_inv_audit_company FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

CREATE INDEX IF NOT EXISTS idx_inv_audit_inventory ON public.inventory_audit_ledger(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inv_audit_company ON public.inventory_audit_ledger(company_id);
CREATE INDEX IF NOT EXISTS idx_inv_audit_created ON public.inventory_audit_ledger(created_at);

-- Enable RLS on audit ledger
ALTER TABLE public.inventory_audit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_ledger_select ON public.inventory_audit_ledger;
CREATE POLICY audit_ledger_select ON public.inventory_audit_ledger
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS audit_ledger_insert ON public.inventory_audit_ledger;
CREATE POLICY audit_ledger_insert ON public.inventory_audit_ledger
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

-- Trigger: after inventory transaction, write to audit ledger
CREATE OR REPLACE FUNCTION public.trigger_inventory_audit_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_stock NUMERIC(15,2);
  new_stock_calc NUMERIC(15,2);
  qty_change NUMERIC(15,2);
  inv_id TEXT;
BEGIN
  -- Get the inventory item ID
  inv_id := COALESCE(
    NULLIF(NEW.data->>'item_id', ''),
    NULLIF(NEW.data->>'inventory_id', '')
  );

  IF inv_id IS NULL THEN
    RETURN NEW; -- Skip if no inventory reference
  END IF;

  -- Get current stock level
  SELECT COALESCE(NULLIF((i.data->>'stock'), ''), '0')::numeric
  INTO current_stock
  FROM public.inventory i
  WHERE i.id = inv_id;

  IF current_stock IS NULL THEN
    current_stock := 0;
  END IF;

  -- Calculate quantity change from transaction
  qty_change := COALESCE(NULLIF(NEW.data->>'quantity', ''), '0')::numeric;
  IF qty_change = 0 THEN
    qty_change := COALESCE(NULLIF(NEW.data->>'change', ''), '0')::numeric;
  END IF;

  -- Adjust sign based on movement type
  -- 'in', 'purchase', 'return', 'adjustment_positive' = positive
  -- 'out', 'sale', 'transfer_out', 'waste', 'adjustment_negative' = negative
  IF NEW.data->>'type' IN ('out', 'sale', 'transfer_out', 'waste', 'adjustment_negative', 'consumption') THEN
    qty_change := -ABS(qty_change);
  ELSE
    qty_change := ABS(qty_change);
  END IF;

  new_stock_calc := current_stock + qty_change;

  -- Insert into immutable audit ledger
  INSERT INTO public.inventory_audit_ledger (
    transaction_id, inventory_id, company_id,
    previous_stock, new_stock, quantity_change,
    movement_type, reference_type, reference_id,
    created_by
  ) VALUES (
    NEW.id, inv_id, NEW.company_id,
    current_stock, new_stock_calc, qty_change,
    COALESCE(NEW.data->>'type', 'adjustment'),
    NEW.data->>'reference_type',
    NEW.data->>'reference_id',
    auth.uid()
  );

  -- Update inventory stock level
  UPDATE public.inventory i
  SET data = jsonb_set(
    jsonb_set(i.data, '{stock}', to_jsonb(new_stock_calc::text)::jsonb),
    '{updated_at}', to_jsonb(NOW()::text)::jsonb
  ),
  updated_at = NOW()
  WHERE i.id = inv_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_audit_ledger ON public.inventory_transactions;
CREATE TRIGGER trg_inventory_audit_ledger
  AFTER INSERT ON public.inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_inventory_audit_ledger();

-- ============================================================================
-- PART 4: Immutable Transaction Protection
-- ============================================================================

-- Prevent UPDATE or DELETE of inventory transactions once created
CREATE OR REPLACE FUNCTION public.trigger_protect_inventory_transactions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Inventory transactions cannot be updated. Create a reversal transaction instead.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Inventory transactions cannot be deleted. Create a reversal transaction instead.';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_inventory_transactions ON public.inventory_transactions;
CREATE TRIGGER trg_protect_inventory_transactions
  BEFORE UPDATE OR DELETE ON public.inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_protect_inventory_transactions();

-- Prevent UPDATE or DELETE of audit ledger
DROP TRIGGER IF EXISTS trg_protect_inventory_audit ON public.inventory_audit_ledger;
CREATE TRIGGER trg_protect_inventory_audit
  BEFORE UPDATE OR DELETE ON public.inventory_audit_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_protect_inventory_transactions();

-- ============================================================================
-- PART 5: Sync Profile to company_users
-- ============================================================================

-- When a profile is created/updated, sync to company_users for backward compat
CREATE OR REPLACE FUNCTION public.trigger_sync_profile_to_company_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.company_id IS NOT NULL AND NEW.company_id <> '' AND NEW.user_id IS NOT NULL AND NEW.user_id <> '' THEN
    INSERT INTO public.company_users (user_id, company_id, role, is_default)
    VALUES (NEW.user_id::uuid, NEW.company_id, COALESCE(NULLIF(NEW.role, ''), 'member'), true)
    ON CONFLICT (user_id, company_id) DO UPDATE SET
      role = COALESCE(NULLIF(NEW.role, ''), EXCLUDED.role),
      is_default = true,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_to_company_users ON public.profiles;
CREATE TRIGGER trg_sync_profile_to_company_users
  AFTER INSERT OR UPDATE OF company_id ON public.profiles
  FOR EACH ROW
  WHEN (NEW.company_id IS NOT NULL AND NEW.company_id <> '')
  EXECUTE FUNCTION public.trigger_sync_profile_to_company_users();

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- To rollback ALL triggers in this file:
/*
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT t.tablename::text FROM pg_tables t WHERE t.schemaname = 'public'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_company_id ON %I;', tbl);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_validate_inventory_txn_company ON %I;', tbl);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_validate_warehouse_inv_company ON %I;', tbl);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_validate_sale_item_company ON %I;', tbl);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_validate_gr_company ON %I;', tbl);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_inventory_audit_ledger ON %I;', tbl);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_protect_inventory_transactions ON %I;', tbl);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_protect_inventory_audit ON %I;', tbl);
  END LOOP;
  DROP TRIGGER IF EXISTS trg_sync_profile_to_company_users ON public.profiles;
END $$;
*/
