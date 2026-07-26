-- Drop FK constraints to company_config (table is empty, company IDs come from app-layer)
ALTER TABLE customer_referrals DROP CONSTRAINT IF EXISTS customer_referrals_company_id_fkey;
ALTER TABLE referral_rewards DROP CONSTRAINT IF EXISTS referral_rewards_company_id_fkey;
ALTER TABLE referral_timeline DROP CONSTRAINT IF EXISTS referral_timeline_company_id_fkey;
ALTER TABLE referral_audit_logs DROP CONSTRAINT IF EXISTS referral_audit_logs_company_id_fkey;
ALTER TABLE referral_campaigns DROP CONSTRAINT IF EXISTS referral_campaigns_company_id_fkey;
ALTER TABLE referral_analytics DROP CONSTRAINT IF EXISTS referral_analytics_company_id_fkey;
ALTER TABLE referral_reversals DROP CONSTRAINT IF EXISTS referral_reversals_company_id_fkey;
ALTER TABLE referral_event_history DROP CONSTRAINT IF EXISTS referral_event_history_company_id_fkey;
