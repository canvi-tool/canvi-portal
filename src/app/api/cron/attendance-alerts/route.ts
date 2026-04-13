import { NextRequest, NextResponse } from 'next/server'

/**
 * 勤怠アラート Cron Job (毎時実行)
 *
 * 全機能を無効化済み:
 * 1. 退勤漏れ通知 — 出勤直後に誤発火する不具合のため停止（ユーザー要望）
 *    PJごとの通知設定は /api/cron/attendance-check で処理
 * 2. 残業超過通知 — 通知が大量送出されたため停止（ユーザー要望）
 *
 * 将来退勤漏れ通知を復活させる場合は、clock_in からの最低経過時間チェック
 * （例: 最低2時間経過後 + シフト終了時刻が clock_in 以前の場合は無視）を追加すること。
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // JSTで現在時刻を取得（ログ用）
  const now = new Date()
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const today = jstNow.toISOString().split('T')[0]
  const jstHours = jstNow.getUTCHours()
  const jstMinutes = jstNow.getUTCMinutes()

  return NextResponse.json({
    success: true,
    date: today,
    jstTime: `${String(jstHours).padStart(2, '0')}:${String(jstMinutes).padStart(2, '0')}`,
    message: '全通知機能は無効化済み（退勤漏れ: 誤発火不具合, 残業超過: 大量送出）',
    results: {
      clock_out_missing: { checked: 0, alerted: 0, errors: 0, names: [] },
      overtime: { checked: 0, alerted: 0, errors: 0, names: [] },
    },
  })
}
