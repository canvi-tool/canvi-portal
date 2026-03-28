'use client'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { ContractForm } from '../_components/contract-form'

export default function NewContractPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="契約書の新規作成"
        description="テンプレートを選択して契約書を作成します"
        actions={
          <Button variant="outline" render={<Link href="/contracts" />}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            一覧に戻る
          </Button>
        }
      />
      <ContractForm mode="create" />
    </div>
  )
}
