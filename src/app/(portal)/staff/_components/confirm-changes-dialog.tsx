'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'

export interface FieldChange {
  label: string
  before: string
  after: string
}

interface ConfirmChangesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  changes: FieldChange[]
  onConfirm: () => void
  isLoading?: boolean
  submitMode?: 'save' | 'request'
  attachmentRequirement?: {
    requiresIdentityDoc: boolean
    requiresAddressDoc: boolean
    requiresBankHolderDoc: boolean
  }
  attachmentUrls?: string[]
  onUploadFile?: (file: File) => void
}

export function ConfirmChangesDialog({
  open,
  onOpenChange,
  changes,
  onConfirm,
  isLoading,
  submitMode = 'save',
  attachmentRequirement,
  attachmentUrls = [],
  onUploadFile,
}: ConfirmChangesDialogProps) {
  const newFields = changes.filter((c) => !c.before && c.after)
  const updatedFields = changes.filter((c) => c.before && c.after && c.before !== c.after)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>変更内容の確認</DialogTitle>
          <DialogDescription>
            以下の項目が変更されます。内容を確認してOKを押してください。
          </DialogDescription>
        </DialogHeader>

        {changes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">変更はありません</p>
        ) : (
          <div className="space-y-4">
            {/* 新規追加 */}
            {newFields.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="default" className="bg-emerald-600">追加</Badge>
                  <span className="text-sm font-medium">{newFields.length}件</span>
                </div>
                <div className="rounded-md border divide-y">
                  {newFields.map((c) => (
                    <div key={c.label} className="px-3 py-2 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground shrink-0 w-32">{c.label}</span>
                      <span className="font-medium text-emerald-700 dark:text-emerald-400 text-right">{c.after}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 変更 */}
            {updatedFields.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="default" className="bg-amber-600">変更</Badge>
                  <span className="text-sm font-medium">{updatedFields.length}件</span>
                </div>
                <div className="rounded-md border divide-y">
                  {updatedFields.map((c) => (
                    <div key={c.label} className="px-3 py-2 text-sm">
                      <div className="text-muted-foreground mb-1">{c.label}</div>
                      <div className="flex items-center gap-2">
                        <span className="line-through text-red-500/70">{c.before}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium text-emerald-700 dark:text-emerald-400">{c.after}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 添付書類（承認申請モード） */}
        {submitMode === 'request' && attachmentRequirement && (
          (() => {
            const needed: string[] = []
            if (attachmentRequirement.requiresIdentityDoc) needed.push('本人確認書類（運転免許証・マイナンバーカード等）')
            if (attachmentRequirement.requiresAddressDoc) needed.push('住所確認書類（住民票・公共料金請求書等）')
            if (attachmentRequirement.requiresBankHolderDoc) needed.push('口座名義確認書類（通帳・キャッシュカード等）')
            if (needed.length === 0) {
              return (
                <div className="mt-3 rounded border border-blue-200 bg-blue-50 dark:bg-blue-950/20 px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
                  この変更は本人確認書類の添付不要です。オーナー承認後に反映されます。
                </div>
              )
            }
            return (
              <div className="mt-3 space-y-2">
                <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                  以下の書類の添付が必要です:
                  <ul className="list-disc list-inside mt-1">
                    {needed.map((n) => <li key={n}>{n}</li>)}
                  </ul>
                </div>
                <div>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f && onUploadFile) onUploadFile(f)
                    }}
                    className="text-xs"
                  />
                  {attachmentUrls.length > 0 && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      添付済: {attachmentUrls.length} 件
                    </div>
                  )}
                </div>
              </div>
            )
          })()
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            戻る
          </Button>
          <Button onClick={onConfirm} disabled={isLoading || changes.length === 0}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitMode === 'request' ? '変更を申請する' : 'OK - 更新する'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
