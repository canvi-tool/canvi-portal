'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Users, Video, Phone, RefreshCw, CheckCircle2, XCircle, AlertCircle, Monitor } from 'lucide-react'
import { toast } from 'sonner'

interface ServiceHealth {
  name: string
  status: 'connected' | 'not_configured' | 'error' | 'demo'
  message: string
  lastChecked: string
}

const STATUS_CONFIG = {
  connected: { label: '接続済み', variant: 'default' as const, icon: CheckCircle2, color: 'text-green-600' },
  not_configured: { label: '未設定', variant: 'secondary' as const, icon: AlertCircle, color: 'text-yellow-600' },
  error: { label: 'エラー', variant: 'destructive' as const, icon: XCircle, color: 'text-red-600' },
  demo: { label: 'デモモード', variant: 'outline' as const, icon: Monitor, color: 'text-blue-600' },
}

export default function IntegrationSetupPage() {
  const [services, setServices] = useState<ServiceHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)

  async function checkHealth() {
    setChecking(true)
    try {
      const res = await fetch('/api/integrations/health')
      if (!res.ok) throw new Error('ヘルスチェックに失敗しました')
      const data = await res.json()
      setServices(data.services)
    } catch {
      toast.error('接続チェックに失敗しました')
    } finally {
      setLoading(false)
      setChecking(false)
    }
  }

  useEffect(() => {
    checkHealth()
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="API接続セットアップ"
        description="Google Workspace・Zoom・Zoom Phoneの接続設定ガイド"
      />

      {/* 接続ステータス */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">接続ステータス</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={checkHealth}
              disabled={checking}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${checking ? 'animate-spin' : ''}`} />
              再チェック
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {services.map((service) => {
                const config = STATUS_CONFIG[service.status]
                const Icon = config.icon
                return (
                  <div
                    key={service.name}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-5 w-5 ${config.color}`} />
                      <div>
                        <p className="text-sm font-medium">{service.name}</p>
                        <p className="text-xs text-muted-foreground">{service.message}</p>
                      </div>
                    </div>
                    <Badge variant={config.variant}>{config.label}</Badge>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* セットアップガイド */}
      <Accordion defaultValue={["google-workspace", "zoom", "zoom-phone"]} className="space-y-4">
        {/* Google Workspace */}
        <AccordionItem value="google-workspace" className="rounded-lg border px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <Users className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">Google Workspace 接続設定</p>
                <p className="text-xs text-muted-foreground">Admin SDK Directory API</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="space-y-4 pl-12">
              <div>
                <h4 className="text-sm font-semibold mb-2">前提条件</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  <li>Google Workspace Business / Enterprise プラン</li>
                  <li>Google Cloud Platform プロジェクト</li>
                  <li>特権管理者アクセス</li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Step 1: Google Cloud プロジェクト設定</h4>
                <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
                  <li>
                    <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                      Google Cloud Console
                    </a>
                    にアクセスし、プロジェクトを作成または選択
                  </li>
                  <li>「APIとサービス」→「APIを有効化」→ <strong>Admin SDK API</strong> を有効化</li>
                  <li>「APIとサービス」→「認証情報」→「認証情報を作成」→「サービスアカウント」</li>
                  <li>サービスアカウント名を入力（例: canvi-portal-admin）して作成</li>
                  <li>作成したサービスアカウントの「鍵」タブ → 「鍵を追加」→「新しい鍵を作成」→ JSON形式でダウンロード</li>
                </ol>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Step 2: ドメイン全体の委任</h4>
                <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
                  <li>
                    <a href="https://admin.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                      Google Admin
                    </a>
                    → セキュリティ → アクセスとデータ管理 → APIの制御 → ドメイン全体の委任
                  </li>
                  <li>「新しく追加」をクリック</li>
                  <li>
                    クライアントID: サービスアカウントのクライアントID（JSONファイル内の <code className="bg-muted px-1 rounded">client_id</code>）
                  </li>
                  <li>
                    OAuthスコープに以下を入力:
                    <code className="block mt-1 bg-muted p-2 rounded text-xs break-all">
                      https://www.googleapis.com/auth/admin.directory.user,https://www.googleapis.com/auth/admin.directory.group
                    </code>
                  </li>
                </ol>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Step 3: 環境変数設定</h4>
                <div className="bg-muted rounded-lg p-3 font-mono text-xs space-y-1">
                  <p>GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL=<span className="text-blue-600">JSONの client_email</span></p>
                  <p>GOOGLE_WORKSPACE_PRIVATE_KEY=<span className="text-blue-600">JSONの private_key（改行を\nに変換）</span></p>
                  <p>GOOGLE_WORKSPACE_ADMIN_EMAIL=<span className="text-blue-600">okabayashi@canvi.co.jp</span></p>
                  <p>GOOGLE_WORKSPACE_DOMAIN=<span className="text-blue-600">canvi.co.jp</span></p>
                </div>
              </div>

              <CardDescription>
                Vercelにデプロイする場合は、Vercelのプロジェクト設定 → Environment Variables に上記を追加してください。
              </CardDescription>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Zoom */}
        <AccordionItem value="zoom" className="rounded-lg border px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <Video className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">Zoom 接続設定</p>
                <p className="text-xs text-muted-foreground">Server-to-Server OAuth</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="space-y-4 pl-12">
              <div>
                <h4 className="text-sm font-semibold mb-2">前提条件</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  <li>Zoom Workspaceプラン（Pro以上）</li>
                  <li>Zoom Marketplaceへのアクセス権（管理者）</li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Step 1: Server-to-Server OAuthアプリ作成</h4>
                <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
                  <li>
                    <a href="https://marketplace.zoom.us/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                      Zoom Marketplace
                    </a>
                    にログイン
                  </li>
                  <li>「Develop」→「Build App」→「Server-to-Server OAuth」を選択</li>
                  <li>アプリ名を入力（例: Canvi Portal）して作成</li>
                  <li><strong>Account ID</strong>、<strong>Client ID</strong>、<strong>Client Secret</strong> をメモ</li>
                </ol>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Step 2: スコープ設定</h4>
                <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
                  <li>「Scopes」タブで以下を追加:
                    <ul className="list-disc pl-5 mt-1 space-y-0.5">
                      <li><code className="bg-muted px-1 rounded">user:read:admin</code> - ユーザー情報の読み取り</li>
                      <li><code className="bg-muted px-1 rounded">user:write:admin</code> - ユーザーの作成・更新</li>
                      <li><code className="bg-muted px-1 rounded">phone:read:admin</code> - Zoom Phone情報の読み取り</li>
                      <li><code className="bg-muted px-1 rounded">phone:write:admin</code> - Zoom Phone設定の変更</li>
                      <li><code className="bg-muted px-1 rounded">phone_call_log:read:admin</code> - 通話ログの読み取り</li>
                    </ul>
                  </li>
                  <li>「Activation」タブで「Activate your app」をクリック</li>
                </ol>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Step 3: 環境変数設定</h4>
                <div className="bg-muted rounded-lg p-3 font-mono text-xs space-y-1">
                  <p>ZOOM_ACCOUNT_ID=<span className="text-blue-600">Account ID</span></p>
                  <p>ZOOM_CLIENT_ID=<span className="text-blue-600">Client ID</span></p>
                  <p>ZOOM_CLIENT_SECRET=<span className="text-blue-600">Client Secret</span></p>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Zoom Phone */}
        <AccordionItem value="zoom-phone" className="rounded-lg border px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-700">
                <Phone className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">Zoom Phone 接続設定</p>
                <p className="text-xs text-muted-foreground">Zoom API共通認証</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="space-y-4 pl-12">
              <div>
                <h4 className="text-sm font-semibold mb-2">前提条件</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  <li>上記のZoom API設定が完了していること</li>
                  <li>Zoom Phoneライセンスがアカウントで有効化されていること</li>
                  <li>Zoom Phone管理者権限</li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">追加設定不要</h4>
                <p className="text-sm text-muted-foreground">
                  Zoom Phoneは上記のZoom Server-to-Server OAuthと同じ認証情報を使用します。
                  Zoom APIの設定が完了していれば、Zoom Phoneの機能も自動的に利用可能になります。
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  ただし、Zoom Phoneライセンスがアカウントで有効でない場合、コールキューや通話ログの
                  APIはエラーを返します。Zoom管理画面でPhoneライセンスが有効か確認してください。
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* 本番モード切替ガイド */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">本番モードへの切替</CardTitle>
          <CardDescription>
            デモモードから本番モードに切り替えるには、以下の手順を実行してください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
            <li>上記の手順で各サービスのAPI認証情報を取得</li>
            <li>
              <code className="bg-muted px-1 rounded">.env.local</code> に環境変数を追加
            </li>
            <li>
              <code className="bg-muted px-1 rounded">NEXT_PUBLIC_DEMO_MODE=false</code> に変更
            </li>
            <li>Vercelにデプロイする場合は、Vercelの「Settings」→「Environment Variables」に同じ値を設定</li>
            <li>デプロイ後、このページの「再チェック」ボタンで接続を確認</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
