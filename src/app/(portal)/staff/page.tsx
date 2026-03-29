import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Plus, Upload } from 'lucide-react'
import { StaffListClient } from './_components/staff-list-client'

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
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" render={<Link href="/staff/import" />}>
              <Upload className="h-4 w-4 mr-2" />
              CSV一括インポート
            </Button>
            <Button render={<Link href="/staff/new" />}>
              <Plus className="h-4 w-4 mr-2" />
              新規登録
            </Button>
          </div>
        }
      />
      <StaffListClient initialData={staffList || []} />
    </div>
  )
}
