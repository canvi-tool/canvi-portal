import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/types/database'

interface StaffCsvRow {
  staff_code: string
  last_name: string
  first_name: string
  last_name_kana?: string
  first_name_kana?: string
  email: string
  personal_email?: string
  phone?: string
  date_of_birth?: string
  employment_type?: string
  status?: string
  hire_date?: string
  address?: string
  bank_name?: string
  bank_branch?: string
  bank_account_type?: string
  bank_account_number?: string
  bank_account_holder?: string
  notes?: string
}

interface AssignmentCsvRow {
  staff_code: string
  project_name: string
  role?: string
  status?: string
  start_date: string
  end_date?: string
}

interface CompensationCsvRow {
  staff_code: string
  project_name: string
  rule_type: string
  name: string
  priority?: string
  effective_from?: string
  effective_to?: string
  // param_ prefixed columns → params JSONB
  [key: string]: string | undefined
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = values[i] || ''
    })
    return row
  })
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const formData = await request.formData()
    const csvType = formData.get('type') as string // 'staff' | 'assignments' | 'compensation'
    const file = formData.get('file') as File

    if (!file || !csvType) {
      return NextResponse.json({ error: 'ファイルとタイプは必須です' }, { status: 400 })
    }

    const text = await file.text()
    const rows = parseCsv(text)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSVにデータ行がありません' }, { status: 400 })
    }

    const results = { inserted: 0, updated: 0, errors: [] as string[] }

    if (csvType === 'staff') {
      await importStaff(supabase, rows as unknown as StaffCsvRow[], results)
    } else if (csvType === 'assignments') {
      await importAssignments(supabase, rows as unknown as AssignmentCsvRow[], results)
    } else if (csvType === 'compensation') {
      await importCompensation(supabase, rows as unknown as CompensationCsvRow[], results)
    } else {
      return NextResponse.json({ error: '不正なタイプです: staff, assignments, compensation のいずれかを指定してください' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      ...results,
      total: rows.length,
    })
  } catch (err) {
    console.error('CSV import error:', err)
    return NextResponse.json(
      { error: 'インポートに失敗しました', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function importStaff(supabase: any, rows: StaffCsvRow[], results: { inserted: number; updated: number; errors: string[] }) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row.last_name || !row.first_name || !row.email) {
      results.errors.push(`行${i + 2}: last_name, first_name, email は必須です`)
      continue
    }

    const customFields: Record<string, string> = {}
    if (row.address) customFields.address = row.address
    if (row.bank_name) customFields.bank_name = row.bank_name
    if (row.bank_branch) customFields.bank_branch = row.bank_branch
    if (row.bank_account_type) customFields.bank_account_type = row.bank_account_type
    if (row.bank_account_number) customFields.bank_account_number = row.bank_account_number
    if (row.bank_account_holder) customFields.bank_account_holder = row.bank_account_holder
    if (row.personal_email) customFields.personal_email = row.personal_email

    const staffRecord = {
      staff_code: row.staff_code,
      last_name: row.last_name,
      first_name: row.first_name,
      last_name_kana: row.last_name_kana || null,
      first_name_kana: row.first_name_kana || null,
      email: row.email,
      phone: row.phone || null,
      date_of_birth: row.date_of_birth || null,
      employment_type: row.employment_type || 'contractor',
      status: row.status || 'active',
      hire_date: row.hire_date || null,
      notes: row.notes || null,
      custom_fields: customFields as unknown as Json,
    }

    // Check if staff with this email already exists
    const { data: existing } = await supabase
      .from('staff')
      .select('id, custom_fields')
      .eq('email', row.email)
      .limit(1)

    if (existing && existing.length > 0) {
      // Merge custom_fields
      const existingCf = (existing[0].custom_fields || {}) as Record<string, string>
      const mergedCf = { ...existingCf, ...customFields }

      const { error } = await supabase
        .from('staff')
        .update({ ...staffRecord, custom_fields: mergedCf as unknown as Json })
        .eq('id', existing[0].id)

      if (error) {
        results.errors.push(`行${i + 2}: 更新エラー - ${error.message}`)
      } else {
        results.updated++
      }
    } else {
      const { error } = await supabase.from('staff').insert(staffRecord)
      if (error) {
        results.errors.push(`行${i + 2}: 挿入エラー - ${error.message}`)
      } else {
        results.inserted++
      }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function importAssignments(supabase: any, rows: AssignmentCsvRow[], results: { inserted: number; updated: number; errors: string[] }) {
  // Pre-fetch staff and projects for lookup
  const { data: allStaff } = await supabase.from('staff').select('id, email, staff_code')
  const { data: allProjects } = await supabase.from('projects').select('id, name')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const staffByCode = new Map<string, string>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(allStaff || []).forEach((s: any) => {
    if (s.staff_code) staffByCode.set(s.staff_code, s.id)
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projectByName = new Map<string, string>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(allProjects || []).forEach((p: any) => {
    projectByName.set(p.name, p.id)
  })

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const staffId = staffByCode.get(row.staff_code)
    const projectId = projectByName.get(row.project_name)

    if (!staffId) {
      results.errors.push(`行${i + 2}: スタッフコード "${row.staff_code}" が見つかりません`)
      continue
    }
    if (!projectId) {
      results.errors.push(`行${i + 2}: プロジェクト "${row.project_name}" が見つかりません`)
      continue
    }

    const record = {
      project_id: projectId,
      staff_id: staffId,
      role_title: row.role || null,
      status: row.status || 'confirmed',
      start_date: row.start_date,
      end_date: row.end_date || null,
    }

    // Check for existing assignment
    const { data: existing } = await supabase
      .from('project_assignments')
      .select('id')
      .eq('project_id', projectId)
      .eq('staff_id', staffId)
      .limit(1)

    if (existing && existing.length > 0) {
      const { error } = await supabase
        .from('project_assignments')
        .update(record)
        .eq('id', existing[0].id)
      if (error) {
        results.errors.push(`行${i + 2}: 更新エラー - ${error.message}`)
      } else {
        results.updated++
      }
    } else {
      const { error } = await supabase.from('project_assignments').insert(record)
      if (error) {
        results.errors.push(`行${i + 2}: 挿入エラー - ${error.message}`)
      } else {
        results.inserted++
      }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function importCompensation(supabase: any, rows: CompensationCsvRow[], results: { inserted: number; updated: number; errors: string[] }) {
  // Pre-fetch staff, projects, assignments
  const { data: allStaff } = await supabase.from('staff').select('id, staff_code')
  const { data: allProjects } = await supabase.from('projects').select('id, name')
  const { data: allAssignments } = await supabase.from('project_assignments').select('id, project_id, staff_id')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const staffByCode = new Map<string, string>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(allStaff || []).forEach((s: any) => {
    if (s.staff_code) staffByCode.set(s.staff_code, s.id)
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projectByName = new Map<string, string>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(allProjects || []).forEach((p: any) => {
    projectByName.set(p.name, p.id)
  })

  // assignment lookup: "staffId|projectId" → assignmentId
  const assignmentMap = new Map<string, string>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(allAssignments || []).forEach((a: any) => {
    assignmentMap.set(`${a.staff_id}|${a.project_id}`, a.id)
  })

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const staffId = staffByCode.get(row.staff_code)
    const projectId = projectByName.get(row.project_name)

    if (!staffId) {
      results.errors.push(`行${i + 2}: スタッフコード "${row.staff_code}" が見つかりません`)
      continue
    }
    if (!projectId) {
      results.errors.push(`行${i + 2}: プロジェクト "${row.project_name}" が見つかりません`)
      continue
    }

    const assignmentId = assignmentMap.get(`${staffId}|${projectId}`)
    if (!assignmentId) {
      results.errors.push(`行${i + 2}: スタッフ "${row.staff_code}" × プロジェクト "${row.project_name}" のアサインが見つかりません。先に02_project_assignments.csvをインポートしてください`)
      continue
    }

    // Build params JSONB from param_ prefixed columns
    const params: Record<string, string | number> = {}
    Object.entries(row).forEach(([key, val]) => {
      if (key.startsWith('param_') && val) {
        const paramKey = key.replace('param_', '')
        const num = Number(val)
        params[paramKey] = isNaN(num) ? val : num
      }
    })

    const record = {
      assignment_id: assignmentId,
      rule_type: row.rule_type,
      name: row.name,
      params: params as unknown as Json,
      priority: row.priority ? parseInt(row.priority) : 0,
      is_active: true,
      effective_from: row.effective_from || null,
      effective_to: row.effective_to || null,
    }

    // Check for existing rule with same assignment + name
    const { data: existing } = await supabase
      .from('compensation_rules')
      .select('id')
      .eq('assignment_id', assignmentId)
      .eq('name', row.name)
      .limit(1)

    if (existing && existing.length > 0) {
      const { error } = await supabase
        .from('compensation_rules')
        .update(record)
        .eq('id', existing[0].id)
      if (error) {
        results.errors.push(`行${i + 2}: 更新エラー - ${error.message}`)
      } else {
        results.updated++
      }
    } else {
      const { error } = await supabase.from('compensation_rules').insert(record)
      if (error) {
        results.errors.push(`行${i + 2}: 挿入エラー - ${error.message}`)
      } else {
        results.inserted++
      }
    }
  }
}
