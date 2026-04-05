-- ============================================================
-- 00037_create_leave_management.sql
-- 有給休暇管理（付与・申請・承認）
-- ============================================================

-- ========== 有給付与テーブル ==========
CREATE TABLE public.leave_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  grant_date DATE NOT NULL,                          -- 付与日
  expiry_date DATE NOT NULL,                         -- 有効期限（付与日+2年）
  grant_type TEXT DEFAULT 'annual' CHECK (grant_type IN (
    'annual', 'special', 'compensatory'
  )),
  total_days NUMERIC(4,1) NOT NULL,                  -- 付与日数
  used_days NUMERIC(4,1) DEFAULT 0,                  -- 使用済み日数
  remaining_days NUMERIC(4,1) GENERATED ALWAYS AS (total_days - used_days) STORED,  -- 残日数（自動計算）
  note TEXT,                                         -- 備考
  created_by UUID REFERENCES auth.users(id),         -- 付与実行者
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== 有給申請テーブル ==========
CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  leave_grant_id UUID REFERENCES public.leave_grants(id),  -- 紐づく付与レコード
  start_date DATE NOT NULL,                          -- 開始日
  end_date DATE NOT NULL,                            -- 終了日
  leave_type TEXT NOT NULL CHECK (leave_type IN (
    'full_day', 'half_day_am', 'half_day_pm', 'hourly'
  )),
  hours NUMERIC(3,1),                                -- 時間単位の場合
  days NUMERIC(4,1) NOT NULL,                        -- 使用日数
  reason TEXT,                                       -- 申請理由
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'cancelled'
  )),
  approved_by UUID REFERENCES auth.users(id),        -- 承認者
  approved_at TIMESTAMPTZ,                           -- 承認日時
  approval_comment TEXT,                             -- 承認/却下コメント
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at トリガー
CREATE TRIGGER leave_requests_updated_at
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== インデックス ==========
-- leave_grants
CREATE INDEX idx_leave_grants_staff_id ON public.leave_grants(staff_id);
CREATE INDEX idx_leave_grants_grant_date ON public.leave_grants(grant_date);
CREATE INDEX idx_leave_grants_expiry_date ON public.leave_grants(expiry_date);
CREATE INDEX idx_leave_grants_staff_expiry ON public.leave_grants(staff_id, expiry_date);

-- leave_requests
CREATE INDEX idx_leave_requests_staff_id ON public.leave_requests(staff_id);
CREATE INDEX idx_leave_requests_leave_grant_id ON public.leave_requests(leave_grant_id);
CREATE INDEX idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX idx_leave_requests_start_date ON public.leave_requests(start_date);
CREATE INDEX idx_leave_requests_staff_status ON public.leave_requests(staff_id, status);
CREATE INDEX idx_leave_requests_pending ON public.leave_requests(status) WHERE status = 'pending';

-- ========== RLS 有効化 ==========
ALTER TABLE public.leave_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- ========== leave_grants RLS ポリシー ==========
CREATE POLICY "Admins can view all leave grants" ON public.leave_grants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can insert leave grants" ON public.leave_grants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update leave grants" ON public.leave_grants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Staff: 自分の付与レコードのみ閲覧可能
CREATE POLICY "Staff can view own leave grants" ON public.leave_grants
  FOR SELECT USING (
    staff_id IN (
      SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages leave grants" ON public.leave_grants
  FOR ALL USING (auth.role() = 'service_role');

-- ========== leave_requests RLS ポリシー ==========
CREATE POLICY "Admins can view all leave requests" ON public.leave_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can insert leave requests" ON public.leave_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update leave requests" ON public.leave_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Staff: 自分の申請のみ閲覧可能
CREATE POLICY "Staff can view own leave requests" ON public.leave_requests
  FOR SELECT USING (
    staff_id IN (
      SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid()
    )
  );

-- Staff: 自分の申請を作成可能
CREATE POLICY "Staff can insert own leave requests" ON public.leave_requests
  FOR INSERT WITH CHECK (
    staff_id IN (
      SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid()
    )
  );

-- Staff: 自分の申請を更新可能（キャンセル等）
CREATE POLICY "Staff can update own leave requests" ON public.leave_requests
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

CREATE POLICY "Service role manages leave requests" ON public.leave_requests
  FOR ALL USING (auth.role() = 'service_role');
