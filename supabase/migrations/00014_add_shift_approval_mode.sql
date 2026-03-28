-- ============================================================
-- 00014_add_shift_approval_mode.sql
-- 案件テーブルにシフト承認モードを追加
-- ============================================================

-- シフト承認モード: AUTO (自動承認) / APPROVAL (承認フロー)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS shift_approval_mode TEXT NOT NULL DEFAULT 'AUTO';

-- コメント
COMMENT ON COLUMN public.projects.shift_approval_mode IS 'シフト承認モード: AUTO=自動承認, APPROVAL=承認フロー必須';
