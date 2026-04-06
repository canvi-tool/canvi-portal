ALTER TABLE public.work_reports
  ADD COLUMN IF NOT EXISTS approval_comment TEXT;
