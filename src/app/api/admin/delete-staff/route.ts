import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { secret, staff_codes } = await request.json()
    if (secret !== process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-10)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    const results: Record<string, unknown> = {}

    for (const code of staff_codes) {
      const { data, error } = await admin
        .from('staff')
        .delete()
        .eq('staff_code', code)
        .select('id, staff_code, last_name, first_name')

      results[code] = error ? { error: error.message } : { deleted: data }
    }

    return NextResponse.json({ success: true, results })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
