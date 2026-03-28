-- ============================================================
-- 00004_create_projects.sql
-- 案件・アサイン・報酬ルール管理
-- ============================================================

-- 案件ステータス
CREATE TYPE public.project_status AS ENUM (
  'planning',        -- 企画中
  'active',          -- 進行中
  'on_hold',         -- 保留中
  'completed',       -- 完了
  'cancelled'        -- キャンセル
);

-- アサインステータス
CREATE TYPE public.assignment_status AS ENUM (
  'proposed',        -- 提案中
  'confirmed',       -- 確定
  'in_progress',     -- 稼働中
  'completed',       -- 完了
  'cancelled'        -- キャンセル
);

-- 報酬計算タイプ
CREATE TYPE public.compensation_type AS ENUM (
  'hourly',          -- 時給制
  'daily',           -- 日給制
  'monthly',         -- 月給制
  'fixed',           -- 固定額
  'commission'       -- 歩合制
);

-- ========== 案件テーブル ==========
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code TEXT NOT NULL UNIQUE,         -- 案件コード
  name TEXT NOT NULL,                        -- 案件名
  description TEXT,                          -- 説明
  client_name TEXT,                          -- クライアント名
  client_contact TEXT,                       -- クライアント連絡先

  -- ステータス・期間
  status public.project_status NOT NULL DEFAULT 'planning',
  start_date DATE,                           -- 開始日
  end_date DATE,                             -- 終了日

  -- 勤務場所
  location_name TEXT,                        -- 勤務地名
  location_address TEXT,                     -- 勤務地住所
  location_lat NUMERIC(10, 7),              -- 緯度 (GPS打刻用)
  location_lng NUMERIC(10, 7),              -- 経度 (GPS打刻用)
  location_radius INTEGER DEFAULT 200,      -- 打刻許可半径 (メートル)

  -- 予算
  budget_amount NUMERIC(14, 2),             -- 予算額
  budget_currency TEXT DEFAULT 'JPY',       -- 通貨

  -- 設定
  requires_gps_checkin BOOLEAN DEFAULT false, -- GPS打刻必須
  default_shift_start TIME,                  -- デフォルト勤務開始時刻
  default_shift_end TIME,                    -- デフォルト勤務終了時刻
  default_break_minutes INTEGER DEFAULT 60,  -- デフォルト休憩時間 (分)

  -- メタデータ
  tags JSONB DEFAULT '[]'::jsonb,           -- タグ
  custom_fields JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- updated_at トリガー
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== アサインテーブル ==========
CREATE TABLE public.project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,

  -- アサイン情報
  status public.assignment_status NOT NULL DEFAULT 'proposed',
  role_title TEXT,                           -- 役割・ポジション名
  start_date DATE NOT NULL,                  -- アサイン開始日
  end_date DATE,                             -- アサイン終了日

  -- 個別勤務設定 (案件デフォルトを上書き)
  shift_start TIME,                          -- 勤務開始時刻
  shift_end TIME,                            -- 勤務終了時刻
  break_minutes INTEGER,                     -- 休憩時間 (分)

  -- メタデータ
  notes TEXT,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- 同一案件・スタッフの重複アサイン防止
  UNIQUE(project_id, staff_id, start_date)
);

-- updated_at トリガー
CREATE TRIGGER project_assignments_updated_at
  BEFORE UPDATE ON public.project_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== 報酬ルールテーブル ==========
CREATE TABLE public.compensation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES public.project_assignments(id) ON DELETE CASCADE,

  -- ルール名と優先度
  name TEXT NOT NULL,                        -- ルール名
  priority INTEGER NOT NULL DEFAULT 0,       -- 優先度 (高い方が優先)

  -- 報酬タイプと金額
  compensation_type public.compensation_type NOT NULL,
  base_amount NUMERIC(10, 2) NOT NULL,       -- 基本金額
  currency TEXT DEFAULT 'JPY',

  -- 割増条件
  overtime_multiplier NUMERIC(4, 2) DEFAULT 1.25,  -- 残業割増率
  night_multiplier NUMERIC(4, 2) DEFAULT 1.25,     -- 深夜割増率
  holiday_multiplier NUMERIC(4, 2) DEFAULT 1.35,   -- 休日割増率
  overtime_threshold_hours NUMERIC(5, 2) DEFAULT 8, -- 残業開始時間

  -- 適用期間
  effective_from DATE NOT NULL,              -- 適用開始日
  effective_until DATE,                      -- 適用終了日

  -- 条件 (JSONB で柔軟な条件定義)
  conditions JSONB DEFAULT '{}'::jsonb,      -- 適用条件

  -- メタデータ
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- updated_at トリガー
CREATE TRIGGER compensation_rules_updated_at
  BEFORE UPDATE ON public.compensation_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== インデックス ==========
-- projects
CREATE INDEX idx_projects_status ON public.projects(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_code ON public.projects(project_code);
CREATE INDEX idx_projects_client ON public.projects(client_name) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_dates ON public.projects(start_date, end_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_tags ON public.projects USING gin(tags) WHERE deleted_at IS NULL;

-- project_assignments
CREATE INDEX idx_assignments_project ON public.project_assignments(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignments_staff ON public.project_assignments(staff_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignments_status ON public.project_assignments(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignments_dates ON public.project_assignments(start_date, end_date) WHERE deleted_at IS NULL;

-- compensation_rules
CREATE INDEX idx_comp_rules_project ON public.compensation_rules(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_comp_rules_staff ON public.compensation_rules(staff_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_comp_rules_assignment ON public.compensation_rules(assignment_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_comp_rules_effective ON public.compensation_rules(effective_from, effective_until) WHERE deleted_at IS NULL;
CREATE INDEX idx_comp_rules_priority ON public.compensation_rules(priority DESC) WHERE deleted_at IS NULL;

-- RLS 有効化
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compensation_rules ENABLE ROW LEVEL SECURITY;

-- ========== projects RLS ポリシー ==========
CREATE POLICY "Admins can view all projects" ON public.projects
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can insert projects" ON public.projects
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update projects" ON public.projects
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete projects" ON public.projects
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Staff: アサインされた案件のみ閲覧可能
CREATE POLICY "Staff can view assigned projects" ON public.projects
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.project_assignments pa
      JOIN public.staff s ON pa.staff_id = s.id
      WHERE pa.project_id = projects.id
        AND s.user_id = auth.uid()
        AND pa.deleted_at IS NULL
    )
  );

CREATE POLICY "Service role manages projects" ON public.projects
  FOR ALL USING (auth.role() = 'service_role');

-- ========== project_assignments RLS ポリシー ==========
CREATE POLICY "Admins can view all assignments" ON public.project_assignments
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can insert assignments" ON public.project_assignments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update assignments" ON public.project_assignments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete assignments" ON public.project_assignments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Staff: 自分のアサインのみ閲覧可能
CREATE POLICY "Staff can view own assignments" ON public.project_assignments
  FOR SELECT USING (
    deleted_at IS NULL
    AND staff_id IN (
      SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages assignments" ON public.project_assignments
  FOR ALL USING (auth.role() = 'service_role');

-- ========== compensation_rules RLS ポリシー ==========
CREATE POLICY "Admins can view compensation rules" ON public.compensation_rules
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can insert compensation rules" ON public.compensation_rules
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update compensation rules" ON public.compensation_rules
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete compensation rules" ON public.compensation_rules
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Staff: 自分の報酬ルールのみ閲覧可能
CREATE POLICY "Staff can view own compensation rules" ON public.compensation_rules
  FOR SELECT USING (
    deleted_at IS NULL
    AND staff_id IN (
      SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages compensation rules" ON public.compensation_rules
  FOR ALL USING (auth.role() = 'service_role');
