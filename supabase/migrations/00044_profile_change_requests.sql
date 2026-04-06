-- 00044: プロフィール編集承認フロー
-- 1) profile_change_requests: プロフィール変更申請
-- 2) staff_emergency_contacts: 緊急連絡先の履歴テーブル（承認承認後、新規行として追加）

-- ============================================================
-- profile_change_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profile_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,

  -- 変更内容: { field_name: { from, to } }
  changes JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- 添付書類のURLリスト（Supabase Storage）
  attachment_urls TEXT[] NOT NULL DEFAULT '{}',

  -- 変更カテゴリ（添付要否判定用の情報）
  requires_identity_doc BOOLEAN NOT NULL DEFAULT FALSE,
  requires_address_doc BOOLEAN NOT NULL DEFAULT FALSE,
  requires_bank_holder_doc BOOLEAN NOT NULL DEFAULT FALSE,

  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),

  review_comment TEXT,
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profile_change_requests_status_idx
  ON public.profile_change_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS profile_change_requests_staff_idx
  ON public.profile_change_requests(staff_id, created_at DESC);

-- 1スタッフにつきPENDINGは1件だけ（新しく申請すると既存PENDINGは自動CANCELLEDされる想定）
CREATE UNIQUE INDEX IF NOT EXISTS profile_change_requests_unique_pending
  ON public.profile_change_requests(staff_id)
  WHERE status = 'PENDING';

ALTER TABLE public.profile_change_requests ENABLE ROW LEVEL SECURITY;

-- RLS: 自分の申請 or admin/owner/manager は閲覧可
DROP POLICY IF EXISTS "pcr_select" ON public.profile_change_requests;
CREATE POLICY "pcr_select" ON public.profile_change_requests
  FOR SELECT USING (
    requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('owner', 'admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = profile_change_requests.staff_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "pcr_insert" ON public.profile_change_requests;
CREATE POLICY "pcr_insert" ON public.profile_change_requests
  FOR INSERT WITH CHECK (requested_by = auth.uid());

-- ============================================================
-- staff_emergency_contacts: 緊急連絡先の履歴
-- 承認後、古い行を残して新しい行を is_current=true で追加
-- ============================================================
CREATE TABLE IF NOT EXISTS public.staff_emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  contact_name TEXT,
  contact_phone TEXT,
  contact_relation TEXT,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS staff_emergency_contacts_staff_idx
  ON public.staff_emergency_contacts(staff_id, is_current, effective_from DESC);

ALTER TABLE public.staff_emergency_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sec_select" ON public.staff_emergency_contacts;
CREATE POLICY "sec_select" ON public.staff_emergency_contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('owner', 'admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = staff_emergency_contacts.staff_id
        AND s.user_id = auth.uid()
    )
  );
