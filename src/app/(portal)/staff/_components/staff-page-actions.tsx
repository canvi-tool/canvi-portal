'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, Upload, UserPlus, Mail, Send, Loader2, CheckCircle2 } from 'lucide-react'
import { InviteOnboardingDialog } from './invite-onboarding-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface EmailResult {
  success_count: number
  fail_count: number
  results: { display_name: string; email: string; success: boolean; error?: string }[]
}

export function StaffPageActions() {
  const [inviteOpen, setInviteOpen] = useState(false)
  const [sendEmailOpen, setSendEmailOpen] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailResult, setEmailResult] = useState<EmailResult | null>(null)

  const handleSendWelcomeEmails = async () => {
    setSendingEmail(true)
    try {
      const res = await fetch('/api/users/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'メール送信に失敗しました')
        return
      }
      setEmailResult(data)
      setSendEmailOpen(false)
      toast.success(data.message)
    } catch {
      toast.error('メール送信に失敗しました')
    } finally {
      setSendingEmail(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => setSendEmailOpen(true)}>
          <Mail className="h-4 w-4 mr-2" />
          ログイン案内メール
        </Button>
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

      {/* 一括メール送信確認ダイアログ */}
      <Dialog open={sendEmailOpen} onOpenChange={setSendEmailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              初回ログイン案内メール一括送信
            </DialogTitle>
            <DialogDescription>
              全メンバーに初回ログイン案内メールを送信します。
              各メンバーの初期パスワードが再生成され、メールにログイン情報が記載されます。
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-3 text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-200 mb-1">送信内容</p>
            <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-0.5 list-disc list-inside">
              <li>メールアドレス（ログインID）</li>
              <li>新しい初期パスワード（Canvi+電話番号下4桁+ca形式で再生成）</li>
              <li>ログインURL</li>
              <li>パスワード設定 → Google連携の手順</li>
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">
            対象: 自分以外の全ユーザー
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendEmailOpen(false)} disabled={sendingEmail}>
              キャンセル
            </Button>
            <Button onClick={handleSendWelcomeEmails} disabled={sendingEmail}>
              {sendingEmail ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  送信中...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  全員に送信
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 送信結果ダイアログ */}
      <Dialog open={!!emailResult} onOpenChange={(open) => { if (!open) setEmailResult(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              メール送信結果
            </DialogTitle>
            <DialogDescription>
              {emailResult?.success_count}名に送信完了
              {emailResult?.fail_count ? `、${emailResult.fail_count}名失敗` : ''}
            </DialogDescription>
          </DialogHeader>
          {emailResult?.results && (
            <div className="max-h-60 overflow-y-auto space-y-1">
              {emailResult.results.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-sm px-1 py-1">
                  {r.success ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <span className="h-3.5 w-3.5 text-red-500 shrink-0 text-center">✗</span>
                  )}
                  <span className="truncate">{r.display_name}</span>
                  <span className="text-xs text-muted-foreground truncate">{r.email}</span>
                  {r.error && <span className="text-xs text-red-500 truncate">{r.error}</span>}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setEmailResult(null)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
