-- ============================================================
-- 00009_create_retirement.sql
-- 退職手続き管理
-- ============================================================

-- 退職理由
CREATE TYPE public.retirement_reason AS ENUM (
  'voluntary',       -- 自己都合
  'company',         -- 会社都合
  'contract_end',    -- 契約満了
  'mutual',          -- 合意退職
  'retirement_age',  -- 定年退職
  'other'            -- その他
);

-- 退職手続きステータス
CREATE TYPE public.retirement_status AS ENUM (
  'initiated',       -- 開始
  'documents_pending', -- 書類待ち
  'in_progress',     -- 手続き中
  'final_payment',   -- 最終給与処理
  'completed',       -- 完了
  'cancelled'        -- キャンセル
);

-- ========== 退職記録テーブル ==========
CREATE TABLE public.retirement_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,

  -- 退職情報
  status public.retirement_status NOT NULL DEFAULT 'initiated',
  reason public.retirement_reason NOT NULL,
  reason_detail TEXT,                        -- 退職理由詳細
  resignation_date DATE,                     -- 退職届提出日
  last_working_date DATE NOT NULL,           -- 最終出勤日
  effective_date DATE NOT NULL,              -- 退職日 (退職効力発生日)

  -- チェックリスト (手続き進捗)
  checklist JSONB DEFAULT '{
    "resignation_letter_received": false,
    "equipment_returned": false,
    "access_revoked": false,
    "final_payment_calculated": false,
    "documents_issued": false,
    "exit_interview_done": false,
    "insurance_processed": false,
    "pension_processed": false
  }'::jsonb,

  -- 最終給与情報
  final_payment_id UUID REFERENCES public.payment_calculations(id),
  outstanding_amount NUMERIC(12, 2) DEFAULT 0, -- 未精算額
  severance_amount NUMERIC(12, 2) DEFAULT 0,   -- 退職金
  paid_leave_remaining INTEGER DEFAULT 0,       -- 残有給日数
  paid_leave_buyout NUMERIC(12, 2) DEFAULT 0,  -- 有給買取額

  -- 退職後連絡先
  forwarding_email TEXT,                     -- 転送先メール
  forwarding_phone TEXT,                     -- 転送先電話
  forwarding_address TEXT,                   -- 転送先住所

  -- 書類発行
  documents_issued JSONB DEFAULT '[]'::jsonb, -- 発行済み書類リスト
  -- [{type: "離職票", issued_at: "...", sent_at: "..."}]

  -- メタデータ
  notes TEXT,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  processed_by UUID REFERENCES public.users(id), -- 手続き担当者
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- updated_at トリガー
CREATE TRIGGER retirement_records_updated_at
  BEFORE UPDATE ON public.retirement_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== インデックス ==========
CREATE INDEX idx_retirement_staff ON public.retirement_records(staff_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_retirement_status ON public.retirement_records(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_retirement_effective_date ON public.retirement_records(effective_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_retirement_last_working ON public.retirement_records(last_working_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_retirement_reason ON public.retirement_records(reason) WHERE deleted_at IS NULL;
CREATE INDEX idx_retirement_in_progress ON public.retirement_records(status)
  WHERE deleted_at IS NULL AND status NOT IN ('completed', 'cancelled');

-- RLS 有効化
ALTER TABLE public.retirement_records ENABLE ROW LEVEL SECURITY;

-- ========== retirement_records RLS ポリシー ==========
CREATE POLICY "Admins can view all retirement records" ON public.retirement_records
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can insert retirement records" ON public.retirement_records
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update retirement records" ON public.retirement_records
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete retirement records" ON public.retirement_records
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Staff: 自分の退職記録のみ閲覧可能
CREATE POLICY "Staff can view own retirement records" ON public.retirement_records
  FOR SELECT USING (
    deleted_at IS NULL
    AND staff_id IN (
      SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages retirement records" ON public.retirement_records
  FOR ALL USING (auth.role() = 'service_role');
