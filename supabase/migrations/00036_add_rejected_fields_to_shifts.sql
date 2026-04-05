-- シフトの却下追跡フィールドを追加
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES auth.users(id);
