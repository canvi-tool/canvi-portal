import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { GoogleCalendarClient } from '@/lib/integrations/google-calendar'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const { calendar_id, project_id, staff_id, start_date, end_date } = body

    if (!calendar_id || !staff_id || !start_date || !end_date) {
      return NextResponse.json(
        { error: '必須パラメータが不足しています' },
        { status: 400 }
      )
    }

    // Get the current user's Google OAuth tokens from integrations settings
    const { data: integration } = await supabase
      .from('custom_field_definitions')
      .select('options')
      .eq('entity_type', 'integration_google_calendar')
      .eq('field_name', 'oauth_tokens')
      .single()

    if (!integration?.options) {
      return NextResponse.json(
        { error: 'Google Calendar連携が設定されていません。設定画面から連携してください。' },
        { status: 400 }
      )
    }

    const tokens = integration.options as { access_token?: string; refresh_token?: string }

    if (!tokens.access_token) {
      return NextResponse.json(
        { error: 'Google Calendar認証トークンが無効です。再連携してください。' },
        { status: 401 }
      )
    }

    const client = await GoogleCalendarClient.create(
      tokens.access_token,
      tokens.refresh_token
    )

    const timeMin = new Date(start_date + 'T00:00:00').toISOString()
    const timeMax = new Date(end_date + 'T23:59:59').toISOString()

    const result = await client.syncShifts(
      calendar_id,
      project_id,
      staff_id,
      timeMin,
      timeMax
    )

    return NextResponse.json({
      ...result,
      synced_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('POST /api/shifts/sync error:', error)
    const message = error instanceof Error ? error.message : 'サーバーエラーが発生しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
