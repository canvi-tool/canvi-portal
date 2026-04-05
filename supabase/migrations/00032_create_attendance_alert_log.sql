-- =============================================
-- 00032: 打刻漏れアラート送信ログテーブル
-- シフト開始後の打刻漏れアラートの送信回数を追跡し、
-- 重複送信を防止する
-- =============================================

CREATE TABLE IF NOT EXISTS public.attendance_alert_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  project_id UUID NOT NULL,
  staff_id UUID NOT NULL,
  alert_count INTEGER NOT NULL DEFAULT 1,
  last_alerted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- shift_id ごとに1レコードのみ（同じシフトに対するアラートは1行で管理）
CREATE UNIQUE INDEX idx_attendance_alert_log_shift
  ON public.attendance_alert_log(shift_id);

-- 日付ベースのクリーンアップ用インデックス
CREATE INDEX idx_attendance_alert_log_created_at
  ON public.attendance_alert_log(created_at);

-- RLS（admin clientでバイパスするが念のため設定）
ALTER TABLE public.attendance_alert_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage attendance_alert_log"
  ON public.attendance_alert_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
