-- 00018_add_eiji_name_columns.sql
-- スタッフテーブルにローマ字名カラムを追加

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS last_name_eiji TEXT,
  ADD COLUMN IF NOT EXISTS first_name_eiji TEXT;

COMMENT ON COLUMN public.staff.last_name_eiji IS '姓（ローマ字）';
COMMENT ON COLUMN public.staff.first_name_eiji IS '名（ローマ字）';
