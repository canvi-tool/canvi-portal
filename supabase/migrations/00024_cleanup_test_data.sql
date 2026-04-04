-- =============================================
-- 00024: テストデータのクリーンアップ
-- 対象: 書類管理, シフト管理, 勤務報告, 退任・離任, アラート
-- =============================================

-- 1. 書類管理 (見積書・契約書・請求書)
DELETE FROM public.project_invoices;
DELETE FROM public.project_contracts;
DELETE FROM public.project_estimates;

-- 2. シフト管理
DELETE FROM public.shift_approval_history;
DELETE FROM public.shifts;

-- 3. 勤務報告・実績
DELETE FROM public.performance_reports;
DELETE FROM public.work_reports;

-- 4. 退任・離任
DELETE FROM public.retirement_records;

-- 5. アラート
DELETE FROM public.alerts;

-- 6. 関連する通知履歴 (上記に紐づくもの)
DELETE FROM public.notification_history;

-- 7. 関連する監査ログ (上記テーブルの操作ログ)
DELETE FROM public.audit_logs
WHERE resource IN (
  'project_estimate', 'project_contract', 'project_invoice',
  'shift', 'work_report', 'performance_report',
  'retirement_record', 'alert', 'notification'
);
