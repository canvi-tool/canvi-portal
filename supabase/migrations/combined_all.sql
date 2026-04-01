-- ============================================================
-- 00001_create_auth_rbac.sql
-- 認証・ロールベースアクセス制御 (RBAC)
-- ============================================================

-- Users テーブル (auth.users の拡張)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ロールテーブル
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 権限テーブル
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'all',
  UNIQUE(resource, action, scope)
);

-- ロール・権限の紐付け
CREATE TABLE public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ユーザー・ロールの紐付け
CREATE TABLE public.user_roles (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES public.users(id),
  PRIMARY KEY (user_id, role_id)
);

-- 初期ロールの投入
INSERT INTO public.roles (name, description) VALUES
  ('owner', 'システムオーナー - 全権限'),
  ('admin', '管理者 - 日常運用権限'),
  ('staff', 'スタッフ - 自分の情報のみ');

-- 全リソースの権限を投入
INSERT INTO public.permissions (resource, action) VALUES
  ('staff', 'create'), ('staff', 'read'), ('staff', 'update'), ('staff', 'delete'),
  ('contracts', 'create'), ('contracts', 'read'), ('contracts', 'update'), ('contracts', 'delete'), ('contracts', 'send'),
  ('projects', 'create'), ('projects', 'read'), ('projects', 'update'), ('projects', 'delete'),
  ('assignments', 'create'), ('assignments', 'read'), ('assignments', 'update'), ('assignments', 'delete'),
  ('shifts', 'create'), ('shifts', 'read'), ('shifts', 'update'), ('shifts', 'delete'), ('shifts', 'sync'),
  ('reports', 'create'), ('reports', 'read'), ('reports', 'update'), ('reports', 'approve'),
  ('payments', 'read'), ('payments', 'calculate'), ('payments', 'confirm'), ('payments', 'issue'),
  ('notifications', 'read'), ('notifications', 'send'), ('notifications', 'resend'),
  ('retirement', 'create'), ('retirement', 'read'), ('retirement', 'update'),
  ('settings', 'read'), ('settings', 'update'),
  ('audit_logs', 'read'),
  ('ai', 'read'), ('ai', 'execute');

-- admin ロールに権限を付与 (設定変更・監査ログ以外)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.name = 'admin'
AND NOT (p.resource = 'settings' AND p.action = 'update')
AND NOT (p.resource = 'audit_logs');

-- staff ロールに限定権限を付与
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.name = 'staff'
AND (
  (p.resource = 'staff' AND p.action = 'read')
  OR (p.resource = 'shifts' AND p.action = 'read')
  OR (p.resource = 'reports' AND p.action IN ('create', 'read', 'update'))
  OR (p.resource = 'payments' AND p.action = 'read')
  OR (p.resource = 'contracts' AND p.action = 'read')
  OR (p.resource = 'projects' AND p.action = 'read')
  OR (p.resource = 'notifications' AND p.action = 'read')
);

-- updated_at 自動更新トリガー関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS 有効化
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ========== users テーブルの RLS ポリシー ==========
CREATE POLICY "Users can view their own record" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );
CREATE POLICY "Users can update their own record" ON public.users
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Service role can manage users" ON public.users
  FOR ALL USING (auth.role() = 'service_role');

-- ========== roles テーブルの RLS ポリシー ==========
CREATE POLICY "Authenticated can read roles" ON public.roles
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service role can manage roles" ON public.roles
  FOR ALL USING (auth.role() = 'service_role');

-- ========== permissions テーブルの RLS ポリシー ==========
CREATE POLICY "Authenticated can read permissions" ON public.permissions
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service role manages permissions" ON public.permissions
  FOR ALL USING (auth.role() = 'service_role');

-- ========== role_permissions テーブルの RLS ポリシー ==========
CREATE POLICY "Authenticated can read role_permissions" ON public.role_permissions
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service role manages role_permissions" ON public.role_permissions
  FOR ALL USING (auth.role() = 'service_role');

-- ========== user_roles テーブルの RLS ポリシー ==========
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can read all user_roles" ON public.user_roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );
CREATE POLICY "Service role manages user_roles" ON public.user_roles
  FOR ALL USING (auth.role() = 'service_role');

-- インデックス
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_is_active ON public.users(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON public.user_roles(role_id);
CREATE INDEX idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX idx_permissions_resource_action ON public.permissions(resource, action);
-- ============================================================
-- 00002_create_staff.sql
-- スタッフ管理テーブル
-- ============================================================

-- 雇用形態
CREATE TYPE public.employment_type AS ENUM (
  'full_time',       -- 正社員
  'part_time',       -- パートタイム
  'contract',        -- 契約社員
  'temporary',       -- 派遣社員
  'freelance'        -- フリーランス
);

-- スタッフステータス
CREATE TYPE public.staff_status AS ENUM (
  'active',          -- 稼働中
  'on_leave',        -- 休職中
  'suspended',       -- 停止中
  'retired'          -- 退職済み
);

-- 性別
CREATE TYPE public.gender_type AS ENUM (
  'male',            -- 男性
  'female',          -- 女性
  'other',           -- その他
  'prefer_not_to_say' -- 回答しない
);

-- スタッフテーブル
CREATE TABLE public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES public.users(id) ON DELETE SET NULL,

  -- 基本情報
  staff_code TEXT NOT NULL UNIQUE,          -- スタッフコード (自動採番 or 手動)
  last_name TEXT NOT NULL,                  -- 姓
  first_name TEXT NOT NULL,                 -- 名
  last_name_kana TEXT,                      -- 姓（カナ）
  first_name_kana TEXT,                     -- 名（カナ）
  last_name_eiji TEXT,                      -- 姓（ローマ字）
  first_name_eiji TEXT,                     -- 名（ローマ字）
  email TEXT NOT NULL,                      -- メールアドレス
  phone TEXT,                               -- 電話番号
  gender public.gender_type,               -- 性別
  date_of_birth DATE,                       -- 生年月日

  -- 住所
  postal_code TEXT,                         -- 郵便番号
  prefecture TEXT,                          -- 都道府県
  city TEXT,                                -- 市区町村
  address_line1 TEXT,                       -- 番地
  address_line2 TEXT,                       -- 建物名・部屋番号

  -- 雇用情報
  employment_type public.employment_type NOT NULL DEFAULT 'part_time',
  status public.staff_status NOT NULL DEFAULT 'active',
  hire_date DATE NOT NULL,                  -- 入社日
  termination_date DATE,                    -- 退職日

  -- 報酬情報
  hourly_rate NUMERIC(10, 2),              -- 時給
  daily_rate NUMERIC(10, 2),               -- 日給
  monthly_salary NUMERIC(12, 2),           -- 月給
  transportation_allowance NUMERIC(10, 2) DEFAULT 0, -- 交通費

  -- 銀行口座情報
  bank_name TEXT,                           -- 銀行名
  bank_branch TEXT,                         -- 支店名
  bank_account_type TEXT,                   -- 口座種別 (普通/当座)
  bank_account_number TEXT,                 -- 口座番号
  bank_account_holder TEXT,                 -- 口座名義

  -- 緊急連絡先
  emergency_contact_name TEXT,             -- 緊急連絡先名
  emergency_contact_phone TEXT,            -- 緊急連絡先電話番号
  emergency_contact_relationship TEXT,     -- 緊急連絡先続柄

  -- スキル・資格
  skills JSONB DEFAULT '[]'::jsonb,        -- スキルタグ配列
  qualifications JSONB DEFAULT '[]'::jsonb, -- 資格情報配列
  notes TEXT,                               -- 備考

  -- カスタムフィールド
  custom_fields JSONB DEFAULT '{}'::jsonb,

  -- メタデータ
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- updated_at トリガー
CREATE TRIGGER staff_updated_at
  BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- インデックス
CREATE INDEX idx_staff_user_id ON public.staff(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_staff_staff_code ON public.staff(staff_code);
CREATE INDEX idx_staff_email ON public.staff(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_staff_status ON public.staff(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_staff_employment_type ON public.staff(employment_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_staff_name ON public.staff(last_name, first_name) WHERE deleted_at IS NULL;
CREATE INDEX idx_staff_name_kana ON public.staff(last_name_kana, first_name_kana) WHERE deleted_at IS NULL;
CREATE INDEX idx_staff_hire_date ON public.staff(hire_date);
CREATE INDEX idx_staff_skills ON public.staff USING gin(skills) WHERE deleted_at IS NULL;

-- RLS 有効化
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- RLS ポリシー
-- Owner/Admin: 論理削除されていないスタッフを閲覧可能
CREATE POLICY "Admins can view all staff" ON public.staff
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Owner/Admin: スタッフの作成・更新・削除
CREATE POLICY "Admins can insert staff" ON public.staff
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update staff" ON public.staff
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete staff" ON public.staff
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Staff: 自分のレコードのみ閲覧可能
CREATE POLICY "Staff can view own record" ON public.staff
  FOR SELECT USING (
    deleted_at IS NULL
    AND user_id = auth.uid()
  );

-- Service role: 全権限
CREATE POLICY "Service role can manage staff" ON public.staff
  FOR ALL USING (auth.role() = 'service_role');
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
-- ============================================================
-- 00004_create_projects.sql
-- 案件・アサイン・報酬ルール管理
-- ============================================================

-- 案件ステータス
CREATE TYPE public.project_status AS ENUM (
  'planning',        -- 企画中
  'active',          -- 進行中
  'on_hold',         -- 保留中
  'completed',       -- 完了
  'cancelled'        -- キャンセル
);

-- アサインステータス
CREATE TYPE public.assignment_status AS ENUM (
  'proposed',        -- 提案中
  'confirmed',       -- 確定
  'in_progress',     -- 稼働中
  'completed',       -- 完了
  'cancelled'        -- キャンセル
);

-- 報酬計算タイプ
CREATE TYPE public.compensation_type AS ENUM (
  'hourly',          -- 時給制
  'daily',           -- 日給制
  'monthly',         -- 月給制
  'fixed',           -- 固定額
  'commission'       -- 歩合制
);

-- ========== 案件テーブル ==========
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code TEXT NOT NULL UNIQUE,         -- 案件コード
  name TEXT NOT NULL,                        -- 案件名
  description TEXT,                          -- 説明
  client_name TEXT,                          -- クライアント名
  client_contact TEXT,                       -- クライアント連絡先

  -- ステータス・期間
  status public.project_status NOT NULL DEFAULT 'planning',
  start_date DATE,                           -- 開始日
  end_date DATE,                             -- 終了日

  -- 勤務場所
  location_name TEXT,                        -- 勤務地名
  location_address TEXT,                     -- 勤務地住所
  location_lat NUMERIC(10, 7),              -- 緯度 (GPS打刻用)
  location_lng NUMERIC(10, 7),              -- 経度 (GPS打刻用)
  location_radius INTEGER DEFAULT 200,      -- 打刻許可半径 (メートル)

  -- 予算
  budget_amount NUMERIC(14, 2),             -- 予算額
  budget_currency TEXT DEFAULT 'JPY',       -- 通貨

  -- 設定
  requires_gps_checkin BOOLEAN DEFAULT false, -- GPS打刻必須
  default_shift_start TIME,                  -- デフォルト勤務開始時刻
  default_shift_end TIME,                    -- デフォルト勤務終了時刻
  default_break_minutes INTEGER DEFAULT 60,  -- デフォルト休憩時間 (分)

  -- メタデータ
  tags JSONB DEFAULT '[]'::jsonb,           -- タグ
  custom_fields JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- updated_at トリガー
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== アサインテーブル ==========
CREATE TABLE public.project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,

  -- アサイン情報
  status public.assignment_status NOT NULL DEFAULT 'proposed',
  role_title TEXT,                           -- 役割・ポジション名
  start_date DATE NOT NULL,                  -- アサイン開始日
  end_date DATE,                             -- アサイン終了日

  -- 個別勤務設定 (案件デフォルトを上書き)
  shift_start TIME,                          -- 勤務開始時刻
  shift_end TIME,                            -- 勤務終了時刻
  break_minutes INTEGER,                     -- 休憩時間 (分)

  -- メタデータ
  notes TEXT,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- 同一案件・スタッフの重複アサイン防止
  UNIQUE(project_id, staff_id, start_date)
);

-- updated_at トリガー
CREATE TRIGGER project_assignments_updated_at
  BEFORE UPDATE ON public.project_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== 報酬ルールテーブル ==========
CREATE TABLE public.compensation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES public.project_assignments(id) ON DELETE CASCADE,

  -- ルール名と優先度
  name TEXT NOT NULL,                        -- ルール名
  priority INTEGER NOT NULL DEFAULT 0,       -- 優先度 (高い方が優先)

  -- 報酬タイプと金額
  compensation_type public.compensation_type NOT NULL,
  base_amount NUMERIC(10, 2) NOT NULL,       -- 基本金額
  currency TEXT DEFAULT 'JPY',

  -- 割増条件
  overtime_multiplier NUMERIC(4, 2) DEFAULT 1.25,  -- 残業割増率
  night_multiplier NUMERIC(4, 2) DEFAULT 1.25,     -- 深夜割増率
  holiday_multiplier NUMERIC(4, 2) DEFAULT 1.35,   -- 休日割増率
  overtime_threshold_hours NUMERIC(5, 2) DEFAULT 8, -- 残業開始時間

  -- 適用期間
  effective_from DATE NOT NULL,              -- 適用開始日
  effective_until DATE,                      -- 適用終了日

  -- 条件 (JSONB で柔軟な条件定義)
  conditions JSONB DEFAULT '{}'::jsonb,      -- 適用条件

  -- メタデータ
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- updated_at トリガー
CREATE TRIGGER compensation_rules_updated_at
  BEFORE UPDATE ON public.compensation_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== インデックス ==========
-- projects
CREATE INDEX idx_projects_status ON public.projects(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_code ON public.projects(project_code);
CREATE INDEX idx_projects_client ON public.projects(client_name) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_dates ON public.projects(start_date, end_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_tags ON public.projects USING gin(tags) WHERE deleted_at IS NULL;

-- project_assignments
CREATE INDEX idx_assignments_project ON public.project_assignments(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignments_staff ON public.project_assignments(staff_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignments_status ON public.project_assignments(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignments_dates ON public.project_assignments(start_date, end_date) WHERE deleted_at IS NULL;

-- compensation_rules
CREATE INDEX idx_comp_rules_project ON public.compensation_rules(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_comp_rules_staff ON public.compensation_rules(staff_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_comp_rules_assignment ON public.compensation_rules(assignment_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_comp_rules_effective ON public.compensation_rules(effective_from, effective_until) WHERE deleted_at IS NULL;
CREATE INDEX idx_comp_rules_priority ON public.compensation_rules(priority DESC) WHERE deleted_at IS NULL;

-- RLS 有効化
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compensation_rules ENABLE ROW LEVEL SECURITY;

-- ========== projects RLS ポリシー ==========
CREATE POLICY "Admins can view all projects" ON public.projects
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can insert projects" ON public.projects
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update projects" ON public.projects
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete projects" ON public.projects
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Staff: アサインされた案件のみ閲覧可能
CREATE POLICY "Staff can view assigned projects" ON public.projects
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.project_assignments pa
      JOIN public.staff s ON pa.staff_id = s.id
      WHERE pa.project_id = projects.id
        AND s.user_id = auth.uid()
        AND pa.deleted_at IS NULL
    )
  );

CREATE POLICY "Service role manages projects" ON public.projects
  FOR ALL USING (auth.role() = 'service_role');

-- ========== project_assignments RLS ポリシー ==========
CREATE POLICY "Admins can view all assignments" ON public.project_assignments
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can insert assignments" ON public.project_assignments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update assignments" ON public.project_assignments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete assignments" ON public.project_assignments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Staff: 自分のアサインのみ閲覧可能
CREATE POLICY "Staff can view own assignments" ON public.project_assignments
  FOR SELECT USING (
    deleted_at IS NULL
    AND staff_id IN (
      SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages assignments" ON public.project_assignments
  FOR ALL USING (auth.role() = 'service_role');

-- ========== compensation_rules RLS ポリシー ==========
CREATE POLICY "Admins can view compensation rules" ON public.compensation_rules
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can insert compensation rules" ON public.compensation_rules
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update compensation rules" ON public.compensation_rules
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete compensation rules" ON public.compensation_rules
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Staff: 自分の報酬ルールのみ閲覧可能
CREATE POLICY "Staff can view own compensation rules" ON public.compensation_rules
  FOR SELECT USING (
    deleted_at IS NULL
    AND staff_id IN (
      SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages compensation rules" ON public.compensation_rules
  FOR ALL USING (auth.role() = 'service_role');
-- ============================================================
-- 00005_create_shifts.sql
-- シフト管理・承認フロー
-- ============================================================

-- シフトテーブル
CREATE TABLE public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- シフト情報
  shift_date DATE NOT NULL,                      -- 勤務日
  start_time TIME NOT NULL,                      -- 開始時刻
  end_time TIME NOT NULL,                        -- 終了時刻

  -- 承認ステータス
  status TEXT NOT NULL DEFAULT 'DRAFT',          -- DRAFT, SUBMITTED, APPROVED, REJECTED, NEEDS_REVISION

  -- メモ
  notes TEXT,                                    -- 備考

  -- Google Calendar 連携
  google_calendar_event_id TEXT,                 -- Google Calendar イベントID
  google_calendar_synced BOOLEAN DEFAULT false,  -- 同期済みフラグ

  -- 承認関連タイムスタンプ
  submitted_at TIMESTAMPTZ,                      -- 提出日時
  approved_at TIMESTAMPTZ,                       -- 承認日時
  approved_by UUID REFERENCES public.users(id),  -- 承認者

  -- メタデータ
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ                         -- 論理削除
);

-- updated_at トリガー
CREATE TRIGGER shifts_updated_at
  BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== シフト承認履歴テーブル ==========
CREATE TABLE public.shift_approval_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,

  -- アクション情報
  action TEXT NOT NULL,                          -- APPROVE, REJECT, NEEDS_REVISION, MODIFY, COMMENT
  comment TEXT,                                  -- コメント

  -- 変更前後の時刻 (MODIFY アクション用)
  previous_start_time TIME,                      -- 変更前開始時刻
  previous_end_time TIME,                        -- 変更前終了時刻
  new_start_time TIME,                           -- 変更後開始時刻
  new_end_time TIME,                             -- 変更後終了時刻

  -- 実行者
  performed_by UUID NOT NULL REFERENCES public.users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== インデックス ==========
-- shifts
CREATE INDEX idx_shifts_staff_id ON public.shifts(staff_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_shifts_project_id ON public.shifts(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_shifts_shift_date ON public.shifts(shift_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_shifts_status ON public.shifts(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_shifts_staff_date ON public.shifts(staff_id, shift_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_shifts_project_date ON public.shifts(project_id, shift_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_shifts_project_status ON public.shifts(project_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_shifts_submitted_at ON public.shifts(submitted_at) WHERE deleted_at IS NULL AND submitted_at IS NOT NULL;
CREATE INDEX idx_shifts_google_calendar_event ON public.shifts(google_calendar_event_id) WHERE google_calendar_event_id IS NOT NULL;
CREATE INDEX idx_shifts_pending_approval ON public.shifts(project_id, status) WHERE deleted_at IS NULL AND status = 'SUBMITTED';

-- shift_approval_history
CREATE INDEX idx_shift_approval_history_shift ON public.shift_approval_history(shift_id);
CREATE INDEX idx_shift_approval_history_performed_by ON public.shift_approval_history(performed_by);
CREATE INDEX idx_shift_approval_history_performed_at ON public.shift_approval_history(performed_at);

-- ========== RLS 有効化 ==========
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_approval_history ENABLE ROW LEVEL SECURITY;

-- ========== shifts RLS ポリシー ==========
CREATE POLICY "Admins can view all shifts" ON public.shifts
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can insert shifts" ON public.shifts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update shifts" ON public.shifts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete shifts" ON public.shifts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Staff: 自分のシフトのみ閲覧可能
CREATE POLICY "Staff can view own shifts" ON public.shifts
  FOR SELECT USING (
    deleted_at IS NULL
    AND staff_id IN (
      SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid()
    )
  );

-- Staff: 自分のシフトを作成・更新可能
CREATE POLICY "Staff can insert own shifts" ON public.shifts
  FOR INSERT WITH CHECK (
    staff_id IN (
      SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can update own shifts" ON public.shifts
  FOR UPDATE USING (
    staff_id IN (
      SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    staff_id IN (
      SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages shifts" ON public.shifts
  FOR ALL USING (auth.role() = 'service_role');

-- ========== shift_approval_history RLS ポリシー ==========
CREATE POLICY "Admins can view all approval history" ON public.shift_approval_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can insert approval history" ON public.shift_approval_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Staff: 自分のシフトの承認履歴を閲覧可能
CREATE POLICY "Staff can view own shift approval history" ON public.shift_approval_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shifts sh
      JOIN public.staff s ON sh.staff_id = s.id
      WHERE sh.id = shift_approval_history.shift_id
        AND s.user_id = auth.uid()
        AND sh.deleted_at IS NULL
    )
  );

CREATE POLICY "Service role manages approval history" ON public.shift_approval_history
  FOR ALL USING (auth.role() = 'service_role');
-- ============================================================
-- 00006_create_reports.sql
-- 業務報告・勤務実績レポート
-- ============================================================

-- 業務報告ステータス
CREATE TYPE public.report_status AS ENUM (
  'draft',           -- 下書き
  'submitted',       -- 提出済み
  'reviewing',       -- レビュー中
  'approved',        -- 承認済み
  'rejected',        -- 差し戻し
  'revised'          -- 修正済み
);

-- レポート期間種別
CREATE TYPE public.report_period_type AS ENUM (
  'daily',           -- 日次
  'weekly',          -- 週次
  'biweekly',        -- 隔週
  'monthly'          -- 月次
);

-- ========== 業務報告テーブル ==========
CREATE TABLE public.work_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,

  -- レポート内容
  report_date DATE NOT NULL,                 -- 報告対象日
  status public.report_status NOT NULL DEFAULT 'draft',
  title TEXT,                                -- タイトル
  content TEXT,                              -- 報告内容 (Markdown)
  achievements JSONB DEFAULT '[]'::jsonb,    -- 成果・実績リスト
  issues JSONB DEFAULT '[]'::jsonb,          -- 課題・問題リスト
  next_actions JSONB DEFAULT '[]'::jsonb,    -- 次回アクション

  -- 添付ファイル
  attachments JSONB DEFAULT '[]'::jsonb,     -- [{url, filename, size, mime_type}]

  -- 承認情報
  submitted_at TIMESTAMPTZ,                  -- 提出日時
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,                   -- レビュー日時
  review_comment TEXT,                       -- レビューコメント
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,                   -- 承認日時

  -- メタデータ
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- updated_at トリガー
CREATE TRIGGER work_reports_updated_at
  BEFORE UPDATE ON public.work_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== 勤務実績レポートテーブル (集計用) ==========
CREATE TABLE public.performance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,

  -- 期間
  period_type public.report_period_type NOT NULL DEFAULT 'monthly',
  period_start DATE NOT NULL,                -- 集計開始日
  period_end DATE NOT NULL,                  -- 集計終了日

  -- 勤務実績集計
  total_scheduled_hours NUMERIC(8, 2) DEFAULT 0,  -- 予定勤務時間合計
  total_actual_hours NUMERIC(8, 2) DEFAULT 0,     -- 実績勤務時間合計
  total_overtime_hours NUMERIC(8, 2) DEFAULT 0,   -- 残業時間合計
  total_night_hours NUMERIC(8, 2) DEFAULT 0,      -- 深夜勤務時間合計
  total_holiday_hours NUMERIC(8, 2) DEFAULT 0,    -- 休日勤務時間合計
  total_days_worked INTEGER DEFAULT 0,             -- 出勤日数
  total_days_absent INTEGER DEFAULT 0,             -- 欠勤日数
  total_days_late INTEGER DEFAULT 0,               -- 遅刻日数
  total_days_early_leave INTEGER DEFAULT 0,        -- 早退日数

  -- ステータス
  status public.report_status NOT NULL DEFAULT 'draft',
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,

  -- 備考
  notes TEXT,
  summary JSONB DEFAULT '{}'::jsonb,         -- AI生成サマリー等

  -- メタデータ
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- 同一スタッフ・期間の重複防止
  UNIQUE(staff_id, project_id, period_type, period_start, period_end)
);

-- updated_at トリガー
CREATE TRIGGER performance_reports_updated_at
  BEFORE UPDATE ON public.performance_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== インデックス ==========
-- work_reports
CREATE INDEX idx_work_reports_staff ON public.work_reports(staff_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_reports_project ON public.work_reports(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_reports_shift ON public.work_reports(shift_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_reports_date ON public.work_reports(report_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_reports_status ON public.work_reports(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_reports_staff_date ON public.work_reports(staff_id, report_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_reports_submitted ON public.work_reports(submitted_at) WHERE deleted_at IS NULL AND status = 'submitted';

-- performance_reports
CREATE INDEX idx_perf_reports_staff ON public.performance_reports(staff_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_perf_reports_project ON public.performance_reports(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_perf_reports_period ON public.performance_reports(period_start, period_end) WHERE deleted_at IS NULL;
CREATE INDEX idx_perf_reports_status ON public.performance_reports(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_perf_reports_type ON public.performance_reports(period_type) WHERE deleted_at IS NULL;

-- RLS 有効化
ALTER TABLE public.work_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_reports ENABLE ROW LEVEL SECURITY;

-- ========== work_reports RLS ポリシー ==========
CREATE POLICY "Admins can view all work reports" ON public.work_reports
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can insert work reports" ON public.work_reports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update work reports" ON public.work_reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete work reports" ON public.work_reports
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Staff: 自分の報告を閲覧・作成・更新可能
CREATE POLICY "Staff can view own work reports" ON public.work_reports
  FOR SELECT USING (
    deleted_at IS NULL
    AND staff_id IN (
      SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can insert own work reports" ON public.work_reports
  FOR INSERT WITH CHECK (
    staff_id IN (
      SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can update own draft reports" ON public.work_reports
  FOR UPDATE USING (
    staff_id IN (
      SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid()
    )
    AND status IN ('draft', 'rejected', 'revised')
  );

CREATE POLICY "Service role manages work reports" ON public.work_reports
  FOR ALL USING (auth.role() = 'service_role');

-- ========== performance_reports RLS ポリシー ==========
CREATE POLICY "Admins can view all performance reports" ON public.performance_reports
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can insert performance reports" ON public.performance_reports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update performance reports" ON public.performance_reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Staff: 自分の実績レポートのみ閲覧可能
CREATE POLICY "Staff can view own performance reports" ON public.performance_reports
  FOR SELECT USING (
    deleted_at IS NULL
    AND staff_id IN (
      SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages performance reports" ON public.performance_reports
  FOR ALL USING (auth.role() = 'service_role');
-- ============================================================
-- 00007_create_payments.sql
-- 給与計算・支払い管理
-- ============================================================

-- 支払い計算ステータス
CREATE TYPE public.payment_calc_status AS ENUM (
  'draft',           -- 下書き (計算中)
  'calculated',      -- 計算済み
  'reviewing',       -- レビュー中
  'confirmed',       -- 確定
  'issued',          -- 支払い済み
  'cancelled'        -- キャンセル
);

-- 支払い明細種別
CREATE TYPE public.payment_line_type AS ENUM (
  'base_pay',        -- 基本給
  'overtime_pay',    -- 残業手当
  'night_pay',       -- 深夜手当
  'holiday_pay',     -- 休日手当
  'transportation',  -- 交通費
  'bonus',           -- 賞与
  'allowance',       -- その他手当
  'deduction',       -- 控除
  'tax',             -- 税金
  'insurance',       -- 保険料
  'adjustment',      -- 調整
  'other'            -- その他
);

-- ========== 支払い計算テーブル ==========
CREATE TABLE public.payment_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number TEXT NOT NULL UNIQUE,       -- 支払い番号
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,

  -- 対象期間
  period_start DATE NOT NULL,                -- 計算対象期間開始
  period_end DATE NOT NULL,                  -- 計算対象期間終了
  payment_date DATE,                         -- 支払い予定日

  -- 計算結果
  gross_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,    -- 総支給額
  deductions_amount NUMERIC(12, 2) NOT NULL DEFAULT 0, -- 控除額合計
  net_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,      -- 差引支給額
  currency TEXT DEFAULT 'JPY',

  -- 勤務実績サマリー
  total_hours NUMERIC(8, 2) DEFAULT 0,       -- 総勤務時間
  overtime_hours NUMERIC(8, 2) DEFAULT 0,    -- 残業時間
  night_hours NUMERIC(8, 2) DEFAULT 0,       -- 深夜時間
  holiday_hours NUMERIC(8, 2) DEFAULT 0,     -- 休日時間
  days_worked INTEGER DEFAULT 0,             -- 出勤日数

  -- ステータス
  status public.payment_calc_status NOT NULL DEFAULT 'draft',

  -- 確認・承認情報
  calculated_at TIMESTAMPTZ,                 -- 計算実行日時
  confirmed_by UUID REFERENCES public.users(id),
  confirmed_at TIMESTAMPTZ,                  -- 確定日時
  issued_at TIMESTAMPTZ,                     -- 支払い日時
  issued_by UUID REFERENCES public.users(id),

  -- 支払い情報
  bank_name TEXT,                            -- 振込先銀行
  bank_branch TEXT,                          -- 振込先支店
  bank_account_number TEXT,                  -- 振込先口座番号
  bank_account_holder TEXT,                  -- 振込先名義

  -- メタデータ
  notes TEXT,
  calculation_details JSONB DEFAULT '{}'::jsonb, -- 計算の詳細ログ
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- 同一スタッフ・期間の重複防止
  UNIQUE(staff_id, period_start, period_end)
);

-- updated_at トリガー
CREATE TRIGGER payment_calculations_updated_at
  BEFORE UPDATE ON public.payment_calculations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== 支払い明細テーブル ==========
CREATE TABLE public.payment_calculation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_calculation_id UUID NOT NULL REFERENCES public.payment_calculations(id) ON DELETE CASCADE,

  -- 明細情報
  line_type public.payment_line_type NOT NULL,
  description TEXT NOT NULL,                 -- 明細説明
  quantity NUMERIC(10, 2) DEFAULT 1,         -- 数量 (時間数等)
  unit_price NUMERIC(10, 2),                 -- 単価
  amount NUMERIC(12, 2) NOT NULL,            -- 金額 (正: 支給, 負: 控除)
  is_taxable BOOLEAN DEFAULT true,           -- 課税対象

  -- 参照
  project_id UUID REFERENCES public.projects(id),
  shift_id UUID REFERENCES public.shifts(id),
  compensation_rule_id UUID REFERENCES public.compensation_rules(id),

  -- 並び順
  sort_order INTEGER DEFAULT 0,

  -- メタデータ
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- updated_at トリガー
CREATE TRIGGER payment_calculation_lines_updated_at
  BEFORE UPDATE ON public.payment_calculation_lines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== インデックス ==========
-- payment_calculations
CREATE INDEX idx_payment_calc_staff ON public.payment_calculations(staff_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payment_calc_status ON public.payment_calculations(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_payment_calc_period ON public.payment_calculations(period_start, period_end) WHERE deleted_at IS NULL;
CREATE INDEX idx_payment_calc_payment_date ON public.payment_calculations(payment_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_payment_calc_number ON public.payment_calculations(payment_number);
CREATE INDEX idx_payment_calc_confirmed ON public.payment_calculations(confirmed_at) WHERE status = 'confirmed';

-- payment_calculation_lines
CREATE INDEX idx_payment_lines_calc ON public.payment_calculation_lines(payment_calculation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payment_lines_type ON public.payment_calculation_lines(line_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_payment_lines_project ON public.payment_calculation_lines(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_payment_lines_shift ON public.payment_calculation_lines(shift_id) WHERE shift_id IS NOT NULL;
CREATE INDEX idx_payment_lines_sort ON public.payment_calculation_lines(payment_calculation_id, sort_order);

-- RLS 有効化
ALTER TABLE public.payment_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_calculation_lines ENABLE ROW LEVEL SECURITY;

-- ========== payment_calculations RLS ポリシー ==========
CREATE POLICY "Admins can view all payments" ON public.payment_calculations
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can insert payments" ON public.payment_calculations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update payments" ON public.payment_calculations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete payments" ON public.payment_calculations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Staff: 自分の支払い情報のみ閲覧可能
CREATE POLICY "Staff can view own payments" ON public.payment_calculations
  FOR SELECT USING (
    deleted_at IS NULL
    AND staff_id IN (
      SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages payments" ON public.payment_calculations
  FOR ALL USING (auth.role() = 'service_role');

-- ========== payment_calculation_lines RLS ポリシー ==========
CREATE POLICY "Admins can view all payment lines" ON public.payment_calculation_lines
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can insert payment lines" ON public.payment_calculation_lines
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update payment lines" ON public.payment_calculation_lines
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete payment lines" ON public.payment_calculation_lines
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Staff: 自分の明細のみ閲覧可能
CREATE POLICY "Staff can view own payment lines" ON public.payment_calculation_lines
  FOR SELECT USING (
    deleted_at IS NULL
    AND payment_calculation_id IN (
      SELECT pc.id FROM public.payment_calculations pc
      JOIN public.staff s ON pc.staff_id = s.id
      WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages payment lines" ON public.payment_calculation_lines
  FOR ALL USING (auth.role() = 'service_role');
-- ============================================================
-- 00008_create_notifications.sql
-- 通知履歴管理
-- ============================================================

-- 通知チャネル
CREATE TYPE public.notification_channel AS ENUM (
  'email',           -- メール
  'sms',             -- SMS
  'line',            -- LINE
  'push',            -- プッシュ通知
  'in_app'           -- アプリ内通知
);

-- 通知ステータス
CREATE TYPE public.notification_status AS ENUM (
  'pending',         -- 送信待ち
  'sending',         -- 送信中
  'sent',            -- 送信済み
  'delivered',       -- 配信済み
  'read',            -- 既読
  'failed',          -- 失敗
  'cancelled'        -- キャンセル
);

-- 通知種別
CREATE TYPE public.notification_type AS ENUM (
  'contract_sent',       -- 契約書送信
  'contract_signed',     -- 契約書署名完了
  'shift_reminder',      -- シフトリマインダー
  'shift_change',        -- シフト変更通知
  'report_submitted',    -- 業務報告提出
  'report_approved',     -- 業務報告承認
  'report_rejected',     -- 業務報告差し戻し
  'payment_confirmed',   -- 給与確定通知
  'payment_issued',      -- 給与支払い完了
  'assignment_new',      -- 新規アサイン通知
  'retirement_started',  -- 退職手続き開始
  'alert',               -- アラート通知
  'system',              -- システム通知
  'custom'               -- カスタム通知
);

-- ========== 通知履歴テーブル ==========
CREATE TABLE public.notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 宛先
  recipient_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  recipient_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  recipient_email TEXT,                      -- 送信先メールアドレス
  recipient_phone TEXT,                      -- 送信先電話番号

  -- 通知情報
  notification_type public.notification_type NOT NULL,
  channel public.notification_channel NOT NULL,
  status public.notification_status NOT NULL DEFAULT 'pending',

  -- コンテンツ
  subject TEXT,                              -- 件名
  body_text TEXT,                            -- 本文 (テキスト)
  body_html TEXT,                            -- 本文 (HTML)
  template_id TEXT,                          -- 使用テンプレートID
  template_variables JSONB DEFAULT '{}'::jsonb, -- テンプレート変数

  -- 関連リソース
  resource_type TEXT,                        -- 関連リソース種別 (contract, shift, etc.)
  resource_id UUID,                          -- 関連リソースID

  -- 送信情報
  scheduled_at TIMESTAMPTZ,                  -- 予定送信日時
  sent_at TIMESTAMPTZ,                       -- 実際の送信日時
  delivered_at TIMESTAMPTZ,                  -- 配信日時
  read_at TIMESTAMPTZ,                       -- 既読日時
  failed_at TIMESTAMPTZ,                     -- 失敗日時
  failure_reason TEXT,                       -- 失敗理由

  -- リトライ情報
  retry_count INTEGER DEFAULT 0,             -- リトライ回数
  max_retries INTEGER DEFAULT 3,             -- 最大リトライ回数
  next_retry_at TIMESTAMPTZ,                 -- 次回リトライ日時

  -- 外部連携
  external_message_id TEXT,                  -- 外部サービスのメッセージID
  external_response JSONB,                   -- 外部サービスのレスポンス

  -- メタデータ
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at トリガー
CREATE TRIGGER notification_history_updated_at
  BEFORE UPDATE ON public.notification_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== インデックス ==========
CREATE INDEX idx_notifications_recipient_user ON public.notification_history(recipient_user_id) WHERE recipient_user_id IS NOT NULL;
CREATE INDEX idx_notifications_recipient_staff ON public.notification_history(recipient_staff_id) WHERE recipient_staff_id IS NOT NULL;
CREATE INDEX idx_notifications_type ON public.notification_history(notification_type);
CREATE INDEX idx_notifications_channel ON public.notification_history(channel);
CREATE INDEX idx_notifications_status ON public.notification_history(status);
CREATE INDEX idx_notifications_created ON public.notification_history(created_at);
CREATE INDEX idx_notifications_scheduled ON public.notification_history(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_notifications_resource ON public.notification_history(resource_type, resource_id) WHERE resource_id IS NOT NULL;
CREATE INDEX idx_notifications_retry ON public.notification_history(next_retry_at) WHERE status = 'failed' AND retry_count < max_retries;
CREATE INDEX idx_notifications_user_unread ON public.notification_history(recipient_user_id, read_at) WHERE read_at IS NULL AND status IN ('sent', 'delivered');

-- RLS 有効化
ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

-- ========== notification_history RLS ポリシー ==========
CREATE POLICY "Admins can view all notifications" ON public.notification_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can insert notifications" ON public.notification_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update notifications" ON public.notification_history
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Staff: 自分宛ての通知のみ閲覧可能
CREATE POLICY "Users can view own notifications" ON public.notification_history
  FOR SELECT USING (
    recipient_user_id = auth.uid()
  );

-- Staff: 自分の通知を既読にできる
CREATE POLICY "Users can mark own notifications read" ON public.notification_history
  FOR UPDATE USING (
    recipient_user_id = auth.uid()
  )
  WITH CHECK (
    recipient_user_id = auth.uid()
  );

CREATE POLICY "Service role manages notifications" ON public.notification_history
  FOR ALL USING (auth.role() = 'service_role');
-- ============================================================
-- 00009_create_retirement.sql
-- 退職手続き管理
-- ============================================================

-- 退職理由
CREATE TYPE public.retirement_reason AS ENUM (
  'voluntary',       -- 自己都合
  'company',         -- 会社都合
  'contract_end',    -- 契約満了
  'mutual',          -- 合意退職
  'retirement_age',  -- 定年退職
  'other'            -- その他
);

-- 退職手続きステータス
CREATE TYPE public.retirement_status AS ENUM (
  'initiated',       -- 開始
  'documents_pending', -- 書類待ち
  'in_progress',     -- 手続き中
  'final_payment',   -- 最終給与処理
  'completed',       -- 完了
  'cancelled'        -- キャンセル
);

-- ========== 退職記録テーブル ==========
CREATE TABLE public.retirement_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,

  -- 退職情報
  status public.retirement_status NOT NULL DEFAULT 'initiated',
  reason public.retirement_reason NOT NULL,
  reason_detail TEXT,                        -- 退職理由詳細
  resignation_date DATE,                     -- 退職届提出日
  last_working_date DATE NOT NULL,           -- 最終出勤日
  effective_date DATE NOT NULL,              -- 退職日 (退職効力発生日)

  -- チェックリスト (手続き進捗)
  checklist JSONB DEFAULT '{
    "resignation_letter_received": false,
    "equipment_returned": false,
    "access_revoked": false,
    "final_payment_calculated": false,
    "documents_issued": false,
    "exit_interview_done": false,
    "insurance_processed": false,
    "pension_processed": false
  }'::jsonb,

  -- 最終給与情報
  final_payment_id UUID REFERENCES public.payment_calculations(id),
  outstanding_amount NUMERIC(12, 2) DEFAULT 0, -- 未精算額
  severance_amount NUMERIC(12, 2) DEFAULT 0,   -- 退職金
  paid_leave_remaining INTEGER DEFAULT 0,       -- 残有給日数
  paid_leave_buyout NUMERIC(12, 2) DEFAULT 0,  -- 有給買取額

  -- 退職後連絡先
  forwarding_email TEXT,                     -- 転送先メール
  forwarding_phone TEXT,                     -- 転送先電話
  forwarding_address TEXT,                   -- 転送先住所

  -- 書類発行
  documents_issued JSONB DEFAULT '[]'::jsonb, -- 発行済み書類リスト
  -- [{type: "離職票", issued_at: "...", sent_at: "..."}]

  -- メタデータ
  notes TEXT,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  processed_by UUID REFERENCES public.users(id), -- 手続き担当者
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- updated_at トリガー
CREATE TRIGGER retirement_records_updated_at
  BEFORE UPDATE ON public.retirement_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== インデックス ==========
CREATE INDEX idx_retirement_staff ON public.retirement_records(staff_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_retirement_status ON public.retirement_records(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_retirement_effective_date ON public.retirement_records(effective_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_retirement_last_working ON public.retirement_records(last_working_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_retirement_reason ON public.retirement_records(reason) WHERE deleted_at IS NULL;
CREATE INDEX idx_retirement_in_progress ON public.retirement_records(status)
  WHERE deleted_at IS NULL AND status NOT IN ('completed', 'cancelled');

-- RLS 有効化
ALTER TABLE public.retirement_records ENABLE ROW LEVEL SECURITY;

-- ========== retirement_records RLS ポリシー ==========
CREATE POLICY "Admins can view all retirement records" ON public.retirement_records
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can insert retirement records" ON public.retirement_records
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update retirement records" ON public.retirement_records
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete retirement records" ON public.retirement_records
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Staff: 自分の退職記録のみ閲覧可能
CREATE POLICY "Staff can view own retirement records" ON public.retirement_records
  FOR SELECT USING (
    deleted_at IS NULL
    AND staff_id IN (
      SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages retirement records" ON public.retirement_records
  FOR ALL USING (auth.role() = 'service_role');
-- ============================================================
-- 00010_create_custom_fields.sql
-- カスタムフィールド定義
-- ============================================================

-- カスタムフィールドのデータ型
CREATE TYPE public.custom_field_type AS ENUM (
  'text',            -- テキスト
  'number',          -- 数値
  'date',            -- 日付
  'datetime',        -- 日時
  'boolean',         -- 真偽値
  'select',          -- 単一選択
  'multiselect',     -- 複数選択
  'url',             -- URL
  'email',           -- メール
  'phone',           -- 電話番号
  'file',            -- ファイル
  'json'             -- JSON
);

-- ========== カスタムフィールド定義テーブル ==========
CREATE TABLE public.custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- フィールド情報
  entity_type TEXT NOT NULL,                 -- 適用対象エンティティ (staff, projects, contracts, etc.)
  field_key TEXT NOT NULL,                   -- フィールドキー (プログラム用)
  field_label TEXT NOT NULL,                 -- 表示ラベル
  field_type public.custom_field_type NOT NULL DEFAULT 'text',
  description TEXT,                          -- フィールド説明

  -- バリデーション
  is_required BOOLEAN NOT NULL DEFAULT false, -- 必須フラグ
  default_value TEXT,                        -- デフォルト値
  validation_rules JSONB DEFAULT '{}'::jsonb, -- バリデーションルール
  -- {min, max, pattern, min_length, max_length, etc.}

  -- 選択肢 (select / multiselect 用)
  options JSONB DEFAULT '[]'::jsonb,         -- [{value, label, color}]

  -- 表示設定
  sort_order INTEGER NOT NULL DEFAULT 0,     -- 表示順
  is_visible BOOLEAN NOT NULL DEFAULT true,  -- 表示フラグ
  is_filterable BOOLEAN NOT NULL DEFAULT false, -- フィルター対象
  is_searchable BOOLEAN NOT NULL DEFAULT false, -- 検索対象
  display_width TEXT DEFAULT 'full',         -- 表示幅 (full, half, third)

  -- メタデータ
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- 同一エンティティでのフィールドキー重複防止
  UNIQUE(entity_type, field_key)
);

-- updated_at トリガー
CREATE TRIGGER custom_field_definitions_updated_at
  BEFORE UPDATE ON public.custom_field_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== インデックス ==========
CREATE INDEX idx_custom_fields_entity ON public.custom_field_definitions(entity_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_custom_fields_key ON public.custom_field_definitions(entity_type, field_key) WHERE deleted_at IS NULL;
CREATE INDEX idx_custom_fields_sort ON public.custom_field_definitions(entity_type, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_custom_fields_visible ON public.custom_field_definitions(entity_type, is_visible) WHERE deleted_at IS NULL;
CREATE INDEX idx_custom_fields_filterable ON public.custom_field_definitions(entity_type)
  WHERE deleted_at IS NULL AND is_filterable = true;

-- RLS 有効化
ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;

-- ========== custom_field_definitions RLS ポリシー ==========
-- 全認証ユーザーが閲覧可能 (フォーム表示に必要)
CREATE POLICY "Authenticated can view custom fields" ON public.custom_field_definitions
  FOR SELECT USING (
    deleted_at IS NULL
    AND auth.role() = 'authenticated'
  );

-- Admin のみ作成・更新・削除可能
CREATE POLICY "Admins can insert custom fields" ON public.custom_field_definitions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update custom fields" ON public.custom_field_definitions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete custom fields" ON public.custom_field_definitions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Service role manages custom fields" ON public.custom_field_definitions
  FOR ALL USING (auth.role() = 'service_role');
-- ============================================================
-- 00011_create_audit_log.sql
-- 監査ログ・変更履歴
-- ============================================================

-- 操作種別
CREATE TYPE public.audit_action AS ENUM (
  'create',          -- 作成
  'update',          -- 更新
  'delete',          -- 削除 (論理削除)
  'restore',         -- 復元
  'login',           -- ログイン
  'logout',          -- ログアウト
  'export',          -- エクスポート
  'import',          -- インポート
  'approve',         -- 承認
  'reject',          -- 却下
  'send',            -- 送信
  'sign',            -- 署名
  'calculate',       -- 計算
  'confirm',         -- 確定
  'assign',          -- アサイン
  'unassign'         -- アサイン解除
);

-- ========== 監査ログテーブル ==========
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 操作者情報
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_email TEXT,                           -- 操作者メール (ユーザー削除時のため冗長保持)
  user_display_name TEXT,                    -- 操作者名 (冗長保持)
  ip_address TEXT,                           -- IPアドレス
  user_agent TEXT,                           -- ユーザーエージェント

  -- 操作内容
  action public.audit_action NOT NULL,
  resource_type TEXT NOT NULL,               -- リソース種別 (staff, contracts, etc.)
  resource_id UUID,                          -- リソースID
  resource_label TEXT,                       -- リソース表示名 (検索用)

  -- 変更内容
  old_values JSONB,                          -- 変更前の値
  new_values JSONB,                          -- 変更後の値
  changed_fields TEXT[],                     -- 変更されたフィールド名リスト
  description TEXT,                          -- 操作の説明

  -- コンテキスト
  session_id TEXT,                           -- セッションID
  request_id TEXT,                           -- リクエストID
  metadata JSONB DEFAULT '{}'::jsonb,        -- 追加メタデータ

  -- タイムスタンプ
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== インデックス ==========
CREATE INDEX idx_audit_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_action ON public.audit_logs(action);
CREATE INDEX idx_audit_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_resource_type ON public.audit_logs(resource_type);
CREATE INDEX idx_audit_created ON public.audit_logs(created_at);
CREATE INDEX idx_audit_created_desc ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_user_created ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_resource_created ON public.audit_logs(resource_type, resource_id, created_at DESC);
CREATE INDEX idx_audit_ip ON public.audit_logs(ip_address) WHERE ip_address IS NOT NULL;
CREATE INDEX idx_audit_changed_fields ON public.audit_logs USING gin(changed_fields) WHERE changed_fields IS NOT NULL;

-- RLS 有効化
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ========== audit_logs RLS ポリシー ==========
-- Owner のみ閲覧可能
CREATE POLICY "Owners can view all audit logs" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'owner'
    )
  );

-- Admin は自分のリソースに関するログのみ閲覧可能
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
  );

-- 監査ログは挿入のみ (更新・削除不可) - service_role 経由
CREATE POLICY "Service role can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can read audit logs" ON public.audit_logs
  FOR SELECT USING (auth.role() = 'service_role');

-- ========== 汎用監査トリガー関数 ==========
-- 任意のテーブルにアタッチして自動監査ログを記録
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  _old_values JSONB;
  _new_values JSONB;
  _changed_fields TEXT[];
  _action public.audit_action;
  _resource_id UUID;
  _user_id UUID;
  _key TEXT;
BEGIN
  -- 操作種別の判定
  IF TG_OP = 'INSERT' THEN
    _action := 'create';
    _new_values := to_jsonb(NEW);
    _resource_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- 論理削除の検出
    IF NEW.deleted_at IS NOT NULL AND (OLD.deleted_at IS NULL) THEN
      _action := 'delete';
    ELSIF OLD.deleted_at IS NOT NULL AND (NEW.deleted_at IS NULL) THEN
      _action := 'restore';
    ELSE
      _action := 'update';
    END IF;

    _old_values := to_jsonb(OLD);
    _new_values := to_jsonb(NEW);
    _resource_id := NEW.id;

    -- 変更フィールドの検出
    _changed_fields := ARRAY[]::TEXT[];
    FOR _key IN SELECT jsonb_object_keys(_new_values)
    LOOP
      IF _key NOT IN ('updated_at', 'updated_by') THEN
        IF (_old_values ->> _key) IS DISTINCT FROM (_new_values ->> _key) THEN
          _changed_fields := array_append(_changed_fields, _key);
        END IF;
      END IF;
    END LOOP;
  ELSIF TG_OP = 'DELETE' THEN
    _action := 'delete';
    _old_values := to_jsonb(OLD);
    _resource_id := OLD.id;
  END IF;

  -- 現在のユーザーIDを取得 (auth.uid() が NULL の場合は service_role)
  BEGIN
    _user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    _user_id := NULL;
  END;

  -- 監査ログ挿入
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    old_values,
    new_values,
    changed_fields,
    description
  ) VALUES (
    _user_id,
    _action,
    TG_TABLE_NAME,
    _resource_id,
    _old_values,
    _new_values,
    _changed_fields,
    TG_OP || ' on ' || TG_TABLE_NAME
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========== 主要テーブルに監査トリガーをアタッチ ==========
CREATE TRIGGER audit_staff
  AFTER INSERT OR UPDATE OR DELETE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_contracts
  AFTER INSERT OR UPDATE OR DELETE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_projects
  AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_project_assignments
  AFTER INSERT OR UPDATE OR DELETE ON public.project_assignments
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_shifts
  AFTER INSERT OR UPDATE OR DELETE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_payment_calculations
  AFTER INSERT OR UPDATE OR DELETE ON public.payment_calculations
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_retirement_records
  AFTER INSERT OR UPDATE OR DELETE ON public.retirement_records
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();
-- ============================================================
-- 00012_create_alerts.sql
-- アラート管理
-- ============================================================

-- アラート重要度
CREATE TYPE public.alert_severity AS ENUM (
  'info',            -- 情報
  'warning',         -- 警告
  'error',           -- エラー
  'critical'         -- 緊急
);

-- アラートステータス
CREATE TYPE public.alert_status AS ENUM (
  'active',          -- 有効
  'acknowledged',    -- 確認済み
  'resolved',        -- 解決済み
  'dismissed',       -- 却下
  'expired'          -- 期限切れ
);

-- アラートカテゴリ
CREATE TYPE public.alert_category AS ENUM (
  'contract_expiry',       -- 契約期限
  'shift_anomaly',         -- シフト異常
  'report_overdue',        -- 報告遅延
  'payment_pending',       -- 支払い未処理
  'attendance_issue',      -- 勤怠問題
  'assignment_gap',        -- アサイン空白
  'retirement_pending',    -- 退職手続き未完了
  'system_error',          -- システムエラー
  'compliance',            -- コンプライアンス
  'custom'                 -- カスタム
);

-- ========== アラートテーブル ==========
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- アラート情報
  title TEXT NOT NULL,                       -- アラートタイトル
  message TEXT NOT NULL,                     -- アラートメッセージ
  category public.alert_category NOT NULL,
  severity public.alert_severity NOT NULL DEFAULT 'info',
  status public.alert_status NOT NULL DEFAULT 'active',

  -- 対象
  target_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- 対象ユーザー
  target_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL, -- 対象スタッフ

  -- 関連リソース
  resource_type TEXT,                        -- 関連リソース種別
  resource_id UUID,                          -- 関連リソースID
  action_url TEXT,                           -- アクションURL (対応画面へのリンク)

  -- アラート条件
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- 発生日時
  due_date DATE,                             -- 対応期限
  auto_resolve_at TIMESTAMPTZ,               -- 自動解決日時

  -- 対応情報
  acknowledged_by UUID REFERENCES public.users(id),
  acknowledged_at TIMESTAMPTZ,               -- 確認日時
  resolved_by UUID REFERENCES public.users(id),
  resolved_at TIMESTAMPTZ,                   -- 解決日時
  resolution_note TEXT,                      -- 解決メモ
  dismissed_by UUID REFERENCES public.users(id),
  dismissed_at TIMESTAMPTZ,                  -- 却下日時

  -- メタデータ
  metadata JSONB DEFAULT '{}'::jsonb,        -- 追加データ (閾値, 検出値など)
  is_recurring BOOLEAN DEFAULT false,        -- 繰り返しアラート
  recurrence_key TEXT,                       -- 繰り返しキー (重複防止用)
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- updated_at トリガー
CREATE TRIGGER alerts_updated_at
  BEFORE UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== インデックス ==========
CREATE INDEX idx_alerts_status ON public.alerts(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_alerts_severity ON public.alerts(severity) WHERE deleted_at IS NULL AND status = 'active';
CREATE INDEX idx_alerts_category ON public.alerts(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_alerts_target_user ON public.alerts(target_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_alerts_target_staff ON public.alerts(target_staff_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_alerts_resource ON public.alerts(resource_type, resource_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_alerts_triggered ON public.alerts(triggered_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_alerts_due_date ON public.alerts(due_date) WHERE deleted_at IS NULL AND status = 'active';
CREATE INDEX idx_alerts_auto_resolve ON public.alerts(auto_resolve_at) WHERE deleted_at IS NULL AND status = 'active' AND auto_resolve_at IS NOT NULL;
CREATE INDEX idx_alerts_recurrence ON public.alerts(recurrence_key) WHERE recurrence_key IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_alerts_active_severity ON public.alerts(severity, triggered_at DESC) WHERE deleted_at IS NULL AND status = 'active';

-- RLS 有効化
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- ========== alerts RLS ポリシー ==========
CREATE POLICY "Admins can view all alerts" ON public.alerts
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can insert alerts" ON public.alerts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update alerts" ON public.alerts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete alerts" ON public.alerts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Staff: 自分宛てのアラートのみ閲覧可能
CREATE POLICY "Users can view own alerts" ON public.alerts
  FOR SELECT USING (
    deleted_at IS NULL
    AND target_user_id = auth.uid()
  );

-- Staff: 自分宛てのアラートを確認・却下可能
CREATE POLICY "Users can acknowledge own alerts" ON public.alerts
  FOR UPDATE USING (
    target_user_id = auth.uid()
  )
  WITH CHECK (
    target_user_id = auth.uid()
  );

CREATE POLICY "Service role manages alerts" ON public.alerts
  FOR ALL USING (auth.role() = 'service_role');
-- PJ向け見積書
CREATE TABLE project_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  estimate_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_address TEXT,
  client_contact_person TEXT,
  client_email TEXT,
  description TEXT,
  items JSONB NOT NULL DEFAULT '[]', -- [{name, description, quantity, unit, unit_price, amount}]
  subtotal NUMERIC(12,0) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  tax_amount NUMERIC(12,0) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,0) NOT NULL DEFAULT 0,
  valid_until DATE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','rejected','expired')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PJ向け契約書（スタッフ契約とは別）
CREATE TABLE project_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  estimate_id UUID REFERENCES project_estimates(id),
  contract_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_address TEXT,
  client_contact_person TEXT,
  client_email TEXT,
  content TEXT, -- 契約本文
  items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC(12,0) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  tax_amount NUMERIC(12,0) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,0) NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  payment_terms TEXT, -- 支払条件
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_signature','signed','active','expired','terminated')),
  external_sign_id TEXT, -- freee Sign document ID
  signed_at TIMESTAMPTZ,
  signed_document_url TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PJ向け請求書
CREATE TABLE project_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES project_contracts(id),
  invoice_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_address TEXT,
  client_contact_person TEXT,
  client_email TEXT,
  description TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC(12,0) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  tax_amount NUMERIC(12,0) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,0) NOT NULL DEFAULT 0,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  payment_method TEXT, -- 振込先情報
  bank_info TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_estimates_project ON project_estimates(project_id);
CREATE INDEX idx_project_contracts_project ON project_contracts(project_id);
CREATE INDEX idx_project_invoices_project ON project_invoices(project_id);
-- ============================================================
-- 00014_add_shift_approval_mode.sql
-- 案件テーブルにシフト承認モードを追加
-- ============================================================

-- シフト承認モード: AUTO (自動承認) / APPROVAL (承認フロー)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS shift_approval_mode TEXT NOT NULL DEFAULT 'AUTO';

-- コメント
COMMENT ON COLUMN public.projects.shift_approval_mode IS 'シフト承認モード: AUTO=自動承認, APPROVAL=承認フロー必須';
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
