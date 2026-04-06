-- ============================================================
-- 00042_compensation_model.sql
-- 報酬モデル Phase 2
-- スタッフの基本報酬種別 + PJ別の報酬上書き + 履歴管理
-- ============================================================

-- 報酬種別 ENUM
DO $$ BEGIN
  CREATE TYPE public.compensation_type AS ENUM (
    'MONTHLY',        -- 月給固定
    'HOURLY',         -- 時給
    'DAILY',          -- 日給
    'PER_UNIT',       -- 件数単価（架電・成約など）
    'REVENUE_SHARE',  -- 売上の何%
    'COMMISSION'      -- コミッション（段階歩合）
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ========== users テーブルに基本報酬種別を追加 ==========
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS compensation_type public.compensation_type,
  ADD COLUMN IF NOT EXISTS base_monthly_amount NUMERIC(12,2),        -- 月給（MONTHLY時）
  ADD COLUMN IF NOT EXISTS base_hourly_amount NUMERIC(12,2),         -- 時給（HOURLY時 or フォールバック）
  ADD COLUMN IF NOT EXISTS base_daily_amount NUMERIC(12,2);          -- 日給（DAILY時）

COMMENT ON COLUMN public.users.compensation_type IS
  'スタッフの基本報酬種別。PJ別の上書きがある場合は project_member_compensations を優先。';

-- ========== PJ別の報酬上書き ==========
CREATE TABLE IF NOT EXISTS public.project_member_compensations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  rate_type public.compensation_type NOT NULL,
  rate_amount NUMERIC(12,2) NOT NULL DEFAULT 0,  -- 単価 / 月額 / 時給など
  unit_label TEXT,                               -- PER_UNIT時のラベル(例: "架電1件")

  -- 複雑な段階歩合・ボーナスルール
  -- 例: [{ "threshold": 50, "rate_amount": 1000 }, { "threshold": 100, "rate_amount": 1500 }]
  bonus_rules JSONB DEFAULT '[]'::jsonb,

  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,  -- NULL = 現在有効

  notes TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 同一スタッフ×PJ×開始日の重複防止（履歴は effective_from で区別）
  UNIQUE (staff_id, project_id, effective_from)
);

CREATE INDEX IF NOT EXISTS pmc_staff_project_idx
  ON public.project_member_compensations(staff_id, project_id);
CREATE INDEX IF NOT EXISTS pmc_effective_idx
  ON public.project_member_compensations(effective_from, effective_to);

CREATE TRIGGER project_member_compensations_updated_at
  BEFORE UPDATE ON public.project_member_compensations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.project_member_compensations IS
  'スタッフ×PJ別の報酬上書き。未設定時は users.compensation_type にフォールバック。effective_from/toで履歴管理。';

-- ========== 日次生産性集計（work_reportsから拾うための補助カラム） ==========
-- work_reports.custom_fields に以下のJSONキーを規約として保持:
--   { "num_calls": 120, "num_appointments": 5, "num_closings": 1, "revenue": 50000 }
-- 取得時はSQL側で (custom_fields->>'num_calls')::int で参照
COMMENT ON COLUMN public.work_reports.custom_fields IS
  '日次生産性指標の正規キー: num_calls / num_appointments / num_closings / revenue (すべて数値)';

-- ========== RLS ==========
ALTER TABLE public.project_member_compensations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pmc_select ON public.project_member_compensations;
CREATE POLICY pmc_select ON public.project_member_compensations
  FOR SELECT USING (
    -- 管理者 or 自分自身の報酬のみ閲覧可
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'owner', 'manager')
    )
    OR staff_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS pmc_write ON public.project_member_compensations;
CREATE POLICY pmc_write ON public.project_member_compensations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'owner')
    )
  );
