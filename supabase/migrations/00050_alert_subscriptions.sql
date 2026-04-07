-- =============================================
-- アラート購読設定 (Phase 1)
--   alert_definitions: アラート種別カタログ
--   alert_subscriptions: ロール×アラートのON/OFF設定
-- =============================================

CREATE TABLE IF NOT EXISTS public.alert_definitions (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  default_severity TEXT NOT NULL CHECK (default_severity IN ('info', 'warning', 'critical')),
  action_url_template TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.alert_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id TEXT NOT NULL REFERENCES public.alert_definitions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'staff')),
  channel_dashboard BOOLEAN NOT NULL DEFAULT TRUE,
  channel_slack BOOLEAN NOT NULL DEFAULT FALSE,
  channel_email BOOLEAN NOT NULL DEFAULT FALSE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (alert_id, role)
);

CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_alert ON public.alert_subscriptions(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_role ON public.alert_subscriptions(role);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_alert_definitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_alert_definitions_updated_at ON public.alert_definitions;
CREATE TRIGGER trg_alert_definitions_updated_at
  BEFORE UPDATE ON public.alert_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_alert_definitions_updated_at();

CREATE OR REPLACE FUNCTION public.set_alert_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_alert_subscriptions_updated_at ON public.alert_subscriptions;
CREATE TRIGGER trg_alert_subscriptions_updated_at
  BEFORE UPDATE ON public.alert_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_alert_subscriptions_updated_at();

-- =============================================
-- Seed: alert_definitions
-- =============================================
INSERT INTO public.alert_definitions (id, category, label, default_severity, action_url_template, sort_order) VALUES
  ('shift_unsubmitted',           'A_self',     'シフト未提出（25日締切）',          'warning', '/shifts',                                                  10),
  ('attendance_missing_clock_in', 'A_self',     '出勤打刻漏れ',                       'warning', '/attendance',                                              20),
  ('correction_request_pending',  'B_approval', '打刻修正申請待ち',                   'info',    '/attendance/manage',                                       30),
  ('shift_approval_pending',      'B_approval', 'シフト承認待ち',                     'info',    '/shifts/pending',                                          40),
  ('attendance_shift_diff',       'C_anomaly',  '打刻×シフト乖離（±30分超）',        'warning', '/attendance/manage',                                       50),
  ('staff_missing_fields',        'D_finance',  'スタッフ必須項目未入力',             'warning', '/staff',                                                   60),
  ('pj_no_client',                'E_config',   'PJにクライアント未紐付け',           'warning', '/projects/{project_id}/edit',                              70),
  ('client_info_incomplete',      'E_config',   'クライアント情報不足',               'warning', '/clients/{client_id}/edit',                                80),
  ('pj_compensation_missing',     'E_config',   'スタッフ報酬体系未入力',             'warning', '/projects/{project_id}/assignments/{staff_id}',            90)
ON CONFLICT (id) DO UPDATE SET
  category = EXCLUDED.category,
  label = EXCLUDED.label,
  default_severity = EXCLUDED.default_severity,
  action_url_template = EXCLUDED.action_url_template,
  sort_order = EXCLUDED.sort_order;

-- =============================================
-- Seed: alert_subscriptions (default)
--   表: 各アラートの「デフォルト購読ロール」
-- =============================================
-- shift_unsubmitted: staff, owner
INSERT INTO public.alert_subscriptions (alert_id, role, enabled) VALUES
  ('shift_unsubmitted', 'staff', TRUE),
  ('shift_unsubmitted', 'admin', FALSE),
  ('shift_unsubmitted', 'owner', TRUE),
  ('attendance_missing_clock_in', 'staff', TRUE),
  ('attendance_missing_clock_in', 'admin', TRUE),
  ('attendance_missing_clock_in', 'owner', FALSE),
  ('correction_request_pending', 'staff', FALSE),
  ('correction_request_pending', 'admin', TRUE),
  ('correction_request_pending', 'owner', TRUE),
  ('shift_approval_pending', 'staff', FALSE),
  ('shift_approval_pending', 'admin', TRUE),
  ('shift_approval_pending', 'owner', TRUE),
  ('attendance_shift_diff', 'staff', FALSE),
  ('attendance_shift_diff', 'admin', TRUE),
  ('attendance_shift_diff', 'owner', TRUE),
  ('staff_missing_fields', 'staff', FALSE),
  ('staff_missing_fields', 'admin', FALSE),
  ('staff_missing_fields', 'owner', TRUE),
  ('pj_no_client', 'staff', FALSE),
  ('pj_no_client', 'admin', FALSE),
  ('pj_no_client', 'owner', TRUE),
  ('client_info_incomplete', 'staff', FALSE),
  ('client_info_incomplete', 'admin', TRUE),
  ('client_info_incomplete', 'owner', TRUE),
  ('pj_compensation_missing', 'staff', FALSE),
  ('pj_compensation_missing', 'admin', FALSE),
  ('pj_compensation_missing', 'owner', TRUE)
ON CONFLICT (alert_id, role) DO NOTHING;

-- =============================================
-- RLS
-- =============================================
ALTER TABLE public.alert_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_subscriptions ENABLE ROW LEVEL SECURITY;

-- alert_definitions: owner のみ select 可（更新は migration 側のみ想定）
DROP POLICY IF EXISTS alert_definitions_select ON public.alert_definitions;
CREATE POLICY alert_definitions_select ON public.alert_definitions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name = 'owner'
    )
  );

-- alert_subscriptions: owner のみ select / update
DROP POLICY IF EXISTS alert_subscriptions_select ON public.alert_subscriptions;
CREATE POLICY alert_subscriptions_select ON public.alert_subscriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name = 'owner'
    )
  );

DROP POLICY IF EXISTS alert_subscriptions_update ON public.alert_subscriptions;
CREATE POLICY alert_subscriptions_update ON public.alert_subscriptions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name = 'owner'
    )
  );
