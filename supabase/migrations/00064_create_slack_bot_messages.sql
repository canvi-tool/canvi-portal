-- Universal Slack bot message tracking table
-- Tracks all bot messages sent to Slack channels for thread reply processing
-- When a user replies to a bot message, we look up context here to determine the action

CREATE TABLE IF NOT EXISTS slack_bot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL,
  message_ts TEXT NOT NULL,          -- Slack message timestamp (unique per channel)
  thread_ts TEXT,                    -- Parent thread ts (null if this IS the parent)
  message_type TEXT NOT NULL,        -- 'alert_summary', 'clock_in', 'clock_out', 'report_submitted', 'shift_submitted', etc.
  context JSONB NOT NULL DEFAULT '{}', -- Structured context about what this message is about
  project_id UUID REFERENCES projects(id),
  staff_id UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (channel_id, message_ts)
);

-- Index for quick lookups when processing thread replies
-- When a reply comes in, we look up by channel_id + thread_ts (the parent message_ts)
CREATE INDEX IF NOT EXISTS idx_slack_bot_messages_channel_thread
  ON slack_bot_messages (channel_id, message_ts);

-- Enable Row Level Security
ALTER TABLE slack_bot_messages ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access (only API routes access this)
CREATE POLICY "service_role_full_access"
  ON slack_bot_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Auto-cleanup old records (keep 30 days)
-- Can be run as a scheduled job: DELETE FROM slack_bot_messages WHERE created_at < now() - interval '30 days';
