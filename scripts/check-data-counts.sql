-- ============================================
-- 各テーブルのデータ件数確認
-- Supabase SQL Editor で実行してください
-- ============================================

SELECT 'users' AS table_name, COUNT(*) AS row_count FROM public.users
UNION ALL SELECT 'user_roles', COUNT(*) FROM public.user_roles
UNION ALL SELECT 'user_permissions', COUNT(*) FROM public.user_permissions
UNION ALL SELECT 'roles', COUNT(*) FROM public.roles
UNION ALL SELECT 'permissions', COUNT(*) FROM public.permissions
UNION ALL SELECT 'role_permissions', COUNT(*) FROM public.role_permissions
UNION ALL SELECT 'staff', COUNT(*) FROM public.staff
UNION ALL SELECT 'contract_templates', COUNT(*) FROM public.contract_templates
UNION ALL SELECT 'contracts', COUNT(*) FROM public.contracts
UNION ALL SELECT 'projects', COUNT(*) FROM public.projects
UNION ALL SELECT 'project_assignments', COUNT(*) FROM public.project_assignments
UNION ALL SELECT 'compensation_rules', COUNT(*) FROM public.compensation_rules
UNION ALL SELECT 'shifts', COUNT(*) FROM public.shifts
UNION ALL SELECT 'shift_approval_history', COUNT(*) FROM public.shift_approval_history
UNION ALL SELECT 'work_reports', COUNT(*) FROM public.work_reports
UNION ALL SELECT 'performance_reports', COUNT(*) FROM public.performance_reports
UNION ALL SELECT 'payment_calculations', COUNT(*) FROM public.payment_calculations
UNION ALL SELECT 'payment_calculation_lines', COUNT(*) FROM public.payment_calculation_lines
UNION ALL SELECT 'notification_history', COUNT(*) FROM public.notification_history
UNION ALL SELECT 'retirement_records', COUNT(*) FROM public.retirement_records
UNION ALL SELECT 'custom_field_definitions', COUNT(*) FROM public.custom_field_definitions
UNION ALL SELECT 'audit_logs', COUNT(*) FROM public.audit_logs
UNION ALL SELECT 'alerts', COUNT(*) FROM public.alerts
UNION ALL SELECT 'project_estimates', COUNT(*) FROM public.project_estimates
UNION ALL SELECT 'project_contracts', COUNT(*) FROM public.project_contracts
UNION ALL SELECT 'project_invoices', COUNT(*) FROM public.project_invoices
UNION ALL SELECT 'staff_external_accounts', COUNT(*) FROM public.staff_external_accounts
ORDER BY table_name;
