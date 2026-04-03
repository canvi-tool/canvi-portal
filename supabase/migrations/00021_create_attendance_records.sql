-- =============================================
-- 00021: 出退勤打刻テーブル (attendance_records)
-- =============================================

CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  break_start TIMESTAMPTZ,
  break_end TIMESTAMPTZ,
  break_minutes INTEGER DEFAULT 0,
  work_minutes INTEGER,
  overtime_minutes INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'clocked_in' CHECK (status IN (
    'clocked_in', 'on_break', 'clocked_out', 'modified', 'approved'
  )),
  location_type TEXT CHECK (location_type IN ('office', 'remote', 'client_site', 'other')),
  note TEXT,
  modified_by UUID REFERENCES auth.users(id),
  modification_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- インデックス
CREATE INDEX idx_attendance_user_date ON attendance_records(user_id, date) WHERE deleted_at IS NULL;
CREATE INDEX idx_attendance_staff_date ON attendance_records(staff_id, date) WHERE deleted_at IS NULL;
CREATE INDEX idx_attendance_project_date ON attendance_records(project_id, date) WHERE deleted_at IS NULL;
CREATE INDEX idx_attendance_date ON attendance_records(date) WHERE deleted_at IS NULL;
CREATE INDEX idx_attendance_status ON attendance_records(status) WHERE deleted_at IS NULL;

-- updated_at 自動更新トリガー
CREATE TRIGGER set_attendance_records_updated_at
  BEFORE UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS 有効化
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- RLS ポリシー: 管理者は全レコード操作可
CREATE POLICY "attendance_admin_all" ON attendance_records
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  );

-- RLS ポリシー: スタッフは自分のレコードのみ
CREATE POLICY "attendance_staff_own" ON attendance_records
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS ポリシー: サービスロール（API用）
CREATE POLICY "attendance_service_role" ON attendance_records
  FOR ALL
  USING (auth.role() = 'service_role');
