import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GoogleCalendarClient } from '@/lib/integrations/google-calendar'
import { getValidTokenForUser } from '@/lib/integrations/google-token'

/**
 * Google Calendar → シフト 定期同期 Cron Job
 *
 * 10分ごとに実行し、Googleカレンダーの変更をシフトに反映:
 * 1. google_refresh_token を持つユーザーを取得
 * 2. 各ユーザーのプライマリカレンダーから今日・明日のイベントを取得
 * 3. 既存シフトと比較して作成・更新・削除を実行
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

    // 検索範囲: 今日の00:00 JST ～ 2週間後の00:00 JST
    const timeMin = `${today}T00:00:00+09:00`
    const twoWeeksLater = new Date(jstNow.getTime() + 14 * 24 * 60 * 60 * 1000)
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

        // スタッフのアクティブなプロジェクトアサインメントを取得
        const { data: assignments } = await admin
          .from('project_assignments')
          .select('project_id, projects!inner(id, name, custom_fields)')
          .eq('staff_id', staffRecord.id)
          .in('status', ['active', 'confirmed'])

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
        const defaultProjectId = assignments[0].project_id

        // プライマリカレンダーからイベントを取得
        const events = await client.getEvents('primary', timeMin, timeMax)

        // シフト関連イベントのみフィルタリング
        const shiftEvents = events.filter((event) => {
          // 終日イベントを除外（dateTime ではなく date 形式のもの）
          if (!event.start.includes('T') || !event.end.includes('T')) {
            return false
          }
          // "シフト" を含む、またはアサイン済みプロジェクト名/カレンダー表記名を含むイベントのみ
          const summary = (event.summary || '').toLowerCase()
          if (summary.includes('シフト')) return true
          for (const [projectName] of projectMap) {
            if (summary.includes(projectName)) return true
          }
          for (const displayName of calendarDisplayNames) {
            if (summary.includes(displayName)) return true
          }
          return false
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
        }>()

        // notes に gcal: プレフィックスがあるシフトもマッピング
        const existingByGcalNote = new Map<string, {
          id: string
          shift_date: string
          start_time: string
          end_time: string
          google_meet_url: string | null
        }>()

        if (existingShifts) {
          for (const shift of existingShifts) {
            const shiftData = {
              id: shift.id,
              shift_date: shift.shift_date,
              start_time: toHHMM(shift.start_time),
              end_time: toHHMM(shift.end_time),
              google_meet_url: shift.google_meet_url || null,
            }
            if (shift.google_calendar_event_id) {
              existingByEventId.set(shift.google_calendar_event_id, shiftData)
            }
            if (shift.notes?.startsWith('gcal:')) {
              const gcalId = shift.notes.slice(5)
              existingByGcalNote.set(gcalId, shiftData)
            }
          }
        }

        // 処理済みイベントIDを追跡（削除検知用）
        const processedEventIds = new Set<string>()

        // イベントごとに処理
        for (const event of shiftEvents) {
          processedEventIds.add(event.id)

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
          const projectId = matchProjectFromSummary(event.summary, projectMap) || defaultProjectId

          // 既存シフトとのマッチング
          const existingShift =
            existingByEventId.get(event.id) || existingByGcalNote.get(event.id)

          if (existingShift) {
            // 更新チェック: 時間またはMeet URLが変わっていれば更新
            const newMeetUrl = event.meetUrl || null
            if (
              existingShift.shift_date !== shiftDate ||
              existingShift.start_time !== startTime ||
              existingShift.end_time !== endTime ||
              existingShift.google_meet_url !== newMeetUrl
            ) {
              const { error: updateError } = await admin
                .from('shifts')
                .update({
                  shift_date: shiftDate,
                  start_time: startTime,
                  end_time: endTime,
                  project_id: projectId,
                  google_meet_url: newMeetUrl,
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
              google_meet_url: event.meetUrl || null,
              notes: `gcal:${event.id}`,
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

            // gcal: notes のイベントIDもチェック
            const noteEventId = shift.notes?.startsWith('gcal:')
              ? shift.notes.slice(5)
              : null
            if (noteEventId && processedEventIds.has(noteEventId)) continue

            // イベントが消えた → シフトをソフト削除（REJECTED に変更）
            const { error: deleteError } = await admin
              .from('shifts')
              .update({
                status: 'REJECTED',
                notes: `${shift.notes || ''} [GCalから削除検知]`.trim(),
                google_calendar_synced: false,
                updated_at: new Date().toISOString(),
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
