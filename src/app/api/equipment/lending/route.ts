import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, isOwner } from '@/lib/auth/rbac'
import { sendSlackMessage } from '@/lib/integrations/slack'

// GET: 貸出記録一覧
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    if (!isOwner(user)) return NextResponse.json({ error: 'オーナー権限が必要です' }, { status: 403 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabaseClient()) as any
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staff_id')
    const activeOnly = searchParams.get('active_only') === 'true'

    let query = supabase
      .from('equipment_lending_records')
      .select(`
        *,
        staff:staff_id(id, last_name, first_name),
        items:equipment_lending_items(
          id,
          equipment_item_id,
          is_main_device,
          remarks,
          equipment_item:equipment_item_id(
            id,
            management_number,
            product_name,
            status,
            category:category_code(code, name),
            maker:maker_code(code, name)
          )
        )
      `)
      .is('deleted_at', null)
      .order('lending_date', { ascending: false })

    if (staffId) {
      query = query.eq('staff_id', staffId)
    }
    if (activeOnly) {
      query = query.is('return_date', null)
    }

    const { data, error } = await query
    if (error) {
      console.error('GET lending records error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('GET lending records error:', error)
    return NextResponse.json({ error: '貸出記録の取得に失敗しました' }, { status: 500 })
  }
}

// POST: 貸出記録作成（貸出アイテムも同時作成）
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    if (!isOwner(user)) return NextResponse.json({ error: 'オーナー権限が必要です' }, { status: 403 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabaseClient()) as any
    const body = await request.json()
    const { staff_id, lending_date, pledge_status, pc_pin_code, remarks, items } = body

    if (!staff_id || !lending_date) {
      return NextResponse.json({ error: 'スタッフIDと貸出日は必須です' }, { status: 400 })
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '貸出アイテムは1つ以上必要です' }, { status: 400 })
    }

    // 1. 貸出記録を作成
    const { data: record, error: recordError } = await supabase
      .from('equipment_lending_records')
      .insert({
        staff_id,
        lending_date,
        pledge_status: pledge_status || null,
        pc_pin_code: pc_pin_code || null,
        remarks: remarks || null,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('*')
      .single()

    if (recordError) {
      console.error('POST lending record error:', recordError)
      return NextResponse.json({ error: recordError.message }, { status: 500 })
    }

    // 2. 貸出アイテムを作成（DBトリガーで備品ステータスが 'lent' に自動更新）
    const lendingItems = items.map((item: { equipment_item_id: string; is_main_device?: boolean; remarks?: string }) => ({
      lending_record_id: record.id,
      equipment_item_id: item.equipment_item_id,
      is_main_device: item.is_main_device || false,
      remarks: item.remarks || null,
    }))

    const { error: itemsError } = await supabase
      .from('equipment_lending_items')
      .insert(lendingItems)

    if (itemsError) {
      console.error('POST lending items error:', itemsError)
      // 貸出アイテム作成失敗時は貸出記録も削除
      await supabase.from('equipment_lending_records').delete().eq('id', record.id)
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    // 3. 作成した記録を関連データ付きで再取得
    const { data: fullRecord, error: fetchError } = await supabase
      .from('equipment_lending_records')
      .select(`
        *,
        staff:staff_id(id, last_name, first_name),
        items:equipment_lending_items(
          id,
          equipment_item_id,
          is_main_device,
          remarks,
          equipment_item:equipment_item_id(
            id,
            management_number,
            product_name,
            status
          )
        )
      `)
      .eq('id', record.id)
      .single()

    if (fetchError) {
      console.error('Fetch created record error:', fetchError)
    }

    const returnData = fullRecord || record

    // 4. freee Sign 貸与品管理契約書の自動送信（ベストエフォート・非同期）
    // pledge_status が既に 'signed' の場合はスキップ
    if (pledge_status !== 'signed') {
      triggerFreeeSignEquipmentContract(supabase, record.id, staff_id, returnData).catch((err) => {
        console.error('[Equipment Lending] freee Sign auto-send background error:', err)
      })
    }

    return NextResponse.json({ data: returnData }, { status: 201 })
  } catch (error) {
    console.error('POST lending record error:', error)
    return NextResponse.json({ error: '貸出記録の作成に失敗しました' }, { status: 500 })
  }
}

// ─── freee Sign 貸与品管理契約書 自動送信 ─────────────────

/**
 * 貸出記録作成後に freee Sign で貸与品管理契約書を自動送信する。
 * - FREEE_SIGN_ACCESS_TOKEN が未設定の場合はサイレントスキップ
 * - API呼び出し失敗時はログのみ（貸出記録の作成自体は成功扱い）
 * - 成功時は pledge_status を 'sent' に更新し Slack通知
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function triggerFreeeSignEquipmentContract(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  lendingRecordId: string,
  staffId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lendingRecord: any
) {
  const accessToken = process.env.FREEE_SIGN_ACCESS_TOKEN || ''
  if (!accessToken) {
    console.log('[Equipment Lending] FREEE_SIGN_ACCESS_TOKEN未設定のため契約送信をスキップ')
    return
  }

  const templateId = process.env.FREEE_SIGN_EQUIPMENT_TEMPLATE_ID || ''
  const senderUserId = process.env.FREEE_SIGN_SENDER_USER_ID || ''

  try {
    // スタッフのメールアドレスを取得
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('id, last_name, first_name, email')
      .eq('id', staffId)
      .single()

    if (staffError || !staff) {
      console.warn(`[Equipment Lending] スタッフ情報の取得に失敗: ${staffError?.message || 'not found'}`)
      return
    }

    if (!staff.email) {
      console.warn(`[Equipment Lending] スタッフ ${staff.last_name} ${staff.first_name} のメールアドレスが未設定`)
      return
    }

    const staffName = `${staff.last_name} ${staff.first_name}`

    const { FreeeSignClient } = await import('@/lib/integrations/freee-sign')
    const client = new FreeeSignClient(accessToken)

    // テンプレートからドキュメントを作成、またはテンプレート未設定時はタイトルのみで作成
    let doc
    if (templateId) {
      doc = await client.createDocument({
        title: `貸与品管理契約書 - ${staffName}`,
        template_id: templateId,
      })
    } else {
      doc = await client.createDocument({
        title: `貸与品管理契約書 - ${staffName}`,
      })
    }

    // 署名依頼を送信
    await client.sendForSignature({
      document_id: doc.id,
      sender_user_id: senderUserId,
      recipients: [{
        email: staff.email,
        name: staffName,
        message: `貸与品管理契約書への署名をお願いいたします。`,
      }],
    })

    // pledge_status を 'sent' に更新し、freee Sign ドキュメントIDを保存
    const updateData: Record<string, unknown> = {
      pledge_status: 'sent',
      updated_at: new Date().toISOString(),
    }

    // external_sign_id カラムがあれば保存（webhook連携用）
    try {
      await supabase
        .from('equipment_lending_records')
        .update({ ...updateData, external_sign_id: doc.id })
        .eq('id', lendingRecordId)
    } catch {
      // external_sign_id カラムが無い場合はステータスのみ更新
      await supabase
        .from('equipment_lending_records')
        .update(updateData)
        .eq('id', lendingRecordId)
    }

    console.log(`[Equipment Lending] freee Sign 契約送信完了: ${staffName} (doc: ${doc.id})`)

    // Slack通知
    await sendSlackMessage({
      text: `📋 貸与品管理契約書を送信しました`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '📋 貸与品管理契約書 送信通知' },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: [
              `*対象スタッフ:* ${staffName}`,
              `*メール:* ${staff.email}`,
              `*貸出日:* ${lendingRecord.lending_date || '不明'}`,
              `*freee Sign ドキュメントID:* ${doc.id}`,
            ].join('\n'),
          },
        },
      ],
      icon_emoji: ':memo:',
    }).catch((slackErr) => {
      console.warn('[Equipment Lending] Slack通知送信失敗:', slackErr)
    })
  } catch (err) {
    console.error(`[Equipment Lending] freee Sign 契約自動送信エラー:`, err)
    // 貸出記録の作成は成功扱い - pledge_status は 'not_submitted' のまま
  }
}
