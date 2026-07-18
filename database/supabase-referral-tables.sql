-- Customer Referral Tables — Generic JSONB schema for cloudDb compatibility
-- Each table stores domain fields in a 'data' JSONB column per cloudDb convention

-- 1. Referrals
CREATE TABLE IF NOT EXISTS customer_referrals (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    company_id TEXT REFERENCES company_config(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_referrals_company_id ON customer_referrals(company_id);

ALTER TABLE customer_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_referrals_company_isolation ON customer_referrals
    USING (company_id = get_current_company_id());

CREATE POLICY customer_referrals_company_isolation_insert ON customer_referrals
    FOR INSERT WITH CHECK (company_id = get_current_company_id());

-- 2. Referral Rewards
CREATE TABLE IF NOT EXISTS referral_rewards (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    company_id TEXT REFERENCES company_config(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_company_id ON referral_rewards(company_id);

ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY referral_rewards_company_isolation ON referral_rewards
    USING (company_id = get_current_company_id());

CREATE POLICY referral_rewards_company_isolation_insert ON referral_rewards
    FOR INSERT WITH CHECK (company_id = get_current_company_id());
