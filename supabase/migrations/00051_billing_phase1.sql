-- Billing Phase 1
ALTER TABLE public.payment_calculations
  ADD COLUMN IF NOT EXISTS notice_status TEXT
    CHECK (notice_status IN ('draft','calculated','confirmed','sent','paid','cancelled'))
    DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS notice_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS notice_pdf_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_to_email TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bank_transfer_ref TEXT,
  ADD COLUMN IF NOT EXISTS withholding_tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transportation_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allowance_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_payment_calc_notice_status
  ON public.payment_calculations(notice_status)
  WHERE deleted_at IS NULL;

DO $$ BEGIN
  CREATE TYPE public.billing_rule_type AS ENUM (
    'HOURLY','MONTHLY_FIXED','DAILY','PER_CALL','PER_APPOINTMENT',
    'PER_CLOSING','REVENUE_SHARE','MANAGEMENT_FEE','DISCOUNT_FIXED','DISCOUNT_RATE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.project_billing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  rule_type public.billing_rule_type NOT NULL,
  label TEXT NOT NULL,
  unit_price NUMERIC(12,2),
  rate_percent NUMERIC(6,3),
  fixed_amount NUMERIC(12,2),
  min_amount NUMERIC(12,2),
  max_amount NUMERIC(12,2),
  tax_rate NUMERIC(5,3) NOT NULL DEFAULT 0.10,
  closing_day INTEGER,
  payment_day INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  notes TEXT,
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pbr_project ON public.project_billing_rules(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pbr_effective ON public.project_billing_rules(effective_from, effective_to);
DROP TRIGGER IF EXISTS trg_pbr_updated_at ON public.project_billing_rules;
CREATE TRIGGER trg_pbr_updated_at BEFORE UPDATE ON public.project_billing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('draft','calculated','confirmed','sent','paid','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  project_id UUID NOT NULL REFERENCES public.projects(id),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'JPY',
  status public.invoice_status NOT NULL DEFAULT 'draft',
  pdf_url TEXT,
  pdf_generated_at TIMESTAMPTZ,
  issued_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  sent_to_email TEXT,
  paid_at TIMESTAMPTZ,
  bank_name TEXT,
  bank_branch TEXT,
  bank_account_type TEXT,
  bank_account_number TEXT,
  bank_account_holder TEXT,
  notes TEXT,
  calculation_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (project_id, period_start, period_end)
);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_client ON public.invoices(client_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_project ON public.invoices(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date);
DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  billing_rule_id UUID REFERENCES public.project_billing_rules(id),
  rule_type public.billing_rule_type,
  description TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit TEXT,
  unit_price NUMERIC(12,2),
  amount NUMERIC(12,2) NOT NULL,
  tax_rate NUMERIC(5,3) NOT NULL DEFAULT 0.10,
  is_taxable BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);
DROP TRIGGER IF EXISTS trg_invoice_items_updated_at ON public.invoice_items;
CREATE TRIGGER trg_invoice_items_updated_at BEFORE UPDATE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  paid_at DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  method TEXT,
  reference TEXT,
  bank_transfer_ref TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON public.invoice_payments(invoice_id);

ALTER TABLE public.project_billing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pbr_select ON public.project_billing_rules;
CREATE POLICY pbr_select ON public.project_billing_rules FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('owner','admin'))
);
DROP POLICY IF EXISTS pbr_modify ON public.project_billing_rules;
CREATE POLICY pbr_modify ON public.project_billing_rules FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'owner')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'owner')
);

DROP POLICY IF EXISTS invoices_select ON public.invoices;
CREATE POLICY invoices_select ON public.invoices FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('owner','admin'))
);
DROP POLICY IF EXISTS invoices_modify ON public.invoices;
CREATE POLICY invoices_modify ON public.invoices FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'owner')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'owner')
);

DROP POLICY IF EXISTS invoice_items_select ON public.invoice_items;
CREATE POLICY invoice_items_select ON public.invoice_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('owner','admin'))
);
DROP POLICY IF EXISTS invoice_items_modify ON public.invoice_items;
CREATE POLICY invoice_items_modify ON public.invoice_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'owner')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'owner')
);

DROP POLICY IF EXISTS invoice_payments_select ON public.invoice_payments;
CREATE POLICY invoice_payments_select ON public.invoice_payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('owner','admin'))
);
DROP POLICY IF EXISTS invoice_payments_modify ON public.invoice_payments;
CREATE POLICY invoice_payments_modify ON public.invoice_payments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'owner')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'owner')
);
