import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { StaffListClient } from './_components/staff-list-client'
import { StaffPageActions } from './_components/staff-page-actions'

export default async function StaffPage() {
  const supabase = await createServerSupabaseClient()

  const { data: staffList, error } = await supabase
    .from('staff')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Staff page query error:', error)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="スタッフ管理"
        description="スタッフの一覧と管理"
        actions={<StaffPageActions />}
      />
      <StaffListClient initialData={staffList || []} />
    </div>
  )
}
