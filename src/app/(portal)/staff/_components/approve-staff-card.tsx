'use client'

import { useState, useEffect } from 'react'
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
  SelectValueWithLabel,
} from '@/components/ui/select'
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { getEffectiveStatus } from './staff-status-badge'
import type { Tables } from '@/lib/types/database'

interface ApproveStaffCardProps {
  staff: Tables<'staff'>
}

const ORG_UNITS = [
  { value: '/', label: 'canvi.co.jp' },
]

const PORTAL_ROLES = [
  { value: 'owner', label: 'オーナー', desc: '全機能アクセス・設定変更・権限管理' },
  { value: 'admin', label: '管理者', desc: '日常運用・承認・契約管理' },
  { value: 'staff', label: 'メンバー', desc: '自分のPJ・シフト・勤務報告のみ' },
]

export function ApproveStaffCard({ staff }: ApproveStaffCardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [emailPrefix, setEmailPrefix] = useState('')
  const [orgUnit, setOrgUnit] = useState('/')
  const [staffCode, setStaffCode] = useState(staff.staff_code || '')
  const [portalRole, setPortalRole] = useState('staff')

  // custom_fieldsのonboarding_statusを考慮して承認待ちか判定
  const cf = staff.custom_fields as Record<string, unknown> | null
  const effectiveStatus = getEffectiveStatus(staff.status, cf)

  // ローマ字名からメールプレフィックスを自動生成: first_name.last_name（番号なし）
  useEffect(() => {
    if (staff.last_name_eiji && staff.first_name_eiji && !emailPrefix) {
      const prefix = `${staff.first_name_eiji.toLowerCase()}.${staff.last_name_eiji.toLowerCase()}`
      setEmailPrefix(prefix)
    }
  }, [staff.last_name_eiji, staff.first_name_eiji, emailPrefix])

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
          portal_role: portalRole,
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

      const googleNote = data.results?.google?.note as string | undefined

      if (warnings.length > 0) {
        toast.warning('承認しましたが、一部の処理に失敗しました', {
          description: warnings.join('\n'),
          duration: 8000,
        })
      } else {
        const desc = [
          data.google_email ? `Googleアカウント: ${data.google_email}` : '',
          googleNote || '',
        ].filter(Boolean).join('\n')
        toast.success('承認が完了しました', {
          description: desc || undefined,
          duration: googleNote ? 8000 : 4000,
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
                placeholder="taro.yamada"
                className="rounded-r-none"
              />
              <span className="inline-flex items-center rounded-r-md border border-l-0 border-input bg-muted px-3 h-9 text-sm text-muted-foreground whitespace-nowrap">
                @canvi.co.jp
              </span>
            </div>
            {staff.first_name_eiji && staff.last_name_eiji && (
              <p className="text-xs text-muted-foreground">
                ローマ字名から自動生成: {staff.first_name_eiji.toLowerCase()}.{staff.last_name_eiji.toLowerCase()}
                <br />
                ※同名ユーザーが既に存在する場合は自動で002〜の連番が付与されます
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>組織部門</Label>
            <Select value={orgUnit} onValueChange={setOrgUnit}>
              <SelectTrigger>
                <SelectValueWithLabel
                  value={orgUnit}
                  labels={Object.fromEntries(ORG_UNITS.map(o => [o.value, o.label]))}
                />
              </SelectTrigger>
              <SelectContent>
                {ORG_UNITS.map((ou) => (
                  <SelectItem key={ou.value} value={ou.value}>{ou.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>ポータルロール <span className="text-red-500">*</span></Label>
            <Select value={portalRole} onValueChange={setPortalRole}>
              <SelectTrigger>
                <SelectValueWithLabel
                  value={portalRole}
                  labels={Object.fromEntries(PORTAL_ROLES.map(r => [r.value, r.label]))}
                />
              </SelectTrigger>
              <SelectContent>
                {PORTAL_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    <span className="font-medium">{r.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{r.desc}</span>
                  </SelectItem>
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
