-- ============================================================================
-- Migration: 00020_my_number_handler_permission
-- Purpose: マイナンバー担当者専用権限の追加
-- マイナンバー法（行政手続における特定の個人を識別するための番号の利用等に関する法律）
-- 第12条: 特定個人情報の提供制限
-- 第29条: 特定個人情報の安全管理措置
-- ============================================================================

-- ============================================================================
-- 1. マイナンバー関連の権限を追加
-- ============================================================================

INSERT INTO public.permissions (resource, action) VALUES
  ('my_number', 'read'),     -- マイナンバー関連書類の閲覧
  ('my_number', 'update')    -- マイナンバー関連書類の更新・アップロード
ON CONFLICT (resource, action, scope) DO NOTHING;

-- ============================================================================
-- 2. ownerロールには自動付与しない（ownerはcheckPermissionで全権限持ち）
--    adminロールにもデフォルトでは付与しない（マイナンバー担当者のみ）
--    → 個別のユーザーにのみ付与する運用
-- ============================================================================

-- NOTE: マイナンバー担当者への権限付与は以下のSQLで個別に行う:
--
-- -- 1. まず担当者のuser_idを確認
-- SELECT u.id, u.email, u.display_name FROM public.users u WHERE u.email = 'tantousha@canvi.co.jp';
--
-- -- 2. my_number権限のIDを取得
-- SELECT id FROM public.permissions WHERE resource = 'my_number' AND action = 'read';
--
-- -- 3. ユーザーに直接権限を付与（user_permissionsテーブル経由）
-- ※ 現在のRBACはロール経由のみなので、下記の専用テーブルを作成

-- ============================================================================
-- 3. ユーザー個別権限テーブル（マイナンバー担当者指定用）
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_permissions (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID REFERENCES public.users(id),
  reason TEXT,  -- 付与理由（監査証跡用）
  expires_at TIMESTAMPTZ,  -- 有効期限（任意）
  PRIMARY KEY (user_id, permission_id)
);

-- RLS有効化
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- ポリシー: ownerのみ閲覧・管理可能
CREATE POLICY "Owners can manage user_permissions" ON public.user_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'owner'
    )
  );

-- ポリシー: 自分の権限は閲覧可能
CREATE POLICY "Users can view own permissions" ON public.user_permissions
  FOR SELECT USING (user_id = auth.uid());

-- ポリシー: service_roleはフルアクセス
CREATE POLICY "Service role manages user_permissions" ON public.user_permissions
  FOR ALL USING (auth.role() = 'service_role');

-- インデックス
CREATE INDEX idx_user_permissions_user_id ON public.user_permissions(user_id);
CREATE INDEX idx_user_permissions_permission_id ON public.user_permissions(permission_id);

-- ============================================================================
-- 4. 監査ログトリガー（マイナンバー権限の付与・削除を記録）
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_user_permissions_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (
      user_id, action, resource, resource_id,
      new_data, description
    ) VALUES (
      NEW.granted_by,
      'create',
      'user_permissions',
      NEW.user_id,
      jsonb_build_object(
        'permission_id', NEW.permission_id,
        'reason', NEW.reason,
        'expires_at', NEW.expires_at
      ),
      'マイナンバー担当者権限の付与'
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (
      user_id, action, resource, resource_id,
      old_data, description
    ) VALUES (
      auth.uid(),
      'delete',
      'user_permissions',
      OLD.user_id,
      jsonb_build_object(
        'permission_id', OLD.permission_id,
        'reason', OLD.reason
      ),
      'マイナンバー担当者権限の削除'
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER user_permissions_audit
  AFTER INSERT OR DELETE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION audit_user_permissions_change();

-- ============================================================================
-- 5. コメント
-- ============================================================================

COMMENT ON TABLE public.user_permissions IS
  'ユーザー個別権限 - マイナンバー法に基づく特定個人情報取扱担当者の指定に使用。ownerのみ管理可能。';

COMMENT ON COLUMN public.user_permissions.reason IS
  '権限付与理由 - マイナンバー法の安全管理措置として記録が義務付けられている';

COMMENT ON COLUMN public.user_permissions.expires_at IS
  '有効期限 - 定期的な見直しのため設定を推奨（例: 1年後）';
