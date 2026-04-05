-- Add slack_thread_ts column to work_reports for Slack thread consolidation
-- All activity for a daily report (submit, approve, reject, re-submit) is grouped in one Slack thread
ALTER TABLE work_reports
ADD COLUMN IF NOT EXISTS slack_thread_ts TEXT;

COMMENT ON COLUMN work_reports.slack_thread_ts IS 'Slack message timestamp for thread consolidation. Stored when first notification is sent.';
