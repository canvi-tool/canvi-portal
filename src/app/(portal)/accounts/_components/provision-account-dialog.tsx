'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
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

// --- Types ---

interface ProvisionAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultProvider?: 'google' | 'zoom'
}

interface StaffMember {
  id: string
  name: string
  nameRomaji: string
  email?: string
}

// --- Demo Staff ---

const STAFF_LIST: StaffMember[] = [
  { id: 's1', name: '佐藤健太', nameRomaji: 'sato', email: 'sato@canvi.co.jp' },
  { id: 's2', name: '田中美咲', nameRomaji: 'tanaka', email: 'tanaka@canvi.co.jp' },
  { id: 's3', name: '鈴木一郎', nameRomaji: 'suzuki', email: 'suzuki@canvi.co.jp' },
  { id: 's4', name: '山田花子', nameRomaji: 'yamada', email: 'yamada@canvi.co.jp' },
  { id: 's5', name: '高橋雄太', nameRomaji: 'takahashi' },
  { id: 's6', name: '伊藤真理', nameRomaji: 'ito' },
  { id: 's7', name: '渡辺大輔', nameRomaji: 'watanabe' },
]

const ORG_UNITS = [
  { value: '/管理者', label: '管理者' },
  { value: '/スタッフ', label: 'スタッフ' },
  { value: '/スタッフ/営業', label: 'スタッフ / 営業' },
  { value: '/スタッフ/受電', label: 'スタッフ / 受電' },
]

// --- Component ---

export function ProvisionAccountDialog({
  open,
  onOpenChange,
  defaultProvider = 'google',
}: ProvisionAccountDialogProps) {
  const [provider, setProvider] = useState<string>(defaultProvider)
  const [selectedStaff, setSelectedStaff] = useState<string>('')
  const [emailPrefix, setEmailPrefix] = useState('')
  const [orgUnit, setOrgUnit] = useState<string>('/スタッフ')
  const [zoomLicenseType, setZoomLicenseType] = useState<string>('Licensed')

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setProvider(defaultProvider)
      setSelectedStaff('')
      setEmailPrefix('')
      setOrgUnit('/スタッフ')
      setZoomLicenseType('Licensed')
    }
  }, [open, defaultProvider])

  // Auto-fill email prefix from staff
  useEffect(() => {
    if (selectedStaff) {
      const staff = STAFF_LIST.find(s => s.id === selectedStaff)
      if (staff) {
        setEmailPrefix(staff.nameRomaji)
      }
    }
  }, [selectedStaff])

  const selectedStaffData = STAFF_LIST.find(s => s.id === selectedStaff)

  const handleSubmit = () => {
    // Demo: just close the dialog
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>アカウント作成</DialogTitle>
          <DialogDescription>
            外部サービスのアカウントを新規作成します。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Staff Selector */}
          <div className="space-y-2">
            <Label>スタッフ選択</Label>
            <Select value={selectedStaff} onValueChange={setSelectedStaff}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="スタッフを選択..." />
              </SelectTrigger>
              <SelectContent>
                {STAFF_LIST.map(staff => (
                  <SelectItem key={staff.id} value={staff.id}>
                    {staff.name}
                    {staff.email && (
                      <span className="text-muted-foreground ml-2 text-xs">({staff.email})</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Provider Selector */}
          <div className="space-y-2">
            <Label>サービス</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google">Google Workspace</SelectItem>
                <SelectItem value="zoom">Zoom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Google Workspace specific fields */}
          {provider === 'google' && (
            <>
              <div className="space-y-2">
                <Label>メールアドレス</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={emailPrefix}
                    onChange={e => setEmailPrefix(e.target.value)}
                    placeholder="username"
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">@canvi.co.jp</span>
                </div>
                {emailPrefix && (
                  <p className="text-xs text-muted-foreground">
                    作成されるメール: {emailPrefix}@canvi.co.jp
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>組織部門</Label>
                <Select value={orgUnit} onValueChange={setOrgUnit}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORG_UNITS.map(ou => (
                      <SelectItem key={ou.value} value={ou.value}>{ou.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Zoom specific fields */}
          {provider === 'zoom' && (
            <>
              <div className="space-y-2">
                <Label>メールアドレス</Label>
                <Input
                  value={selectedStaffData?.email || `${emailPrefix}@canvi.co.jp`}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Google Workspaceのメールアドレスが使用されます。
                </p>
              </div>

              <div className="space-y-2">
                <Label>ライセンスタイプ</Label>
                <Select value={zoomLicenseType} onValueChange={setZoomLicenseType}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Basic">Basic（無料）</SelectItem>
                    <SelectItem value="Licensed">Licensed（有料）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Auto-fill info */}
          {selectedStaffData && (
            <div className="rounded-lg border bg-muted/50 p-3 text-xs space-y-1">
              <p className="font-medium text-sm">自動入力情報</p>
              <p>氏名: {selectedStaffData.name}</p>
              <p>姓（ローマ字）: {selectedStaffData.nameRomaji}</p>
              {selectedStaffData.email && <p>既存メール: {selectedStaffData.email}</p>}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedStaff || (provider === 'google' && !emailPrefix)}
          >
            アカウント作成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
