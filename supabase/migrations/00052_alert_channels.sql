-- =============================================
-- アラート購読 Phase 2
--   - role_override JSONB をユーザー単位の上書き格納用に追加
--   - contract_expiring / invoice_unpaid を alert_definitions に追加
-- =============================================

-- channel_slack / channel_email カラムは Phase 1 (00050) で追加済のため
-- ここでは追加しない。念のため IF NOT EXISTS で防御的に追加する。
ALTER TABLE public.alert_subscriptions
  ADD COLUMN IF NOT EXISTS channel_slack BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS channel_email BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS role_override JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.alert_subscriptions.role_override IS
  'ユーザー単位の上書き設定。{"<user_id>": {"enabled": bool, "channel_dashboard": bool, "channel_slack": bool, "channel_email": bool}}';

CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_role_override
  ON public.alert_subscriptions USING gin (role_override);

-- =============================================
-- Seed: 凍結中の追加アラート種別
-- =============================================
INSERT INTO public.alert_definitions (id, category, label, default_severity, action_url_template, sort_order) VALUES
  ('contract_expiring', 'F_billing', '契約終了が近いプロジェクト', 'warning', '/projects/{project_id}/edit', 100),
  ('invoice_unpaid',    'F_billing', '請求書が未払い',             'critical','/billing/invoices/{invoice_id}', 110)
ON CONFLICT (id) DO UPDATE SET
  category = EXCLUDED.category,
  label = EXCLUDED.label,
  default_severity = EXCLUDED.default_severity,
  action_url_template = EXCLUDED.action_url_template,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.alert_subscriptions (alert_id, role, enabled, channel_dashboard) VALUES
  ('contract_expiring', 'owner', TRUE,  TRUE),
  ('contract_expiring', 'admin', TRUE,  TRUE),
  ('contract_expiring', 'staff', FALSE, TRUE),
  ('invoice_unpaid',    'owner', TRUE,  TRUE),
  ('invoice_unpaid',    'admin', FALSE, TRUE),
  ('invoice_unpaid',    'staff', FALSE, TRUE)
ON CONFLICT (alert_id, role) DO NOTHING;
