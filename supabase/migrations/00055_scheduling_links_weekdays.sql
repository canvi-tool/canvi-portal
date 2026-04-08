-- 日程調整リンクに曜日フィルタ・祝日除外を追加
ALTER TABLE scheduling_links
  ADD COLUMN IF NOT EXISTS weekdays INTEGER[] NULL,
  ADD COLUMN IF NOT EXISTS exclude_holidays BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN scheduling_links.weekdays IS '0=日,1=月,...,6=土。NULLで全曜日。';
COMMENT ON COLUMN scheduling_links.exclude_holidays IS '日本の祝日を除外するか';
