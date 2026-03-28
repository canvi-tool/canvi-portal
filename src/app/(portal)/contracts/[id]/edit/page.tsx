'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft } from 'lucide-react'
import { useContract } from '@/hooks/use-contracts'
import { ContractForm } from '../../_components/contract-form'

export default function EditContractPage() {
  const params = useParams()
  const id = params.id as string
  const { data: contract, isLoading } = useContract(id)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="mb-4 text-muted-foreground">契約が見つかりません</p>
        <Button variant="outline" render={<Link href="/contracts" />}>
          一覧に戻る
        </Button>
      </div>
    )
  }

  if (contract.status !== 'draft') {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="mb-4 text-muted-foreground">
          下書き状態の契約のみ編集できます
        </p>
        <Button variant="outline" render={<Link href={`/contracts/${id}`} />}>
          契約詳細に戻る
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="契約の編集"
        description={`${contract.title} (${contract.id.slice(0, 8).toUpperCase()})`}
        actions={
          <Button variant="outline" render={<Link href={`/contracts/${id}`} />}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            詳細に戻る
          </Button>
        }
      />
      <ContractForm
        mode="edit"
        contractId={id}
        initialData={{
          staff_id: contract.staff_id,
          template_id: contract.template_id,
          title: contract.title,
          content: contract.content || '',
          status: contract.status as 'draft',
          start_date: contract.start_date,
          end_date: contract.end_date,
          variables: (contract.variables as Record<string, unknown>) || {},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          staff: contract.staff as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          template: contract.template as any,
        }}
      />
    </div>
  )
}
