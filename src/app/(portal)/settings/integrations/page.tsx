'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { FileSignature, Calendar, Mail, Brain, Loader2, Users, Phone, Video } from 'lucide-react'
import { toast } from 'sonner'

interface IntegrationConfig {
  key: string
  enabled: boolean
  config: Record<string, string>
}

const INTEGRATION_META: Record<
  string,
  {
    name: string
    description: string
    icon: React.ElementType
    configFields: { key: string; label: string; masked?: boolean; placeholder?: string }[]
  }
> = {
  freee_sign: {
    name: 'freee Sign',
    description: '電子契約サービスとの連携（OAuth 2.0）。契約書の電子署名を管理します。',
    icon: FileSignature,
    configFields: [
      { key: 'client_id', label: 'クライアントID', placeholder: 'freee Sign OAuth クライアントID' },
      { key: 'client_secret', label: 'クライアントシークレット', masked: true, placeholder: '••••••••' },
      { key: 'sender_user_id', label: '送信者ユーザーID', placeholder: 'freee Sign上の送信者ID' },
      { key: 'webhook_secret', label: 'Webhookシークレット', masked: true, placeholder: 'Webhook署名検証用パスワード' },
    ],
  },
  google_calendar: {
    name: 'Google カレンダー',
    description: 'シフトや面談スケジュールをGoogle カレンダーと同期します。',
    icon: Calendar,
    configFields: [
      { key: 'calendar_id', label: 'カレンダーID', placeholder: 'xxx@group.calendar.google.com' },
    ],
  },
  resend_email: {
    name: 'メール送信 (Resend)',
    description: '契約書送付・通知メールをResend経由で送信します。',
    icon: Mail,
    configFields: [
      { key: 'api_key', label: 'APIキー', masked: true, placeholder: 're_xxxxxxxxxxxx' },
      { key: 'from_email', label: '送信元メール', placeholder: 'noreply@example.com' },
      { key: 'from_name', label: '送信元名', placeholder: 'Canvi Portal' },
    ],
  },
  claude_ai: {
    name: 'Claude AI',
    description: 'AI分析・異常検知にClaude APIを使用します。',
    icon: Brain,
    configFields: [
      { key: 'api_key', label: 'APIキー', masked: true, placeholder: 'sk-ant-xxxxxxxxxxxx' },
      { key: 'model', label: 'モデル', placeholder: 'claude-sonnet-4-20250514' },
    ],
  },
  google_workspace: {
    name: 'Google Workspace',
    description: 'ユーザー・グループ管理をGoogle Admin SDKで連携します。',
    icon: Users,
    configFields: [
      { key: 'service_account_email', label: 'サービスアカウントメール', placeholder: 'xxx@xxx.iam.gserviceaccount.com' },
      { key: 'private_key', label: '秘密鍵 (PEM)', masked: true, placeholder: '-----BEGIN PRIVATE KEY-----...' },
      { key: 'admin_email', label: '管理者メール', placeholder: 'admin@canvi.co.jp' },
      { key: 'domain', label: 'ドメイン', placeholder: 'canvi.co.jp' },
    ],
  },
  zoom: {
    name: 'Zoom',
    description: 'Zoomユーザー管理をServer-to-Server OAuthで連携します。',
    icon: Video,
    configFields: [
      { key: 'account_id', label: 'アカウントID', placeholder: 'Zoom Account ID' },
      { key: 'client_id', label: 'クライアントID', placeholder: 'Zoom Client ID' },
      { key: 'client_secret', label: 'クライアントシークレット', masked: true, placeholder: '••••••••' },
    ],
  },
  zoom_phone: {
    name: 'Zoom Phone',
    description: 'Zoom Phoneのコールキュー・通話ログ管理（Zoom連携が必要）',
    icon: Phone,
    configFields: [],
  },
}

function maskValue(value: string) {
  if (!value || value.length <= 8) return '••••••••'
  return value.slice(0, 4) + '••••' + value.slice(-4)
}

export default function IntegrationsSettingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([])
  const [error, setError] = useState<string | null>(null)
  const [configDialogKey, setConfigDialogKey] = useState<string | null>(null)
  const [configValues, setConfigValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/integrations')
      if (res.status === 403) {
        router.push('/dashboard')
        return
      }
      if (!res.ok) throw new Error('データの取得に失敗しました')
      const data = await res.json()
      setIntegrations(data.integrations)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function openConfigDialog(integrationKey: string) {
    const existing = integrations.find((i) => i.key === integrationKey)
    const meta = INTEGRATION_META[integrationKey]
    if (!meta) return

    const values: Record<string, string> = {}
    for (const field of meta.configFields) {
      values[field.key] = existing?.config?.[field.key] ?? ''
    }
    setConfigValues(values)
    setConfigDialogKey(integrationKey)
  }

  async function handleSaveConfig() {
    if (!configDialogKey) return
    setSaving(true)
    try {
      const res = await fetch('/api/settings/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: configDialogKey,
          enabled: true,
          config: configValues,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? '保存に失敗しました')
      }
      toast.success('連携設定を保存しました')
      setConfigDialogKey(null)
      await fetchData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  async function handleTestConnection(integrationKey: string) {
    setTesting(integrationKey)
    try {
      const res = await fetch('/api/settings/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: integrationKey, action: 'test' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error ?? '接続テストに失敗しました')
      }
      toast.success(data.message ?? '接続テストに成功しました')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '接続テストに失敗しました')
    } finally {
      setTesting(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="外部連携" description="外部サービスとの連携設定" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="外部連携" description="外部サービスとの連携設定" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  const currentMeta = configDialogKey ? INTEGRATION_META[configDialogKey] : null

  return (
    <div className="space-y-6">
      <PageHeader
        title="外部連携"
        description="外部サービスとの連携を設定します。APIキーやOAuth設定を管理できます。"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {Object.entries(INTEGRATION_META).map(([key, meta]) => {
          const integration = integrations.find((i) => i.key === key)
          const status: 'connected' | 'disconnected' =
            integration?.enabled ? 'connected' : 'disconnected'
          return (
            <Card key={key}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <meta.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{meta.name}</CardTitle>
                      <CardDescription className="mt-0.5">
                        {meta.description}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={status === 'connected' ? 'default' : 'secondary'}>
                    {status === 'connected' ? '接続済' : '未接続'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {integration?.enabled && (
                  <div className="mb-3 space-y-1">
                    {meta.configFields.map((cf) => {
                      const val = integration.config?.[cf.key]
                      if (!val) return null
                      return (
                        <div key={cf.key} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium">{cf.label}:</span>
                          <span className="font-mono">
                            {cf.masked ? maskValue(val) : val}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openConfigDialog(key)}
                  >
                    設定
                  </Button>
                  {integration?.enabled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTestConnection(key)}
                      disabled={testing === key}
                    >
                      {testing === key ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          テスト中...
                        </>
                      ) : (
                        '接続テスト'
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 設定ダイアログ */}
      <Dialog
        open={configDialogKey !== null}
        onOpenChange={(v) => { if (!v) setConfigDialogKey(null) }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{currentMeta?.name} 設定</DialogTitle>
            <DialogDescription>
              接続に必要な情報を入力してください。
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {currentMeta?.configFields.map((cf) => (
              <div key={cf.key} className="space-y-1.5">
                <Label htmlFor={`int-${cf.key}`}>{cf.label}</Label>
                <Input
                  id={`int-${cf.key}`}
                  type={cf.masked ? 'password' : 'text'}
                  placeholder={cf.placeholder}
                  value={configValues[cf.key] ?? ''}
                  onChange={(e) =>
                    setConfigValues((prev) => ({
                      ...prev,
                      [cf.key]: e.target.value,
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setConfigDialogKey(null)}
            >
              キャンセル
            </Button>
            <Button onClick={handleSaveConfig} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
