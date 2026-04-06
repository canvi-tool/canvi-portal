-- プロジェクトごとのGoogleカレンダー表記名
-- この値が設定されている場合、カレンダーイベントのタイトルにPJ名の代わりに使用される
ALTER TABLE projects ADD COLUMN IF NOT EXISTS calendar_display_name TEXT;

COMMENT ON COLUMN projects.calendar_display_name IS 'Googleカレンダーに登録する際の表記名。未設定の場合はPJ名(name)が使用される';
