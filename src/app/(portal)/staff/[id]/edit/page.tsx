'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { LoadingSkeleton } from '@/components/shared/loading-skeleton'
import { StaffForm } from '../../_components/staff-form'
import { useStaff, useUpdateStaff } from '@/hooks/use-staff'
import type { StaffFormValues } from '@/lib/validations/staff'

interface EditStaffPageProps {
  params: Promise<{ id: string }>
}

export default function EditStaffPage({ params }: EditStaffPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const { data: staff, isLoading: isLoadingStaff } = useStaff(id)
  const { mutateAsync, isPending } = useUpdateStaff(id)

  async function handleSubmit(data: StaffFormValues) {
    try {
      await mutateAsync(data)
      toast.success('スタッフ情報を更新しました')
      router.push(`/staff/${id}`)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'スタッフの更新に失敗しました'
      toast.error(message)
    }
  }

  if (isLoadingStaff) {
    return (
      <div className="space-y-6">
        <PageHeader title="スタッフ編集" />
        <LoadingSkeleton variant="form" rows={8} />
      </div>
    )
  }

  if (!staff) {
    return (
      <div className="space-y-6">
        <PageHeader title="スタッフ編集" />
        <p className="text-muted-foreground">スタッフが見つかりません</p>
      </div>
    )
  }

  // Extract form values from staff record + custom_fields
  const custom = (staff.custom_fields as Record<string, string>) || {}
  const defaultValues: Partial<StaffFormValues> = {
    staff_code: custom.staff_code || '',
    employment_type: staff.employment_type as StaffFormValues['employment_type'],
    last_name: custom.last_name || staff.full_name.split(' ')[0] || '',
    first_name: custom.first_name || staff.full_name.split(' ')[1] || '',
    last_name_kana: custom.last_name_kana || '',
    first_name_kana: custom.first_name_kana || '',
    email: staff.email,
    phone: staff.phone || '',
    date_of_birth: staff.date_of_birth || '',
    address: custom.address || '',
    bank_name: custom.bank_name || '',
    bank_branch: custom.bank_branch || '',
    bank_account_type: custom.bank_account_type || '',
    bank_account_number: custom.bank_account_number || '',
    bank_account_holder: custom.bank_account_holder || '',
    join_date: staff.join_date || '',
    notes: staff.notes || '',
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="スタッフ編集"
        description={`${staff.full_name} の情報を編集`}
      />
      <StaffForm
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
        isLoading={isPending}
      />
    </div>
  )
}
