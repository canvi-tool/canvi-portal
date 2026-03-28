-- ============================================================
-- 00007_create_payments.sql
-- 給与計算・支払い管理
-- ============================================================

-- 支払い計算ステータス
CREATE TYPE public.payment_calc_status AS ENUM (
  'draft',           -- 下書き (計算中)
  'calculated',      -- 計算済み
  'reviewing',       -- レビュー中
  'confirmed',       -- 確定
  'issued',          -- 支払い済み
  'cancelled'        -- キャンセル
);

-- 支払い明細種別
CREATE TYPE public.payment_line_type AS ENUM (
  'base_pay',        -- 基本給
  'overtime_pay',    -- 残業手当
  'night_pay',       -- 深夜手当
  'holiday_pay',     -- 休日手当
  'transportation',  -- 交通費
  'bonus',           -- 賞与
  'allowance',       -- その他手当
  'deduction',       -- 控除
  'tax',             -- 税金
  'insurance',       -- 保険料
  'adjustment',      -- 調整
  'other'            -- その他
);

-- ========== 支払い計算テーブル ==========
CREATE TABLE public.payment_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number TEXT NOT NULL UNIQUE,       -- 支払い番号
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,

  -- 対象期間
  period_start DATE NOT NULL,                -- 計算対象期間開始
  period_end DATE NOT NULL,                  -- 計算対象期間終了
  payment_date DATE,                         -- 支払い予定日

  -- 計算結果
  gross_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,    -- 総支給額
  deductions_amount NUMERIC(12, 2) NOT NULL DEFAULT 0, -- 控除額合計
  net_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,      -- 差引支給額
  currency TEXT DEFAULT 'JPY',

  -- 勤務実績サマリー
  total_hours NUMERIC(8, 2) DEFAULT 0,       -- 総勤務時間
  overtime_hours NUMERIC(8, 2) DEFAULT 0,    -- 残業時間
  night_hours NUMERIC(8, 2) DEFAULT 0,       -- 深夜時間
  holiday_hours NUMERIC(8, 2) DEFAULT 0,     -- 休日時間
  days_worked INTEGER DEFAULT 0,             -- 出勤日数

  -- ステータス
  status public.payment_calc_status NOT NULL DEFAULT 'draft',

  -- 確認・承認情報
  calculated_at TIMESTAMPTZ,                 -- 計算実行日時
  confirmed_by UUID REFERENCES public.users(id),
  confirmed_at TIMESTAMPTZ,                  -- 確定日時
  issued_at TIMESTAMPTZ,                     -- 支払い日時
  issued_by UUID REFERENCES public.users(id),

  -- 支払い情報
  bank_name TEXT,                            -- 振込先銀行
  bank_branch TEXT,                          -- 振込先支店
  bank_account_number TEXT,                  -- 振込先口座番号
  bank_account_holder TEXT,                  -- 振込先名義

  -- メタデータ
  notes TEXT,
  calculation_details JSONB DEFAULT '{}'::jsonb, -- 計算の詳細ログ
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- 同一スタッフ・期間の重複防止
  UNIQUE(staff_id, period_start, period_end)
);

-- updated_at トリガー
CREATE TRIGGER payment_calculations_updated_at
  BEFORE UPDATE ON public.payment_calculations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== 支払い明細テーブル ==========
CREATE TABLE public.payment_calculation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_calculation_id UUID NOT NULL REFERENCES public.payment_calculations(id) ON DELETE CASCADE,

  -- 明細情報
  line_type public.payment_line_type NOT NULL,
  description TEXT NOT NULL,                 -- 明細説明
  quantity NUMERIC(10, 2) DEFAULT 1,         -- 数量 (時間数等)
  unit_price NUMERIC(10, 2),                 -- 単価
  amount NUMERIC(12, 2) NOT NULL,            -- 金額 (正: 支給, 負: 控除)
  is_taxable BOOLEAN DEFAULT true,           -- 課税対象

  -- 参照
  project_id UUID REFERENCES public.projects(id),
  shift_id UUID REFERENCES public.shifts(id),
  compensation_rule_id UUID REFERENCES public.compensation_rules(id),

  -- 並び順
  sort_order INTEGER DEFAULT 0,

  -- メタデータ
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- updated_at トリガー
CREATE TRIGGER payment_calculation_lines_updated_at
  BEFORE UPDATE ON public.payment_calculation_lines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== インデックス ==========
-- payment_calculations
CREATE INDEX idx_payment_calc_staff ON public.payment_calculations(staff_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payment_calc_status ON public.payment_calculations(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_payment_calc_period ON public.payment_calculations(period_start, period_end) WHERE deleted_at IS NULL;
CREATE INDEX idx_payment_calc_payment_date ON public.payment_calculations(payment_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_payment_calc_number ON public.payment_calculations(payment_number);
CREATE INDEX idx_payment_calc_confirmed ON public.payment_calculations(confirmed_at) WHERE status = 'confirmed';

-- payment_calculation_lines
CREATE INDEX idx_payment_lines_calc ON public.payment_calculation_lines(payment_calculation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payment_lines_type ON public.payment_calculation_lines(line_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_payment_lines_project ON public.payment_calculation_lines(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_payment_lines_shift ON public.payment_calculation_lines(shift_id) WHERE shift_id IS NOT NULL;
CREATE INDEX idx_payment_lines_sort ON public.payment_calculation_lines(payment_calculation_id, sort_order);

-- RLS 有効化
ALTER TABLE public.payment_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_calculation_lines ENABLE ROW LEVEL SECURITY;

-- ========== payment_calculations RLS ポリシー ==========
CREATE POLICY "Admins can view all payments" ON public.payment_calculations
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can insert payments" ON public.payment_calculations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update payments" ON public.payment_calculations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete payments" ON public.payment_calculations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Staff: 自分の支払い情報のみ閲覧可能
CREATE POLICY "Staff can view own payments" ON public.payment_calculations
  FOR SELECT USING (
    deleted_at IS NULL
    AND staff_id IN (
      SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages payments" ON public.payment_calculations
  FOR ALL USING (auth.role() = 'service_role');

-- ========== payment_calculation_lines RLS ポリシー ==========
CREATE POLICY "Admins can view all payment lines" ON public.payment_calculation_lines
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can insert payment lines" ON public.payment_calculation_lines
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update payment lines" ON public.payment_calculation_lines
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete payment lines" ON public.payment_calculation_lines
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Staff: 自分の明細のみ閲覧可能
CREATE POLICY "Staff can view own payment lines" ON public.payment_calculation_lines
  FOR SELECT USING (
    deleted_at IS NULL
    AND payment_calculation_id IN (
      SELECT pc.id FROM public.payment_calculations pc
      JOIN public.staff s ON pc.staff_id = s.id
      WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages payment lines" ON public.payment_calculation_lines
  FOR ALL USING (auth.role() = 'service_role');
