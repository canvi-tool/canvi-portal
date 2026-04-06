import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getProjectAccess } from '@/lib/auth/project-access'
import { isOwner } from '@/lib/auth/rbac'
import { isFreelanceType } from '@/lib/validations/staff'

function todayStr() {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

export async function GET() {
  try {
    const { user, allowedProjectIds } = await getProjectAccess()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const supabase = await createServerSupabaseClient()
    const today = todayStr()
    const isOwnerUser = isOwner(user)

    // プロジェクト数（スコープ適用）
    let activeProjectCount = 0
    if (allowedProjectIds === null) {
      // オーナー: 全プロジェクト
      const { count } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
      activeProjectCount = count || 0
    } else if (allowedProjectIds.length > 0) {
      const { count } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .in('id', allowedProjectIds)
      activeProjectCount = count || 0
    }

    // 本日のシフト（スコープ適用）
    let shiftQuery = supabase
      .from('shifts')
      .select('id, start_time, end_time, status, staff:staff_id(last_name, first_name), project:project_id(name)')
      .eq('shift_date', today)
      .order('start_time', { ascending: true })
      .limit(10)

    if (allowedProjectIds !== null && allowedProjectIds.length > 0) {
      shiftQuery = shiftQuery.in('project_id', allowedProjectIds)
    } else if (allowedProjectIds !== null && allowedProjectIds.length === 0) {
      // アサインなし → シフトなし
      shiftQuery = shiftQuery.in('project_id', ['__none__'])
    }

    const shiftRes = await shiftQuery

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const todaysShifts = (shiftRes.data || []).map((s: any) => ({
      id: s.id,
      staffName: s.staff ? `${s.staff.last_name} ${s.staff.first_name}` : '不明',
      projectName: s.project?.name || '不明',
      startTime: s.start_time?.slice(0, 5) || '00:00',
      endTime: s.end_time?.slice(0, 5) || '00:00',
      status: s.status || 'SUBMITTED',
    }))

    // アラート（alertsテーブルにはproject_idがないため、related_staff_idでスコープ）
    // オーナーは全アラート、それ以外はスタッフIDに紐づくアラートのみ
    let alertCountQuery = supabase
      .from('alerts')
      .select('id', { count: 'exact', head: true })
      .in('status', ['active'])

    if (!isOwnerUser && user.staffId) {
      alertCountQuery = alertCountQuery.eq('related_staff_id', user.staffId)
    } else if (!isOwnerUser && !user.staffId) {
      // スタッフIDなし → アラートなし
      alertCountQuery = alertCountQuery.eq('related_staff_id', '__none__')
    }

    const alertCountRes = await alertCountQuery

    let alertListQuery = supabase
      .from('alerts')
      .select('id, alert_type, message, severity, created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    if (!isOwnerUser && user.staffId) {
      alertListQuery = alertListQuery.eq('related_staff_id', user.staffId)
    } else if (!isOwnerUser && !user.staffId) {
      alertListQuery = alertListQuery.eq('related_staff_id', '__none__')
    }

    const alertListRes = await alertListQuery

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recentAlerts = (alertListRes.data || []).map((a: any) => ({
      id: a.id,
      type: a.alert_type || 'その他',
      message: a.message || '',
      severity: a.severity || 'info',
      createdAt: a.created_at?.split('T')[0] || today,
    }))

    // --- オーナー専用データ ---
    let staffCount = 0
    const pendingForms: Array<{
      id: string
      name: string
      type: string
      requestedAt: string
      email: string
    }> = []
    const staffMissingFields: Array<{
      id: string
      name: string
      employmentType: string
      missingFields: string[]
    }> = []
    const recentStaff: Array<{
      id: string
      name: string
      createdAt: string
    }> = []

    if (isOwnerUser) {
      const [staffCountRes, recentStaffRes, allStaffRes] = await Promise.all([
        supabase.from('staff').select('id', { count: 'exact', head: true }),
        supabase
          .from('staff')
          .select('id, last_name, first_name, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('staff')
          .select('id, last_name, first_name, last_name_kana, first_name_kana, last_name_eiji, first_name_eiji, date_of_birth, phone, postal_code, prefecture, address_line1, bank_name, bank_branch, bank_account_number, bank_account_holder, emergency_contact_name, emergency_contact_phone, email, personal_email, employment_type, status, custom_fields')
          .order('updated_at', { ascending: false }),
      ])

      staffCount = staffCountRes.count || 0

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const s of (recentStaffRes.data || []) as any[]) {
        recentStaff.push({
          id: s.id,
          name: `${s.last_name} ${s.first_name}`,
          createdAt: s.created_at?.split('T')[0] || today,
        })
      }

      // 未回答フォーム & 必須項目未入力
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const s of (allStaffRes.data || []) as any[]) {
        const cf = (s.custom_fields as Record<string, unknown>) || {}

        if (cf.onboarding_token && cf.onboarding_status === 'pending_registration') {
          pendingForms.push({
            id: s.id,
            name: `${s.last_name} ${s.first_name}`,
            type: 'onboarding',
            requestedAt: (cf.invited_at as string)?.split('T')[0] || '',
            email: s.personal_email || s.email || '',
          })
        }
        if (cf.info_update_token && !cf.info_update_completed_at) {
          const expiresAt = cf.info_update_expires_at as string | undefined
          if (!expiresAt || new Date(expiresAt) > new Date()) {
            pendingForms.push({
              id: s.id,
              name: `${s.last_name} ${s.first_name}`,
              type: 'info_update',
              requestedAt: (cf.info_update_requested_at as string)?.split('T')[0] || '',
              email: s.email || s.personal_email || '',
            })
          }
        }

        if (s.status !== 'suspended') {
          const isFreelance = isFreelanceType(s.employment_type)
          const missing: string[] = []
          if (!s.last_name_kana) missing.push('姓（カナ）')
          if (!s.first_name_kana) missing.push('名（カナ）')
          if (!s.last_name_eiji) missing.push('姓（ローマ字）')
          if (!s.first_name_eiji) missing.push('名（ローマ字）')
          if (!s.date_of_birth) missing.push('生年月日')
          if (!s.phone) missing.push('電話番号')
          if (!s.postal_code) missing.push('郵便番号')
          if (!s.prefecture) missing.push('都道府県')
          if (!s.address_line1) missing.push('住所')
          if (!s.bank_name) missing.push('銀行名')
          if (!s.bank_branch) missing.push('支店名')
          if (!s.bank_account_number) missing.push('口座番号')
          if (!s.bank_account_holder) missing.push('口座名義')
          if (!isFreelance) {
            if (!s.emergency_contact_name) missing.push('緊急連絡先（氏名）')
            if (!s.emergency_contact_phone) missing.push('緊急連絡先（電話番号）')
            if (!cf.identity_document) missing.push('本人確認書類')
          }
          if (missing.length > 0) {
            staffMissingFields.push({
              id: s.id,
              name: `${s.last_name} ${s.first_name}`,
              employmentType: s.employment_type,
              missingFields: missing,
            })
          }
        }
      }
    }

    return NextResponse.json({
      staffCount,
      activeProjects: activeProjectCount,
      unresolvedAlerts: alertCountRes.count || 0,
      pendingForms,
      staffMissingFields,
      todaysShifts,
      recentAlerts,
      recentStaff,
      isOwner: isOwnerUser,
    })
  } catch (error) {
    console.error('GET /api/dashboard error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
