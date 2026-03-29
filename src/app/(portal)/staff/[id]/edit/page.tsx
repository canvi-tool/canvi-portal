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

  // Extract form values from staff record
  const defaultValues: Partial<StaffFormValues> = {
    staff_code: staff.staff_code || '',
    employment_type: staff.employment_type as StaffFormValues['employment_type'],
    last_name: staff.last_name || '',
    first_name: staff.first_name || '',
    last_name_kana: staff.last_name_kana || '',
    first_name_kana: staff.first_name_kana || '',
    email: staff.email,
    phone: staff.phone || '',
    date_of_birth: staff.date_of_birth || '',
    address_line1: staff.address_line1 || '',
    address_line2: staff.address_line2 || '',
    personal_email: staff.personal_email || '',
    gender: staff.gender || '',
    postal_code: staff.postal_code || '',
    prefecture: staff.prefecture || '',
    city: staff.city || '',
    last_name_eiji: staff.last_name_eiji || '',
    first_name_eiji: staff.first_name_eiji || '',
    bank_name: staff.bank_name || '',
    bank_branch: staff.bank_branch || '',
    bank_account_type: staff.bank_account_type || '',
    bank_account_number: staff.bank_account_number || '',
    bank_account_holder: staff.bank_account_holder || '',
    hire_date: staff.hire_date || '',
    notes: staff.notes || '',
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="スタッフ編集"
        description={`${staff.last_name} ${staff.first_name} の情報を編集`}
      />
      <StaffForm
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
        isLoading={isPending}
        showProvisioning={false}
      />
    </div>
  )
}
