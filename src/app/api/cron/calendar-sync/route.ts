import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GoogleCalendarClient } from '@/lib/integrations/google-calendar'
import { getValidTokenForUser } from '@/lib/integrations/google-token'
import { syncFromGoogleCalendarForStaff } from '@/lib/integrations/google-calendar-import'

// Vercel Serverless Function 最大実行時間（全ユーザー同期用に長め確保）
export const maxDuration = 300
export const dynamic = 'force-dynamic'

/**
 * Google Calendar → シフト 定期同期 Cron Job
 *
 * 1時間ごとに実行し、全ユーザーのGoogleカレンダー変更をCanviシフトに反映:
 * 1. google_refresh_token を持つ全ユーザーを取得（ログイン状態不問）
 * 2. Phase 1: syncFromGoogleCalendarForStaff で gcal_pending_events にPJ未割当取込
 * 3. Phase 0: プライマリカレンダーから今日〜30日のイベントを取得して shifts を作成/更新/削除
 *
 * これにより、カレンダーページを開いていないユーザーのカレンダーも常に最新に保たれ、
 * チーム全員で最新のシフトを共有できる。
 */
export async function GET(request: NextRequest) {
  // Cron認証
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const syncResults: Array<{
    userId: string
    staffId: string
    created: number
    updated: number
    deleted: number
    skipped: number
    errors: string[]
  }> = []

  try {
    // JSTで今日から2週間の日付を計算
    const now = new Date()
    const jstOffset = 9 * 60 * 60 * 1000
    const jstNow = new Date(now.getTime() + jstOffset)
    const today = jstNow.toISOString().split('T')[0]

    // 検索範囲: 今日の00:00 JST ～ 30日後の00:00 JST
    const timeMin = `${today}T00:00:00+09:00`
    const twoWeeksLater = new Date(jstNow.getTime() + 30 * 24 * 60 * 60 * 1000)
    const twoWeeksLaterStr = twoWeeksLater.toISOString().split('T')[0]
    const timeMax = `${twoWeeksLaterStr}T00:00:00+09:00`

    // google_refresh_token を持つユーザー一覧を取得
    const { data: usersWithGoogle, error: usersError } = await admin
      .from('users')
      .select('id')
      .not('google_refresh_token', 'is', null)

    if (usersError) {
      console.error('[calendar-sync] Failed to fetch users:', usersError.message)
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    if (!usersWithGoogle || usersWithGoogle.length === 0) {
      return NextResponse.json({
        message: 'No users with Google Calendar integration',
        results: [],
      })
    }

    console.log(`[calendar-sync] Processing ${usersWithGoogle.length} users`)

    for (const user of usersWithGoogle) {
      const userResult = {
        userId: user.id,
        staffId: '',
        created: 0,
        updated: 0,
        deleted: 0,
        skipped: 0,
        errors: [] as string[],
      }

      try {
        // ユーザーに紐づくスタッフを取得
        const { data: staffRecord } = await admin
          .from('staff')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle()

        if (!staffRecord) {
          userResult.errors.push('No active staff record found')
          syncResults.push(userResult)
          continue
        }

        userResult.staffId = staffRecord.id

        // Phase 1: GCal → gcal_pending_events (PJ未割当取込)。
        // シフトページを開いていないユーザーでも pending_events に入るようにする。
        try {
          await syncFromGoogleCalendarForStaff({
            staffId: staffRecord.id as string,
            userId: user.id,
            timeMin,
            timeMax,
          })
        } catch (e) {
          userResult.errors.push(
            `Phase1 import error: ${e instanceof Error ? e.message : String(e)}`,
          )
        }

        // 有効なGoogleトークンを取得
        const token = await getValidTokenForUser(user.id)
        if (!token) {
          userResult.errors.push('Failed to get valid Google token')
          syncResults.push(userResult)
          continue
        }

        const client = new GoogleCalendarClient(
          token.accessToken,
          token.refreshToken || undefined
        )

        // スタッフの有効なプロジェクトアサインメントを取得
        // status は 'in_progress' 等が実運用で使われているため、deleted_at=null のみで絞る
        const { data: assignments } = await admin
          .from('project_assignments')
          .select('project_id, status, projects!inner(id, name, custom_fields)')
          .eq('staff_id', staffRecord.id)
          .is('deleted_at', null)
          .not('status', 'eq', 'completed')

        if (!assignments || assignments.length === 0) {
          userResult.errors.push('No active project assignments')
          syncResults.push(userResult)
          continue
        }

        // プロジェクト名→IDマッピングを構築
        const projectMap = new Map<string, string>()
        const calendarDisplayNames = new Set<string>()
        for (const a of assignments) {
          const project = a.projects as unknown as { id: string; name: string; custom_fields?: Record<string, unknown> | null }
          if (project?.name) {
            projectMap.set(project.name.toLowerCase(), project.id)
          }
          const displayName = project?.custom_fields?.calendar_display_name as string | undefined
          if (displayName) calendarDisplayNames.add(displayName.toLowerCase())
        }
        void assignments

        // プライマリカレンダーからイベントを取得
        const events = await client.getEvents('primary', timeMin, timeMax)

        // 全イベントを同期対象に（時刻指定のあるイベントのみ、終日除外）
        void calendarDisplayNames
        const shiftEvents = events.filter((event) => {
          if (!event.start.includes('T') || !event.end.includes('T')) {
            return false
          }
          return true
        })

        // このスタッフの今日〜2週間の既存シフト（google_calendar_event_idあり）を取得
        const { data: existingShifts } = await admin
          .from('shifts')
          .select('id, shift_date, start_time, end_time, google_calendar_event_id, google_meet_url, notes, status')
          .eq('staff_id', staffRecord.id)
          .gte('shift_date', today)
          .lte('shift_date', twoWeeksLaterStr)
          .is('deleted_at', null)
          .not('google_calendar_event_id', 'is', null)

        // DB の start_time は HH:MM:SS 形式、parseEventToJST は HH:MM 形式 → HH:MM に統一
        const toHHMM = (t: string) => t.slice(0, 5)

        const existingByEventId = new Map<string, {
          id: string
          shift_date: string
          start_time: string
          end_time: string
          google_meet_url: string | null
          notes: string | null
        }>()

        if (existingShifts) {
          for (const shift of existingShifts) {
            if (shift.google_calendar_event_id) {
              existingByEventId.set(shift.google_calendar_event_id, {
                id: shift.id,
                shift_date: shift.shift_date,
                start_time: toHHMM(shift.start_time),
                end_time: toHHMM(shift.end_time),
                google_meet_url: shift.google_meet_url || null,
                notes: shift.notes || null,
              })
            }
          }
        }

        // 処理済みイベントIDを追跡（削除検知用）
        const processedEventIds = new Set<string>()

        // イベントごとに処理
        for (const event of shiftEvents) {
          // ISO 8601 → JST の DATE と TIME に変換
          const { shiftDate, startTime, endTime } = parseEventToJST(event.start, event.end)
          if (!shiftDate || !startTime || !endTime) {
            userResult.skipped++
            continue
          }

          // 時間の妥当性チェック
          const durationMs = new Date(event.end).getTime() - new Date(event.start).getTime()
          const durationHours = durationMs / (1000 * 60 * 60)
          if (durationHours <= 0 || durationHours > 24) {
            userResult.skipped++
            continue
          }

          // イベントIDに対応するプロジェクトを特定
          // サマリーからPJが特定できないイベントはシフト化しない（個人予定の誤取込防止）
          const projectId = matchProjectFromSummary(event.summary, projectMap)
          if (!projectId) {
            userResult.skipped++
            continue
          }
          // PJマッチしたイベントのみ「処理済み」として扱う
          // (マッチしないイベントに紐づく既存シフトは削除検知で自動削除される)
          processedEventIds.add(event.id)

          // 既存シフトとのマッチング (google_calendar_event_id のみ)
          const existingShift = existingByEventId.get(event.id)
          const newMeetUrl = event.meetUrl || null
          const newDescription = event.description || null

          if (existingShift) {
            const cleanExistingNotes = existingShift.notes && existingShift.notes.startsWith('gcal:') ? null : existingShift.notes
            if (
              existingShift.shift_date !== shiftDate ||
              existingShift.start_time !== startTime ||
              existingShift.end_time !== endTime ||
              existingShift.google_meet_url !== newMeetUrl ||
              cleanExistingNotes !== newDescription
            ) {
              const { error: updateError } = await admin
                .from('shifts')
                .update({
                  shift_date: shiftDate,
                  start_time: startTime,
                  end_time: endTime,
                  project_id: projectId,
                  google_meet_url: newMeetUrl,
                  notes: newDescription,
                  google_calendar_synced: true,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingShift.id)

              if (updateError) {
                userResult.errors.push(
                  `Update error (${event.summary}): ${updateError.message}`
                )
              } else {
                userResult.updated++
              }
            } else {
              userResult.skipped++
            }
          } else {
            // 新規シフト作成
            const { error: insertError } = await admin.from('shifts').insert({
              staff_id: staffRecord.id,
              project_id: projectId,
              shift_date: shiftDate,
              start_time: startTime,
              end_time: endTime,
              status: 'APPROVED',
              shift_type: 'WORK',
              google_calendar_event_id: event.id,
              google_calendar_synced: true,
              google_meet_url: newMeetUrl,
              notes: newDescription,
              created_by: user.id,
            })

            if (insertError) {
              userResult.errors.push(
                `Create error (${event.summary}): ${insertError.message}`
              )
            } else {
              userResult.created++
            }
          }
        }

        // 削除検知: google_calendar_event_id があるがイベントが存在しなくなったシフト
        if (existingShifts) {
          for (const shift of existingShifts) {
            const eventId = shift.google_calendar_event_id
            if (!eventId) continue
            if (processedEventIds.has(eventId)) continue

            // イベントが消えた → シフトをソフト削除
            const nowIso = new Date().toISOString()
            const { error: deleteError } = await admin
              .from('shifts')
              .update({
                deleted_at: nowIso,
                updated_at: nowIso,
              })
              .eq('id', shift.id)

            if (deleteError) {
              userResult.errors.push(
                `Soft-delete error (shift ${shift.id}): ${deleteError.message}`
              )
            } else {
              userResult.deleted++
            }
          }
        }
      } catch (userError) {
        const message =
          userError instanceof Error ? userError.message : '不明なエラー'
        userResult.errors.push(`Sync failed: ${message}`)
        console.error(`[calendar-sync] Error for user ${user.id}:`, userError)
      }

      syncResults.push(userResult)
    }

    const totalCreated = syncResults.reduce((sum, r) => sum + r.created, 0)
    const totalUpdated = syncResults.reduce((sum, r) => sum + r.updated, 0)
    const totalDeleted = syncResults.reduce((sum, r) => sum + r.deleted, 0)
    const totalErrors = syncResults.reduce((sum, r) => sum + r.errors.length, 0)

    console.log(
      `[calendar-sync] Complete: ${totalCreated} created, ${totalUpdated} updated, ${totalDeleted} deleted, ${totalErrors} errors`
    )

    return NextResponse.json({
      synced_at: new Date().toISOString(),
      users_processed: syncResults.length,
      total_created: totalCreated,
      total_updated: totalUpdated,
      total_deleted: totalDeleted,
      total_errors: totalErrors,
      results: syncResults,
    })
  } catch (error) {
    console.error('[calendar-sync] Critical error:', error)
    const message = error instanceof Error ? error.message : 'サーバーエラーが発生しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * Google Calendar イベントの start/end (ISO 8601) を JST の date, start_time, end_time に変換
 */
function parseEventToJST(
  startStr: string,
  endStr: string
): { shiftDate: string | null; startTime: string | null; endTime: string | null } {
  try {
    const startDate = new Date(startStr)
    const endDate = new Date(endStr)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return { shiftDate: null, startTime: null, endTime: null }
    }

    // JST に変換 (UTC + 9時間)
    const jstOffset = 9 * 60 * 60 * 1000
    const jstStart = new Date(startDate.getTime() + jstOffset)
    const jstEnd = new Date(endDate.getTime() + jstOffset)

    const shiftDate = jstStart.toISOString().split('T')[0]
    const startTime = jstStart.toISOString().split('T')[1].slice(0, 5) // HH:MM
    const endTime = jstEnd.toISOString().split('T')[1].slice(0, 5) // HH:MM

    return { shiftDate, startTime, endTime }
  } catch {
    return { shiftDate: null, startTime: null, endTime: null }
  }
}

/**
 * イベントのsummaryからプロジェクトを特定
 * "[プロジェクト名] シフト" のようなフォーマットを想定
 */
function matchProjectFromSummary(
  summary: string,
  projectMap: Map<string, string>
): string | null {
  if (!summary) return null
  const lowerSummary = summary.toLowerCase()

  // "[プロジェクト名]" 形式から抽出
  const bracketMatch = summary.match(/\[(.+?)\]/)
  if (bracketMatch) {
    const projectName = bracketMatch[1].toLowerCase()
    const projectId = projectMap.get(projectName)
    if (projectId) return projectId
  }

  // プロジェクト名が含まれているかチェック
  for (const [projectName, projectId] of projectMap) {
    if (lowerSummary.includes(projectName)) {
      return projectId
    }
  }

  return null
}
