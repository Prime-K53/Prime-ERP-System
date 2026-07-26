-- Migrate referral tables to generic JSONB schema for cloudDb compatibility
-- WARNING: Drops and recreates all 8 tables used by cloudDb

DROP TABLE IF EXISTS referral_event_history CASCADE;
DROP TABLE IF EXISTS referral_reversals CASCADE;
DROP TABLE IF EXISTS referral_analytics CASCADE;
DROP TABLE IF EXISTS referral_campaigns CASCADE;
DROP TABLE IF EXISTS referral_audit_logs CASCADE;
DROP TABLE IF EXISTS referral_timeline CASCADE;
DROP TABLE IF EXISTS referral_rewards CASCADE;
DROP TABLE IF EXISTS customer_referrals CASCADE;

-- 1. Referrals
CREATE TABLE customer_referrals (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    company_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_referrals_company_id ON customer_referrals(company_id);

-- 2. Referral Rewards
CREATE TABLE referral_rewards (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    company_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_referral_rewards_company_id ON referral_rewards(company_id);

-- 3. Referral Timeline
CREATE TABLE referral_timeline (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    company_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_referral_timeline_company_id ON referral_timeline(company_id);

-- 4. Referral Audit Logs
CREATE TABLE referral_audit_logs (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    company_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_referral_audit_company_id ON referral_audit_logs(company_id);

-- 5. Referral Campaigns
CREATE TABLE referral_campaigns (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    company_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_referral_campaigns_company_id ON referral_campaigns(company_id);

-- 6. Referral Analytics
CREATE TABLE referral_analytics (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    company_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_referral_analytics_company_id ON referral_analytics(company_id);

-- 7. Referral Reversals
CREATE TABLE referral_reversals (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    company_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_referral_reversals_company_id ON referral_reversals(company_id);

-- 8. Referral Event History
CREATE TABLE referral_event_history (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    company_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_referral_events_company_id ON referral_event_history(company_id);

-- 9. Auto-expire referrals via scheduled function
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
        SELECT id, company_id FROM customer_referrals
        WHERE data->>'status' = 'active'
        AND created_at + (COALESCE(
            (SELECT (data->>'expiryDays')::int
             FROM company_config c
             WHERE c.id = customer_referrals.company_id
             AND data ? 'referralSettings'),
             365
        ) || ' days')::INTERVAL <= NOW()
    LOOP
        UPDATE customer_referrals
        SET data = jsonb_set(COALESCE(data, '{}'), '{status}', '"expired"'),
            updated_at = NOW()
        WHERE id = rec.id;
        expired_count := expired_count + 1;

        INSERT INTO referral_timeline (id, data, company_id)
        VALUES (
            gen_random_uuid()::text,
            jsonb_build_object(
                'referral_id', rec.id,
                'event_type', 'referral_expired',
                'title', 'Referral expired',
                'description', 'Referral automatically expired by scheduled job',
                'timestamp', NOW()::text
            ),
            rec.company_id
        );
    END LOOP;

    RETURN expired_count;
END;
$$;

-- 10. Generate referral analytics snapshot
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
    v_total_refs INTEGER;
    v_active_refs INTEGER;
    v_converted_refs INTEGER;
    v_total_amt NUMERIC(15,2);
    v_approved_amt NUMERIC(15,2);
    v_paid_amt NUMERIC(15,2);
    v_pending_amt NUMERIC(15,2);
    v_cancelled_amt NUMERIC(15,2);
    v_invoice_total NUMERIC(15,2);
    v_total_count INTEGER;
BEGIN
    v_analytics_id := gen_random_uuid()::text;

    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE data->>'status' = 'active'),
        COUNT(*) FILTER (WHERE data->>'status' = 'converted')
    INTO v_total_refs, v_active_refs, v_converted_refs
    FROM customer_referrals
    WHERE (p_company_id IS NULL OR company_id = p_company_id)
    AND created_at >= p_start_date::timestamptz
    AND created_at < (p_end_date + 1)::timestamptz;

    SELECT
        COUNT(*),
        COALESCE(SUM((data->>'amount')::numeric), 0),
        COALESCE(SUM((data->>'amount')::numeric) FILTER (WHERE data->>'status' IN ('approved', 'paid')), 0),
        COALESCE(SUM((data->>'amount')::numeric) FILTER (WHERE data->>'status' = 'paid'), 0),
        COALESCE(SUM((data->>'amount')::numeric) FILTER (WHERE data->>'status' = 'pending'), 0),
        COALESCE(SUM((data->>'amount')::numeric) FILTER (WHERE data->>'status' = 'cancelled'), 0),
        COALESCE(SUM((data->>'invoice_amount')::numeric), 0)
    INTO v_total_count, v_total_amt, v_approved_amt, v_paid_amt, v_pending_amt, v_cancelled_amt, v_invoice_total
    FROM referral_rewards
    WHERE (p_company_id IS NULL OR company_id = p_company_id)
    AND created_at >= p_start_date::timestamptz
    AND created_at < (p_end_date + 1)::timestamptz;

    INSERT INTO referral_analytics (id, data, company_id)
    VALUES (
        v_analytics_id,
        jsonb_build_object(
            'period', p_period,
            'period_start', p_start_date::text,
            'period_end', p_end_date::text,
            'total_referrals', v_total_refs,
            'active_referrals', v_active_refs,
            'converted_referrals', v_converted_refs,
            'total_rewards_amount', v_total_amt,
            'approved_rewards_amount', v_approved_amt,
            'paid_rewards_amount', v_paid_amt,
            'pending_rewards_amount', v_pending_amt,
            'reversed_rewards_amount', v_cancelled_amt,
            'average_reward_amount', CASE WHEN v_total_count > 0 THEN v_total_amt / v_total_count ELSE 0 END,
            'conversion_rate', CASE WHEN v_total_refs > 0 THEN (v_converted_refs::NUMERIC / v_total_refs) * 100 ELSE 0 END,
            'revenue_attributed', v_invoice_total,
            'roi', CASE WHEN v_total_amt > 0 THEN ((v_invoice_total - v_total_amt) / v_total_amt) * 100 ELSE 0 END,
            'generated_at', NOW()::text
        ),
        p_company_id
    );

    RETURN v_analytics_id;
END;
$$;
