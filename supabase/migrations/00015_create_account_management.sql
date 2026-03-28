-- ============================================================
-- 00015_create_account_management.sql
-- 外部アカウントプロビジョニング管理テーブル
-- ============================================================

-- 外部アカウント管理テーブル
-- スタッフのオンボーディング/オフボーディングに伴う
-- 外部サービスアカウントの状態を追跡する
CREATE TABLE IF NOT EXISTS public.staff_external_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id),
  provider TEXT NOT NULL,                -- 'google_workspace', 'zoom', 'zoom_phone'
  external_id TEXT,                      -- プロバイダー側のユーザーID
  email TEXT,                            -- プロバイダー側のメールアドレス
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, suspended, deleted
  provisioned_at TIMESTAMPTZ,            -- アカウント作成日時
  suspended_at TIMESTAMPTZ,              -- アカウント停止日時
  deleted_at TIMESTAMPTZ,                -- アカウント削除日時
  metadata JSONB DEFAULT '{}'::jsonb,    -- プロバイダー固有の追加情報
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at トリガー
CREATE TRIGGER staff_external_accounts_updated_at
  BEFORE UPDATE ON public.staff_external_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- インデックス
CREATE INDEX idx_staff_external_accounts_staff ON public.staff_external_accounts(staff_id);
CREATE INDEX idx_staff_external_accounts_provider ON public.staff_external_accounts(provider, status);
CREATE INDEX idx_staff_external_accounts_email ON public.staff_external_accounts(email) WHERE deleted_at IS NULL;

-- RLS 有効化
ALTER TABLE public.staff_external_accounts ENABLE ROW LEVEL SECURITY;

-- RLS ポリシー
-- Owner/Admin: 全レコード閲覧可能
CREATE POLICY "Admins can view all external accounts" ON public.staff_external_accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Owner/Admin: 作成・更新
CREATE POLICY "Admins can insert external accounts" ON public.staff_external_accounts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update external accounts" ON public.staff_external_accounts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Service role: 全権限
CREATE POLICY "Service role can manage external accounts" ON public.staff_external_accounts
  FOR ALL USING (auth.role() = 'service_role');
