'use client'

import { useState, useEffect, useCallback } from 'react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RefreshCw, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// --- Types ---

interface SyncPreviewUser {
  name: string
  email: string
  provider: 'google_workspace' | 'zoom'
  external_id: string
  status: 'new' | 'exists'
}

interface SyncPreviewResponse {
  users: SyncPreviewUser[]
  already_exists: number
  to_import: number
}

interface SyncDetail {
  email: string
  name: string
  provider: string
  action: 'imported' | 'skipped' | 'error'
  reason?: string
}

interface SyncResult {
  imported: number
  skipped: number
  errors: string[]
  details: SyncDetail[]
}

interface SyncAccountsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Step = 'config' | 'preview' | 'syncing' | 'result'

const PROVIDER_LABELS: Record<string, string> = {
  google_workspace: 'Google Workspace',
  zoom: 'Zoom',
}

// --- Component ---

export function SyncAccountsDialog({
  open,
  onOpenChange,
}: SyncAccountsDialogProps) {
  const [step, setStep] = useState<Step>('config')
  const [gwsChecked, setGwsChecked] = useState(true)
  const [zoomChecked, setZoomChecked] = useState(true)
  const [previewData, setPreviewData] = useState<SyncPreviewResponse | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep('config')
      setGwsChecked(true)
      setZoomChecked(true)
      setPreviewData(null)
      setPreviewLoading(false)
      setPreviewError(null)
      setSyncResult(null)
    }
  }, [open])

  const selectedProviders = useCallback(() => {
    const providers: string[] = []
    if (gwsChecked) providers.push('google_workspace')
    if (zoomChecked) providers.push('zoom')
    return providers
  }, [gwsChecked, zoomChecked])

  const handleLoadPreview = useCallback(async () => {
    const providers = selectedProviders()
    if (providers.length === 0) return

    setPreviewLoading(true)
    setPreviewError(null)

    try {
      const res = await fetch(
        `/api/integrations/sync/preview?providers=${providers.join(',')}`
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const data: SyncPreviewResponse = await res.json()
      setPreviewData(data)
      setStep('preview')
    } catch (err) {
      setPreviewError(
        err instanceof Error ? err.message : 'プレビューの取得に失敗しました'
      )
    } finally {
      setPreviewLoading(false)
    }
  }, [selectedProviders])

  const handleSync = useCallback(async () => {
    const providers = selectedProviders()
    if (providers.length === 0) return

    setStep('syncing')

    try {
      const res = await fetch('/api/integrations/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providers }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      const result: SyncResult = await res.json()
      setSyncResult(result)
      setStep('result')
    } catch (err) {
      setSyncResult({
        imported: 0,
        skipped: 0,
        errors: [err instanceof Error ? err.message : '同期に失敗しました'],
        details: [],
      })
      setStep('result')
    }
  }, [selectedProviders])

  const newUsers = previewData?.users.filter((u) => u.status === 'new') || []
  const existingUsers = previewData?.users.filter((u) => u.status === 'exists') || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            既存アカウント同期
          </DialogTitle>
          <DialogDescription>
            Google WorkspaceやZoomの既存ユーザーをCanviポータルのスタッフとしてインポートします。
          </DialogDescription>
        </DialogHeader>

        {/* Step: Config */}
        {step === 'config' && (
          <div className="space-y-4 py-2">
            <div className="space-y-3">
              <p className="text-sm font-medium">同期元サービスを選択</p>
              <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="checkbox"
                  checked={gwsChecked}
                  onChange={(e) => setGwsChecked(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">Google Workspace</p>
                  <p className="text-xs text-muted-foreground">
                    ドメイン内のユーザーを同期
                  </p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="checkbox"
                  checked={zoomChecked}
                  onChange={(e) => setZoomChecked(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">Zoom</p>
                  <p className="text-xs text-muted-foreground">
                    Zoomアカウントのユーザーを同期
                  </p>
                </div>
              </label>
            </div>

            {previewError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {previewError}
              </div>
            )}
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && previewData && (
          <div className="space-y-4 py-2 flex-1 overflow-hidden flex flex-col">
            {/* Summary */}
            <div className="flex gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="default" className="bg-blue-500">
                  {previewData.to_import}
                </Badge>
                <span>新規インポート</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">
                  {previewData.already_exists}
                </Badge>
                <span>既に登録済み</span>
              </div>
            </div>

            {/* User table */}
            <div className="flex-1 overflow-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名前</TableHead>
                    <TableHead>メールアドレス</TableHead>
                    <TableHead>サービス</TableHead>
                    <TableHead>ステータス</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {newUsers.map((user) => (
                    <TableRow key={`${user.provider}-${user.email}`}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {PROVIDER_LABELS[user.provider]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                          <CheckCircle2 className="h-3 w-3" />
                          インポート対象
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {existingUsers.map((user) => (
                    <TableRow
                      key={`${user.provider}-${user.email}`}
                      className="opacity-50"
                    >
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {PROVIDER_LABELS[user.provider]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          登録済み（スキップ）
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {previewData.users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        同期対象のユーザーが見つかりませんでした
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Step: Syncing */}
        {step === 'syncing' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-muted-foreground">同期処理中...</p>
          </div>
        )}

        {/* Step: Result */}
        {step === 'result' && syncResult && (
          <div className="space-y-4 py-2 flex-1 overflow-hidden flex flex-col">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {syncResult.imported}
                </p>
                <p className="text-xs text-muted-foreground">インポート成功</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-gray-500">
                  {syncResult.skipped}
                </p>
                <p className="text-xs text-muted-foreground">スキップ</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p
                  className={cn(
                    'text-2xl font-bold',
                    syncResult.errors.length > 0
                      ? 'text-red-600'
                      : 'text-gray-500'
                  )}
                >
                  {syncResult.errors.length}
                </p>
                <p className="text-xs text-muted-foreground">エラー</p>
              </div>
            </div>

            {/* Error list */}
            {syncResult.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium text-red-700 flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  エラー詳細
                </p>
                {syncResult.errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-600 pl-5">
                    {err}
                  </p>
                ))}
              </div>
            )}

            {/* Details table */}
            <div className="flex-1 overflow-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名前</TableHead>
                    <TableHead>メールアドレス</TableHead>
                    <TableHead>サービス</TableHead>
                    <TableHead>結果</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncResult.details.map((detail, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">
                        {detail.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {detail.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {PROVIDER_LABELS[detail.provider] || detail.provider}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {detail.action === 'imported' && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            インポート完了
                          </span>
                        )}
                        {detail.action === 'skipped' && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            スキップ
                          </span>
                        )}
                        {detail.action === 'error' && (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600">
                            <XCircle className="h-3 w-3" />
                            エラー
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'config' && (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleLoadPreview}
                disabled={(!gwsChecked && !zoomChecked) || previewLoading}
              >
                {previewLoading && (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                )}
                プレビュー
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('config')}>
                戻る
              </Button>
              <Button
                onClick={handleSync}
                disabled={newUsers.length === 0}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                同期開始（{newUsers.length}件）
              </Button>
            </>
          )}

          {step === 'syncing' && (
            <Button variant="outline" disabled>
              処理中...
            </Button>
          )}

          {step === 'result' && (
            <Button onClick={() => onOpenChange(false)}>
              閉じる
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
