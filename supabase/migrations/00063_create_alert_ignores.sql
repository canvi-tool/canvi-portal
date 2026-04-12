-- オーナーが特定のアラートパターンを「無視」するためのテーブル
-- 無視されたパターンはSlack通知の対象から除外される

CREATE TABLE IF NOT EXISTS public.alert_ignores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,
  staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ユニーク制約（同じパターンの重複を防止）
CREATE UNIQUE INDEX idx_alert_ignores_unique_pattern
  ON public.alert_ignores (alert_type, COALESCE(staff_id, '00000000-0000-0000-0000-000000000000'), COALESCE(project_id, '00000000-0000-0000-0000-000000000000'))
  WHERE is_active = true;

CREATE INDEX idx_alert_ignores_active ON public.alert_ignores (is_active) WHERE is_active = true;

ALTER TABLE public.alert_ignores ENABLE ROW LEVEL SECURITY;

-- service_role は全操作可能
CREATE POLICY "Service role manages alert_ignores"
  ON public.alert_ignores FOR ALL
  USING (true)
  WITH CHECK (true);

-- authenticated ユーザーは閲覧可能
CREATE POLICY "Authenticated users can view alert_ignores"
  ON public.alert_ignores FOR SELECT
  TO authenticated
  USING (true);
