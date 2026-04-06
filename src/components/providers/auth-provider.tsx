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
import type { User, Session } from '@supabase/supabase-js'

interface AuthContextValue {
  user: User | null
  session: Session | null
  isLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  isLoading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
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
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
      setIsLoading(false)

      // メールログイン時にユーザーレコードを作成（fire-and-forget: ロックをブロックしない）
      if (event === 'SIGNED_IN' && newSession?.user) {
        const u = newSession.user
        const ensureUser = async () => {
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
        // fire-and-forget: onAuthStateChangeコールバックをブロックしない
        ensureUser()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch (err) {
      console.error('サインアウトエラー:', err)
    }
    setUser(null)
    setSession(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signOut }}>
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
