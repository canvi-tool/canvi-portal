-- ============================================================
-- 00010_create_custom_fields.sql
-- カスタムフィールド定義
-- ============================================================

-- カスタムフィールドのデータ型
CREATE TYPE public.custom_field_type AS ENUM (
  'text',            -- テキスト
  'number',          -- 数値
  'date',            -- 日付
  'datetime',        -- 日時
  'boolean',         -- 真偽値
  'select',          -- 単一選択
  'multiselect',     -- 複数選択
  'url',             -- URL
  'email',           -- メール
  'phone',           -- 電話番号
  'file',            -- ファイル
  'json'             -- JSON
);

-- ========== カスタムフィールド定義テーブル ==========
CREATE TABLE public.custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- フィールド情報
  entity_type TEXT NOT NULL,                 -- 適用対象エンティティ (staff, projects, contracts, etc.)
  field_key TEXT NOT NULL,                   -- フィールドキー (プログラム用)
  field_label TEXT NOT NULL,                 -- 表示ラベル
  field_type public.custom_field_type NOT NULL DEFAULT 'text',
  description TEXT,                          -- フィールド説明

  -- バリデーション
  is_required BOOLEAN NOT NULL DEFAULT false, -- 必須フラグ
  default_value TEXT,                        -- デフォルト値
  validation_rules JSONB DEFAULT '{}'::jsonb, -- バリデーションルール
  -- {min, max, pattern, min_length, max_length, etc.}

  -- 選択肢 (select / multiselect 用)
  options JSONB DEFAULT '[]'::jsonb,         -- [{value, label, color}]

  -- 表示設定
  sort_order INTEGER NOT NULL DEFAULT 0,     -- 表示順
  is_visible BOOLEAN NOT NULL DEFAULT true,  -- 表示フラグ
  is_filterable BOOLEAN NOT NULL DEFAULT false, -- フィルター対象
  is_searchable BOOLEAN NOT NULL DEFAULT false, -- 検索対象
  display_width TEXT DEFAULT 'full',         -- 表示幅 (full, half, third)

  -- メタデータ
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- 同一エンティティでのフィールドキー重複防止
  UNIQUE(entity_type, field_key)
);

-- updated_at トリガー
CREATE TRIGGER custom_field_definitions_updated_at
  BEFORE UPDATE ON public.custom_field_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== インデックス ==========
CREATE INDEX idx_custom_fields_entity ON public.custom_field_definitions(entity_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_custom_fields_key ON public.custom_field_definitions(entity_type, field_key) WHERE deleted_at IS NULL;
CREATE INDEX idx_custom_fields_sort ON public.custom_field_definitions(entity_type, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_custom_fields_visible ON public.custom_field_definitions(entity_type, is_visible) WHERE deleted_at IS NULL;
CREATE INDEX idx_custom_fields_filterable ON public.custom_field_definitions(entity_type)
  WHERE deleted_at IS NULL AND is_filterable = true;

-- RLS 有効化
ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;

-- ========== custom_field_definitions RLS ポリシー ==========
-- 全認証ユーザーが閲覧可能 (フォーム表示に必要)
CREATE POLICY "Authenticated can view custom fields" ON public.custom_field_definitions
  FOR SELECT USING (
    deleted_at IS NULL
    AND auth.role() = 'authenticated'
  );

-- Admin のみ作成・更新・削除可能
CREATE POLICY "Admins can insert custom fields" ON public.custom_field_definitions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update custom fields" ON public.custom_field_definitions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete custom fields" ON public.custom_field_definitions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Service role manages custom fields" ON public.custom_field_definitions
  FOR ALL USING (auth.role() = 'service_role');
