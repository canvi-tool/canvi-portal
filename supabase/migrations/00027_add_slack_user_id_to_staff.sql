-- staffテーブルにslack_user_idカラムを追加（永続的なSlack紐づけ）
ALTER TABLE staff ADD COLUMN IF NOT EXISTS slack_user_id TEXT;

-- ユニーク制約（1人のSlackユーザーが複数スタッフに紐づかないように）
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_slack_user_id
  ON staff (slack_user_id) WHERE slack_user_id IS NOT NULL;

COMMENT ON COLUMN staff.slack_user_id IS 'SlackユーザーID（users.lookupByEmailで取得し永続化）';
