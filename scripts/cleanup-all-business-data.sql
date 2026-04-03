-- ============================================
-- 本番移行前：業務データ全削除
-- マスターデータ（roles, permissions, role_permissions）は残す
-- auth.users も残す（認証ユーザーは別管理）
-- ============================================
-- ⚠️ 実行前に必ず check-data-counts.sql で件数確認してください
-- ⚠️ この操作は取り消せません
-- ============================================

BEGIN;

-- 依存関係の順序で削除（子テーブルから先に）

-- 支払関連
DELETE FROM public.payment_calculation_lines;
DELETE FROM public.payment_calculations;

-- シフト関連
DELETE FROM public.shift_approval_history;
DELETE FROM public.shifts;

-- レポート関連
DELETE FROM public.work_reports;
DELETE FROM public.performance_reports;

-- 通知・アラート
DELETE FROM public.notification_history;
DELETE FROM public.alerts;

-- 退職
DELETE FROM public.retirement_records;

-- プロジェクト関連（子テーブルから）
DELETE FROM public.compensation_rules;
DELETE FROM public.project_assignments;
DELETE FROM public.project_invoices;
DELETE FROM public.project_contracts;
DELETE FROM public.project_estimates;
DELETE FROM public.projects;

-- 契約関連
DELETE FROM public.contracts;
DELETE FROM public.contract_templates;

-- スタッフ関連
DELETE FROM public.staff_external_accounts;
DELETE FROM public.staff;

-- カスタムフィールド定義
DELETE FROM public.custom_field_definitions;

-- 監査ログ
DELETE FROM public.audit_logs;

-- ユーザー権限（マイナンバー担当者など）
DELETE FROM public.user_permissions;

-- ユーザーロール（owner等の再割り当てが必要になる）
-- ※ 必要に応じてコメントアウト解除
-- DELETE FROM public.user_roles;

-- ユーザー（auth.usersと連携しているため通常は残す）
-- ※ 必要に応じてコメントアウト解除
-- DELETE FROM public.users;

COMMIT;

-- 削除後の件数確認
SELECT 'users' AS table_name, COUNT(*) AS row_count FROM public.users
UNION ALL SELECT 'staff', COUNT(*) FROM public.staff
UNION ALL SELECT 'projects', COUNT(*) FROM public.projects
UNION ALL SELECT 'shifts', COUNT(*) FROM public.shifts
UNION ALL SELECT 'alerts', COUNT(*) FROM public.alerts
UNION ALL SELECT 'contracts', COUNT(*) FROM public.contracts
UNION ALL SELECT 'audit_logs', COUNT(*) FROM public.audit_logs
ORDER BY table_name;
