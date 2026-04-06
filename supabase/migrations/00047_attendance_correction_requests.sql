-- =============================================
-- 打刻修正承認フロー: attendance_correction_requests
-- =============================================

CREATE TABLE IF NOT EXISTS public.attendance_correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id UUID NOT NULL REFERENCES public.attendance_records(id) ON DELETE CASCADE,
  requested_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,

  -- スナップショット (元の値)
  original_clock_in TIMESTAMPTZ,
  original_clock_out TIMESTAMPTZ,
  original_break_minutes INTEGER,
  original_note TEXT,

  -- 申請内容
  requested_clock_in TIMESTAMPTZ,
  requested_clock_out TIMESTAMPTZ,
  requested_break_minutes INTEGER,
  requested_note TEXT,

  reason TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),

  reviewed_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_comment TEXT,

  slack_thread_ts TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acr_attendance ON public.attendance_correction_requests(attendance_record_id);
CREATE INDEX IF NOT EXISTS idx_acr_requested_by ON public.attendance_correction_requests(requested_by_user_id);
CREATE INDEX IF NOT EXISTS idx_acr_project ON public.attendance_correction_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_acr_status ON public.attendance_correction_requests(status);
CREATE INDEX IF NOT EXISTS idx_acr_created ON public.attendance_correction_requests(created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_acr_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_acr_updated_at ON public.attendance_correction_requests;
CREATE TRIGGER trg_acr_updated_at
  BEFORE UPDATE ON public.attendance_correction_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_acr_updated_at();

-- RLS
ALTER TABLE public.attendance_correction_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS acr_select ON public.attendance_correction_requests;
CREATE POLICY acr_select ON public.attendance_correction_requests
  FOR SELECT USING (
    requested_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS acr_insert ON public.attendance_correction_requests;
CREATE POLICY acr_insert ON public.attendance_correction_requests
  FOR INSERT WITH CHECK (requested_by_user_id = auth.uid());

DROP POLICY IF EXISTS acr_update ON public.attendance_correction_requests;
CREATE POLICY acr_update ON public.attendance_correction_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('owner', 'admin')
    )
  );
