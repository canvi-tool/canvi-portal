import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Upsert user record in public.users table
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        await supabase.from('users').upsert(
          {
            id: user.id,
            email: user.email!,
            display_name:
              user.user_metadata.full_name || user.email!,
            avatar_url: user.user_metadata.avatar_url,
          },
          { onConflict: 'id' }
        )
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
