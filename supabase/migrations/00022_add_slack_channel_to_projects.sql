-- =============================================
-- 00022: プロジェクトにSlackチャンネル連携カラムを追加
-- =============================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS slack_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS slack_channel_name TEXT;

COMMENT ON COLUMN projects.slack_channel_id IS 'Slack通知送信先チャンネルID (例: C01ABCDEF)';
COMMENT ON COLUMN projects.slack_channel_name IS 'Slackチャンネル表示名 (例: #bpo-001-勤怠)';
