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
