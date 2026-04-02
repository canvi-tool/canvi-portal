'use client'

import Link from 'next/link'
import { APP_NAME } from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ShieldAlert } from 'lucide-react'

export default function ForgotPasswordPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white">
          C
        </div>
        <CardTitle className="text-2xl">{APP_NAME}</CardTitle>
        <CardDescription className="mt-2">
          パスワードリセットについて
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium mb-1">セキュリティのため、パスワードの自己再発行はできません。</p>
              <p className="text-amber-700 dark:text-amber-300">
                パスワードを忘れた場合は、オーナー（管理者）に連絡して、パスワードの再発行を依頼してください。
              </p>
            </div>
          </div>
        </div>

        <Link href="/login">
          <Button variant="outline" className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            ログインページに戻る
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
