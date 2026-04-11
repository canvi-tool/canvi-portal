-- 給与体系区分カラムを追加
ALTER TABLE staff ADD COLUMN IF NOT EXISTS salary_type TEXT DEFAULT NULL;
COMMENT ON COLUMN staff.salary_type IS '給与体系区分: monthly(月給制), hourly(時給制), daily(日給制)';
