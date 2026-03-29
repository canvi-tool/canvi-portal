import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { StaffListClient } from './_components/staff-list-client'
import { StaffPageActions } from './_components/staff-page-actions'

export const dynamic = 'force-dynamic'

export default async function StaffPage() {
  let staffList: Awaited<ReturnType<typeof fetchStaffList>> = []

  try {
    staffList = await fetchStaffList()
  } catch (err) {
    console.error('Staff page error:', err)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="スタッフ管理"
        description="スタッフの一覧と管理"
        actions={<StaffPageActions />}
      />
      <StaffListClient initialData={staffList} />
    </div>
  )
}

async function fetchStaffList() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Staff list query error:', error)
    return []
  }
  return data || []
}
