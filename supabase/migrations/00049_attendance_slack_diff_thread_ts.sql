-- シフト乖離通知用のSlackスレッドtsを保存するカラム
-- cron/shift-attendance-diff から送信した通知の ts を attendance_record に保存し、
-- 後続の「定時で丸める」「修正依頼する」等のリプライを同一スレッドにぶら下げる
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS slack_diff_thread_ts TEXT;

ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS slack_diff_channel_id TEXT;
