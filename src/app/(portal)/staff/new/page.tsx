'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { StaffForm } from '../_components/staff-form'
import type { ProvisioningData } from '../_components/staff-form'
import { useCreateStaff } from '@/hooks/use-staff'
import type { ProvisioningResult } from '@/hooks/use-staff'
import type { StaffFormValues } from '@/lib/validations/staff'

export default function NewStaffPage() {
  const router = useRouter()
  const { mutateAsync, isPending } = useCreateStaff()

  async function handleSubmit(data: StaffFormValues, provisioning?: ProvisioningData) {
    try {
      const created = await mutateAsync({ formData: data, provisioning })

      const provisioningResult = (created as { provisioning?: ProvisioningResult }).provisioning

      if (provisioningResult) {
        const messages: string[] = []
        const warnings: string[] = []

        if (provisioningResult.google_workspace) {
          if (provisioningResult.google_workspace.success) {
            messages.push(`Google Workspace: ${provisioningResult.google_workspace.email}`)
          } else {
            warnings.push(`Google Workspace: ${provisioningResult.google_workspace.error}`)
          }
        }

        if (provisioningResult.slack) {
          if (provisioningResult.slack.success) {
            messages.push(`Slack招待: ${provisioningResult.slack.email}`)
          } else {
            warnings.push(`Slack: ${provisioningResult.slack.error}`)
          }
        }

        if (provisioningResult.portal) {
          if (provisioningResult.portal.success) {
            messages.push(`ポータル招待: ${provisioningResult.portal.email}`)
          } else {
            warnings.push(`ポータル: ${provisioningResult.portal.error}`)
          }
        }

        if (warnings.length > 0) {
          toast.warning('スタッフを登録しましたが、一部のアカウント作成に失敗しました', {
            description: warnings.join('\n'),
            duration: 8000,
          })
        }

        if (messages.length > 0) {
          toast.success('スタッフを登録しました', {
            description: `アカウント作成完了: ${messages.join(', ')}`,
            duration: 6000,
          })
        } else if (warnings.length === 0) {
          toast.success('スタッフを登録しました')
        }
      } else {
        toast.success('スタッフを登録しました')
      }

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
      <StaffForm onSubmit={handleSubmit} isLoading={isPending} showProvisioning />
    </div>
  )
}
