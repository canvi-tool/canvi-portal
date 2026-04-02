-- ============================================================================
-- Migration: 00019_security_hardening
-- Purpose: セキュリティ強化 - マイナンバー法・個人情報保護法準拠
-- ============================================================================

-- ============================================================================
-- 1. Storage バケットRLSポリシー（本人確認書類の保護）
-- ============================================================================

-- staff-documents バケットが存在しない場合は作成（PRIVATE）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'staff-documents',
  'staff-documents',
  false,  -- PRIVATE: 署名付きURLでのみアクセス可能
  10485760,  -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,  -- 確実にPRIVATEに設定
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- 既存ポリシーがあれば削除して再作成
DROP POLICY IF EXISTS "Admins can view staff documents" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete staff documents" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access to staff documents" ON storage.objects;

-- RLS有効化（storage.objectsは通常デフォルトで有効）
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- owner/admin: 全スタッフの書類を閲覧可能
CREATE POLICY "Admins can view staff documents" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'staff-documents'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- スタッフ: 自分の書類のみアップロード可能（オンボーディング時）
CREATE POLICY "Staff can upload own documents" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'staff-documents'
    AND (
      -- service_roleは常に許可
      auth.role() = 'service_role'
      OR
      -- owner/adminは全許可
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
      )
    )
  );

-- owner/admin: 書類の削除権限
CREATE POLICY "Admins can delete staff documents" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'staff-documents'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- service_role: フルアクセス（バックエンドAPI用）
CREATE POLICY "Service role full access to staff documents" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'staff-documents'
    AND auth.role() = 'service_role'
  );

-- ============================================================================
-- 2. 監査ログの機密データアクセス記録用カラム追加
-- ============================================================================

-- 機密データアクセスの種別を記録（既存のaction enumに追加は不要、metadataで対応）
COMMENT ON TABLE public.audit_logs IS
  '監査ログ - マイナンバー法安全管理措置に基づくアクセス記録。保存期間: 7年間';

-- ============================================================================
-- 3. staffテーブルの機密フィールドにコメント追加（データ分類）
-- ============================================================================

COMMENT ON COLUMN public.staff.date_of_birth IS '生年月日 - 特定個人情報（要暗号化対象）';
COMMENT ON COLUMN public.staff.bank_account_number IS '銀行口座番号 - 機密情報（要暗号化対象）';
COMMENT ON COLUMN public.staff.bank_account_holder IS '口座名義 - 機密情報';
COMMENT ON COLUMN public.staff.postal_code IS '郵便番号 - 個人情報';
COMMENT ON COLUMN public.staff.address_line1 IS '住所1 - 個人情報';
COMMENT ON COLUMN public.staff.address_line2 IS '住所2 - 個人情報';
COMMENT ON COLUMN public.staff.emergency_contact_name IS '緊急連絡先氏名 - 個人情報';
COMMENT ON COLUMN public.staff.emergency_contact_phone IS '緊急連絡先電話番号 - 個人情報';
COMMENT ON COLUMN public.staff.custom_fields IS 'カスタムフィールド - identity_documentキーは特定個人情報（本人確認書類参照）を含む';

-- ============================================================================
-- 4. セッション管理: auth.sessionsの有効期限短縮
-- ============================================================================

-- Supabase Dashboardで設定推奨:
-- JWT expiry: 3600 (1時間)
-- Refresh token lifetime: 86400 (24時間)
-- 以下はコメントとして記録
COMMENT ON SCHEMA auth IS
  'Supabase Auth - JWT有効期限: 3600秒(推奨), リフレッシュトークン: 86400秒(推奨)';
