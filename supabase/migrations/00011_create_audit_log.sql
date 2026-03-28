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
