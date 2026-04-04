-- =============================================
-- 00023: project_status enumに paused, archived を追加
-- =============================================

ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'paused';
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'archived';
