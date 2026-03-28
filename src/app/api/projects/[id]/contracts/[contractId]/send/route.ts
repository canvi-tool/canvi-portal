import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

interface RouteParams {
  params: Promise<{ id: string; contractId: string }>
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { contractId } = await params

    if (DEMO_MODE) {
      return NextResponse.json({
        id: contractId,
        status: 'pending_signature',
        external_sign_id: `freee-sign-demo-${Date.now()}`,
        message: 'freee Signで署名依頼を送信しました（デモ）',
        updated_at: new Date().toISOString(),
      })
    }

    const supabase = await createServerSupabaseClient()

    // Get the contract
    const { data: contract, error: fetchError } = await supabase
      .from('project_contracts')
      .select('*')
      .eq('id', contractId)
      .single()

    if (fetchError || !contract) {
      return NextResponse.json({ error: 'PJ契約書が見つかりません' }, { status: 404 })
    }

    if (contract.status !== 'draft') {
      return NextResponse.json(
        { error: '下書き状態の契約のみ署名依頼を送信できます' },
        { status: 400 }
      )
    }

    if (!contract.client_email) {
      return NextResponse.json(
        { error: 'クライアントのメールアドレスが設定されていません' },
        { status: 400 }
      )
    }

    // TODO: Integrate with freee Sign API
    // For now, just update the status
    const { data: updatedContract, error: updateError } = await supabase
      .from('project_contracts')
      .update({
        status: 'pending_signature',
        updated_at: new Date().toISOString(),
      })
      .eq('id', contractId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: '契約ステータスの更新に失敗しました' }, { status: 500 })
    }

    return NextResponse.json(updatedContract)
  } catch (error) {
    console.error('POST project contract send error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
