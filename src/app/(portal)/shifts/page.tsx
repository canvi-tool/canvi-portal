'use client'

import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client'
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  Plus,
  ChevronDown,
  Users,
  Check,
  X,
  Link2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValueWithLabel,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
// Dialog imports removed - now handled by PendingEventsPanel
import { PageHeader } from '@/components/layout/page-header'
import { ShiftFullCalendar, type CalendarShift, type GoogleCalendarEvent } from './_components/shift-fullcalendar'
import type { GCalEventItem } from './_components/gcal-event-dialog'
import { PendingEventsPanel } from './_components/pending-events-panel'
import type { PendingEvent } from './_components/pending-events-panel'

// Lazy load heavy dialog components (only loaded when opened)
const ShiftCreateDialog = lazy(() => import('./_components/shift-create-dialog').then(m => ({ default: m.ShiftCreateDialog })))
const ShiftBulkDialog = lazy(() => import('./_components/shift-bulk-dialog').then(m => ({ default: m.ShiftBulkDialog })))
const ShiftEditDialog = lazy(() => import('./_components/shift-edit-dialog').then(m => ({ default: m.ShiftEditDialog })))
const GCalEventDialog = lazy(() => import('./_components/gcal-event-dialog').then(m => ({ default: m.GCalEventDialog })))
const AvailabilityPanel = lazy(() => import('./_components/availability-panel').then(m => ({ default: m.AvailabilityPanel })))
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { toast } from 'sonner'

// --- Types ---

interface ProjectOption {
  id: string
  name: string
  shiftApprovalMode: 'AUTO' | 'APPROVAL'
}

interface StaffOption {
  id: string
  name: string
  userId?: string
}

// --- Component ---

export default function ShiftsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Data
  const [shifts, setShifts] = useState<CalendarShift[]>([])
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([])
  const [rawPendingEvents, setRawPendingEvents] = useState<PendingEvent[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [staffList, setStaffList] = useState<StaffOption[]>([])
  const staffListRef = useRef<StaffOption[]>([])
  useEffect(() => { staffListRef.current = staffList }, [staffList])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterStaffIds, setFilterStaffIds] = useState<string[]>([]) // empty = all
  // Stable primitive key derived from filterStaffIds to use in useCallback/useEffect deps
  const filterStaffIdsKey = useMemo(() => filterStaffIds.join(','), [filterStaffIds])
  const filterStaffIdsRef = useRef<string[]>([])
  useEffect(() => { filterStaffIdsRef.current = filterStaffIds }, [filterStaffIds])
  const [filterProject, setFilterProject] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Date range from FullCalendar (stored as primitives to avoid object identity issues)
  const [dateRangeStart, setDateRangeStart] = useState('')
  const [dateRangeEnd, setDateRangeEnd] = useState('')
  // Convenience object built from primitives (identity changes only when values change)
  const dateRange = useMemo(() => ({ start: dateRangeStart, end: dateRangeEnd }), [dateRangeStart, dateRangeEnd])

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createInitial, setCreateInitial] = useState({ date: '', startTime: '', endTime: '' })
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)

  // クエリ ?openBulk=1 で一括申請モーダルを自動オープン
  useEffect(() => {
    if (searchParams?.get('openBulk') === '1') {
      setBulkDialogOpen(true)
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        url.searchParams.delete('openBulk')
        window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [availabilitySheetOpen, setAvailabilitySheetOpen] = useState(false)
  // 複製プリフィル（Bulkダイアログで使用）
  const [duplicatePrefill, setDuplicatePrefill] = useState<{
    staffId?: string
    projectId?: string
    startTime?: string
    endTime?: string
    notes?: string
    title?: string
    attendees?: Array<{ email: string; name?: string; staff_id?: string }>
    slotEntries?: Array<{ date: string; startTime: string; endTime: string }>
  } | null>(null)

  // Edit dialog
  const [editingShift, setEditingShift] = useState<{
    id: string; staffId: string; staffName: string; projectId: string;
    projectName: string; date: string; startTime: string; endTime: string;
    status: 'SUBMITTED' | 'APPROVED' | 'NEEDS_REVISION';
    title?: string;
    notes?: string;
    googleMeetUrl?: string | null;
    attendees?: Array<{ email: string; name?: string; staff_id?: string }>;
  } | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  // GCal event dialog
  const [gcalEvent, setGcalEvent] = useState<GCalEventItem | null>(null)
  const [gcalDialogOpen, setGcalDialogOpen] = useState(false)

  const [isManager, setIsManager] = useState(false)
  const [currentStaffId, setCurrentStaffId] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [userRoles, setUserRoles] = useState<string[]>([])

  const [filterInitialized, setFilterInitialized] = useState(false)
  useEffect(() => {
    fetch('/api/user/current')
      .then(r => r.json())
      .then(data => {
        if (data.isManager != null) setIsManager(data.isManager)
        if (data.staffId) {
          setCurrentStaffId(data.staffId)
          // 初回ロード時のみ自分自身を選択状態にする
          setFilterStaffIds(prev => (prev.length === 0 ? [data.staffId] : prev))
        }
        if (data.roles) setUserRoles(data.roles)
        if (data.id) setCurrentUserId(data.id)
      })
      .catch(() => {})
      .finally(() => {
        // 初期化完了（staffId 取得に失敗した場合も fetch を解禁）
        setFilterInitialized(true)
      })
  }, [])

  // GCal→Canvi オンデマンド同期（refで最新のfetchShifts/refreshGoogleEventsを参照）
  const syncFromGcalRef = useRef<(silent: boolean) => Promise<void>>(async () => {})
  const syncFromGcal = useCallback(async (silent = false) => {
    await syncFromGcalRef.current(silent)
  }, [])
  syncFromGcalRef.current = async (silent: boolean) => {
    if (!dateRange.start || !dateRange.end) return
    try {
      // Phase 1: 新取込パス (PJ未割当モデル)
      let pendingCreated = 0
      try {
        const importRes = await fetch('/api/shifts/gcal-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ start_date: dateRange.start, end_date: dateRange.end }),
        })
        if (importRes.ok) {
          const importData = await importRes.json()
          pendingCreated = importData.created || 0
        }
      } catch { /* noop */ }

      const res = await fetch('/api/shifts/sync-from-gcal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: dateRange.start, end_date: dateRange.end }),
      })
      if (res.ok) {
        const data = await res.json()
        const changes = (data.created || 0) + (data.updated || 0) + (data.deleted || 0)
        const pendingMsg = pendingCreated > 0 ? ` / PJ未割当 ${pendingCreated}件 追加` : ''
        if (changes > 0 || pendingCreated > 0) {
          toast.success(`${data.message || '同期完了'}${pendingMsg}`)
        } else if (!silent) {
          toast.info('Googleカレンダーとの差分はありません')
        }
        // 常にシフトとGCalイベントの両方を再取得
        fetchShifts()
        refreshGoogleEvents()
      } else if (!silent) {
        const err = await res.json().catch(() => ({}))
        if (err.error !== 'Googleカレンダーが未連携です') {
          toast.error(err.error || '同期に失敗しました')
        }
      }
    } catch {
      if (!silent) toast.error('同期に失敗しました')
    }
  }

  // シフトデータ取得
  const fetchShiftsRef = useRef<() => Promise<void>>(async () => {})
  const fetchShifts = useCallback(async () => {
    await fetchShiftsRef.current()
  }, [])
  // ローカルミューテーション後の保険リフェッチ（単一呼び出し）
  // Realtimeの健全性に依存せず、操作ユーザー側で確実に最新状態を反映する
  // Promiseを返すことで、呼び出し元がawaitできる
  const fetchShiftsSafe = useCallback(() => {
    return fetchShiftsRef.current()
  }, [])
  // Request deduplication: skip if a fetch is already in flight
  const fetchInFlightRef = useRef(false)
  const fetchShiftsImpl = useCallback(async () => {
    if (!dateRangeStart || !dateRangeEnd) return
    // 初回フィルタ初期化（自分=デフォルト）が完了するまで待機
    // こうしないと currentUser 取得前に「全員」fetch が走り、後から自分 fetch と
    // レース状態になって全員分が残る事故が起きる
    if (!filterInitialized) return
    // リクエスト重複排除: 前回のフェッチが完了していなければスキップ
    if (fetchInFlightRef.current) return
    fetchInFlightRef.current = true
    setLoading(true)
    try {
      // Read filter arrays from refs (stable deps use primitive keys only)
      const staffIds = filterStaffIdsRef.current
      const params = new URLSearchParams({
        start_date: dateRangeStart,
        end_date: dateRangeEnd,
      })
      if (filterProject !== 'all') params.set('project_id', filterProject)
      if (staffIds.length > 0) params.set('staff_id', staffIds.join(','))
      if (filterStatus !== 'all') params.set('status', filterStatus)

      const __t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
      // shifts と gcal-pending を並列取得（直列だとRTTが倍になる）
      const pendingParams = new URLSearchParams({ start_date: dateRangeStart, end_date: dateRangeEnd })
      if (staffIds.length > 0) pendingParams.set('staff_id', staffIds.join(','))
      const [res, pendingRes] = await Promise.all([
        fetch(`/api/shifts?${params}`),
        fetch(`/api/shifts/gcal-pending?${pendingParams}`).catch(() => null),
      ])
      if (!res.ok) throw new Error('シフトの取得に失敗しました')
      const __ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - __t0
      if (__ms > 500) console.log(`[shifts] fetch ${Math.round(__ms)}ms (${staffIds.length || 'all'} staff)`)

      const data = await res.json()
      let list = data.data || (Array.isArray(data) ? data : [])

      // 安全網: Canvi発シフトの重複排除（同一 google_calendar_event_id / external_event_id）
      // GCal webhook 経由で稀に同一イベントに対して2行生成される事故が報告されたため、
      // 最も古い (created_at が古い) 1行だけを残す。
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const byKey = new Map<string, any>()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const deduped: any[] = []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const s of list as any[]) {
          const key = s.google_calendar_event_id || s.external_event_id || null
          if (!key) {
            deduped.push(s)
            continue
          }
          const prev = byKey.get(key)
          if (!prev) {
            byKey.set(key, s)
            deduped.push(s)
          } else {
            // 既存より古い方を残す
            const prevTs = new Date(prev.created_at || 0).getTime()
            const curTs = new Date(s.created_at || 0).getTime()
            if (curTs < prevTs) {
              const idx = deduped.indexOf(prev)
              if (idx >= 0) deduped[idx] = s
              byKey.set(key, s)
            }
          }
        }
        list = deduped
      } catch { /* noop */ }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: CalendarShift[] = list.map((s: any) => {
        const staff = s.staff || {}
        const project = s.project || {}
        return {
          id: s.id,
          staffId: s.staff_id,
          staffName: `${staff.last_name || ''} ${staff.first_name || ''}`.trim() || '不明',
          projectId: s.project_id || '',
          projectName: project.name || '未割当',
          date: s.shift_date,
          startTime: (s.start_time || '').slice(0, 5),
          endTime: (s.end_time || '').slice(0, 5),
          status: s.status,
          shiftType: s.shift_type || 'WORK',
          title: s.title || undefined,
          notes: s.notes,
          googleMeetUrl: s.google_meet_url,
          googleEventId: s.google_calendar_event_id,
          approvalMode: project.shift_approval_mode || 'AUTO',
          attendees: Array.isArray(s.attendees) ? s.attendees : [],
          source: (s.source || 'manual') as 'manual' | 'google_calendar' | 'import',
          needsProjectAssignment: !!s.needs_project_assignment,
        }
      })

      // 招待者（attendees.staff_id）を別スタッフの仮想シフトとして展開
      //   - 岡林のシフトに後藤が招待されていれば、後藤カレンダーにも「後藤優衣」名義で表示
      //   - 仮想行は編集/ドラッグ/削除不可（オーナーシフトの参照のみ）
      //
      // ★重複表示防止: 仮想行は「現在フィルタで表示対象になっているスタッフ」のみ生成する。
      // フィルタ未指定（自分のみ）の場合は currentStaffId のみ対象。
      // そうしないと、自分のカレンダーを見ているだけで、招待した相手の仮想行まで
      // 追加されてしまい、同じ時刻・同じタイトルの「二重表示」が発生する。
      const visibleStaffSet = new Set<string>(
        staffIds.length > 0
          ? staffIds
          : (currentStaffId ? [currentStaffId] : [])
      )
      const expanded: CalendarShift[] = []
      for (const s of mapped) {
        // オーナー行: オーナー staffId がフィルタ対象外なら非表示
        // （API は attendees 経由でも返すため、対象外オーナーが混ざる）
        const ownerVisible = visibleStaffSet.size === 0 || visibleStaffSet.has(s.staffId)
        if (ownerVisible) expanded.push(s)
        if (!s.attendees || s.attendees.length === 0) continue
        for (const a of s.attendees) {
          if (!a.staff_id || a.staff_id === s.staffId) continue
          // 現在表示中のスタッフでないなら仮想行を作らない
          if (visibleStaffSet.size > 0 && !visibleStaffSet.has(a.staff_id)) continue
          // staffList から名前を引ける場合はそれを優先、なければ attendee.name
          const staffInfo = staffListRef.current.find((x) => x.id === a.staff_id)
          const displayName = staffInfo?.name || a.name || a.email
          expanded.push({
            ...s,
            id: `${s.id}__att__${a.staff_id}`,
            staffId: a.staff_id,
            staffName: displayName,
            isVirtualAttendee: true,
            ownerShiftId: s.id,
          })
        }
      }
      // PJ未割当のGCal取込イベントはカレンダーには表示しない
      // pendingRes を rawPendingEvents に格納（PendingEventsPanel で使用）
      try {
        if (pendingRes && pendingRes.ok) {
          const pendingData = await pendingRes.json()
          const pendingList: PendingEvent[] = (Array.isArray(pendingData) ? pendingData : []).map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (p: any) => {
              // staffList から名前を引く
              const staffInfo = staffListRef.current.find((s) => s.id === p.staff_id)
              return {
                id: p.id,
                event_date: p.event_date,
                start_time: p.start_time,
                end_time: p.end_time,
                title: p.title || null,
                external_event_id: p.external_event_id,
                staff_name: staffInfo?.name || undefined,
              }
            }
          )
          setRawPendingEvents(pendingList)
        }
      } catch { /* noop */ }

      setShifts(expanded)
    } catch {
      toast.error('シフトの取得に失敗しました')
    } finally {
      setLoading(false)
      fetchInFlightRef.current = false
    }
  // Use primitive deps to avoid unnecessary recreation of the callback on object/array identity changes
  }, [dateRangeStart, dateRangeEnd, filterProject, filterStaffIdsKey, filterStatus, filterInitialized, currentStaffId])

  // 最新のfetchShiftsImplをrefに同期（stale closure対策）
  useEffect(() => {
    fetchShiftsRef.current = fetchShiftsImpl
  }, [fetchShiftsImpl])

  // プロジェクト一覧を取得（初回のみ）
  useEffect(() => {
    fetch('/api/projects?limit=100')
      .then(r => r.json())
      .then(res => {
        const list = res.data || (Array.isArray(res) ? res : [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setProjects(list.map((p: any) => ({
          id: p.id,
          name: p.name,
          shiftApprovalMode: p.shift_approval_mode || 'AUTO',
        })))
      })
      .catch(() => {})
  }, [])

  // スタッフ一覧を取得（プロジェクトフィルター変更時に再取得）
  useEffect(() => {
    const params = new URLSearchParams({ status: 'active', limit: '100', scope: 'accessible' })
    if (filterProject !== 'all') {
      params.set('project_id', filterProject)
    }
    fetch(`/api/staff?${params}`)
      .then(r => r.json())
      .then(res => {
        const list = res.data || (Array.isArray(res) ? res : [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setStaffList(list.map((s: any) => ({
          id: s.id,
          name: `${s.last_name || ''} ${s.first_name || ''}`.trim(),
          userId: s.user_id || undefined,
        })))
      })
      .catch(() => {})
  }, [filterProject])

  useEffect(() => {
    fetchShiftsImpl()
  }, [fetchShiftsImpl])

  // ページ表示時にGCal→Canvi自動同期（サイレント）
  useEffect(() => {
    if (dateRange.start && dateRange.end && currentUserId) {
      syncFromGcal(true)
    }
  }, [dateRange.start, dateRange.end, currentUserId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ページ初回表示時に GCal watch channel を ensure 登録 (既登録ならスキップ)
  // これにより webhook が常時有効になり、polling 経由の 15s 遅延が解消される
  // sessionStorage で同一セッション内の重複呼び出しを防止
  useEffect(() => {
    if (!currentUserId) return
    const cacheKey = `gcal-watch-registered-${currentUserId}`
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(cacheKey)) return
    // fire-and-forget
    fetch('/api/gcal-watch/register?ensure=1', { method: 'POST' })
      .then(() => {
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(cacheKey, '1')
      })
      .catch(() => {})
  }, [currentUserId])

  // ポーリング + ウィンドウフォーカス時に再取得（webhook/Realtime のフォールバック）
  useEffect(() => {
    if (!dateRange.start || !dateRange.end || !currentUserId) return
    let lastRun = 0
    const MIN_INTERVAL = 20_000 // 20秒以内の重複トリガーは無視
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastRun < MIN_INTERVAL) return
      lastRun = now
      syncFromGcal(true)
    }
    // webhook + Realtime が主経路。polling は 30 秒毎のフォールバック
    const interval = setInterval(tick, 30_000)
    const onFocus = () => tick()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [dateRange.start, dateRange.end, currentUserId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Supabase Realtime: shifts テーブルの変更を購読して即時UI更新
  // これにより GCal webhook → DB 書き込み → 1秒以内に Canvi UI に反映される
  useEffect(() => {
    if (!currentUserId) return
    const supabase = createSupabaseBrowserClient()
    let pendingTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleRefetch = () => {
      if (pendingTimer) return
      // 連続変更のデバウンス（300msウィンドウでまとめて1回再取得）
      // webhook で複数件まとめて DB に書かれるケースを 1回にまとめる
      pendingTimer = setTimeout(() => {
        pendingTimer = null
        fetchShiftsRef.current()
        // DB書き込み完了後にGCalイベントも再取得（シフト↔GCal同期の反映）
        refreshGoogleEventsRef.current()
      }, 300)
    }
    const channel = supabase
      .channel('shifts-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts' },
        (payload) => {
          console.log('[shifts-realtime] postgres_changes', payload.eventType)
          scheduleRefetch()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gcal_pending_events' },
        (payload) => {
          console.log('[shifts-realtime] gcal_pending_events changed', payload.eventType)
          scheduleRefetch()
        }
      )
      .on('broadcast', { event: 'shifts-changed' }, () => {
        console.log('[shifts-realtime] broadcast received')
        scheduleRefetch()
      })
      .subscribe((status, err) => {
        console.log('[shifts-realtime] status:', status, err || '')
      })
    return () => {
      if (pendingTimer) clearTimeout(pendingTimer)
      supabase.removeChannel(channel)
    }
  }, [currentUserId])

  // フィルター対象のGCalユーザーID群を算出
  const gcalTargets = useMemo(() => {
    // スタッフが明示的に選択されている場合はそのメンバーのみ
    if (filterStaffIds.length > 0) {
      return filterStaffIds
        .map(sid => {
          const staff = staffList.find(s => s.id === sid)
          if (!staff?.userId) return null
          return { userId: staff.userId, staffId: staff.id, staffName: staff.name }
        })
        .filter((x): x is { userId: string; staffId: string; staffName: string } => !!x)
    }
    // 「全スタッフ」選択時: staffList の全員（userIdがあるメンバー）のGCalを取得
    // staffList はプロジェクトフィルターに連動して絞り込まれている
    if (staffList.length > 0) {
      const all = staffList
        .filter(s => !!s.userId)
        .map(s => ({ userId: s.userId!, staffId: s.id, staffName: s.name }))
      if (all.length > 0) return all
    }
    // フォールバック: 自分のみ
    return currentUserId ? [{ userId: currentUserId, staffId: currentStaffId || '', staffName: '' }] : []
  }, [filterStaffIds, staffList, currentUserId, currentStaffId])

  const gcalTargetsKey = useMemo(() => gcalTargets.map(t => t.userId).join(','), [gcalTargets])

  // 選択スタッフ変更時: 即座に GCal インポート → fetch シフト → 予定再取得
  const lastImportKeyRef = useRef<string>('')
  // gcal-import 対象のスタッフID群（全スタッフ時はstaffList全員）
  const importStaffIds = useMemo(() => {
    if (filterStaffIds.length > 0) return filterStaffIds
    return staffList.map(s => s.id)
  }, [filterStaffIds, staffList])
  useEffect(() => {
    if (!isManager) return
    if (importStaffIds.length === 0) return
    if (!dateRange.start || !dateRange.end) return
    const key = `${importStaffIds.slice().sort().join(',')}|${dateRange.start}|${dateRange.end}`
    if (lastImportKeyRef.current === key) return
    lastImportKeyRef.current = key
    ;(async () => {
      try {
        const res = await fetch('/api/shifts/gcal-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_ids: importStaffIds,
            start_date: dateRange.start,
            end_date: dateRange.end,
          }),
        })
        if (res.ok) {
          fetchShifts()
          refreshGoogleEvents()
        }
      } catch { /* noop */ }
    })()
  }, [importStaffIds, dateRange.start, dateRange.end, isManager]) // eslint-disable-line react-hooks/exhaustive-deps

  // Googleカレンダー予定取得（複数ユーザー対応）
  useEffect(() => {
    if (gcalTargets.length === 0 || !dateRange.start || !dateRange.end) {
      setGoogleEvents([])
      return
    }
    const timeMin = `${dateRange.start}T00:00:00+09:00`
    const timeMax = `${dateRange.end}T23:59:59+09:00`
    const userIdToMeta = new Map(gcalTargets.map(t => [t.userId, t]))
    const params = new URLSearchParams({
      user_ids: gcalTargets.map(t => t.userId).join(','),
      time_min: timeMin,
      time_max: timeMax,
    })
    console.log(`[gcal] Fetching availability for ${gcalTargets.length} users`)
    fetch(`/api/calendar/availability?${params}`)
      .then(r => {
        if (!r.ok) { console.error('[gcal] availability returned', r.status); return null }
        return r.json()
      })
      .then(data => {
        if (!data?.members?.length) { console.warn('[gcal] No members in response'); setGoogleEvents([]); return }
        const all: GoogleCalendarEvent[] = []
        const seen = new Map<string, number>()
        let totalGcalEvents = 0
        let skippedCanvi = 0
        for (const member of data.members as Array<{ id: string; busy?: Array<{ source: string; start: string; end: string; summary?: string; eventId?: string; description?: string; location?: string; meetUrl?: string; canviShiftId?: string; attendees?: Array<{ email: string; displayName?: string; responseStatus?: string; organizer?: boolean; self?: boolean }> }>; gcalStatus?: string }>) {
          const meta = userIdToMeta.get(member.id)
          const memberGcalCount = (member.busy || []).filter(b => b.source === 'google').length
          console.log(`[gcal] Member ${member.id}: ${memberGcalCount} google events, gcalStatus=${member.gcalStatus || 'n/a'}`)
          for (const b of member.busy || []) {
            if (b.source !== 'google') continue
            totalGcalEvents++
            // Canvi発のイベントはスキップ（Canvi側の表示を優先）
            if (b.canviShiftId) { skippedCanvi++; continue }
            const ev: GoogleCalendarEvent = {
              id: b.eventId || `gcal-${member.id}-${b.start}`,
              summary: b.summary || '(予定)',
              start: b.start,
              end: b.end,
              description: b.description,
              location: b.location,
              meetUrl: b.meetUrl || null,
              staffId: meta?.staffId || undefined,
              staffName: meta?.staffName || undefined,
              attendees: b.attendees,
            }
            // 複数メンバーで同じGCalイベント(eventId)が返るケースを dedup
            // staffIdを持つ（=フィルタ選択スタッフ）方を優先表示
            const key = ev.id
            const prevIdx = seen.get(key)
            if (prevIdx === undefined) {
              seen.set(key, all.length)
              all.push(ev)
            } else if (!all[prevIdx].staffId && ev.staffId) {
              all[prevIdx] = ev
            }
          }
        }
        console.log(`[gcal] Total: ${totalGcalEvents} google events, ${skippedCanvi} skipped (canvi), ${all.length} to render`)
        setGoogleEvents(all)
      })
      .catch((err) => { console.error('[gcal] availability fetch error:', err); setGoogleEvents([]) })
  }, [gcalTargetsKey, dateRange.start, dateRange.end]) // eslint-disable-line react-hooks/exhaustive-deps

  // FullCalendar handlers

  const handleDateRangeChange = useCallback((start: string, end: string) => {
    setDateRangeStart(prev => prev === start ? prev : start)
    setDateRangeEnd(prev => prev === end ? prev : end)
  }, [])

  // shifts を ref で持ち、ハンドラの識別子を安定化（FullCalendar の不要な再レンダを削減）
  const shiftsRef = useRef<CalendarShift[]>([])
  useEffect(() => { shiftsRef.current = shifts }, [shifts])

  const handleShiftClick = useCallback((shift: CalendarShift) => {
    // GCal pending events are now handled by PendingEventsPanel (not shown on calendar)
    if (shift.id.startsWith('gcal_pending__')) {
      return
    }
    // 仮想招待行クリック → オーナーシフトを開く（同じデータを参照するため情報は同一）
    const realId = shift.isVirtualAttendee && shift.ownerShiftId ? shift.ownerShiftId : shift.id
    const owner = shift.isVirtualAttendee
      ? shiftsRef.current.find((s) => s.id === realId) || shift
      : shift
    setEditingShift({
      id: owner.id,
      staffId: owner.staffId,
      staffName: owner.staffName,
      projectId: owner.projectId,
      projectName: owner.projectName,
      date: owner.date,
      startTime: owner.startTime,
      endTime: owner.endTime,
      status: owner.status,
      title: owner.title,
      notes: owner.notes,
      googleMeetUrl: owner.googleMeetUrl,
      attendees: owner.attendees || [],
    })
    setEditDialogOpen(true)
  }, [isManager]) // shifts は ref 経由で参照

  const handleShiftDragUpdate = useCallback(async (
    shiftId: string, date: string, startTime: string, endTime: string
  ): Promise<boolean> => {
    if (shiftId.startsWith('gcal_pending__')) {
      toast.error('PJ未割当のGCal予定はPJ選択後に編集できます')
      return false
    }
    if (shiftId.includes('__att__')) {
      toast.error('招待されたシフトは変更できません（主催者のみ編集可能）')
      return false
    }
    try {
      const res = await fetch(`/api/shifts/${shiftId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shift_date: date,
          start_time: startTime,
          end_time: endTime,
          _dragUpdate: true,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'シフトの更新に失敗しました')
        return false
      }
      toast.success('シフトを移動しました')
      fetchShiftsSafe()
      return true
    } catch {
      toast.error('シフトの更新に失敗しました')
      return false
    }
  }, [fetchShiftsSafe])

  const handleShiftCopy = useCallback(async (shiftId: string, targetDate: string) => {
    const resolvedId = shiftId.includes('__att__') ? shiftId.split('__att__')[0] : shiftId
    const source = shiftsRef.current.find(s => s.id === resolvedId)
    if (!source || !targetDate) return

    try {
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: source.staffId,
          project_id: source.projectId,
          shift_date: targetDate,
          start_time: source.startTime,
          end_time: source.endTime,
          shift_type: source.shiftType,
          notes: source.notes,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success(`${targetDate} にシフトをコピーしました`)
      fetchShiftsSafe()
    } catch {
      toast.error('シフトのコピーに失敗しました')
    }
  }, [fetchShiftsSafe])

  const handleShiftDelete = useCallback(async (shiftId: string) => {
    if (shiftId.startsWith('gcal_pending__')) {
      toast.error('PJ未割当のGCal予定はここから削除できません')
      return
    }
    if (shiftId.includes('__att__')) {
      toast.error('招待されたシフトは削除できません（主催者のみ可能）')
      return
    }
    // 楽観的UI: ローカルstateからすぐに削除
    const prev = shiftsRef.current
    setShifts(curr => curr.filter(s => s.id !== shiftId))
    try {
      const res = await fetch(`/api/shifts/${shiftId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('シフトを削除しました')
        fetchShiftsSafe()
      } else {
        setShifts(prev)
        toast.error('シフトの削除に失敗しました')
      }
    } catch {
      setShifts(prev)
      toast.error('シフトの削除に失敗しました')
    }
  }, [fetchShiftsSafe])

  const handleSlotSelect = useCallback((date: string, startTime: string, endTime: string) => {
    setCreateInitial({ date, startTime, endTime })
    setCreateDialogOpen(true)
  }, [])

  const handleShiftSave = useCallback(async (updated: { id: string; staffName: string; startTime: string; endTime: string; projectId?: string; title?: string; notes?: string; attendees?: Array<{ email: string; name?: string; staff_id?: string }> }) => {
    try {
      const body: Record<string, unknown> = {
        start_time: updated.startTime,
        end_time: updated.endTime,
        _inlineUpdate: true,
      }
      if (updated.projectId) body.project_id = updated.projectId
      if (updated.title !== undefined) body.title = updated.title
      if (updated.notes !== undefined) body.notes = updated.notes
      if (Array.isArray(updated.attendees)) body.attendees = updated.attendees

      const res = await fetch(`/api/shifts/${updated.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success(`${updated.staffName}のシフトを更新しました`)
        fetchShiftsSafe()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'シフトの更新に失敗しました')
      }
    } catch {
      toast.error('シフトの更新に失敗しました')
    }
  }, [fetchShiftsSafe])

  const handleShiftApprove = useCallback(async (shiftId: string) => {
    try {
      const res = await fetch(`/api/shifts/${shiftId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE' }),
      })
      if (res.ok) {
        toast.success('シフトを承認しました')
        fetchShiftsSafe()
      }
    } catch {
      toast.error('シフトの承認に失敗しました')
    }
  }, [fetchShiftsSafe])

  const handleShiftReject = useCallback(async (shiftId: string) => {
    try {
      const res = await fetch(`/api/shifts/${shiftId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECT' }),
      })
      if (res.ok) {
        toast.success('シフトを却下しました')
        fetchShiftsSafe()
      }
    } catch {
      toast.error('シフトの却下に失敗しました')
    }
  }, [fetchShiftsSafe])

  // --- Google Calendar event handlers ---

  const handleGoogleEventClick = useCallback((event: GoogleCalendarEvent) => {
    setGcalEvent({
      id: event.id,
      summary: event.summary,
      start: event.start,
      end: event.end,
      description: event.description,
      location: event.location,
      meetUrl: event.meetUrl,
      attendees: event.attendees,
    })
    setGcalDialogOpen(true)
  }, [])

  const handleGcalEventUpdate = useCallback(async (
    eventId: string,
    payload: { summary?: string; description?: string; startDateTime?: string; endDateTime?: string; attendees?: string[] }
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/gcal-events/${encodeURIComponent(eventId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Googleカレンダーの更新に失敗しました')
        return false
      }
      toast.success('Googleカレンダーの予定を更新しました')
      refreshGoogleEvents()
      return true
    } catch {
      toast.error('Googleカレンダーの更新に失敗しました')
      return false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleGoogleEventDragUpdate = useCallback(async (
    eventId: string, startDateTime: string, endDateTime: string
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/gcal-events/${encodeURIComponent(eventId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDateTime, endDateTime }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Googleカレンダーの更新に失敗しました')
        return false
      }
      toast.success('Googleカレンダーの予定を移動しました')
      // GCal予定を再取得
      refreshGoogleEvents()
      return true
    } catch {
      toast.error('Googleカレンダーの更新に失敗しました')
      return false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleGcalEventTimeUpdate = useCallback(async (
    eventId: string, startDateTime: string, endDateTime: string
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/gcal-events/${encodeURIComponent(eventId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDateTime, endDateTime }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Googleカレンダーの更新に失敗しました')
        return false
      }
      toast.success('Googleカレンダーの予定を更新しました')
      refreshGoogleEvents()
      return true
    } catch {
      toast.error('Googleカレンダーの更新に失敗しました')
      return false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleGcalEventDelete = useCallback(async (eventId: string) => {
    try {
      const res = await fetch(`/api/gcal-events/${encodeURIComponent(eventId)}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Googleカレンダーの予定を削除しました')
        refreshGoogleEvents()
      } else {
        toast.error('Googleカレンダーの予定の削除に失敗しました')
      }
    } catch {
      toast.error('Googleカレンダーの予定の削除に失敗しました')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleGcalMeetCreate = useCallback(async (eventId: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/gcal-events/${encodeURIComponent(eventId)}/meet`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Meet URLの発行に失敗しました')
        return null
      }
      const data = await res.json()
      toast.success('Google Meet URLを発行しました')
      refreshGoogleEvents()
      return data.meetUrl
    } catch {
      toast.error('Meet URLの発行に失敗しました')
      return null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleGcalMeetDelete = useCallback(async (eventId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/gcal-events/${encodeURIComponent(eventId)}/meet`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Meet URLの削除に失敗しました')
        return false
      }
      toast.success('Google Meet URLを削除しました')
      refreshGoogleEvents()
      return true
    } catch {
      toast.error('Meet URLの削除に失敗しました')
      return false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // GCal予定を再取得するヘルパー（refで最新状態を参照）
  const refreshGoogleEventsRef = useRef<() => void>(() => {})
  const refreshGoogleEvents = useCallback(() => {
    refreshGoogleEventsRef.current()
  }, [])
  refreshGoogleEventsRef.current = () => {
    if (gcalTargets.length === 0 || !dateRange.start || !dateRange.end) return
    const timeMin = `${dateRange.start}T00:00:00+09:00`
    const timeMax = `${dateRange.end}T23:59:59+09:00`
    const userIdToMeta = new Map(gcalTargets.map(t => [t.userId, t]))
    const params = new URLSearchParams({
      user_ids: gcalTargets.map(t => t.userId).join(','),
      time_min: timeMin,
      time_max: timeMax,
    })
    console.log('[gcal-refresh] Refreshing Google events...')
    fetch(`/api/calendar/availability?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.members?.length) { console.warn('[gcal-refresh] No members'); setGoogleEvents([]); return }
        const all: GoogleCalendarEvent[] = []
        const seen = new Map<string, number>()
        for (const member of data.members as Array<{ id: string; busy?: Array<{ source: string; start: string; end: string; summary?: string; eventId?: string; description?: string; location?: string; meetUrl?: string; canviShiftId?: string; attendees?: Array<{ email: string; displayName?: string; responseStatus?: string; organizer?: boolean; self?: boolean }> }> }>) {
          const meta = userIdToMeta.get(member.id)
          for (const b of member.busy || []) {
            if (b.source !== 'google') continue
            if (b.canviShiftId) continue
            const ev: GoogleCalendarEvent = {
              id: b.eventId || `gcal-${member.id}-${b.start}`,
              summary: b.summary || '(予定)',
              start: b.start,
              end: b.end,
              description: b.description,
              location: b.location,
              meetUrl: b.meetUrl || null,
              staffId: meta?.staffId || undefined,
              staffName: meta?.staffName || undefined,
              attendees: b.attendees,
            }
            const key = ev.id
            const prevIdx = seen.get(key)
            if (prevIdx === undefined) {
              seen.set(key, all.length)
              all.push(ev)
            } else if (!all[prevIdx].staffId && ev.staffId) {
              all[prevIdx] = ev
            }
          }
        }
        setGoogleEvents(all)
      })
      .catch(() => {})
  }

  // Stats
  const totalShifts = shifts.length
  const pendingCount = shifts.filter(s => s.status === 'SUBMITTED').length
  const approvedCount = shifts.filter(s => s.status === 'APPROVED').length

  // 合計時間計算（スタッフ別: 重複区間をマージして重複カウント回避 / PJ別: 重複除去せず加算）
  const staffHours = useMemo(() => {
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number)
      return h * 60 + m
    }
    // スタッフ×日付 でまとめ → 区間マージ
    const intervalsByStaffDay = new Map<string, { start: number; end: number }[]>()
    const staffMeta = new Map<string, { name: string; shifts: number }>()
    const projectMap = new Map<string, { name: string; hours: number; shifts: number }>()

    for (const s of shifts) {
      if (s.shiftType !== 'WORK') continue
      const start = toMin(s.startTime)
      const end = toMin(s.endTime)
      if (end <= start) continue

      const key = `${s.staffId}::${s.date}`
      if (!intervalsByStaffDay.has(key)) intervalsByStaffDay.set(key, [])
      intervalsByStaffDay.get(key)!.push({ start, end })

      const meta = staffMeta.get(s.staffId)
      if (meta) meta.shifts += 1
      else staffMeta.set(s.staffId, { name: s.staffName, shifts: 1 })

      // PJ別は重複除去しない
      const hours = (end - start) / 60
      const pj = projectMap.get(s.projectId)
      if (pj) { pj.hours += hours; pj.shifts += 1 }
      else projectMap.set(s.projectId, { name: s.projectName, hours, shifts: 1 })
    }

    // スタッフごとに区間マージして合計時間算出
    const staffHoursMap = new Map<string, number>()
    for (const [key, intervals] of intervalsByStaffDay) {
      const staffId = key.split('::')[0]
      intervals.sort((a, b) => a.start - b.start)
      let merged = 0
      let curStart = intervals[0].start
      let curEnd = intervals[0].end
      for (let i = 1; i < intervals.length; i++) {
        const iv = intervals[i]
        if (iv.start <= curEnd) {
          curEnd = Math.max(curEnd, iv.end)
        } else {
          merged += curEnd - curStart
          curStart = iv.start
          curEnd = iv.end
        }
      }
      merged += curEnd - curStart
      staffHoursMap.set(staffId, (staffHoursMap.get(staffId) || 0) + merged / 60)
    }

    let totalHours = 0
    const byStaff = Array.from(staffMeta.entries()).map(([id, m]) => {
      const h = staffHoursMap.get(id) || 0
      totalHours += h
      return { name: m.name, hours: h, shifts: m.shifts }
    }).sort((a, b) => b.hours - a.hours)

    const byProject = Array.from(projectMap.values()).sort((a, b) => b.hours - a.hours)

    return { byStaff, byProject, totalHours }
  }, [shifts])

  // シフト由来のGCalイベントを除外（重複表示防止: シフト管理側を優先表示）
  const dedupedGoogleEvents = useMemo(() => {
    if (googleEvents.length > 0) {
      console.log(`[gcal-dedup] Input: ${googleEvents.length} google events, ${shifts.length} shifts`)
    }
    const shiftEventIds = new Set(
      shifts.map(s => s.googleEventId).filter((v): v is string => !!v)
    )
    // 時間+スタッフでのキーも作成（google_calendar_event_id 未反映の同期前シフトを除外するため）
    const shiftTimeKeys = new Set<string>()
    for (const s of shifts) {
      if (s.isVirtualAttendee) continue
      // staffId|YYYY-MM-DDTHH:mm|HH:mm
      shiftTimeKeys.add(`${s.staffId}|${s.date}T${s.startTime}|${s.endTime}`)
    }
    return googleEvents.filter(e => {
      if (shiftEventIds.has(e.id)) return false
      // start/end ISO → date + HH:mm
      try {
        const sd = new Date(e.start)
        const ed = new Date(e.end)
        const pad = (n: number) => String(n).padStart(2, '0')
        const dateStr = `${sd.getFullYear()}-${pad(sd.getMonth() + 1)}-${pad(sd.getDate())}`
        const stStr = `${pad(sd.getHours())}:${pad(sd.getMinutes())}`
        const enStr = `${pad(ed.getHours())}:${pad(ed.getMinutes())}`
        if (e.staffId) {
          if (shiftTimeKeys.has(`${e.staffId}|${dateStr}T${stStr}|${enStr}`)) return false
        } else if (currentStaffId) {
          // staffId 未指定（自分のGCal）→ 自分のシフトと一致した場合のみ除外
          if (shiftTimeKeys.has(`${currentStaffId}|${dateStr}T${stStr}|${enStr}`)) return false
        }
      } catch { /* noop */ }
      return true
    })
  }, [googleEvents, shifts, currentStaffId])

  // Google Calendar events: スタッフフィルター選択時は選択スタッフのイベントのみ表示
  const googleEventsForCalendar = useMemo(() => {
    if (filterStaffIds.length === 0) return dedupedGoogleEvents
    const selectedSet = new Set(filterStaffIds)
    return dedupedGoogleEvents.filter(e => {
      // staffId がセットされていて選択中のスタッフに含まれる場合のみ表示
      if (e.staffId && selectedSet.has(e.staffId)) return true
      // staffId が未セット（= 自分のカレンダー）は、自分が選択されている場合のみ
      if (!e.staffId && currentStaffId && selectedSet.has(currentStaffId)) return true
      return false
    })
  }, [dedupedGoogleEvents, filterStaffIds, currentStaffId])

  // Filter labels
  const projectLabels = useMemo<Record<string, string>>(() => (
    { all: '全プロジェクト', ...Object.fromEntries(projects.map(p => [p.id, p.name])) }
  ), [projects])
const statusLabels = useMemo<Record<string, string>>(() => ({
    all: '全ステータス',
    SUBMITTED: '申請中',
    APPROVED: '承認済',
    NEEDS_REVISION: '修正依頼',
  }), [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Canviカレンダー"
        description="ドラッグ&リサイズでシフトを直感的に管理"
        actions={
          <div className="flex items-center gap-2">
<Button
              size="sm"
              onClick={() => {
                const today = new Date()
                const y = today.getFullYear()
                const m = String(today.getMonth() + 1).padStart(2, '0')
                const d = String(today.getDate()).padStart(2, '0')
                setCreateInitial({ date: `${y}-${m}-${d}`, startTime: '09:00', endTime: '18:00' })
                setCreateDialogOpen(true)
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              申請
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkDialogOpen(true)}
            >
              <CalendarPlus className="h-4 w-4 mr-1" />
              一括申請
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAvailabilitySheetOpen(true)}
            >
              <Link2 className="h-4 w-4 mr-1" />
              日程調整URL発行
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/shifts/pending')}
            >
              <Clock className="h-4 w-4 mr-1" />
              承認待ち
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 min-w-4 text-[10px]">
                  {pendingCount}
                </Badge>
              )}
            </Button>
            <PendingEventsPanel
              events={rawPendingEvents}
              projects={projects}
              isManager={isManager}
              onAssign={async (eventId, projectId) => {
                const res = await fetch(`/api/shifts/gcal-pending/${eventId}/assign`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ project_id: projectId }),
                })
                if (!res.ok) throw new Error('Assign failed')
              }}
              onExclude={async (eventId) => {
                const res = await fetch(`/api/shifts/gcal-pending/${eventId}`, { method: 'PATCH' })
                if (!res.ok) throw new Error('Exclude failed')
              }}
              onBulkAssign={async (eventIds, projectId) => {
                const res = await fetch('/api/shifts/gcal-pending/bulk-assign', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ids: eventIds, project_id: projectId }),
                })
                if (!res.ok) throw new Error('Bulk assign failed')
              }}
              onBulkExclude={async (eventIds) => {
                await Promise.all(eventIds.map(id =>
                  fetch(`/api/shifts/gcal-pending/${id}`, { method: 'PATCH' })
                ))
              }}
              onRefresh={fetchShiftsSafe}
            />
          </div>
        }
      />

      {/* Stats Bar */}
      <Card>
        <CardContent className="pt-0">
          <div className="flex items-center gap-6 flex-wrap">
            {/* 合計 */}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-lg font-bold">{staffHours.totalHours.toFixed(1)}h</span>
              <span className="text-xs text-muted-foreground">合計</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{totalShifts}件</span>
            </div>
            {pendingCount > 0 && (
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-sm text-amber-600">{pendingCount}件待ち</span>
              </div>
            )}
            {approvedCount > 0 && (
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                <span className="text-sm text-green-600">{approvedCount}件承認</span>
              </div>
            )}

            {/* スタッフ別時間（重複区間マージ済） */}
            {staffHours.byStaff.length > 0 && (
              <>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-3 flex-wrap">
                  {staffHours.byStaff.map((s) => (
                    <div key={s.name} className="flex items-center gap-1 text-xs">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-primary font-bold">{s.hours.toFixed(1)}h</span>
                      <span className="text-muted-foreground">({s.shifts}件)</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* PJ別稼働時間 */}
            {staffHours.byProject.length > 0 && (
              <>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">PJ別</span>
                  {staffHours.byProject.map((p) => (
                    <div key={p.name} className="flex items-center gap-1 text-xs">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-emerald-600 font-bold">{p.hours.toFixed(1)}h</span>
                      <span className="text-muted-foreground">({p.shifts}件)</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="h-9 w-auto min-w-[120px] text-sm">
            <SelectValueWithLabel value={filterProject} labels={projectLabels} placeholder="全PJ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全プロジェクト</SelectItem>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 w-auto min-w-[100px] text-sm">
            <SelectValueWithLabel value={filterStatus} labels={statusLabels} placeholder="全状態" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(statusLabels).map(([key, val]) => (
              <SelectItem key={key} value={key}>{val}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger
            className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md border border-input bg-background px-3 h-9 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground"
          >
            <Users className="h-3.5 w-3.5" />
            {filterStaffIds.length === 0
              ? '全スタッフ'
              : filterStaffIds.length === 1
                ? staffList.find(s => s.id === filterStaffIds[0])?.name || '1名'
                : `${filterStaffIds.length}名選択`}
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-1 max-h-64 overflow-y-auto">
              <div
                role="button"
                tabIndex={0}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-muted cursor-pointer select-none"
                onClick={() => setFilterStaffIds([])}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setFilterStaffIds([])
                  }
                }}
              >
                <span
                  className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    filterStaffIds.length === 0
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-input'
                  }`}
                  aria-hidden
                >
                  {filterStaffIds.length === 0 && <Check className="h-3 w-3" />}
                </span>
                全スタッフ
              </div>
              <div className="border-t my-1" />
              {staffList.map(s => {
                const isSelected = filterStaffIds.includes(s.id)
                const toggle = () => {
                  setFilterStaffIds(prev =>
                    prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                  )
                }
                return (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-muted cursor-pointer select-none"
                    onClick={toggle}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggle()
                      }
                    }}
                  >
                    <span
                      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        isSelected
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-input'
                      }`}
                      aria-hidden
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </span>
                    {s.name}
                  </div>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* 選択中スタッフのチップ表示 */}
        {filterStaffIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {filterStaffIds.map(sid => {
              const s = staffList.find(st => st.id === sid)
              if (!s) return null
              return (
                <span
                  key={sid}
                  className="inline-flex items-center gap-1 rounded-full border bg-muted/60 pl-2 pr-1 py-0.5 text-xs"
                >
                  {s.name}
                  <button
                    type="button"
                    aria-label={`${s.name}を選択解除`}
                    onClick={() => setFilterStaffIds(prev => prev.filter(id => id !== sid))}
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-background"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )
            })}
            <button
              type="button"
              onClick={() => setFilterStaffIds([])}
              className="text-[11px] text-muted-foreground hover:text-foreground underline ml-1"
            >
              全解除
            </button>
          </div>
        )}

        {loading && (
          <span className="text-xs text-muted-foreground">読み込み中...</span>
        )}
      </div>

      {/* FullCalendar */}
      <ShiftFullCalendar
        shifts={shifts}
        googleEvents={googleEventsForCalendar}
        isManager={isManager}
        currentStaffId={currentStaffId || undefined}
        onShiftClick={handleShiftClick}
        onShiftDragUpdate={handleShiftDragUpdate}
        onShiftCopy={handleShiftCopy}
        onShiftDelete={handleShiftDelete}
        onSlotSelect={handleSlotSelect}
        onDateRangeChange={handleDateRangeChange}
        onGoogleEventClick={handleGoogleEventClick}
        onGoogleEventDragUpdate={handleGoogleEventDragUpdate}
      />

      {/* Create Dialog (lazy loaded) */}
      {createDialogOpen && (
        <Suspense fallback={null}>
          <ShiftCreateDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            initialDate={createInitial.date}
            initialStartTime={createInitial.startTime}
            initialEndTime={createInitial.endTime}
            projects={projects}
            staffList={staffList}
            currentStaffId={currentStaffId}
            isManager={isManager}
            onCreated={fetchShiftsSafe}
          />
        </Suspense>
      )}

      {/* Availability Sheet */}
      <Sheet open={availabilitySheetOpen} onOpenChange={setAvailabilitySheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>日程調整URL発行</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <Suspense fallback={<div className="text-sm text-muted-foreground p-4">読み込み中...</div>}>
            <AvailabilityPanel
              selectedStaffIds={filterStaffIds}
              staffList={staffList}
              onReserveSlots={async ({ slots, memberStaffIds }) => {
                // memberStaffIds → staff詳細を取得して attendees 生成
                let attendeeList: Array<{ email: string; name?: string; staff_id?: string }> = []
                try {
                  const res = await fetch('/api/staff?limit=500')
                  const json = await res.json()
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const items: any[] = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : []
                  const byId = new Map<string, { email?: string; name: string }>()
                  for (const it of items) {
                    byId.set(it.id, {
                      email: it.email || undefined,
                      name: `${it.last_name || ''} ${it.first_name || ''}`.trim() || it.email || '',
                    })
                  }
                  // 予約者（currentStaffId）以外を招待者として追加
                  attendeeList = memberStaffIds
                    .filter((sid) => sid !== currentStaffId)
                    .map((sid) => {
                      const s = byId.get(sid)
                      return s?.email ? { email: s.email, name: s.name, staff_id: sid } : null
                    })
                    .filter((a): a is { email: string; name: string; staff_id: string } => !!a)
                } catch (e) {
                  console.error('Failed to resolve attendees', e)
                }

                setDuplicatePrefill({
                  staffId: currentStaffId,
                  attendees: attendeeList,
                  title: '日程調整',
                  slotEntries: slots,
                })
                setAvailabilitySheetOpen(false)
                setBulkDialogOpen(true)
              }}
            />
            </Suspense>
          </div>
        </SheetContent>
      </Sheet>

      {/* Bulk Dialog (lazy loaded) */}
      {bulkDialogOpen && (
        <Suspense fallback={null}>
          <ShiftBulkDialog
            open={bulkDialogOpen}
            onOpenChange={(o) => { setBulkDialogOpen(o); if (!o) setDuplicatePrefill(null) }}
            projects={projects}
            staffList={staffList}
            currentStaffId={currentStaffId}
            isManager={isManager}
            userRoles={userRoles}
            onCreated={fetchShiftsSafe}
            prefill={duplicatePrefill}
          />
        </Suspense>
      )}

      {/* Edit Dialog (lazy loaded) */}
      {editDialogOpen && (
        <Suspense fallback={null}>
          <ShiftEditDialog
            shift={editingShift}
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            onSave={handleShiftSave}
            onDelete={handleShiftDelete}
            onApprove={handleShiftApprove}
            onReject={handleShiftReject}
            onSyncCalendar={() => fetchShifts()}
            onDuplicate={(s) => {
              setDuplicatePrefill({
                staffId: s.staffId,
                projectId: s.projectId,
                startTime: s.startTime,
                endTime: s.endTime,
                title: s.title,
                notes: s.notes,
                attendees: s.attendees || [],
              })
              setBulkDialogOpen(true)
            }}
            isManager={isManager}
            projects={projects}
            currentStaffId={currentStaffId}
          />
        </Suspense>
      )}

      {/* GCal Event Dialog (lazy loaded) */}
      {gcalDialogOpen && (
        <Suspense fallback={null}>
          <GCalEventDialog
            event={gcalEvent}
            open={gcalDialogOpen}
            onOpenChange={setGcalDialogOpen}
            onTimeUpdate={handleGcalEventTimeUpdate}
            onUpdate={handleGcalEventUpdate}
            onDelete={handleGcalEventDelete}
            onMeetCreate={handleGcalMeetCreate}
            onMeetDelete={handleGcalMeetDelete}
          />
        </Suspense>
      )}

      {/* PendingEventsPanel now handles both single and bulk assign dialogs inline */}
    </div>
  )
}
