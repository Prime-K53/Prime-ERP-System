-- Add data column to existing tables if missing
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE referral_logs ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
ALTER TABLE referral_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create missing tables
CREATE TABLE IF NOT EXISTS referral_commissions (
  id TEXT PRIMARY KEY,
  data JSONB DEFAULT '{}',
  company_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_company ON referral_commissions(company_id);

CREATE TABLE IF NOT EXISTS referral_transactions (
  id TEXT PRIMARY KEY,
  data JSONB DEFAULT '{}',
  company_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_referral_transactions_company ON referral_transactions(company_id);

-- Ensure indexes on existing tables
CREATE INDEX IF NOT EXISTS idx_referrals_company ON referrals(company_id);
CREATE INDEX IF NOT EXISTS idx_referral_logs_company ON referral_logs(company_id);
