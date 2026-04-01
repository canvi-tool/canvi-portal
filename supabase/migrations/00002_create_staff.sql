-- ============================================================
-- 00002_create_staff.sql
-- スタッフ管理テーブル
-- ============================================================

-- 雇用形態
CREATE TYPE public.employment_type AS ENUM (
  'full_time',       -- 正社員
  'part_time',       -- パートタイム
  'contract',        -- 契約社員
  'temporary',       -- 派遣社員
  'freelance'        -- フリーランス
);

-- スタッフステータス
CREATE TYPE public.staff_status AS ENUM (
  'active',          -- 稼働中
  'on_leave',        -- 休職中
  'suspended',       -- 停止中
  'retired'          -- 退職済み
);

-- 性別
CREATE TYPE public.gender_type AS ENUM (
  'male',            -- 男性
  'female',          -- 女性
  'other',           -- その他
  'prefer_not_to_say' -- 回答しない
);

-- スタッフテーブル
CREATE TABLE public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES public.users(id) ON DELETE SET NULL,

  -- 基本情報
  staff_code TEXT NOT NULL UNIQUE,          -- スタッフコード (自動採番 or 手動)
  last_name TEXT NOT NULL,                  -- 姓
  first_name TEXT NOT NULL,                 -- 名
  last_name_kana TEXT,                      -- 姓（カナ）
  first_name_kana TEXT,                     -- 名（カナ）
  last_name_eiji TEXT,                      -- 姓（ローマ字）
  first_name_eiji TEXT,                     -- 名（ローマ字）
  email TEXT NOT NULL,                      -- メールアドレス
  phone TEXT,                               -- 電話番号
  gender public.gender_type,               -- 性別
  date_of_birth DATE,                       -- 生年月日

  -- 住所
  postal_code TEXT,                         -- 郵便番号
  prefecture TEXT,                          -- 都道府県
  city TEXT,                                -- 市区町村
  address_line1 TEXT,                       -- 番地
  address_line2 TEXT,                       -- 建物名・部屋番号

  -- 雇用情報
  employment_type public.employment_type NOT NULL DEFAULT 'part_time',
  status public.staff_status NOT NULL DEFAULT 'active',
  hire_date DATE NOT NULL,                  -- 入社日
  termination_date DATE,                    -- 退職日

  -- 報酬情報
  hourly_rate NUMERIC(10, 2),              -- 時給
  daily_rate NUMERIC(10, 2),               -- 日給
  monthly_salary NUMERIC(12, 2),           -- 月給
  transportation_allowance NUMERIC(10, 2) DEFAULT 0, -- 交通費

  -- 銀行口座情報
  bank_name TEXT,                           -- 銀行名
  bank_branch TEXT,                         -- 支店名
  bank_account_type TEXT,                   -- 口座種別 (普通/当座)
  bank_account_number TEXT,                 -- 口座番号
  bank_account_holder TEXT,                 -- 口座名義

  -- 緊急連絡先
  emergency_contact_name TEXT,             -- 緊急連絡先名
  emergency_contact_phone TEXT,            -- 緊急連絡先電話番号
  emergency_contact_relationship TEXT,     -- 緊急連絡先続柄

  -- スキル・資格
  skills JSONB DEFAULT '[]'::jsonb,        -- スキルタグ配列
  qualifications JSONB DEFAULT '[]'::jsonb, -- 資格情報配列
  notes TEXT,                               -- 備考

  -- カスタムフィールド
  custom_fields JSONB DEFAULT '{}'::jsonb,

  -- メタデータ
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- updated_at トリガー
CREATE TRIGGER staff_updated_at
  BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- インデックス
CREATE INDEX idx_staff_user_id ON public.staff(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_staff_staff_code ON public.staff(staff_code);
CREATE INDEX idx_staff_email ON public.staff(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_staff_status ON public.staff(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_staff_employment_type ON public.staff(employment_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_staff_name ON public.staff(last_name, first_name) WHERE deleted_at IS NULL;
CREATE INDEX idx_staff_name_kana ON public.staff(last_name_kana, first_name_kana) WHERE deleted_at IS NULL;
CREATE INDEX idx_staff_hire_date ON public.staff(hire_date);
CREATE INDEX idx_staff_skills ON public.staff USING gin(skills) WHERE deleted_at IS NULL;

-- RLS 有効化
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- RLS ポリシー
-- Owner/Admin: 論理削除されていないスタッフを閲覧可能
CREATE POLICY "Admins can view all staff" ON public.staff
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Owner/Admin: スタッフの作成・更新・削除
CREATE POLICY "Admins can insert staff" ON public.staff
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update staff" ON public.staff
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete staff" ON public.staff
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Staff: 自分のレコードのみ閲覧可能
CREATE POLICY "Staff can view own record" ON public.staff
  FOR SELECT USING (
    deleted_at IS NULL
    AND user_id = auth.uid()
  );

-- Service role: 全権限
CREATE POLICY "Service role can manage staff" ON public.staff
  FOR ALL USING (auth.role() = 'service_role');
