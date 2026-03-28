import { NextRequest } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React, { type ReactElement } from 'react'
import {
  EstimateDocument,
  type EstimatePdfData,
} from '@/lib/pdf/estimate-document'
import {
  ProjectContractDocument,
  type ProjectContractPdfData,
} from '@/lib/pdf/project-contract-document'
import {
  InvoiceDocument,
  type InvoicePdfData,
} from '@/lib/pdf/invoice-document'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// Demo data generators
function getDemoEstimateData(id: string): EstimatePdfData {
  return {
    estimateNumber: `EST-${id.slice(0, 8).toUpperCase()}`,
    title: 'Webアプリケーション開発',
    clientName: '株式会社サンプル',
    clientAddress: '東京都千代田区丸の内1-1-1',
    clientContactPerson: '田中太郎',
    items: [
      {
        name: 'フロントエンド開発',
        description: 'React/Next.jsによるUI実装',
        quantity: 1,
        unit: '式',
        unit_price: 1500000,
        amount: 1500000,
      },
      {
        name: 'バックエンド開発',
        description: 'API設計・実装',
        quantity: 1,
        unit: '式',
        unit_price: 1200000,
        amount: 1200000,
      },
      {
        name: 'デザイン制作',
        description: 'UI/UXデザイン',
        quantity: 1,
        unit: '式',
        unit_price: 800000,
        amount: 800000,
      },
      {
        name: 'テスト・品質管理',
        description: '結合テスト・受入テスト',
        quantity: 1,
        unit: '式',
        unit_price: 500000,
        amount: 500000,
      },
    ],
    subtotal: 4000000,
    taxRate: 10,
    taxAmount: 400000,
    totalAmount: 4400000,
    validUntil: '2026-04-30',
    notes:
      '本見積書の内容は、詳細な要件定義後に変更となる場合がございます。\n納期は契約締結後、約3ヶ月を予定しております。',
    createdAt: new Date().toISOString(),
  }
}

function getDemoContractData(id: string): ProjectContractPdfData {
  return {
    contractNumber: `PJ-${id.slice(0, 8).toUpperCase()}`,
    title: 'Webアプリケーション開発業務委託',
    clientName: '株式会社サンプル',
    clientAddress: '東京都千代田区丸の内1-1-1',
    clientContactPerson: '田中太郎',
    content:
      '甲は乙に対し、以下の業務を委託し、乙はこれを受託する。\n\n1. Webアプリケーションの設計・開発業務\n2. 関連するドキュメントの作成\n3. テスト及び品質管理業務\n4. 納品後の保守・運用サポート',
    items: [
      {
        name: 'フロントエンド開発',
        description: 'React/Next.jsによるUI実装',
        quantity: 1,
        unit: '式',
        unit_price: 1500000,
        amount: 1500000,
      },
      {
        name: 'バックエンド開発',
        description: 'API設計・実装',
        quantity: 1,
        unit: '式',
        unit_price: 1200000,
        amount: 1200000,
      },
      {
        name: 'デザイン制作',
        description: 'UI/UXデザイン',
        quantity: 1,
        unit: '式',
        unit_price: 800000,
        amount: 800000,
      },
      {
        name: 'テスト・品質管理',
        description: '結合テスト・受入テスト',
        quantity: 1,
        unit: '式',
        unit_price: 500000,
        amount: 500000,
      },
    ],
    subtotal: 4000000,
    taxRate: 10,
    taxAmount: 400000,
    totalAmount: 4400000,
    startDate: '2026-04-01',
    endDate: '2026-06-30',
    paymentTerms: '納品検収後30日以内に指定口座へ振込',
    notes: '詳細な仕様については別途仕様書にて定める。',
    createdAt: new Date().toISOString(),
  }
}

function getDemoInvoiceData(id: string): InvoicePdfData {
  return {
    invoiceNumber: `INV-${id.slice(0, 8).toUpperCase()}`,
    title: 'Webアプリケーション開発',
    clientName: '株式会社サンプル',
    clientAddress: '東京都千代田区丸の内1-1-1',
    clientContactPerson: '田中太郎',
    items: [
      {
        name: 'フロントエンド開発',
        description: 'React/Next.jsによるUI実装',
        quantity: 1,
        unit: '式',
        unit_price: 1500000,
        amount: 1500000,
      },
      {
        name: 'バックエンド開発',
        description: 'API設計・実装',
        quantity: 1,
        unit: '式',
        unit_price: 1200000,
        amount: 1200000,
      },
      {
        name: 'デザイン制作',
        description: 'UI/UXデザイン',
        quantity: 1,
        unit: '式',
        unit_price: 800000,
        amount: 800000,
      },
      {
        name: 'テスト・品質管理',
        description: '結合テスト・受入テスト',
        quantity: 1,
        unit: '式',
        unit_price: 500000,
        amount: 500000,
      },
    ],
    subtotal: 4000000,
    taxRate: 10,
    taxAmount: 400000,
    totalAmount: 4400000,
    issueDate: new Date().toISOString(),
    dueDate: '2026-04-30',
    paymentMethod: '銀行振込',
    bankInfo:
      'みずほ銀行 渋谷支店\n普通預金 1234567\nカ）キャンビ',
    notes:
      'お振込手数料はお客様のご負担でお願いいたします。\nご不明な点がございましたら、お気軽にお問い合わせください。',
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  try {
    const { type, id } = await params

    // Validate type
    if (!['estimates', 'contracts', 'invoices'].includes(type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid document type' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    let pdfBuffer: Buffer
    let filename: string

    if (DEMO_MODE) {
      // Generate PDF from demo data
      switch (type) {
        case 'estimates': {
          const data = getDemoEstimateData(id)
          filename = `見積書_${data.estimateNumber}.pdf`
          pdfBuffer = await renderToBuffer(
            React.createElement(EstimateDocument, { data }) as unknown as ReactElement
          )
          break
        }
        case 'contracts': {
          const data = getDemoContractData(id)
          filename = `契約書_${data.contractNumber}.pdf`
          pdfBuffer = await renderToBuffer(
            React.createElement(ProjectContractDocument, { data }) as unknown as ReactElement
          )
          break
        }
        case 'invoices': {
          const data = getDemoInvoiceData(id)
          filename = `請求書_${data.invoiceNumber}.pdf`
          pdfBuffer = await renderToBuffer(
            React.createElement(InvoiceDocument, { data }) as unknown as ReactElement
          )
          break
        }
        default:
          return new Response(
            JSON.stringify({ error: 'Invalid document type' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          )
      }
    } else {
      // TODO: Fetch real data from database
      // For now, return 501 Not Implemented when not in demo mode
      return new Response(
        JSON.stringify({ error: 'Not implemented for production mode yet' }),
        { status: 501, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to generate PDF',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
