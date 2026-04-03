-- ============================================
-- 選択テーブルのデータ削除
-- 対象: シフト管理、勤務報告、退職・離任、アラート
-- ============================================

BEGIN;

-- 1. payment_calculation_lines の shift_id 参照を解除（FK制約回避）
UPDATE public.payment_calculation_lines SET shift_id = NULL WHERE shift_id IS NOT NULL;

-- 2. シフト関連（子テーブル → 親テーブルの順）
DELETE FROM public.shift_approval_history;
DELETE FROM public.shifts;

-- 3. 勤務報告
DELETE FROM public.work_reports;
DELETE FROM public.performance_reports;

-- 4. 退職・離任
DELETE FROM public.retirement_records;

-- 5. アラート
DELETE FROM public.alerts;

COMMIT;

-- 削除結果確認
SELECT 'shifts' AS table_name, COUNT(*) AS remaining FROM public.shifts
UNION ALL SELECT 'shift_approval_history', COUNT(*) FROM public.shift_approval_history
UNION ALL SELECT 'work_reports', COUNT(*) FROM public.work_reports
UNION ALL SELECT 'performance_reports', COUNT(*) FROM public.performance_reports
UNION ALL SELECT 'retirement_records', COUNT(*) FROM public.retirement_records
UNION ALL SELECT 'alerts', COUNT(*) FROM public.alerts
ORDER BY table_name;
