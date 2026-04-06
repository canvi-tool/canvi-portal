/**
 * GET /api/profile-change-requests/attachment?path=...
 * 添付ファイルの署名付きURLを返す（オーナー/管理者のみ）
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, isOwner, hasRole } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'

const EXPIRY = 600 // 10分

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    if (!isOwner(user) && !hasRole(user, 'admin')) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }
    const path = new URL(request.url).searchParams.get('path')
    if (!path) return NextResponse.json({ error: 'path が必要です' }, { status: 400 })

    const admin = createAdminClient()
    const { data, error } = await admin.storage
      .from('staff-documents')
      .createSignedUrl(path, EXPIRY)
    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'URL生成失敗' }, { status: 500 })
    }
    return NextResponse.json({ url: data.signedUrl })
  } catch (e) {
    console.error('GET attachment error:', e)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
