ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS needs_project_assignment BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_shifts_needs_project_assignment ON public.shifts(needs_project_assignment) WHERE deleted_at IS NULL AND needs_project_assignment = TRUE;
