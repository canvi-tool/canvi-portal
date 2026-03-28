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
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
      setIsLoading(false)

      // メールログイン時にユーザーレコードを作成（非同期・UIブロックしない）
      if (event === 'SIGNED_IN' && newSession?.user) {
        const u = newSession.user
        try {
          await supabase.from('users').upsert(
            {
              id: u.id,
              email: u.email!,
              display_name: u.user_metadata?.full_name || u.email!,
              avatar_url: u.user_metadata?.avatar_url || null,
            },
            { onConflict: 'id' }
          )
          // ロール自動割り当て
          const { data: existingRole } = await supabase
            .from('user_roles')
            .select('role_id')
            .eq('user_id', u.id)
            .limit(1)
          if (!existingRole || existingRole.length === 0) {
            const { count } = await supabase
              .from('users')
              .select('id', { count: 'exact', head: true })
            const roleName = (count ?? 0) <= 1 ? 'owner' : 'staff'
            const { data: role } = await supabase
              .from('roles')
              .select('id')
              .eq('name', roleName)
              .single()
            if (role) {
              await supabase.from('user_roles').upsert(
                { user_id: u.id, role_id: role.id },
                { onConflict: 'user_id,role_id' }
              )
            }
          }
        } catch (err) {
          console.error('ユーザーレコード作成エラー:', err)
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    if (DEMO_MODE) {
      document.cookie = 'demo_role=;path=/;max-age=0'
      setDemoAccount(null)
      setDemoRole(null)
    } else {
      try {
        const supabase = createClient()
        await supabase.auth.signOut()
      } catch (err) {
        console.error('サインアウトエラー:', err)
      }
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
