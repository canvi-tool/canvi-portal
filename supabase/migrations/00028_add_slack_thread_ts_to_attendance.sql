-- 勤怠レコードにSlackスレッドtsを保存するカラムを追加
-- 出勤打刻時のメッセージtsを保存し、後続の打刻（休憩・退勤）を同一スレッドに送信する
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS slack_thread_ts TEXT;
