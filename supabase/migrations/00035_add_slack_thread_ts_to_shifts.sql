-- Add slack_thread_ts column to shifts for Slack thread consolidation
-- All activity for a shift (submit, approve, reject, re-submit) is grouped in one Slack thread
ALTER TABLE shifts
ADD COLUMN IF NOT EXISTS slack_thread_ts TEXT;

-- Add approval_comment column to store the latest approval/rejection comment
ALTER TABLE shifts
ADD COLUMN IF NOT EXISTS approval_comment TEXT;

COMMENT ON COLUMN shifts.slack_thread_ts IS 'Slack message timestamp for thread consolidation. Stored when first notification is sent.';
COMMENT ON COLUMN shifts.approval_comment IS 'Latest approval or rejection comment from admin/owner.';
