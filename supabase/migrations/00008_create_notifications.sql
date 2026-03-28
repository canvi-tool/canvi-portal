-- ============================================================
-- 00008_create_notifications.sql
-- 通知履歴管理
-- ============================================================

-- 通知チャネル
CREATE TYPE public.notification_channel AS ENUM (
  'email',           -- メール
  'sms',             -- SMS
  'line',            -- LINE
  'push',            -- プッシュ通知
  'in_app'           -- アプリ内通知
);

-- 通知ステータス
CREATE TYPE public.notification_status AS ENUM (
  'pending',         -- 送信待ち
  'sending',         -- 送信中
  'sent',            -- 送信済み
  'delivered',       -- 配信済み
  'read',            -- 既読
  'failed',          -- 失敗
  'cancelled'        -- キャンセル
);

-- 通知種別
CREATE TYPE public.notification_type AS ENUM (
  'contract_sent',       -- 契約書送信
  'contract_signed',     -- 契約書署名完了
  'shift_reminder',      -- シフトリマインダー
  'shift_change',        -- シフト変更通知
  'report_submitted',    -- 業務報告提出
  'report_approved',     -- 業務報告承認
  'report_rejected',     -- 業務報告差し戻し
  'payment_confirmed',   -- 給与確定通知
  'payment_issued',      -- 給与支払い完了
  'assignment_new',      -- 新規アサイン通知
  'retirement_started',  -- 退職手続き開始
  'alert',               -- アラート通知
  'system',              -- システム通知
  'custom'               -- カスタム通知
);

-- ========== 通知履歴テーブル ==========
CREATE TABLE public.notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 宛先
  recipient_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  recipient_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  recipient_email TEXT,                      -- 送信先メールアドレス
  recipient_phone TEXT,                      -- 送信先電話番号

  -- 通知情報
  notification_type public.notification_type NOT NULL,
  channel public.notification_channel NOT NULL,
  status public.notification_status NOT NULL DEFAULT 'pending',

  -- コンテンツ
  subject TEXT,                              -- 件名
  body_text TEXT,                            -- 本文 (テキスト)
  body_html TEXT,                            -- 本文 (HTML)
  template_id TEXT,                          -- 使用テンプレートID
  template_variables JSONB DEFAULT '{}'::jsonb, -- テンプレート変数

  -- 関連リソース
  resource_type TEXT,                        -- 関連リソース種別 (contract, shift, etc.)
  resource_id UUID,                          -- 関連リソースID

  -- 送信情報
  scheduled_at TIMESTAMPTZ,                  -- 予定送信日時
  sent_at TIMESTAMPTZ,                       -- 実際の送信日時
  delivered_at TIMESTAMPTZ,                  -- 配信日時
  read_at TIMESTAMPTZ,                       -- 既読日時
  failed_at TIMESTAMPTZ,                     -- 失敗日時
  failure_reason TEXT,                       -- 失敗理由

  -- リトライ情報
  retry_count INTEGER DEFAULT 0,             -- リトライ回数
  max_retries INTEGER DEFAULT 3,             -- 最大リトライ回数
  next_retry_at TIMESTAMPTZ,                 -- 次回リトライ日時

  -- 外部連携
  external_message_id TEXT,                  -- 外部サービスのメッセージID
  external_response JSONB,                   -- 外部サービスのレスポンス

  -- メタデータ
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at トリガー
CREATE TRIGGER notification_history_updated_at
  BEFORE UPDATE ON public.notification_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== インデックス ==========
CREATE INDEX idx_notifications_recipient_user ON public.notification_history(recipient_user_id) WHERE recipient_user_id IS NOT NULL;
CREATE INDEX idx_notifications_recipient_staff ON public.notification_history(recipient_staff_id) WHERE recipient_staff_id IS NOT NULL;
CREATE INDEX idx_notifications_type ON public.notification_history(notification_type);
CREATE INDEX idx_notifications_channel ON public.notification_history(channel);
CREATE INDEX idx_notifications_status ON public.notification_history(status);
CREATE INDEX idx_notifications_created ON public.notification_history(created_at);
CREATE INDEX idx_notifications_scheduled ON public.notification_history(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_notifications_resource ON public.notification_history(resource_type, resource_id) WHERE resource_id IS NOT NULL;
CREATE INDEX idx_notifications_retry ON public.notification_history(next_retry_at) WHERE status = 'failed' AND retry_count < max_retries;
CREATE INDEX idx_notifications_user_unread ON public.notification_history(recipient_user_id, read_at) WHERE read_at IS NULL AND status IN ('sent', 'delivered');

-- RLS 有効化
ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

-- ========== notification_history RLS ポリシー ==========
CREATE POLICY "Admins can view all notifications" ON public.notification_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can insert notifications" ON public.notification_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update notifications" ON public.notification_history
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- Staff: 自分宛ての通知のみ閲覧可能
CREATE POLICY "Users can view own notifications" ON public.notification_history
  FOR SELECT USING (
    recipient_user_id = auth.uid()
  );

-- Staff: 自分の通知を既読にできる
CREATE POLICY "Users can mark own notifications read" ON public.notification_history
  FOR UPDATE USING (
    recipient_user_id = auth.uid()
  )
  WITH CHECK (
    recipient_user_id = auth.uid()
  );

CREATE POLICY "Service role manages notifications" ON public.notification_history
  FOR ALL USING (auth.role() = 'service_role');
