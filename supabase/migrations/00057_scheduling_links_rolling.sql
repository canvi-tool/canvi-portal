-- Rolling window + remove expiry for scheduling_links
ALTER TABLE scheduling_links ADD COLUMN IF NOT EXISTS period_days INTEGER;
ALTER TABLE scheduling_links ALTER COLUMN expires_at DROP NOT NULL;
UPDATE scheduling_links SET expires_at = NULL WHERE expires_at IS NOT NULL;
