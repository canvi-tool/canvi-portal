import { google, calendar_v3 } from 'googleapis'
import { createAdminClient } from '@/lib/supabase/admin'

interface CalendarInfo {
  id: string
  summary: string
  description?: string
  primary?: boolean
  backgroundColor?: string
}

interface CalendarEvent {
  id: string
  summary: string
  description?: string
  start: string
  end: string
  status?: string
  location?: string
}

interface SyncResult {
  created: number
  updated: number
  skipped: number
  errors: string[]
}

export class GoogleCalendarClient {
  private oauth2Client
  private calendar: calendar_v3.Calendar

  constructor(accessToken: string, refreshToken?: string) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    })

    this.oauth2Client.on('tokens', (tokens) => {
      if (tokens.refresh_token) {
        console.log('New refresh token received')
      }
    })

    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client })
  }

  async listCalendars(): Promise<CalendarInfo[]> {
    try {
      const response = await this.calendar.calendarList.list()
      const items = response.data.items || []

      return items.map((item) => ({
        id: item.id || '',
        summary: item.summary || '',
        description: item.description || undefined,
        primary: item.primary || false,
        backgroundColor: item.backgroundColor || undefined,
      }))
    } catch (error) {
      console.error('Google Calendar listCalendars error:', error)
      throw new Error('カレンダー一覧の取得に失敗しました')
    }
  }

  async getEvents(
    calendarId: string,
    timeMin: string,
    timeMax: string
  ): Promise<CalendarEvent[]> {
    try {
      const events: CalendarEvent[] = []
      let pageToken: string | undefined

      do {
        const response = await this.calendar.events.list({
          calendarId,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 250,
          pageToken,
        })

        const items = response.data.items || []

        for (const item of items) {
          if (!item.id || item.status === 'cancelled') continue

          const start = item.start?.dateTime || item.start?.date
          const end = item.end?.dateTime || item.end?.date

          if (!start || !end) continue

          events.push({
            id: item.id,
            summary: item.summary || '',
            description: item.description || undefined,
            start,
            end,
            status: item.status || undefined,
            location: item.location || undefined,
          })
        }

        pageToken = response.data.nextPageToken || undefined
      } while (pageToken)

      return events
    } catch (error) {
      console.error('Google Calendar getEvents error:', error)
      throw new Error('イベントの取得に失敗しました')
    }
  }

  async syncShifts(
    calendarId: string,
    projectId: string,
    staffId: string,
    timeMin: string,
    timeMax: string
  ): Promise<SyncResult> {
    const result: SyncResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    }

    try {
      const events = await this.getEvents(calendarId, timeMin, timeMax)
      const supabase = createAdminClient()

      for (const event of events) {
        try {
          const startDate = new Date(event.start)
          const endDate = new Date(event.end)

          const date = startDate.toISOString().split('T')[0]
          const startTime = startDate.toTimeString().slice(0, 5)
          const endTime = endDate.toTimeString().slice(0, 5)

          const durationMs = endDate.getTime() - startDate.getTime()
          const durationHours = durationMs / (1000 * 60 * 60)

          if (durationHours <= 0 || durationHours > 24) {
            result.skipped++
            continue
          }

          // Check for existing shift by matching date, staff, project, and time
          const { data: existing } = await supabase
            .from('shifts')
            .select('id')
            .eq('staff_id', staffId)
            .eq('shift_date', date)
            .eq('start_time', startTime)
            .eq('end_time', endTime)
            .maybeSingle()

          if (existing) {
            result.skipped++
            continue
          }

          // Check for google_event_id in notes (used as dedup key)
          const { data: existingByEvent } = await supabase
            .from('shifts')
            .select('id')
            .eq('staff_id', staffId)
            .eq('notes', `gcal:${event.id}`)
            .maybeSingle()

          if (existingByEvent) {
            // Update existing shift
            const { error: updateError } = await supabase
              .from('shifts')
              .update({
                shift_date: date,
                start_time: startTime,
                end_time: endTime,
                project_id: projectId || undefined,
                updated_at: new Date().toISOString(),
              } as never)
              .eq('id', existingByEvent.id)

            if (updateError) {
              result.errors.push(`更新エラー (${event.summary}): ${updateError.message}`)
            } else {
              result.updated++
            }
            continue
          }

          // Create new shift
          const { error: insertError } = await supabase.from('shifts').insert({
            staff_id: staffId,
            project_id: projectId || '',
            shift_date: date,
            start_time: startTime,
            end_time: endTime,
            status: 'APPROVED' as const,
            notes: `gcal:${event.id}`,
            google_calendar_synced: true,
            created_by: staffId,
          })

          if (insertError) {
            result.errors.push(`作成エラー (${event.summary}): ${insertError.message}`)
          } else {
            result.created++
          }
        } catch (eventError) {
          const message =
            eventError instanceof Error ? eventError.message : '不明なエラー'
          result.errors.push(`イベント処理エラー (${event.summary}): ${message}`)
        }
      }

      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : '不明なエラー'
      result.errors.push(`同期エラー: ${message}`)
      return result
    }
  }

  async createEvent(params: {
    calendarId?: string
    summary: string
    description?: string
    startDateTime: string
    endDateTime: string
    timeZone?: string
    withMeet?: boolean
    attendees?: string[]
  }): Promise<{ eventId: string; meetUrl: string | null }> {
    const {
      calendarId = 'primary',
      summary,
      description,
      startDateTime,
      endDateTime,
      timeZone = 'Asia/Tokyo',
      withMeet = false,
      attendees,
    } = params

    const requestBody: calendar_v3.Schema$Event = {
      summary,
      description,
      start: { dateTime: startDateTime, timeZone },
      end: { dateTime: endDateTime, timeZone },
    }

    if (attendees?.length) {
      requestBody.attendees = attendees.map((email) => ({ email }))
    }

    if (withMeet) {
      requestBody.conferenceData = {
        createRequest: {
          requestId: `canvi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      }
    }

    const response = await this.calendar.events.insert({
      calendarId,
      requestBody,
      conferenceDataVersion: withMeet ? 1 : 0,
    })

    return {
      eventId: response.data.id || '',
      meetUrl: response.data.conferenceData?.entryPoints?.find(
        (ep) => ep.entryPointType === 'video'
      )?.uri || null,
    }
  }

  async updateEvent(params: {
    calendarId?: string
    eventId: string
    summary?: string
    description?: string
    startDateTime?: string
    endDateTime?: string
    timeZone?: string
  }): Promise<void> {
    const {
      calendarId = 'primary',
      eventId,
      summary,
      description,
      startDateTime,
      endDateTime,
      timeZone = 'Asia/Tokyo',
    } = params

    const requestBody: calendar_v3.Schema$Event = {}
    if (summary !== undefined) requestBody.summary = summary
    if (description !== undefined) requestBody.description = description
    if (startDateTime) requestBody.start = { dateTime: startDateTime, timeZone }
    if (endDateTime) requestBody.end = { dateTime: endDateTime, timeZone }

    await this.calendar.events.patch({
      calendarId,
      eventId,
      requestBody,
    })
  }

  async deleteEvent(calendarId: string = 'primary', eventId: string): Promise<void> {
    await this.calendar.events.delete({
      calendarId,
      eventId,
    })
  }

  async getFreeBusy(params: {
    emails: string[]
    timeMin: string
    timeMax: string
    timeZone?: string
  }): Promise<Record<string, Array<{ start: string; end: string }>>> {
    const { emails, timeMin, timeMax, timeZone = 'Asia/Tokyo' } = params

    const response = await this.calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        timeZone,
        items: emails.map((id) => ({ id })),
      },
    })

    const result: Record<string, Array<{ start: string; end: string }>> = {}
    const calendars = response.data.calendars || {}

    for (const email of emails) {
      const cal = calendars[email]
      result[email] = (cal?.busy || []).map((b) => ({
        start: b.start || '',
        end: b.end || '',
      }))
    }

    return result
  }

  /**
   * events.list APIを使ってbusy時間を取得する（calendar.events スコープで動作）
   * freeBusy APIが使えない場合のフォールバック
   */
  async getBusyFromEvents(params: {
    timeMin: string
    timeMax: string
    timeZone?: string
  }): Promise<Array<{ start: string; end: string; summary?: string; eventId?: string; description?: string; location?: string }>> {
    const { timeMin, timeMax } = params

    const response = await this.calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    })

    const events = response.data.items || []
    return events
      .filter(e => e.status !== 'cancelled' && (e.start?.dateTime || e.start?.date))
      .map(e => ({
        start: e.start?.dateTime || e.start?.date || '',
        end: e.end?.dateTime || e.end?.date || '',
        summary: e.summary || undefined,
        eventId: e.id || undefined,
        description: e.description || undefined,
        location: e.location || undefined,
      }))
  }

  static async getAuthUrl(): Promise<string> {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events.readonly',
      ],
      prompt: 'consent',
    })
  }

  static async getTokensFromCode(code: string) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    const { tokens } = await oauth2Client.getToken(code)
    return tokens
  }
}
