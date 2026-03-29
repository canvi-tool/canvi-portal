'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, Upload, UserPlus } from 'lucide-react'
import { InviteOnboardingDialog } from './invite-onboarding-dialog'

export function StaffPageActions() {
  const [inviteOpen, setInviteOpen] = useState(false)

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          入職招待
        </Button>
        <Button variant="outline" render={<Link href="/staff/import" />}>
          <Upload className="h-4 w-4 mr-2" />
          CSV一括インポート
        </Button>
        <Button render={<Link href="/staff/new" />}>
          <Plus className="h-4 w-4 mr-2" />
          新規登録
        </Button>
      </div>
      <InviteOnboardingDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  )
}
