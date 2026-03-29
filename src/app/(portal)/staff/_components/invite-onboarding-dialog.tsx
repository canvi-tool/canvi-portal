'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Mail, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

interface InviteOnboardingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteOnboardingDialog({ open, onOpenChange }: InviteOnboardingDialogProps) {
  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResultUrl(null)

    try {
      const res = await fetch('/api/staff/invite-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          last_name: lastName,
          first_name: firstName,
          personal_email: email,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '招待に失敗しました')
        return
      }
      toast.success(data.message || '招待メールを送信しました')
      setResultUrl(data.onboarding_url)
    } catch {
      toast.error('招待に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!resultUrl) return
    await navigator.clipboard.writeText(resultUrl)
    setCopied(true)
    toast.success('URLをコピーしました')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClose = () => {
    onOpenChange(false)
    // Reset after close animation
    setTimeout(() => {
      setLastName('')
      setFirstName('')
      setEmail('')
      setResultUrl(null)
      setCopied(false)
    }, 200)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>入職スタッフを招待</DialogTitle>
          <DialogDescription>
            入職予定者の個人メールアドレスに、スタッフ登録フォームのリンクが送信されます。
          </DialogDescription>
        </DialogHeader>

        {resultUrl ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground mb-2">招待メールを送信しました。以下のURLを直接共有することもできます：</p>
              <div className="flex items-center gap-2">
                <Input value={resultUrl} readOnly className="text-xs" />
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleClose}>閉じる</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>姓 <span className="text-red-500">*</span></Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required placeholder="山田" />
              </div>
              <div className="space-y-1.5">
                <Label>名 <span className="text-red-500">*</span></Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="太郎" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>個人メールアドレス <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="personal@example.com"
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">この宛先にスタッフ登録フォームのURLが送信されます</p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={handleClose}>キャンセル</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                招待メールを送信
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
