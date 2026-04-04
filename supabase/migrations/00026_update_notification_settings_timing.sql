-- =============================================
-- 00026: 通知設定の改善
-- - 契約・支払関連カラムの削除（Slack通知には不要）
-- - 打刻漏れアラートのタイミング設定パラメータ追加
-- - シフト提出アラートのタイミング設定パラメータ追加
-- - 日報未提出リマインドのタイミング設定パラメータ追加
-- =============================================

-- 1. 不要カラムの削除
ALTER TABLE public.project_notification_settings
  DROP COLUMN IF EXISTS contract_unsigned,
  DROP COLUMN IF EXISTS payment_anomaly;

-- 2. 打刻漏れアラートのタイミング設定
--    delay_minutes: シフト開始から何分後に最初のアラートを出すか
--    repeat_interval_minutes: 繰り返しアラートの間隔（分）
--    max_repeats: 最大繰り返し回数（0=繰り返しなし）
ALTER TABLE public.project_notification_settings
  ADD COLUMN IF NOT EXISTS attendance_missing_delay_minutes INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS attendance_missing_repeat_interval_minutes INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS attendance_missing_max_repeats INTEGER NOT NULL DEFAULT 3;

-- 3. シフト提出アラートのタイミング設定
--    deadline_day: 対象月の何日を提出締切とするか（例: 25 → 前月25日）
--    alert_start_days_before: 締切の何日前からアラートを出すか
--    alert_repeat_interval_days: アラートの繰り返し間隔（日）
ALTER TABLE public.project_notification_settings
  ADD COLUMN IF NOT EXISTS shift_submission_deadline_day INTEGER NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS shift_submission_alert_start_days_before INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS shift_submission_alert_repeat_interval_days INTEGER NOT NULL DEFAULT 1;

-- 4. 日報未提出リマインドのタイミング設定
--    delay_hours: 退勤時刻から何時間後にリマインドするか
--    repeat_interval_hours: 繰り返しリマインドの間隔（時間）
--    max_repeats: 最大繰り返し回数
ALTER TABLE public.project_notification_settings
  ADD COLUMN IF NOT EXISTS report_overdue_delay_hours INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS report_overdue_repeat_interval_hours INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS report_overdue_max_repeats INTEGER NOT NULL DEFAULT 2;

-- 5. 残業警告の閾値設定
--    threshold_hours: 何時間超過で警告するか
ALTER TABLE public.project_notification_settings
  ADD COLUMN IF NOT EXISTS overtime_warning_threshold_hours NUMERIC(4,1) NOT NULL DEFAULT 8.0;
