-- Customer Referral + Wallet Rewards Tables
-- Run this migration after supabase-create-all-tables.sql

-- 1. Customer Referrals
CREATE TABLE IF NOT EXISTS customer_referrals (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    referred_by_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    referred_by_name TEXT,
    referral_code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'converted', 'expired', 'cancelled')),
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    converted_at TIMESTAMPTZ,
    converted_invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
    notes TEXT,
    company_id TEXT REFERENCES company_config(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_referrals_customer_id ON customer_referrals(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_referrals_referred_by_id ON customer_referrals(referred_by_id);
CREATE INDEX IF NOT EXISTS idx_customer_referrals_status ON customer_referrals(status);
CREATE INDEX IF NOT EXISTS idx_customer_referrals_referral_code ON customer_referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_customer_referrals_company_id ON customer_referrals(company_id);

ALTER TABLE customer_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_referrals_company_isolation ON customer_referrals
    USING (company_id = get_current_company_id());

CREATE POLICY customer_referrals_company_isolation_insert ON customer_referrals
    FOR INSERT WITH CHECK (company_id = get_current_company_id());

-- 2. Referral Rewards
CREATE TABLE IF NOT EXISTS referral_rewards (
    id TEXT PRIMARY KEY,
    referral_id TEXT NOT NULL REFERENCES customer_referrals(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    invoice_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    cancelled_at TIMESTAMPTZ,
    cancelled_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    cancel_reason TEXT,
    wallet_transaction_id TEXT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    notes TEXT,
    company_id TEXT REFERENCES company_config(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referral_id ON referral_rewards(referral_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_customer_id ON referral_rewards(customer_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_invoice_id ON referral_rewards(invoice_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_status ON referral_rewards(status);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_company_id ON referral_rewards(company_id);

ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY referral_rewards_company_isolation ON referral_rewards
    USING (company_id = get_current_company_id());

CREATE POLICY referral_rewards_company_isolation_insert ON referral_rewards
    FOR INSERT WITH CHECK (company_id = get_current_company_id());
