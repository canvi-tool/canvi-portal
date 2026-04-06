-- Phase 1: Googleカレンダー取込のための shifts テーブル拡張
-- - source: 'manual' | 'google_calendar' | 'import'
-- - external_event_id: Googleカレンダーのevent id
-- - needs_project_assignment: 取込直後のPJ未割当フラグ（カレンダー上で「PJ選択」ボタンを表示）

ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS external_event_id TEXT;

ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS external_calendar_id TEXT;

ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS external_updated_at TIMESTAMPTZ;

ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS needs_project_assignment BOOLEAN NOT NULL DEFAULT FALSE;

-- project_id を NULL 許容に（取込直後はPJ未割当）
ALTER TABLE shifts
  ALTER COLUMN project_id DROP NOT NULL;

-- 同一スタッフ内で同じ external_event_id は1件のみ
CREATE UNIQUE INDEX IF NOT EXISTS shifts_external_event_uq
  ON shifts(staff_id, external_event_id)
  WHERE external_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS shifts_needs_assignment_idx
  ON shifts(staff_id, needs_project_assignment)
  WHERE needs_project_assignment = TRUE;

COMMENT ON COLUMN shifts.source IS '出処: manual=Canvi手動 / google_calendar=GCal取込 / import=その他インポート';
COMMENT ON COLUMN shifts.external_event_id IS 'Google Calendar event id (source=google_calendar時)';
COMMENT ON COLUMN shifts.needs_project_assignment IS 'true=PJ未割当（予実集計対象外、カレンダー上でPJ選択を促す）';
