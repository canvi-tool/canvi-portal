-- compensation_rules テーブルをコードの期待するスキーマに合わせる
-- 新カラム追加（コードが期待するもの）
ALTER TABLE compensation_rules ADD COLUMN IF NOT EXISTS rule_type TEXT;
ALTER TABLE compensation_rules ADD COLUMN IF NOT EXISTS params JSONB DEFAULT '{}';
ALTER TABLE compensation_rules ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE compensation_rules ADD COLUMN IF NOT EXISTS effective_to DATE;

-- 旧カラムのNOT NULL制約を緩和（既存データ互換性のため）
ALTER TABLE compensation_rules ALTER COLUMN compensation_type DROP NOT NULL;
ALTER TABLE compensation_rules ALTER COLUMN base_amount DROP NOT NULL;
ALTER TABLE compensation_rules ALTER COLUMN effective_from DROP NOT NULL;

-- 既存データのrule_typeをcompensation_typeから移行
UPDATE compensation_rules
SET rule_type = compensation_type::text
WHERE rule_type IS NULL AND compensation_type IS NOT NULL;

-- effective_untilからeffective_toへ移行
UPDATE compensation_rules
SET effective_to = effective_until
WHERE effective_to IS NULL AND effective_until IS NOT NULL;

-- コメント
COMMENT ON COLUMN compensation_rules.rule_type IS '報酬ルールタイプ: time_rate, count_rate, standby_rate, monthly_fixed, fixed_plus_variable, percentage, adjustment';
COMMENT ON COLUMN compensation_rules.params IS 'ルール固有パラメータ（JSON）';
COMMENT ON COLUMN compensation_rules.is_active IS 'ルール有効フラグ';
