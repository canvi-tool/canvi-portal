-- ============================================================
-- 00033_add_report_type_to_work_reports.sql
-- 日報タイプ (training/outbound/inbound) を work_reports に追加
-- ============================================================

-- report_type カラム追加
ALTER TABLE public.work_reports
  ADD COLUMN IF NOT EXISTS report_type TEXT NOT NULL DEFAULT 'outbound';

-- year_month カラムを追加（既存の report_date と併用）
-- 既存のAPIが year_month を使っているため互換性維持
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'work_reports' AND column_name = 'year_month'
  ) THEN
    ALTER TABLE public.work_reports ADD COLUMN year_month TEXT;
  END IF;
END $$;

-- report_type にインデックス追加
CREATE INDEX IF NOT EXISTS idx_work_reports_type ON public.work_reports(report_type) WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.work_reports.report_type IS 'training=研修日報, outbound=架電日報, inbound=受電日報';
