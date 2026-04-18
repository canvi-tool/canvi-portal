-- ============================================================
-- Canvi Portal: Master Tenants
-- Canviポータルが全サービス（Canvas / テレアポくん / AI社畜 / オペマネ / 達人）の
-- テナントを一元管理するためのマスターテーブル。
--
-- canonical_id は各サービスDBの tenants.id と一致する統一UUIDで、
-- Portalで CRUD 後、各サービスへ propagation される。
-- ============================================================

CREATE TABLE IF NOT EXISTS public.master_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_id UUID NOT NULL UNIQUE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  enabled_services JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_master_tenants_status ON public.master_tenants (status);
CREATE INDEX IF NOT EXISTS idx_master_tenants_canonical_id ON public.master_tenants (canonical_id);

-- updated_at 自動更新
CREATE OR REPLACE FUNCTION public.master_tenants_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_master_tenants_updated_at ON public.master_tenants;
CREATE TRIGGER trg_master_tenants_updated_at
  BEFORE UPDATE ON public.master_tenants
  FOR EACH ROW EXECUTE FUNCTION public.master_tenants_set_updated_at();

-- RLS: API (service_role) 経由のみ操作可。一般ユーザーのRLS通過は不要
ALTER TABLE public.master_tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access" ON public.master_tenants;
CREATE POLICY "service_role_full_access"
  ON public.master_tenants
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 株式会社Canvi を統一UUIDでseed
INSERT INTO public.master_tenants (canonical_id, name, slug, contact_email, enabled_services)
VALUES (
  '00000000-0000-4000-8000-00000000ca01',
  '株式会社Canvi',
  'canvi-inc',
  'yuji.okabayashi@canvi.co.jp',
  '["canvas","teleapo","ai-shachiku","opemane","tatsujin"]'::jsonb
)
ON CONFLICT (slug) DO NOTHING;
