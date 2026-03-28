import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/rbac'
import { renderToBuffer } from '@react-pdf/renderer'
import { ContractDocument } from '@/lib/pdf/contract-document'
import type { ContractPdfData } from '@/lib/pdf/contract-document'
import React from 'react'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createServerSupabaseClient()

    const { data: contract, error } = await supabase
      .from('contracts')
      .select('*, staff(*), template:contract_templates(*)')
      .eq('id', id)
      .single()

    if (error || !contract) {
      return NextResponse.json(
        { error: '契約が見つかりません' },
        { status: 404 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const staff = contract.staff as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const template = contract.template as any

    const pdfData: ContractPdfData = {
      title: contract.title,
      contractNumber: contract.id.slice(0, 8).toUpperCase(),
      staffName: staff?.full_name || '不明',
      staffEmail: staff?.email || undefined,
      content: contract.content || template?.content_template || '契約内容が設定されていません。',
      startDate: contract.start_date,
      endDate: contract.end_date,
      signedAt: contract.signed_at,
      createdAt: contract.created_at,
    }

    const pdfBuffer = await renderToBuffer(
      React.createElement(ContractDocument, { data: pdfData }) as React.ReactElement
    )

    // Optionally upload to Supabase Storage
    const fileName = `contract-${contract.id}-${Date.now()}.pdf`
    const { error: uploadError } = await supabase.storage
      .from('contracts')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      // Storage upload failed, just return the PDF directly
      console.warn('PDF upload to storage failed:', uploadError)
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(contract.title)}.pdf"`,
      },
    })
  } catch (err) {
    console.error('Contract PDF error:', err)
    return NextResponse.json(
      { error: 'PDF生成に失敗しました' },
      { status: 500 }
    )
  }
}
