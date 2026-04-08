import { NextResponse } from 'next/server'

/**
 * 日報未提出リマインダー Cron Job (無効化済み)
 *
 * 旧仕様: 平日 21:00 JST に一括ブロードキャスト DM + チャンネル通知。
 * 新仕様: 退勤打刻トリガーで本人のみ DM (src/lib/notifications/daily-report-check.ts)。
 *
 * Cron スケジュール自体は vercel.json 側に残っている可能性があるため、
 * ルート自体は残して関数本体を no-op 化している。
 */
export async function GET() {
  return NextResponse.json({
    disabled: true,
    message:
      '日報リマインドは退勤打刻トリガー型に移行しました (src/lib/notifications/daily-report-check.ts)',
  })
}
