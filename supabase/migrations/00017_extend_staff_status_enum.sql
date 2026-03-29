-- オンボーディングフロー用にstaff_status enumを拡張
-- pending_registration: 招待済み・登録待ち
-- pending_approval: 登録フォーム送信済み・承認待ち

ALTER TYPE public.staff_status ADD VALUE IF NOT EXISTS 'pending_registration';
ALTER TYPE public.staff_status ADD VALUE IF NOT EXISTS 'pending_approval';

-- hire_dateをNULL許可に変更（オンボーディング中はまだ入職日未定）
ALTER TABLE public.staff ALTER COLUMN hire_date DROP NOT NULL;
