-- プロジェクトステータスを 提案中/契約中/契約終了 の3つに変更
-- PostgreSQLのENUMに新しい値を追加
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'proposing';
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'ended';

-- 既存データのマイグレーション
UPDATE public.projects SET status = 'proposing' WHERE status = 'planning';
UPDATE public.projects SET status = 'ended' WHERE status IN ('completed', 'archived', 'paused');
