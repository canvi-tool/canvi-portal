-- ============================================================
-- 00012_create_alerts.sql
-- アラート管理
-- ============================================================

-- アラート重要度
CREATE TYPE public.alert_severity AS ENUM (
  'info',            -- 情報
  'warning',         -- 警告
  'error',           -- エラー
  'critical'         -- 緊急
);

-- アラートステータス
CREATE TYPE public.alert_status AS ENUM (
  'active',          -- 有効
  'acknowledged',    -- 確認済み
  'resolved',        -- 解決済み
  'dismissed',       -- 却下
  'expired'          -- 期限切れ
);

-- アラートカテゴリ
CREATE TYPE public.alert_category AS ENUM (
  'contract_expiry',       -- 契約期限
  'shift_anomaly',         -- シフト異常
  'report_overdue',        -- 報告遅延
  'payment_pending',       -- 支払い未処理
  'attendance_issue',      -- 勤怠問題
  'assignment_gap',        -- アサイン空白
  'retirement_pending',    -- 退職手続き未完了
  'system_error',          -- システムエラー
  'compliance',            -- コンプライアンス
  'custom'                 -- カスタム
);

-- ========== アラートテーブル ==========
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- アラート情報
  title TEXT NOT NULL,                       -- アラートタイトル
  message TEXT NOT NULL,                     -- アラートメッセージ
  category public.alert_category NOT NULL,
  severity public.alert_severity NOT NULL DEFAULT 'info',
  status public.alert_status NOT NULL DEFAULT 'active',

  -- 対象
  target_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- 対象ユーザー
  target_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL, -- 対象スタッフ

  -- 関連リソース
  resource_type TEXT,                        -- 関連リソース種別
  resource_id UUID,                          -- 関連リソースID
  action_url TEXT,                           -- アクションURL (対応画面へのリンク)

  -- アラート条件
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- 発生日時
  due_date DATE,                             -- 対応期限
  auto_resolve_at TIMESTAMPTZ,               -- 自動解決日時

  -- 対応情報
  acknowledged_by UUID REFERENCES public.users(id),
  acknowledged_at TIMESTAMPTZ,               -- 確認日時
  resolved_by UUID REFERENCES public.users(id),
  resolved_at TIMESTAMPTZ,                   -- 解決日時
  resolution_note TEXT,                      -- 解決メモ
  dismissed_by UUID REFERENCES public.users(id),
  dismissed_at TIMESTAMPTZ,                  -- 却下日時

  -- メタデータ
  metadata JSONB DEFAULT '{}'::jsonb,        -- 追加データ (閾値, 検出値など)
  is_recurring BOOLEAN DEFAULT false,        -- 繰り返しアラート
  recurrence_key TEXT,                       -- 繰り返しキー (重複防止用)
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- updated_at トリガー
CREATE TRIGGER alerts_updated_at
  BEFORE UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== インデックス ==========
CREATE INDEX idx_alerts_status ON public.alerts(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_alerts_severity ON public.alerts(severity) WHERE deleted_at IS NULL AND status = 'active';
CREATE INDEX idx_alerts_category ON public.alerts(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_alerts_target_user ON public.alerts(target_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_alerts_target_staff ON public.alerts(target_staff_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_alerts_resource ON public.alerts(resource_type, resource_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_alerts_triggered ON public.alerts(triggered_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_alerts_due_date ON public.alerts(due_date) WHERE deleted_at IS NULL AND status = 'active';
CREATE INDEX idx_alerts_auto_resolve ON public.alerts(auto_resolve_at) WHERE deleted_at IS NULL AND status = 'active' AND auto_resolve_at IS NOT NULL;
CREATE INDEX idx_alerts_recurrence ON public.alerts(recurrence_key) WHERE recurrence_key IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_alerts_active_severity ON public.alerts(severity, triggered_at DESC) WHERE deleted_at IS NULL AND status = 'active';

-- RLS 有効化
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- ========== alerts RLS ポリシー ==========
CREATE POLICY "Admins can view all alerts" ON public.alerts
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can insert alerts" ON public.alerts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update alerts" ON public.alerts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete alerts" ON public.alerts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Staff: 自分宛てのアラートのみ閲覧可能
CREATE POLICY "Users can view own alerts" ON public.alerts
  FOR SELECT USING (
    deleted_at IS NULL
    AND target_user_id = auth.uid()
  );

-- Staff: 自分宛てのアラートを確認・却下可能
CREATE POLICY "Users can acknowledge own alerts" ON public.alerts
  FOR UPDATE USING (
    target_user_id = auth.uid()
  )
  WITH CHECK (
    target_user_id = auth.uid()
  );

CREATE POLICY "Service role manages alerts" ON public.alerts
  FOR ALL USING (auth.role() = 'service_role');
