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
