'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, X, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

export function GoogleReauthBanner() {
  const [needsReauth, setNeedsReauth] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Check if dismissed recently (1 hour)
    const dismissedAt = localStorage.getItem('google-reauth-dismissed')
    if (dismissedAt && Date.now() - parseInt(dismissedAt) < 60 * 60 * 1000) {
      return
    }

    fetch('/api/google/status')
      .then(r => r.json())
      .then(data => {
        if (data.needsReauth && data.connected) {
          setNeedsReauth(true)
        }
      })
      .catch(() => {})
  }, [])

  const handleReauth = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/callback?reauth=true`,
          scopes: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
    } catch {
      setLoading(false)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem('google-reauth-dismissed', String(Date.now()))
    setDismissed(true)
  }

  if (!needsReauth || dismissed) return null

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50 px-4 py-3 flex items-center gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
      <div className="flex-1 text-sm text-amber-800 dark:text-amber-200">
        Googleカレンダーの再認証が必要です（最終認証から6時間以上経過）
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleReauth}
        disabled={loading}
        className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300"
      >
        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
        再認証
      </Button>
      <button
        onClick={handleDismiss}
        className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
