-- =============================================
-- 00046: 通知設定のデフォルト値調整 + 「その他」カテゴリ削除
-- - 打刻漏れアラート: 5分後 / 5分ごと / 最大5回
-- - 日報提出通知: ON
-- - general_alert (その他) カラムを削除
-- =============================================

-- 1. デフォルト値を更新
ALTER TABLE public.project_notification_settings
  ALTER COLUMN attendance_missing_delay_minutes SET DEFAULT 5,
  ALTER COLUMN attendance_missing_repeat_interval_minutes SET DEFAULT 5,
  ALTER COLUMN attendance_missing_max_repeats SET DEFAULT 5,
  ALTER COLUMN report_submitted SET DEFAULT true;

-- 2. 既存レコードを新デフォルトに揃える
UPDATE public.project_notification_settings
SET
  attendance_missing_delay_minutes = 5,
  attendance_missing_repeat_interval_minutes = 5,
  attendance_missing_max_repeats = 5,
  report_submitted = true;

-- 3. general_alert カラムを削除（「その他」カテゴリ不要）
ALTER TABLE public.project_notification_settings
  DROP COLUMN IF EXISTS general_alert;
