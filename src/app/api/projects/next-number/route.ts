import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * GET /api/projects/next-number?type=BPO
 * 指定されたプロジェクトタイプの次の空き番号（001〜999）を返す
 * 若い番号から順にチェックし、最初の空き番号を返す
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const projectType = searchParams.get('type')

    if (!projectType || !['BPO', 'RPO', 'ETC'].includes(projectType)) {
      return NextResponse.json(
        { error: 'type パラメータが必要です (BPO/RPO/ETC)' },
        { status: 400 }
      )
    }

    // 指定タイプの既存プロジェクト番号をすべて取得
    const { data, error } = await supabase
      .from('projects')
      .select('project_number')
      .eq('project_type', projectType)
      .order('project_number', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 使用済み番号をSetに格納
    const usedNumbers = new Set(
      (data || []).map((p) => p.project_number)
    )

    // 001〜999で最初の空き番号を探す
    let nextNumber: string | null = null
    for (let i = 1; i <= 999; i++) {
      const candidate = String(i).padStart(3, '0')
      if (!usedNumbers.has(candidate)) {
        nextNumber = candidate
        break
      }
    }

    if (!nextNumber) {
      return NextResponse.json(
        { error: `${projectType} の番号は全て使用済みです (001〜999)` },
        { status: 409 }
      )
    }

    return NextResponse.json({
      project_type: projectType,
      next_number: nextNumber,
      project_code: `${projectType}-${nextNumber}`,
    })
  } catch (error) {
    console.error('GET /api/projects/next-number error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
