-- 00045: 打刻丸め Phase 3
-- 2層ストレージ: 生打刻(clock_in/clock_out) + 丸め後打刻(clock_in_rounded/clock_out_rounded)
-- ±10分以内のズレはシフト時刻に丸める。±11分以上は生値のまま。
-- rounding_applied=true の場合のみ丸めが実際に適用されたことを示す。

ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS clock_in_rounded TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clock_out_rounded TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rounding_applied BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_attendance_records_clock_in_rounded
  ON attendance_records(clock_in_rounded)
  WHERE clock_in_rounded IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_records_clock_out_rounded
  ON attendance_records(clock_out_rounded)
  WHERE clock_out_rounded IS NOT NULL;

COMMENT ON COLUMN attendance_records.clock_in_rounded IS 'シフト開始時刻に±10分以内であれば丸めた出勤時刻。それ以外は生clock_inのコピー。';
COMMENT ON COLUMN attendance_records.clock_out_rounded IS 'シフト終了時刻に±10分以内であれば丸めた退勤時刻。それ以外は生clock_outのコピー。';
COMMENT ON COLUMN attendance_records.rounding_applied IS '丸めが実際に適用されたか（ズレ±10分以内の場合のみtrue）。';
