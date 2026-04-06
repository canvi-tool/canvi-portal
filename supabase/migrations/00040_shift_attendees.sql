-- シフト招待者（attendees）カラム追加
-- 形式: [{ email: string, name?: string, staff_id?: string }]
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS attendees JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN shifts.attendees IS 'Googleカレンダーに招待する参加者リスト（Canviメンバー+外部メール）';
