-- Customer Referral Extension v2 — Enterprise Features
-- Adds: Timeline, Audit, Campaigns, Analytics, Reversals, Event History
-- Run after supabase-referral-tables.sql

-- 1. Referral Timeline
CREATE TABLE IF NOT EXISTS referral_timeline (
    id TEXT PRIMARY KEY,
    referral_id TEXT NOT NULL REFERENCES customer_referrals(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'created', 'reward_earned', 'reward_approved', 'reward_paid',
        'reward_rejected', 'reward_reversed', 'referral_converted',
        'referral_expired', 'referral_cancelled', 'campaign_applied', 'note_added'
    )),
    title TEXT NOT NULL,
    description TEXT,
    amount NUMERIC(15,2),
    actor_id TEXT,
    actor_name TEXT,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    company_id TEXT REFERENCES company_config(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_timeline_referral_id ON referral_timeline(referral_id);
CREATE INDEX IF NOT EXISTS idx_referral_timeline_event_type ON referral_timeline(event_type);
CREATE INDEX IF NOT EXISTS idx_referral_timeline_company_id ON referral_timeline(company_id);

ALTER TABLE referral_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY referral_timeline_company_isolation ON referral_timeline
    USING (company_id = get_current_company_id());

CREATE POLICY referral_timeline_company_isolation_insert ON referral_timeline
    FOR INSERT WITH CHECK (company_id = get_current_company_id());

-- 2. Referral Audit Logs
CREATE TABLE IF NOT EXISTS referral_audit_logs (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('referral', 'reward', 'campaign', 'setting', 'reversal')),
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'cancelled', 'approved', 'rejected', 'reversed', 'expired', 'configured')),
    actor_id TEXT NOT NULL,
    actor_name TEXT,
    field_name TEXT,
    old_value JSONB,
    new_value JSONB,
    reason TEXT,
    ip_address TEXT,
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    correlation_id TEXT,
    company_id TEXT REFERENCES company_config(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_audit_entity ON referral_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_referral_audit_actor ON referral_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_referral_audit_timestamp ON referral_audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_referral_audit_correlation ON referral_audit_logs(correlation_id);

ALTER TABLE referral_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY referral_audit_company_isolation ON referral_audit_logs
    USING (company_id = get_current_company_id());

CREATE POLICY referral_audit_company_isolation_insert ON referral_audit_logs
    FOR INSERT WITH CHECK (company_id = get_current_company_id());

-- 3. Referral Campaigns
CREATE TABLE IF NOT EXISTS referral_campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
    reward_type TEXT NOT NULL CHECK (reward_type IN ('fixed', 'percentage', 'hybrid')),
    reward_value NUMERIC(15,2) NOT NULL DEFAULT 0,
    reward_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
    min_purchase_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    max_reward_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    max_rewards_per_customer INTEGER NOT NULL DEFAULT 0,
    max_total_rewards INTEGER NOT NULL DEFAULT 0,
    total_rewards_given INTEGER NOT NULL DEFAULT 0,
    target_customer_segments JSONB DEFAULT '[]',
    excluded_customer_ids JSONB DEFAULT '[]',
    bonus_multiplier NUMERIC(5,2) DEFAULT 1.00,
    terms_and_conditions TEXT,
    created_by TEXT,
    approved_by TEXT,
    company_id TEXT REFERENCES company_config(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_campaigns_status ON referral_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_referral_campaigns_dates ON referral_campaigns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_referral_campaigns_company_id ON referral_campaigns(company_id);

ALTER TABLE referral_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY referral_campaigns_company_isolation ON referral_campaigns
    USING (company_id = get_current_company_id());

CREATE POLICY referral_campaigns_company_isolation_insert ON referral_campaigns
    FOR INSERT WITH CHECK (company_id = get_current_company_id());

-- 4. Referral Analytics
CREATE TABLE IF NOT EXISTS referral_analytics (
    id TEXT PRIMARY KEY,
    period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_referrals INTEGER NOT NULL DEFAULT 0,
    active_referrals INTEGER NOT NULL DEFAULT 0,
    converted_referrals INTEGER NOT NULL DEFAULT 0,
    total_rewards_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    approved_rewards_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    paid_rewards_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    pending_rewards_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    reversed_rewards_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    average_reward_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    conversion_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    top_referrers JSONB DEFAULT '[]',
    campaign_breakdown JSONB DEFAULT '{}',
    revenue_attributed NUMERIC(15,2) NOT NULL DEFAULT 0,
    roi NUMERIC(10,2) NOT NULL DEFAULT 0,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    company_id TEXT REFERENCES company_config(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_referral_analytics_period ON referral_analytics(period, period_start);
CREATE INDEX IF NOT EXISTS idx_referral_analytics_generated ON referral_analytics(generated_at);

ALTER TABLE referral_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY referral_analytics_company_isolation ON referral_analytics
    USING (company_id = get_current_company_id());

-- 5. Referral Reversals
CREATE TABLE IF NOT EXISTS referral_reversals (
    id TEXT PRIMARY KEY,
    reward_id TEXT NOT NULL REFERENCES referral_rewards(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    requested_by TEXT NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    rejected_by TEXT,
    rejected_at TIMESTAMPTZ,
    reject_reason TEXT,
    completed_at TIMESTAMPTZ,
    wallet_transaction_id TEXT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    ledger_entry_id TEXT REFERENCES ledger_entries(id) ON DELETE SET NULL,
    notes TEXT,
    company_id TEXT REFERENCES company_config(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_reversals_reward_id ON referral_reversals(reward_id);
CREATE INDEX IF NOT EXISTS idx_referral_reversals_status ON referral_reversals(status);

ALTER TABLE referral_reversals ENABLE ROW LEVEL SECURITY;

CREATE POLICY referral_reversals_company_isolation ON referral_reversals
    USING (company_id = get_current_company_id());

CREATE POLICY referral_reversals_company_isolation_insert ON referral_reversals
    FOR INSERT WITH CHECK (company_id = get_current_company_id());

-- 6. Referral Event History
CREATE TABLE IF NOT EXISTS referral_event_history (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    source TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    correlation_id TEXT,
    actor_id TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    error TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3
);

CREATE INDEX IF NOT EXISTS idx_referral_events_type ON referral_event_history(event_type);
CREATE INDEX IF NOT EXISTS idx_referral_events_entity ON referral_event_history(entity_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_correlation ON referral_event_history(correlation_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_timestamp ON referral_event_history(timestamp);

ALTER TABLE referral_event_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY referral_events_company_isolation ON referral_event_history
    USING (true);

-- 7. Auto-expire referrals via scheduled function
CREATE OR REPLACE FUNCTION expire_referrals()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    expired_count INTEGER := 0;
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT id FROM customer_referrals
        WHERE status = 'active'
        AND created_at + (COALESCE(
            (SELECT (value->>'expiryDays')::int
             FROM company_config c
             WHERE c.id = customer_referrals.company_id
             AND value ? 'referralSettings'),
            365
        ) || ' days')::INTERVAL <= NOW()
    LOOP
        UPDATE customer_referrals
        SET status = 'expired',
            updated_at = NOW()
        WHERE id = rec.id;
        expired_count := expired_count + 1;

        INSERT INTO referral_timeline (id, referral_id, event_type, title, description, timestamp, created_at)
        VALUES (gen_random_uuid()::text, rec.id, 'referral_expired', 'Referral expired', 'Referral automatically expired by scheduled job', NOW(), NOW());
    END LOOP;

    RETURN expired_count;
END;
$$;

-- 8. Generate referral analytics snapshot
CREATE OR REPLACE FUNCTION generate_referral_analytics(
    p_period TEXT,
    p_start_date DATE,
    p_end_date DATE,
    p_company_id TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_analytics_id TEXT;
BEGIN
    v_analytics_id := gen_random_uuid()::text;

    INSERT INTO referral_analytics (
        id, period, period_start, period_end,
        total_referrals, active_referrals, converted_referrals,
        total_rewards_amount, approved_rewards_amount, paid_rewards_amount,
        pending_rewards_amount, reversed_rewards_amount,
        average_reward_amount, conversion_rate,
        revenue_attributed, roi, generated_at,
        company_id
    )
    SELECT
        v_analytics_id,
        p_period,
        p_start_date,
        p_end_date,
        COALESCE(ref_stats.total_refs, 0),
        COALESCE(ref_stats.active_refs, 0),
        COALESCE(ref_stats.converted_refs, 0),
        COALESCE(rew_stats.total_amt, 0),
        COALESCE(rew_stats.approved_amt, 0),
        COALESCE(rew_stats.paid_amt, 0),
        COALESCE(rew_stats.pending_amt, 0),
        COALESCE(rew_stats.cancelled_amt, 0),
        CASE WHEN rew_stats.total_count > 0 THEN rew_stats.total_amt / rew_stats.total_count ELSE 0 END,
        CASE WHEN ref_stats.total_refs > 0 THEN (ref_stats.converted_refs::NUMERIC / ref_stats.total_refs) * 100 ELSE 0 END,
        COALESCE(rew_stats.invoice_total, 0),
        CASE WHEN rew_stats.total_amt > 0 THEN ((rew_stats.invoice_total - rew_stats.total_amt) / rew_stats.total_amt) * 100 ELSE 0 END,
        NOW(),
        p_company_id
    FROM (
        SELECT
            COUNT(*) AS total_refs,
            COUNT(*) FILTER (WHERE status = 'active') AS active_refs,
            COUNT(*) FILTER (WHERE status = 'converted') AS converted_refs
        FROM customer_referrals
        WHERE date >= p_start_date AND date <= p_end_date + INTERVAL '1 day'
        AND (p_company_id IS NULL OR company_id = p_company_id)
    ) ref_stats,
    (
        SELECT
            COUNT(*) AS total_count,
            COALESCE(SUM(amount), 0) AS total_amt,
            COALESCE(SUM(amount) FILTER (WHERE status IN ('approved', 'paid')), 0) AS approved_amt,
            COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0) AS paid_amt,
            COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) AS pending_amt,
            COALESCE(SUM(amount) FILTER (WHERE status = 'cancelled'), 0) AS cancelled_amt,
            COALESCE(SUM(invoice_amount), 0) AS invoice_total
        FROM referral_rewards
        WHERE date >= p_start_date AND date <= p_end_date + INTERVAL '1 day'
        AND (p_company_id IS NULL OR company_id = p_company_id)
    ) rew_stats;

    RETURN v_analytics_id;
END;
$$;
