-- ============================================================
-- 00005_create_shifts.sql
-- シフト・勤怠管理
-- ============================================================

-- シフトステータス
CREATE TYPE public.shift_status AS ENUM (
  'scheduled',       -- 予定
  'checked_in',      -- 出勤済み
  'checked_out',     -- 退勤済み
  'completed',       -- 確定済み
  'absent',          -- 欠勤
  'cancelled'        -- キャンセル
);

-- 打刻方法
CREATE TYPE public.checkin_method AS ENUM (
  'manual',          -- 手動入力
  'gps',             -- GPS打刻
  'qr_code',         -- QRコード
  'nfc',             -- NFC
  'biometric',       -- 生体認証
  'system'           -- システム自動
);

-- シフトテーブル
CREATE TABLE public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  assignment_id UUID REFERENCES public.project_assignments(id) ON DELETE SET NULL,

  -- シフト予定
  scheduled_date DATE NOT NULL,              -- 勤務予定日
  scheduled_start TIMESTAMPTZ,               -- 予定開始日時
  scheduled_end TIMESTAMPTZ,                 -- 予定終了日時
  scheduled_break_minutes INTEGER DEFAULT 0, -- 予定休憩時間 (分)

  -- 実績
  actual_start TIMESTAMPTZ,                  -- 実際の出勤日時
  actual_end TIMESTAMPTZ,                    -- 実際の退勤日時
  actual_break_minutes INTEGER DEFAULT 0,    -- 実際の休憩時間 (分)

  -- 計算値 (actual_hours はトリガーで自動計算)
  actual_hours NUMERIC(6, 2) GENERATED ALWAYS AS (
    CASE
      WHEN actual_start IS NOT NULL AND actual_end IS NOT NULL
      THEN ROUND(
        (EXTRACT(EPOCH FROM actual_end) - EXTRACT(EPOCH FROM actual_start)) / 3600.0
        - COALESCE(actual_break_minutes, 0) / 60.0,
        2
      )
      ELSE NULL
    END
  ) STORED,

  -- ステータス
  status public.shift_status NOT NULL DEFAULT 'scheduled',

  -- 打刻情報
  checkin_method public.checkin_method,       -- 出勤打刻方法
  checkout_method public.checkin_method,      -- 退勤打刻方法
  checkin_lat NUMERIC(10, 7),               -- 出勤時緯度
  checkin_lng NUMERIC(10, 7),               -- 出勤時経度
  checkout_lat NUMERIC(10, 7),              -- 退勤時緯度
  checkout_lng NUMERIC(10, 7),              -- 退勤時経度
  checkin_photo_url TEXT,                    -- 出勤時写真URL
  checkout_photo_url TEXT,                   -- 退勤時写真URL

  -- フラグ
  is_overtime BOOLEAN DEFAULT false,         -- 残業フラグ
  is_night_shift BOOLEAN DEFAULT false,      -- 深夜勤務フラグ
  is_holiday BOOLEAN DEFAULT false,          -- 休日出勤フラグ
  is_manual_override BOOLEAN DEFAULT false,  -- 手動補正フラグ

  -- 補正情報
  override_reason TEXT,                      -- 補正理由
  override_by UUID REFERENCES public.users(id), -- 補正者

  -- 外部連携
  external_id TEXT,                          -- 外部システムID (Google Calendar等)
  external_source TEXT,                      -- 外部システム名

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
CREATE TRIGGER shifts_updated_at
  BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- インデックス
CREATE INDEX idx_shifts_staff_id ON public.shifts(staff_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_shifts_project_id ON public.shifts(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_shifts_assignment_id ON public.shifts(assignment_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_shifts_scheduled_date ON public.shifts(scheduled_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_shifts_status ON public.shifts(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_shifts_staff_date ON public.shifts(staff_id, scheduled_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_shifts_project_date ON public.shifts(project_id, scheduled_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_shifts_external_id ON public.shifts(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_shifts_actual_start ON public.shifts(actual_start) WHERE deleted_at IS NULL AND actual_start IS NOT NULL;

-- RLS 有効化
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

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

-- Staff: 自分のシフトに打刻可能 (出勤・退勤のみ更新)
CREATE POLICY "Staff can checkin own shifts" ON public.shifts
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
