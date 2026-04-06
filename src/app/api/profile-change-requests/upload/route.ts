/**
 * POST /api/profile-change-requests/upload
 * プロフィール変更申請の添付書類をアップロード（staff-documents バケット配下）
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const form = await request.formData()
    const file = form.get('file') as File | null
    const staffId = form.get('staff_id') as string | null
    if (!file || !staffId) {
      return NextResponse.json({ error: 'file と staff_id が必要です' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'ファイルサイズが大きすぎます（最大10MB）' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'JPEG/PNG/WebP/PDFのみ対応' }, { status: 400 })
    }

    const admin = createAdminClient()
    const ext = file.name.split('.').pop() || 'bin'
    const path = `profile-change-requests/${staffId}/${Date.now()}-${crypto.randomUUID()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: upErr } = await admin.storage
      .from('staff-documents')
      .upload(path, buffer, { contentType: file.type, upsert: false })
    if (upErr) {
      return NextResponse.json({ error: `アップロード失敗: ${upErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ url: path })
  } catch (e) {
    console.error('POST upload error:', e)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
