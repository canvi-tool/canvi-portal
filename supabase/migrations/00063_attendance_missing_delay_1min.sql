-- =============================================
-- 00063: 打刻漏れアラート初回ディレイを5分→1分に変更
-- - 新規PJ向けDBデフォルトを 1 分に変更
-- - 既存全PJの attendance_missing_delay_minutes を 1 に揃える
-- =============================================

-- 1. デフォルト値を 1 分に変更
ALTER TABLE public.project_notification_settings
  ALTER COLUMN attendance_missing_delay_minutes SET DEFAULT 1;

-- 2. 既存レコードを 1 分に揃える（interval/max は 5 のまま維持）
UPDATE public.project_notification_settings
SET attendance_missing_delay_minutes = 1;
