import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/types/database'
import {
  compensationRuleFormSchema,
  validateParams,
  type CompensationRuleTypeValue,
} from '@/lib/validations/assignment'

interface RouteParams {
  params: Promise<{ id: string; assignmentId: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { assignmentId } = await params
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('compensation_rules')
      .select('*')
      .eq('assignment_id', assignmentId)
      .order('priority', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('GET compensation-rules error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { assignmentId } = await params
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const parsed = compensationRuleFormSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Validate params based on rule_type
    const paramsResult = validateParams(
      parsed.data.rule_type as CompensationRuleTypeValue,
      parsed.data.params
    )
    if (!paramsResult.success) {
      return NextResponse.json(
        { error: 'パラメータバリデーションエラー', details: paramsResult.error.flatten() },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('compensation_rules')
      .insert({
        assignment_id: assignmentId,
        rule_type: parsed.data.rule_type,
        name: parsed.data.name,
        params: paramsResult.data as unknown as Json,
        priority: parsed.data.priority,
        is_active: parsed.data.is_active,
        effective_from: parsed.data.effective_from || null,
        effective_to: parsed.data.effective_until || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('POST compensation-rules error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
