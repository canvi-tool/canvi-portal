-- ============================================================
-- 00016_add_personal_email.sql
-- スタッフテーブルに個人メール（契約書・支払通知書送付用）カラムを追加
-- ============================================================

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS personal_email TEXT;

COMMENT ON COLUMN public.staff.personal_email IS '個人メールアドレス（契約書・支払通知書送付用）';
COMMENT ON COLUMN public.staff.email IS 'Canviメールアドレス（業務用）';

-- インデックス
CREATE INDEX IF NOT EXISTS idx_staff_personal_email
  ON public.staff(personal_email) WHERE deleted_at IS NULL AND personal_email IS NOT NULL;
