-- ============================================================
-- 00003_create_contracts.sql
-- 契約テンプレート・契約管理
-- ============================================================

-- 契約ステータス
CREATE TYPE public.contract_status AS ENUM (
  'draft',           -- 下書き
  'pending_review',  -- レビュー待ち
  'sent',            -- 送信済み
  'viewed',          -- 閲覧済み
  'signed',          -- 署名済み
  'active',          -- 有効
  'expired',         -- 期限切れ
  'terminated',      -- 解約
  'rejected'         -- 拒否
);

-- 契約種別
CREATE TYPE public.contract_type AS ENUM (
  'employment',      -- 雇用契約
  'nda',             -- 秘密保持契約
  'service',         -- 業務委託契約
  'amendment',       -- 変更契約
  'other'            -- その他
);

-- ========== 契約テンプレートテーブル ==========
CREATE TABLE public.contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                        -- テンプレート名
  contract_type public.contract_type NOT NULL DEFAULT 'employment',
  description TEXT,                          -- 説明
  content_html TEXT NOT NULL,                -- HTML形式の契約内容
  variables JSONB DEFAULT '[]'::jsonb,       -- 差し込み変数定義
  is_default BOOLEAN NOT NULL DEFAULT false, -- デフォルトテンプレート
  version INTEGER NOT NULL DEFAULT 1,        -- バージョン番号
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- updated_at トリガー
CREATE TRIGGER contract_templates_updated_at
  BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- インデックス
CREATE INDEX idx_contract_templates_type ON public.contract_templates(contract_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_contract_templates_is_default ON public.contract_templates(is_default) WHERE deleted_at IS NULL;

-- ========== 契約テーブル ==========
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number TEXT NOT NULL UNIQUE,      -- 契約番号
  template_id UUID REFERENCES public.contract_templates(id),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,

  -- 契約情報
  contract_type public.contract_type NOT NULL DEFAULT 'employment',
  status public.contract_status NOT NULL DEFAULT 'draft',
  title TEXT NOT NULL,                       -- 契約タイトル
  content_html TEXT NOT NULL,                -- 最終的な契約内容 (HTML)
  content_snapshot JSONB,                    -- テンプレート変数適用後のスナップショット

  -- 期間
  start_date DATE NOT NULL,                  -- 契約開始日
  end_date DATE,                             -- 契約終了日 (NULLは無期限)
  auto_renew BOOLEAN NOT NULL DEFAULT false, -- 自動更新

  -- 報酬条件
  compensation_details JSONB DEFAULT '{}'::jsonb, -- 報酬条件の詳細

  -- 署名情報
  sent_at TIMESTAMPTZ,                       -- 送信日時
  viewed_at TIMESTAMPTZ,                     -- 閲覧日時
  signed_at TIMESTAMPTZ,                     -- 署名日時
  signer_ip TEXT,                            -- 署名時IPアドレス
  signature_data TEXT,                       -- 電子署名データ

  -- メタデータ
  notes TEXT,                                -- 備考
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- updated_at トリガー
CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- インデックス
CREATE INDEX idx_contracts_staff_id ON public.contracts(staff_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_contracts_status ON public.contracts(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_contracts_type ON public.contracts(contract_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_contracts_start_date ON public.contracts(start_date);
CREATE INDEX idx_contracts_end_date ON public.contracts(end_date) WHERE end_date IS NOT NULL;
CREATE INDEX idx_contracts_template_id ON public.contracts(template_id);
CREATE INDEX idx_contracts_number ON public.contracts(contract_number);

-- RLS 有効化
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- ========== contract_templates RLS ポリシー ==========
CREATE POLICY "Admins can view templates" ON public.contract_templates
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can insert templates" ON public.contract_templates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update templates" ON public.contract_templates
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Service role manages templates" ON public.contract_templates
  FOR ALL USING (auth.role() = 'service_role');

-- ========== contracts RLS ポリシー ==========
CREATE POLICY "Admins can view all contracts" ON public.contracts
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can insert contracts" ON public.contracts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update contracts" ON public.contracts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete contracts" ON public.contracts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Staff: 自分の契約のみ閲覧可能
CREATE POLICY "Staff can view own contracts" ON public.contracts
  FOR SELECT USING (
    deleted_at IS NULL
    AND staff_id IN (
      SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages contracts" ON public.contracts
  FOR ALL USING (auth.role() = 'service_role');
