-- =============================================
-- 00038: 通知設定 v2
-- 休憩開始/終了通知のトグルと、日報未提出リマインドの分単位設定を追加
-- =============================================

ALTER TABLE public.project_notification_settings
  ADD COLUMN IF NOT EXISTS attendance_break_start BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.project_notification_settings
  ADD COLUMN IF NOT EXISTS attendance_break_end BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.project_notification_settings
  ADD COLUMN IF NOT EXISTS report_overdue_delay_minutes INTEGER NOT NULL DEFAULT 5;
