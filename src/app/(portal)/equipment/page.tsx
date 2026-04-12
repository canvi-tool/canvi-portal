import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, isOwner } from '@/lib/auth/rbac'
import { PageHeader } from '@/components/layout/page-header'
import { EquipmentPageClient } from './_components/equipment-page-client'

export const dynamic = 'force-dynamic'

export default async function EquipmentPage() {
  const user = await getCurrentUser()
  if (!user || !isOwner(user)) redirect('/dashboard')
  let equipmentItems: Awaited<ReturnType<typeof fetchEquipmentItems>> = []
  let lendingRecords: Awaited<ReturnType<typeof fetchLendingRecords>> = []
  let categoryCodes: Awaited<ReturnType<typeof fetchCategoryCodes>> = []
  let makerCodes: Awaited<ReturnType<typeof fetchMakerCodes>> = []
  let staffList: Awaited<ReturnType<typeof fetchStaffList>> = []

  try {
    ;[equipmentItems, lendingRecords, categoryCodes, makerCodes, staffList] =
      await Promise.all([
        fetchEquipmentItems(),
        fetchLendingRecords(),
        fetchCategoryCodes(),
        fetchMakerCodes(),
        fetchStaffList(),
      ])
  } catch (err) {
    console.error('Equipment page error:', err)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="貸与品管理"
        description="備品の在庫管理と貸与管理"
      />
      <EquipmentPageClient
        initialEquipment={equipmentItems}
        initialLending={lendingRecords}
        categoryCodes={categoryCodes}
        makerCodes={makerCodes}
        staffList={staffList}
      />
    </div>
  )
}

async function fetchEquipmentItems() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createServerSupabaseClient()) as any
  const { data, error } = await supabase
    .from('equipment_items')
    .select(`
      *,
      category:category_code(code, name),
      maker:maker_code(code, name)
    `)
    .is('deleted_at', null)
    .order('management_number', { ascending: true })

  if (error) {
    console.error('Equipment items query error:', error)
    return []
  }
  return data || []
}

async function fetchLendingRecords() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createServerSupabaseClient()) as any
  const { data, error } = await supabase
    .from('equipment_lending_records')
    .select(`
      *,
      staff:staff_id(id, last_name, first_name),
      items:equipment_lending_items(
        id,
        equipment_item_id,
        is_main_device,
        remarks,
        equipment_item:equipment_item_id(
          id,
          management_number,
          product_name,
          status,
          category:category_code(code, name),
          maker:maker_code(code, name)
        )
      )
    `)
    .is('deleted_at', null)
    .order('lending_date', { ascending: false })

  if (error) {
    console.error('Lending records query error:', error)
    return []
  }
  return data || []
}

async function fetchCategoryCodes() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createServerSupabaseClient()) as any
  const { data, error } = await supabase
    .from('equipment_category_codes')
    .select('code, name')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Category codes query error:', error)
    return []
  }
  return data || []
}

async function fetchMakerCodes() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createServerSupabaseClient()) as any
  const { data, error } = await supabase
    .from('equipment_maker_codes')
    .select('code, name')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Maker codes query error:', error)
    return []
  }
  return data || []
}

async function fetchStaffList() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('staff')
    .select('id, last_name, first_name')
    .in('status', ['active', 'on_leave', 'pre_contract', 'contract_sent', 'pending_signature'])
    .order('last_name', { ascending: true })

  if (error) {
    console.error('Staff list query error:', error)
    return []
  }
  return data || []
}
