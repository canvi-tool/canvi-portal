-- =============================================
-- 00025: プロジェクト別Slack通知設定テーブル
-- 各プロジェクトごとに通知イベントのON/OFFを管理
-- =============================================

CREATE TABLE IF NOT EXISTS public.project_notification_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- 出退勤系
  attendance_clock_in BOOLEAN NOT NULL DEFAULT false,
  attendance_clock_out BOOLEAN NOT NULL DEFAULT false,
  attendance_missing BOOLEAN NOT NULL DEFAULT true,

  -- シフト系
  shift_submitted BOOLEAN NOT NULL DEFAULT false,
  shift_approved BOOLEAN NOT NULL DEFAULT false,
  shift_rejected BOOLEAN NOT NULL DEFAULT true,

  -- 日報・勤務報告系
  report_submitted BOOLEAN NOT NULL DEFAULT false,
  report_overdue BOOLEAN NOT NULL DEFAULT true,

  -- 契約系
  contract_unsigned BOOLEAN NOT NULL DEFAULT true,

  -- 支払系
  payment_anomaly BOOLEAN NOT NULL DEFAULT true,

  -- 勤務時間系
  overtime_warning BOOLEAN NOT NULL DEFAULT true,

  -- 休暇系
  leave_requested BOOLEAN NOT NULL DEFAULT true,

  -- メンバー系
  member_assigned BOOLEAN NOT NULL DEFAULT true,
  member_removed BOOLEAN NOT NULL DEFAULT true,

  -- 汎用アラート
  general_alert BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_project_notification_settings UNIQUE (project_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_project_notification_settings_project
  ON public.project_notification_settings(project_id);

-- updated_at自動更新トリガー
CREATE OR REPLACE FUNCTION update_project_notification_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_project_notification_settings_updated_at
  BEFORE UPDATE ON public.project_notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_project_notification_settings_updated_at();

-- RLSポリシー
ALTER TABLE public.project_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view notification settings"
  ON public.project_notification_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert notification settings"
  ON public.project_notification_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update notification settings"
  ON public.project_notification_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
