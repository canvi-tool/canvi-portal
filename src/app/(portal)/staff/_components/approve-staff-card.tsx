'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { getEffectiveStatus } from './staff-status-badge'
import type { Tables } from '@/lib/types/database'

interface ApproveStaffCardProps {
  staff: Tables<'staff'>
}

const ORG_UNITS = [
  { value: '/管理部', label: '管理部' },
  { value: '/営業部', label: '営業部' },
  { value: '/開発部', label: '開発部' },
  { value: '/スタッフ', label: 'スタッフ' },
]

export function ApproveStaffCard({ staff }: ApproveStaffCardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [emailPrefix, setEmailPrefix] = useState('')
  const [orgUnit, setOrgUnit] = useState('/スタッフ')
  const [staffCode, setStaffCode] = useState('')

  // custom_fieldsのonboarding_statusを考慮して承認待ちか判定
  const cf = staff.custom_fields as Record<string, unknown> | null
  const effectiveStatus = getEffectiveStatus(staff.status, cf)
  if (effectiveStatus !== 'pending_approval') return null

  const handleApprove = async () => {
    if (!emailPrefix) {
      toast.error('Googleメールアドレスのプレフィックスを入力してください')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/staff/${staff.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          google_email_prefix: emailPrefix,
          google_org_unit: orgUnit,
          ...(staffCode ? { staff_code: staffCode } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '承認に失敗しました')
        return
      }

      const warnings: string[] = []
      if (data.results?.google && !data.results.google.success) {
        warnings.push(`Google: ${data.results.google.error}`)
      }
      if (data.results?.portal && !data.results.portal.success) {
        warnings.push(`ポータル: ${data.results.portal.error}`)
      }

      if (warnings.length > 0) {
        toast.warning('承認しましたが、一部の処理に失敗しました', {
          description: warnings.join('\n'),
          duration: 8000,
        })
      } else {
        toast.success('承認が完了しました', {
          description: data.google_email ? `Googleアカウント: ${data.google_email}` : undefined,
        })
      }

      router.refresh()
    } catch {
      toast.error('承認に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-5 w-5" />
          承認待ち
        </CardTitle>
        <CardDescription>
          このスタッフはオンボーディングフォームを送信済みです。承認するとGoogleアカウントが発行され、ポータルにログインできるようになります。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>スタッフコード</Label>
            <div className="flex items-center gap-0">
              <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 h-9 text-sm text-muted-foreground">S</span>
              <Input
                value={staffCode.replace(/^S/, '')}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                  setStaffCode(v ? `S${v.padStart(4, '0')}` : '')
                }}
                placeholder="0001"
                className="rounded-l-none w-24"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Googleメールアドレス <span className="text-red-500">*</span></Label>
            <div className="flex items-center gap-0">
              <Input
                value={emailPrefix}
                onChange={(e) => setEmailPrefix(e.target.value.toLowerCase())}
                placeholder="yamada.taro"
                className="rounded-r-none"
              />
              <span className="inline-flex items-center rounded-r-md border border-l-0 border-input bg-muted px-3 h-9 text-sm text-muted-foreground whitespace-nowrap">
                @canvi.co.jp
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>組織部門</Label>
            <Select value={orgUnit} onValueChange={setOrgUnit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ORG_UNITS.map((ou) => (
                  <SelectItem key={ou.value} value={ou.value}>{ou.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button onClick={handleApprove} disabled={loading || !emailPrefix}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-4 w-4" />
            )}
            承認してアカウント発行
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
