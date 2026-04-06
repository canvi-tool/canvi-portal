import { NextResponse } from 'next/server'
import {
  buildShiftAttendanceDiffNotification,
  sendSlackBotMessage,
} from '@/lib/integrations/slack'

/**
 * 一時テスト用エンドポイント
 * シフト乖離 Slack 通知（承認/差戻しボタン付き）を #test-channnel に送る
 * 確認後は削除可
 */
export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0]

    // ダミーエントリー（実DBは触らない）
    const entries = [
      {
        staffName: '岡林優治',
        shiftTime: '09:00~18:00',
        actualTime: '09:12~18:05',
        diffMinutes: 12,
        attendanceRecordId: '00000000-0000-0000-0000-000000000001',
        shiftId: '00000000-0000-0000-0000-000000000002',
        staffSlackUserId: null,
      },
      {
        staffName: '田中太郎',
        shiftTime: '10:00~19:00',
        actualTime: '10:00~17:30',
        diffMinutes: 90,
        attendanceRecordId: '00000000-0000-0000-0000-000000000003',
        shiftId: '00000000-0000-0000-0000-000000000004',
        staffSlackUserId: null,
      },
    ]

    const notification = buildShiftAttendanceDiffNotification(
      entries,
      today,
      'TEST PROJECT'
    )

    const result = await sendSlackBotMessage('#test-channel', notification)
    return NextResponse.json({ ok: result.success, result })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
