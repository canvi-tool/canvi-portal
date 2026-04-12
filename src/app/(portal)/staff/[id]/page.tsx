import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

import { StaffDetailClient } from '../_components/staff-detail-client'

interface StaffDetailPageProps {
  params: { id: string }
}

export default async function StaffDetailPage({ params }: StaffDetailPageProps) {
  const { id } = params
  const supabase = await createServerSupabaseClient()

  const { data: staff, error } = await supabase
    .from('staff')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !staff) {
    notFound()
  }

  // Fetch contracts
  const { data: contracts } = await supabase
    .from('contracts')
    .select('*')
    .eq('staff_id', id)
    .order('created_at', { ascending: false })

  // Fetch project assignments with project info
  const { data: assignments } = await supabase
    .from('project_assignments')
    .select('*, project:projects(*)')
    .eq('staff_id', id)
    .is('deleted_at', null)
    .order('start_date', { ascending: false })

  // Fetch work reports
  const { data: workReports } = await supabase
    .from('work_reports')
    .select('*')
    .eq('staff_id', id)
    .order('year_month', { ascending: false })
    .limit(12)

  // Fetch payment calculations
  const { data: payments } = await supabase
    .from('payment_calculations')
    .select('*')
    .eq('staff_id', id)
    .order('year_month', { ascending: false })
    .limit(12)

  // Fetch equipment lending records with items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lendingRecords } = await (supabase as any)
    .from('equipment_lending_records')
    .select('*, items:equipment_lending_items(*, equipment:equipment_items(*))')
    .eq('staff_id', id)
    .is('deleted_at', null)
    .order('lending_date', { ascending: false })

  return (
    <StaffDetailClient
      staff={staff}
      contracts={contracts || []}
      assignments={assignments || []}
      workReports={workReports || []}
      payments={payments || []}
      lendingRecords={lendingRecords || []}
    />
  )
}
