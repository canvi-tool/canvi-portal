-- シフト・勤務時間関連の通知を初期値OFFに変更
-- 既存レコードも全てOFFに統一

-- 既存レコードの更新
UPDATE project_notification_settings
SET
  shift_submitted = false,
  shift_rejected = false,
  overtime_warning = false,
  leave_requested = false,
  updated_at = now();

-- カラムのデフォルト値を変更
ALTER TABLE project_notification_settings
  ALTER COLUMN shift_submitted SET DEFAULT false,
  ALTER COLUMN shift_rejected SET DEFAULT false,
  ALTER COLUMN overtime_warning SET DEFAULT false,
  ALTER COLUMN leave_requested SET DEFAULT false;
