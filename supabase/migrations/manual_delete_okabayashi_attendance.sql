-- =============================================
-- 手動実行用: 岡林優治 の打刻データを全削除
-- Supabase Dashboard > SQL Editor で実行
-- =============================================

-- 1. 対象件数の確認（実行前チェック）
SELECT COUNT(*) AS target_count
FROM attendance_records ar
WHERE ar.user_id IN (
  SELECT id FROM users WHERE email = 'yuji.okabayashi@canvi.co.jp'
)
OR ar.staff_id IN (
  SELECT id FROM staff WHERE email = 'yuji.okabayashi@canvi.co.jp'
);

-- 2. 物理削除（ソフト削除ではなく完全削除）
DELETE FROM attendance_records
WHERE user_id IN (
  SELECT id FROM users WHERE email = 'yuji.okabayashi@canvi.co.jp'
)
OR staff_id IN (
  SELECT id FROM staff WHERE email = 'yuji.okabayashi@canvi.co.jp'
);

-- 3. 確認
SELECT COUNT(*) AS remaining
FROM attendance_records ar
WHERE ar.user_id IN (
  SELECT id FROM users WHERE email = 'yuji.okabayashi@canvi.co.jp'
);
