-- 標準報酬月額カラムを追加（社会保険料計算用）
ALTER TABLE staff ADD COLUMN IF NOT EXISTS standard_monthly_remuneration NUMERIC(12, 2) DEFAULT NULL;

-- コメント
COMMENT ON COLUMN staff.standard_monthly_remuneration IS '標準報酬月額（社会保険料計算の基準額）';
