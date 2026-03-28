'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import { getDemoAccountFromCookie, type DemoAccount, type DemoRole } from '@/lib/demo-accounts'
import type { User, Session } from '@supabase/supabase-js'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

interface AuthContextValue {
  user: User | null
  session: Session | null
  isLoading: boolean
  signOut: () => Promise<void>
  // デモモード用
  demoAccount: DemoAccount | null
  demoRole: DemoRole | null
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  isLoading: true,
  signOut: async () => {},
  demoAccount: null,
  demoRole: null,
})

function createDemoUser(account: DemoAccount): User {
  return {
    id: account.id,
    email: account.email,
    user_metadata: {
      full_name: account.name,
      avatar_url: null,
    },
    app_metadata: { role: account.role },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  } as unknown as User
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [demoAccount, setDemoAccount] = useState<DemoAccount | null>(null)
  const [demoRole, setDemoRole] = useState<DemoRole | null>(null)

  useEffect(() => {
    if (DEMO_MODE) {
      const account = getDemoAccountFromCookie()
      if (account) {
        setDemoAccount(account)
        setDemoRole(account.role)
        setUser(createDemoUser(account))
      }
      setIsLoading(false)
      return
    }

    const supabase = createClient()

    const getInitialSession = async () => {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession()
        setSession(initialSession)
        setUser(initialSession?.user ?? null)
      } catch (error) {
        console.error('セッション取得エラー:', error)
      } finally {
        setIsLoading(false)
      }
    }

    getInitialSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
      setIsLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    if (DEMO_MODE) {
      // デモモードではcookieを削除
      document.cookie = 'demo_role=;path=/;max-age=0'
      setDemoAccount(null)
      setDemoRole(null)
    } else {
      const supabase = createClient()
      await supabase.auth.signOut()
    }
    setUser(null)
    setSession(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signOut, demoAccount, demoRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth は AuthProvider の中で使用してください')
  }
  return context
}
