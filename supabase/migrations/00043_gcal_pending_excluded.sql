-- Phase 1 追補: GCal取込イベントの「PJではない」永続除外フラグ
ALTER TABLE public.gcal_pending_events
  ADD COLUMN IF NOT EXISTS excluded BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS excluded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS gcal_pending_excluded_idx
  ON public.gcal_pending_events(staff_id, excluded);

COMMENT ON COLUMN public.gcal_pending_events.excluded IS
  'true=ユーザが「PJではない」として除外。importerは excluded=true のレコードを上書きしない。';
