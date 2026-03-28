'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { StaffForm } from '../_components/staff-form'
import { useCreateStaff } from '@/hooks/use-staff'
import type { StaffFormValues } from '@/lib/validations/staff'

export default function NewStaffPage() {
  const router = useRouter()
  const { mutateAsync, isPending } = useCreateStaff()

  async function handleSubmit(data: StaffFormValues) {
    try {
      const created = await mutateAsync(data)
      toast.success('スタッフを登録しました')
      router.push(`/staff/${created.id}`)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'スタッフの登録に失敗しました'
      toast.error(message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="スタッフ新規登録"
        description="新しいスタッフの情報を入力してください"
      />
      <StaffForm onSubmit={handleSubmit} isLoading={isPending} />
    </div>
  )
}
