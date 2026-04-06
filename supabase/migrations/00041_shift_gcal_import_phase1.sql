-- Phase 1: Googleカレンダー取込のための基盤
-- shifts.project_id は生成列のため NULL 不可。よってPJ未割当のGCalイベントは
-- 専用テーブル gcal_pending_events に保持し、PJ割当後に shifts へ昇格させる。

-- shifts テーブル拡張（PJ割当済みのGCal由来シフトを区別するため）
ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS external_event_id TEXT;

ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS external_calendar_id TEXT;

ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS external_updated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS shifts_external_event_uq
  ON shifts(staff_id, external_event_id)
  WHERE external_event_id IS NOT NULL;

COMMENT ON COLUMN shifts.source IS '出処: manual=Canvi手動 / google_calendar=GCal取込 / import=その他インポート';
COMMENT ON COLUMN shifts.external_event_id IS 'Google Calendar event id (source=google_calendar時)';

-- PJ未割当のGCalイベントを保持する一時テーブル
-- カレンダー上ではグレー表示し、PJ選択で shifts に移動する
CREATE TABLE IF NOT EXISTS gcal_pending_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  external_event_id TEXT NOT NULL,
  external_calendar_id TEXT NOT NULL DEFAULT 'primary',
  external_updated_at TIMESTAMPTZ,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  title TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(staff_id, external_event_id)
);

CREATE INDEX IF NOT EXISTS gcal_pending_events_staff_date_idx
  ON gcal_pending_events(staff_id, event_date);

COMMENT ON TABLE gcal_pending_events IS
  'PJ未割当のGoogleカレンダー取込イベント。ユーザがPJを割当すると shifts へ昇格され、本レコードは削除される';

-- RLS: 自分のレコードのみ参照可能 + 管理者は全件可能
ALTER TABLE gcal_pending_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gcal_pending_events_select_own ON gcal_pending_events;
CREATE POLICY gcal_pending_events_select_own ON gcal_pending_events
  FOR SELECT
  USING (
    staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'owner')
    )
  );
