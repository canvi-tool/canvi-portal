-- ============================================================
-- 00006_create_reports.sql
-- 業務報告・勤務実績レポート
-- ============================================================

-- 業務報告ステータス
CREATE TYPE public.report_status AS ENUM (
  'draft',           -- 下書き
  'submitted',       -- 提出済み
  'reviewing',       -- レビュー中
  'approved',        -- 承認済み
  'rejected',        -- 差し戻し
  'revised'          -- 修正済み
);

-- レポート期間種別
CREATE TYPE public.report_period_type AS ENUM (
  'daily',           -- 日次
  'weekly',          -- 週次
  'biweekly',        -- 隔週
  'monthly'          -- 月次
);

-- ========== 業務報告テーブル ==========
CREATE TABLE public.work_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,

  -- レポート内容
  report_date DATE NOT NULL,                 -- 報告対象日
  status public.report_status NOT NULL DEFAULT 'draft',
  title TEXT,                                -- タイトル
  content TEXT,                              -- 報告内容 (Markdown)
  achievements JSONB DEFAULT '[]'::jsonb,    -- 成果・実績リスト
  issues JSONB DEFAULT '[]'::jsonb,          -- 課題・問題リスト
  next_actions JSONB DEFAULT '[]'::jsonb,    -- 次回アクション

  -- 添付ファイル
  attachments JSONB DEFAULT '[]'::jsonb,     -- [{url, filename, size, mime_type}]

  -- 承認情報
  submitted_at TIMESTAMPTZ,                  -- 提出日時
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,                   -- レビュー日時
  review_comment TEXT,                       -- レビューコメント
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,                   -- 承認日時

  -- メタデータ
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- updated_at トリガー
CREATE TRIGGER work_reports_updated_at
  BEFORE UPDATE ON public.work_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== 勤務実績レポートテーブル (集計用) ==========
CREATE TABLE public.performance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,

  -- 期間
  period_type public.report_period_type NOT NULL DEFAULT 'monthly',
  period_start DATE NOT NULL,                -- 集計開始日
  period_end DATE NOT NULL,                  -- 集計終了日

  -- 勤務実績集計
  total_scheduled_hours NUMERIC(8, 2) DEFAULT 0,  -- 予定勤務時間合計
  total_actual_hours NUMERIC(8, 2) DEFAULT 0,     -- 実績勤務時間合計
  total_overtime_hours NUMERIC(8, 2) DEFAULT 0,   -- 残業時間合計
  total_night_hours NUMERIC(8, 2) DEFAULT 0,      -- 深夜勤務時間合計
  total_holiday_hours NUMERIC(8, 2) DEFAULT 0,    -- 休日勤務時間合計
  total_days_worked INTEGER DEFAULT 0,             -- 出勤日数
  total_days_absent INTEGER DEFAULT 0,             -- 欠勤日数
  total_days_late INTEGER DEFAULT 0,               -- 遅刻日数
  total_days_early_leave INTEGER DEFAULT 0,        -- 早退日数

  -- ステータス
  status public.report_status NOT NULL DEFAULT 'draft',
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,

  -- 備考
  notes TEXT,
  summary JSONB DEFAULT '{}'::jsonb,         -- AI生成サマリー等

  -- メタデータ
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- 同一スタッフ・期間の重複防止
  UNIQUE(staff_id, project_id, period_type, period_start, period_end)
);

-- updated_at トリガー
CREATE TRIGGER performance_reports_updated_at
  BEFORE UPDATE ON public.performance_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== インデックス ==========
-- work_reports
CREATE INDEX idx_work_reports_staff ON public.work_reports(staff_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_reports_project ON public.work_reports(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_reports_shift ON public.work_reports(shift_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_reports_date ON public.work_reports(report_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_reports_status ON public.work_reports(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_reports_staff_date ON public.work_reports(staff_id, report_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_reports_submitted ON public.work_reports(submitted_at) WHERE deleted_at IS NULL AND status = 'submitted';

-- performance_reports
CREATE INDEX idx_perf_reports_staff ON public.performance_reports(staff_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_perf_reports_project ON public.performance_reports(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_perf_reports_period ON public.performance_reports(period_start, period_end) WHERE deleted_at IS NULL;
CREATE INDEX idx_perf_reports_status ON public.performance_reports(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_perf_reports_type ON public.performance_reports(period_type) WHERE deleted_at IS NULL;

-- RLS 有効化
ALTER TABLE public.work_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_reports ENABLE ROW LEVEL SECURITY;

-- ========== work_reports RLS ポリシー ==========
CREATE POLICY "Admins can view all work reports" ON public.work_reports
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can insert work reports" ON public.work_reports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update work reports" ON public.work_reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete work reports" ON public.work_reports
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Staff: 自分の報告を閲覧・作成・更新可能
CREATE POLICY "Staff can view own work reports" ON public.work_reports
  FOR SELECT USING (
    deleted_at IS NULL
    AND staff_id IN (
      SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can insert own work reports" ON public.work_reports
  FOR INSERT WITH CHECK (
    staff_id IN (
      SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can update own draft reports" ON public.work_reports
  FOR UPDATE USING (
    staff_id IN (
      SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid()
    )
    AND status IN ('draft', 'rejected', 'revised')
  );

CREATE POLICY "Service role manages work reports" ON public.work_reports
  FOR ALL USING (auth.role() = 'service_role');

-- ========== performance_reports RLS ポリシー ==========
CREATE POLICY "Admins can view all performance reports" ON public.performance_reports
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can insert performance reports" ON public.performance_reports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update performance reports" ON public.performance_reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Staff: 自分の実績レポートのみ閲覧可能
CREATE POLICY "Staff can view own performance reports" ON public.performance_reports
  FOR SELECT USING (
    deleted_at IS NULL
    AND staff_id IN (
      SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages performance reports" ON public.performance_reports
  FOR ALL USING (auth.role() = 'service_role');
