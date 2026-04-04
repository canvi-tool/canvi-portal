-- Phase 1: シフト管理Googleカレンダー化 + Canviカレンダー基盤
-- users テーブルにGoogleトークン保存カラム追加
-- shifts テーブルにshift_type + google_meet_url追加

-- ============================================================
-- 1. users テーブルにGoogle OAuthトークンカラム追加
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_token_expires_at TIMESTAMPTZ;

-- ============================================================
-- 2. shifts テーブルにshift_type + google_meet_url追加
-- ============================================================
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS shift_type TEXT NOT NULL DEFAULT 'WORK';
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS google_meet_url TEXT;

-- shift_type の値を制約で制限
ALTER TABLE shifts ADD CONSTRAINT shifts_shift_type_check
  CHECK (shift_type IN ('WORK', 'PAID_LEAVE', 'ABSENCE', 'HALF_DAY_LEAVE', 'SPECIAL_LEAVE'));

-- ============================================================
-- 3. インデックス追加（パフォーマンス）
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_shifts_shift_type ON shifts(shift_type);
CREATE INDEX IF NOT EXISTS idx_shifts_staff_date ON shifts(staff_id, shift_date);
