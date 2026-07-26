# Migration Deployment Guide

## Prerequisites
- Run the audit queries first (02-database-audit-read-only.sql)
- Review the results carefully
- Back up your database (Supabase > Database > Backups)

## Migration Order (Run in Sequence)

### Step 1: Audit (Read-Only)
```sql
-- Run each query in 02-database-audit-read-only.sql
-- Capture all output for reference
```

### Step 2: Recovery (If Issues Found)
```sql
-- Run 03-recovery-sql.sql
-- Review before/after counts
-- Manually resolve any remaining orphans
```

### Step 3: Core Schema Hardening
```sql
-- Run 04-schema-hardening.sql
-- This creates company_users, FKs, indexes
```

### Step 4: RLS Policies
```sql
-- Run 05-rls-policies.sql
-- This replaces ALL existing policies with hardened versions
-- Creates tenant_isolation RESTRICTIVE policies
```

### Step 5: Triggers & Validation
```sql
-- Run 06-triggers-validation.sql
-- Enables cross-company validation, immutable ledger, auto-stamping
```

### Step 6: Monitoring
```sql
-- Run 07-monitoring-integrity.sql
-- Deploy check_company_integrity() and quick_tenant_health()
```

### Step 7: Tests
```sql
-- Run 08-comprehensive-test-suite.sql
-- Verify everything works
```

## Rollback Strategy

### If RLS breaks access:
```sql
-- Temporarily disable RLS on a table:
ALTER TABLE public.inventory DISABLE ROW LEVEL SECURITY;

-- Or drop the restrictive policies:
DROP POLICY IF EXISTS tenant_isolation ON public.inventory;
```

### If triggers break operations:
```sql
-- Drop specific trigger:
DROP TRIGGER IF EXISTS trg_validate_inventory_txn_company ON public.inventory_transactions;

-- Or drop all triggers from 06-triggers-validation.sql:
-- (Use the rollback section at the bottom of that file)
```

### Full rollback:
```sql
-- Restore from Supabase backup
-- Or reverse each migration in reverse order (7 → 6 → 5 → 4)
```

## Backend Deployment

### 1. Deploy updated backend routes:
The fixes to `PUT /api/sales/:id` and `DELETE /api/sales/:id` are in `backend/index.cjs`.
Deploy the updated backend.

### 2. Deploy new middleware:
Copy `backend/middleware/companyValidation.cjs` to your deployment.

## Verification Checklist

- [ ] All audit queries return 0 issues
- [ ] get_user_company_id() returns non-null for authenticated users
- [ ] RLS policies are active on all tenant tables
- [ ] FK constraints reference companies(id) correctly
- [ ] company_users table populated
- [ ] Trigger functions installed
- [ ] Inventory transactions protected from update/delete
- [ ] Cross-company operations rejected
- [ ] Quick health check returns clean
- [ ] Tests pass (check for PASSED messages)
