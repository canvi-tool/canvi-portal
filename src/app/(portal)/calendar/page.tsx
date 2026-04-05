'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Calendar, Link2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MemberSelector } from './_components/member-selector'
import { TeamCalendar, type CalendarEventClickData } from './_components/team-calendar'
import { AvailabilityCreateDialog } from './_components/availability-finder'
import { EventDetailDialog, type CalendarEventData } from './_components/event-detail-dialog'
import { SchedulingDialog } from './_components/scheduling-dialog'
import { toast } from 'sonner'

interface MemberItem {
  id: string
  userId: string
  name: string
  projectNames: string[]
}

interface MemberData {
  id: string
  email: string
  displayName: string
  busy: Array<{ start: string; end: string; source: 'shift' | 'google' }>
}

export default function CanviCalendarPage() {
  // メンバー一覧
  const [members, setMembers] = useState<MemberItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // カレンダーデータ
  const [memberData, setMemberData] = useState<MemberData[]>([])
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [loading, setLoading] = useState(false)

  // 予定作成ダイアログ
  const [createOpen, setCreateOpen] = useState(false)
  const [createInitial, setCreateInitial] = useState({ date: '', startTime: '', endTime: '' })

  // 日程調整ダイアログ
  const [schedulingOpen, setSchedulingOpen] = useState(false)

  // イベント詳細ダイアログ
  const [detailEvent, setDetailEvent] = useState<CalendarEventData | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // メンバー名のマップ
  const memberNames = useMemo(() => {
    const map: Record<string, string> = {}
    members.forEach(m => { map[m.userId] = m.name })
    return map
  }, [members])

  // スタッフ一覧取得
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        // スタッフとプロジェクトアサインを取得
        const [staffRes, assignRes] = await Promise.all([
          fetch('/api/staff?status=active&limit=200'),
          fetch('/api/projects?limit=100'),
        ])
        const staffData = await staffRes.json()
        const projectData = await assignRes.json()

        const staffList = staffData.data || []
        const projects = projectData.data || []

        // PJ名マップ
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const projectMap = new Map(projects.map((p: any) => [p.id, p.name]))

        // user_idがないスタッフはGoogleカレンダー連携できないためフィルタ
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items: MemberItem[] = staffList
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((s: any) => !!s.user_id)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((s: any) => ({
            id: s.id,
            userId: s.user_id,
            name: `${s.last_name || ''} ${s.first_name || ''}`.trim(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            projectNames: (s.project_assignments || []).map((a: any) =>
              projectMap.get(a.project_id) || '不明'
            ),
          }))

        setMembers(items)
      } catch {
        toast.error('メンバーの取得に失敗しました')
      }
    }
    fetchMembers()
  }, [])

  // 空き時間データ取得
  const fetchAvailability = useCallback(async () => {
    if (selectedIds.size === 0 || !dateRange.start || !dateRange.end) {
      setMemberData([])
      return
    }

    setLoading(true)
    try {
      const userIds = Array.from(selectedIds).join(',')
      const timeMin = `${dateRange.start}T00:00:00+09:00`
      const timeMax = `${dateRange.end}T23:59:59+09:00`

      const res = await fetch(
        `/api/calendar/availability?user_ids=${userIds}&time_min=${encodeURIComponent(timeMin)}&time_max=${encodeURIComponent(timeMax)}`
      )

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        console.error('Availability API error:', res.status, errData)
        toast.error(errData.error || '予定の取得に失敗しました')
        setMemberData([])
        return
      }
      const data = await res.json()
      setMemberData(data.members || [])
    } catch (err) {
      console.error('fetchAvailability error:', err)
      setMemberData([])
    } finally {
      setLoading(false)
    }
  }, [selectedIds, dateRange])

  useEffect(() => {
    fetchAvailability()
  }, [fetchAvailability])

  // メンバー選択
  const handleToggle = useCallback((userId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(members.map(m => m.userId)))
  }, [members])

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  // カレンダー操作
  const handleDateRangeChange = useCallback((start: string, end: string) => {
    setDateRange({ start, end })
  }, [])

  const handleSlotSelect = useCallback((date: string, startTime: string, endTime: string) => {
    if (selectedIds.size === 0) {
      toast.error('メンバーを選択してください')
      return
    }
    setCreateInitial({ date, startTime, endTime })
    setCreateOpen(true)
  }, [selectedIds])

  const handleEventClick = useCallback((data: CalendarEventClickData) => {
    setDetailEvent(data as CalendarEventData)
    setDetailOpen(true)
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Canviカレンダー"
        description="メンバーの予定を横断表示。空き時間をクリックして予定を作成できます。"
        actions={
          <div className="flex items-center gap-3">
            {selectedIds.size > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSchedulingOpen(true)}
              >
                <Link2 className="h-4 w-4 mr-1.5" />
                日程調整URL発行
              </Button>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {selectedIds.size > 0
                ? `${selectedIds.size}人の予定を表示中`
                : 'メンバーを選択してください'}
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-[280px_1fr] gap-6">
        {/* 左パネル: メンバー選択 */}
        <Card>
          <CardContent className="pt-4">
            <MemberSelector
              members={members}
              selectedIds={selectedIds}
              onToggle={handleToggle}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
            />
          </CardContent>
        </Card>

        {/* 右パネル: チームカレンダー */}
        <div>
          {loading && (
            <div className="text-sm text-muted-foreground mb-2">読み込み中...</div>
          )}

          {selectedIds.size === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-medium text-lg mb-1">メンバーを選択</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  左パネルからメンバーをチェックすると、全員の予定がカレンダーに表示されます。
                  複数人を選択すると、全員が空いている時間帯がハイライトされます。
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {!loading && memberData.length > 0 && memberData.every(m => m.busy.length === 0) && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 text-sm text-amber-800">
                  選択中のメンバーにはこの期間の予定・シフトがありません。
                  Googleカレンダー連携がまだの場合は、再ログインしてGoogleカレンダーへのアクセスを許可してください。
                </div>
              )}
              <TeamCalendar
                members={memberData}
                selectedMemberIds={selectedIds}
                onSlotSelect={handleSlotSelect}
                onDateRangeChange={handleDateRangeChange}
                onEventClick={handleEventClick}
              />
            </>
          )}
        </div>
      </div>

      {/* 予定作成ダイアログ */}
      <AvailabilityCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        selectedUserIds={Array.from(selectedIds)}
        allUserIds={members.map(m => m.userId)}
        initialDate={createInitial.date}
        initialStartTime={createInitial.startTime}
        initialEndTime={createInitial.endTime}
        memberNames={memberNames}
        onCreated={fetchAvailability}
      />

      {/* イベント詳細ダイアログ */}
      <EventDetailDialog
        event={detailEvent}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdated={fetchAvailability}
      />

      {/* 日程調整ダイアログ */}
      <SchedulingDialog
        open={schedulingOpen}
        onOpenChange={setSchedulingOpen}
        selectedUserIds={Array.from(selectedIds)}
        memberNames={memberNames}
      />
    </div>
  )
}
