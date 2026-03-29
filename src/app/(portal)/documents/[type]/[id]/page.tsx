'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DocumentItemsTable,
  type DocumentItem,
} from '../../_components/document-items-table'
import {
  ESTIMATE_STATUS_LABELS,
  PROJECT_CONTRACT_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
} from '@/lib/constants'
import {
  ArrowLeft,
  Pencil,
  FileDown,
  Send,
  Mail,
  FileText,
  Receipt,
  CheckCircle,
  Building2,
  Calendar,
  User,
} from 'lucide-react'

// --- Demo data lookup ---

interface EstimateDetail {
  id: string
  type: 'estimate'
  number: string
  project_name: string
  client_name: string
  client_address: string
  client_contact: string
  client_email: string
  title: string
  status: string
  created_at: string
  valid_until: string
  items: DocumentItem[]
  taxRate: number
  remarks: string
}

interface ContractDetail {
  id: string
  type: 'contract'
  number: string
  project_name: string
  client_name: string
  client_address: string
  client_contact: string
  client_email: string
  title: string
  status: string
  contract_period: string
  freee_sign_status: string
  payment_terms: string
  items: DocumentItem[]
  taxRate: number
  remarks: string
}

interface InvoiceDetail {
  id: string
  type: 'invoice'
  number: string
  project_name: string
  client_name: string
  client_address: string
  client_contact: string
  client_email: string
  title: string
  status: string
  issued_at: string
  due_date: string
  bank_info: string
  items: DocumentItem[]
  taxRate: number
  remarks: string
}

type DocumentDetail = EstimateDetail | ContractDetail | InvoiceDetail

const demoDocuments: Record<string, Record<string, DocumentDetail>> = {
  estimates: {
    'est-001': {
      id: 'est-001',
      type: 'estimate',
      number: 'EST-2026-001',
      project_name: 'Webリニューアル',
      client_name: '株式会社ABC商事',
      client_address: '東京都渋谷区神宮前1-2-3',
      client_contact: '山田太郎',
      client_email: 'yamada@abc-shoji.co.jp',
      title: 'Webリニューアル 見積書',
      status: 'accepted',
      created_at: '2026-03-01',
      valid_until: '2026-03-31',
      items: [
        { name: 'Webデザイン', description: 'トップページ + 下層5ページ', quantity: 1, unit: '式', unit_price: 1000000, amount: 1000000 },
        { name: 'フロントエンド実装', description: 'レスポンシブ対応', quantity: 1, unit: '式', unit_price: 800000, amount: 800000 },
        { name: 'バックエンド開発', description: 'CMS構築', quantity: 1, unit: '式', unit_price: 500000, amount: 500000 },
        { name: 'テスト・検証', description: '各種ブラウザ対応テスト', quantity: 1, unit: '式', unit_price: 200000, amount: 200000 },
      ],
      taxRate: 10,
      remarks: '納品後30日以内にお支払いをお願いいたします。',
    },
    'est-002': {
      id: 'est-002',
      type: 'estimate',
      number: 'EST-2026-002',
      project_name: 'SNSマーケ運用',
      client_name: '合同会社デジタルフロント',
      client_address: '東京都港区六本木4-5-6',
      client_contact: '鈴木花子',
      client_email: 'suzuki@digitalfront.co.jp',
      title: 'SNSマーケティング運用 見積書',
      status: 'sent',
      created_at: '2026-03-15',
      valid_until: '2026-04-14',
      items: [
        { name: 'SNS運用代行', description: 'Instagram/Twitter月次運用', quantity: 12, unit: 'ヶ月', unit_price: 50000, amount: 600000 },
        { name: '広告運用', description: 'SNS広告配信管理', quantity: 1, unit: '式', unit_price: 250000, amount: 250000 },
      ],
      taxRate: 10,
      remarks: '',
    },
    'est-003': {
      id: 'est-003',
      type: 'estimate',
      number: 'EST-2026-003',
      project_name: '業務システム開発',
      client_name: '株式会社テクノソリューション',
      client_address: '大阪府大阪市北区梅田7-8-9',
      client_contact: '佐藤一郎',
      client_email: 'sato@techno-sol.co.jp',
      title: '業務システム開発 見積書',
      status: 'draft',
      created_at: '2026-03-25',
      valid_until: '',
      items: [
        { name: '要件定義', description: '業務フロー分析・要件定義書作成', quantity: 1, unit: '式', unit_price: 1500000, amount: 1500000 },
        { name: '設計・開発', description: 'システム設計・実装', quantity: 1, unit: '式', unit_price: 3000000, amount: 3000000 },
        { name: 'テスト・導入', description: '結合テスト・本番導入支援', quantity: 1, unit: '式', unit_price: 1300000, amount: 1300000 },
      ],
      taxRate: 10,
      remarks: '分割請求（着手時50%、納品時50%）にて対応可能です。',
    },
  },
  contracts: {
    'pc-001': {
      id: 'pc-001',
      type: 'contract',
      number: 'PC-2026-001',
      project_name: 'Webリニューアル',
      client_name: '株式会社ABC商事',
      client_address: '東京都渋谷区神宮前1-2-3',
      client_contact: '山田太郎',
      client_email: 'yamada@abc-shoji.co.jp',
      title: 'Webリニューアル 業務委託契約書',
      status: 'active',
      contract_period: '2026-04-01〜2026-09-30',
      freee_sign_status: '署名済',
      payment_terms: '納品後30日以内に銀行振込',
      items: [
        { name: 'Webデザイン', description: 'トップページ + 下層5ページ', quantity: 1, unit: '式', unit_price: 1000000, amount: 1000000 },
        { name: 'フロントエンド実装', description: 'レスポンシブ対応', quantity: 1, unit: '式', unit_price: 800000, amount: 800000 },
        { name: 'バックエンド開発', description: 'CMS構築', quantity: 1, unit: '式', unit_price: 500000, amount: 500000 },
        { name: 'テスト・検証', description: '各種ブラウザ対応テスト', quantity: 1, unit: '式', unit_price: 200000, amount: 200000 },
      ],
      taxRate: 10,
      remarks: '',
    },
    'pc-002': {
      id: 'pc-002',
      type: 'contract',
      number: 'PC-2026-002',
      project_name: 'SNSマーケ運用',
      client_name: '合同会社デジタルフロント',
      client_address: '東京都港区六本木4-5-6',
      client_contact: '鈴木花子',
      client_email: 'suzuki@digitalfront.co.jp',
      title: 'SNSマーケティング運用 業務委託契約書',
      status: 'pending_signature',
      contract_period: '2026-04-01〜2027-03-31',
      freee_sign_status: 'freeeサイン送付済',
      payment_terms: '月末締め翌月末払い',
      items: [
        { name: 'SNS運用代行', description: 'Instagram/Twitter月次運用', quantity: 12, unit: 'ヶ月', unit_price: 50000, amount: 600000 },
        { name: '広告運用', description: 'SNS広告配信管理', quantity: 1, unit: '式', unit_price: 250000, amount: 250000 },
      ],
      taxRate: 10,
      remarks: '',
    },
  },
  invoices: {
    'inv-001': {
      id: 'inv-001',
      type: 'invoice',
      number: 'INV-2026-001',
      project_name: 'Webリニューアル',
      client_name: '株式会社ABC商事',
      client_address: '東京都渋谷区神宮前1-2-3',
      client_contact: '山田太郎',
      client_email: 'yamada@abc-shoji.co.jp',
      title: 'Webリニューアル 請求書（1回目）',
      status: 'paid',
      issued_at: '2026-03-01',
      due_date: '2026-03-31',
      bank_info: '三菱UFJ銀行 渋谷支店\n普通 1234567\nカ）キャンビ',
      items: [
        { name: 'Webリニューアル（着手金）', description: '契約金額の50%', quantity: 1, unit: '式', unit_price: 1250000, amount: 1250000 },
      ],
      taxRate: 10,
      remarks: '',
    },
    'inv-002': {
      id: 'inv-002',
      type: 'invoice',
      number: 'INV-2026-002',
      project_name: 'Webリニューアル',
      client_name: '株式会社ABC商事',
      client_address: '東京都渋谷区神宮前1-2-3',
      client_contact: '山田太郎',
      client_email: 'yamada@abc-shoji.co.jp',
      title: 'Webリニューアル 請求書（2回目）',
      status: 'sent',
      issued_at: '2026-03-15',
      due_date: '2026-04-15',
      bank_info: '三菱UFJ銀行 渋谷支店\n普通 1234567\nカ）キャンビ',
      items: [
        { name: 'Webリニューアル（納品時）', description: '契約金額の50%', quantity: 1, unit: '式', unit_price: 1250000, amount: 1250000 },
      ],
      taxRate: 10,
      remarks: '',
    },
    'inv-003': {
      id: 'inv-003',
      type: 'invoice',
      number: 'INV-2026-003',
      project_name: 'SNSマーケ運用',
      client_name: '合同会社デジタルフロント',
      client_address: '東京都港区六本木4-5-6',
      client_contact: '鈴木花子',
      client_email: 'suzuki@digitalfront.co.jp',
      title: 'SNSマーケティング運用 請求書',
      status: 'draft',
      issued_at: '',
      due_date: '',
      bank_info: '三菱UFJ銀行 渋谷支店\n普通 1234567\nカ）キャンビ',
      items: [
        { name: 'SNS運用代行 4月分', description: 'Instagram/Twitter運用', quantity: 1, unit: 'ヶ月', unit_price: 50000, amount: 50000 },
        { name: '広告運用 4月分', description: 'SNS広告配信管理', quantity: 1, unit: '式', unit_price: 250000, amount: 250000 },
      ],
      taxRate: 10,
      remarks: '',
    },
  },
}

// --- Helper ---

const formatCurrency = (value: number) =>
  `¥${value.toLocaleString('ja-JP')}`

const typeLabels: Record<string, string> = {
  estimates: '見積書',
  contracts: '契約書',
  invoices: '請求書',
}

function getStatusLabels(type: string) {
  switch (type) {
    case 'estimates':
      return ESTIMATE_STATUS_LABELS
    case 'contracts':
      return PROJECT_CONTRACT_STATUS_LABELS
    case 'invoices':
      return INVOICE_STATUS_LABELS
    default:
      return {}
  }
}

// --- Component ---

interface PageProps {
  params: { type: string; id: string }
}

export default function DocumentDetailPage({ params }: PageProps) {
  const { type, id } = params
  const router = useRouter()

  const doc = demoDocuments[type]?.[id]

  if (!doc) {
    return (
      <div className="space-y-6">
        <PageHeader title="書類が見つかりません" />
        <Button variant="outline" onClick={() => router.push('/documents')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          一覧に戻る
        </Button>
      </div>
    )
  }

  const statusLabels = getStatusLabels(type)
  const typeLabel = typeLabels[type] || '書類'

  const handleEdit = () => {
    toast.info('編集機能は今後実装予定です')
  }

  const handlePdfExport = () => {
    toast.info('PDF出力機能は今後実装予定です')
  }

  const handleStatusChange = () => {
    toast.info('ステータス変更機能は今後実装予定です')
  }

  const handleCreateContract = () => {
    router.push(`/documents/contracts/new`)
  }

  const handleCreateInvoice = () => {
    router.push(`/documents/invoices/new`)
  }

  const handleFreeeSign = () => {
    toast.info('freeeサインでの送付機能は今後実装予定です')
  }

  const handleSendEmail = () => {
    toast.info('メール送付機能は今後実装予定です')
  }

  const handleConfirmPayment = () => {
    toast.success('入金確認を記録しました（デモ）')
  }

  // Render type-specific action buttons
  const renderActions = () => {
    const actions = [
      <Button key="edit" variant="outline" onClick={handleEdit}>
        <Pencil className="h-4 w-4 mr-1" />
        編集
      </Button>,
      <Button key="pdf" variant="outline" onClick={handlePdfExport}>
        <FileDown className="h-4 w-4 mr-1" />
        PDF出力
      </Button>,
    ]

    if (type === 'estimates') {
      actions.push(
        <Button key="to-contract" variant="outline" onClick={handleCreateContract}>
          <FileText className="h-4 w-4 mr-1" />
          契約書作成
        </Button>
      )
    }

    if (type === 'contracts') {
      actions.push(
        <Button key="freee" variant="outline" onClick={handleFreeeSign}>
          <Send className="h-4 w-4 mr-1" />
          freeeサインで送付
        </Button>,
        <Button key="to-invoice" variant="outline" onClick={handleCreateInvoice}>
          <Receipt className="h-4 w-4 mr-1" />
          請求書作成
        </Button>
      )
    }

    if (type === 'invoices') {
      actions.push(
        <Button key="email" variant="outline" onClick={handleSendEmail}>
          <Mail className="h-4 w-4 mr-1" />
          メール送付
        </Button>
      )
      if ((doc as InvoiceDetail).status !== 'paid') {
        actions.push(
          <Button key="confirm-payment" onClick={handleConfirmPayment}>
            <CheckCircle className="h-4 w-4 mr-1" />
            入金確認
          </Button>
        )
      }
    }

    actions.push(
      <Button key="status" variant="secondary" onClick={handleStatusChange}>
        ステータス変更
      </Button>
    )

    return actions
  }

  // Render type-specific info
  const renderTypeInfo = () => {
    if (doc.type === 'estimate') {
      const est = doc as EstimateDetail
      return (
        <>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              作成日
            </p>
            <p className="text-sm font-medium">{est.created_at || '-'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">有効期限</p>
            <p className="text-sm font-medium">{est.valid_until || '-'}</p>
          </div>
        </>
      )
    }

    if (doc.type === 'contract') {
      const ct = doc as ContractDetail
      return (
        <>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              契約期間
            </p>
            <p className="text-sm font-medium">{ct.contract_period}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">freeeサイン状態</p>
            <Badge variant="outline">{ct.freee_sign_status}</Badge>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">支払条件</p>
            <p className="text-sm font-medium">{ct.payment_terms || '-'}</p>
          </div>
        </>
      )
    }

    if (doc.type === 'invoice') {
      const inv = doc as InvoiceDetail
      return (
        <>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              発行日
            </p>
            <p className="text-sm font-medium">{inv.issued_at || '-'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">支払期限</p>
            <p className="text-sm font-medium">{inv.due_date || '-'}</p>
          </div>
        </>
      )
    }

    return null
  }

  const subtotal = doc.items.reduce((sum, item) => sum + item.amount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={doc.title}
        description={`${typeLabel} ${doc.number}`}
        actions={
          <Button variant="outline" onClick={() => router.push('/documents')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            一覧に戻る
          </Button>
        }
      />

      {/* Status & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <StatusBadge status={doc.status} labels={statusLabels} />
          <span className="text-lg font-bold">{formatCurrency(subtotal + Math.floor(subtotal * doc.taxRate / 100))}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {renderActions()}
        </div>
      </div>

      {/* Document Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">PJ名</p>
              <p className="text-sm font-medium">{doc.project_name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">ステータス</p>
              <StatusBadge status={doc.status} labels={statusLabels} />
            </div>
            {renderTypeInfo()}
          </div>
        </CardContent>
      </Card>

      {/* Client Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            クライアント情報
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">会社名</p>
              <p className="text-sm font-medium">{doc.client_name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" />
                担当者
              </p>
              <p className="text-sm font-medium">{doc.client_contact}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">住所</p>
              <p className="text-sm">{doc.client_address}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">メール</p>
              <p className="text-sm">{doc.client_email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>品目明細</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentItemsTable
            items={doc.items}
            onChange={() => {}}
            taxRate={doc.taxRate}
            onTaxRateChange={() => {}}
            readOnly
          />
        </CardContent>
      </Card>

      {/* Invoice-specific: Bank info */}
      {doc.type === 'invoice' && (doc as InvoiceDetail).bank_info && (
        <Card>
          <CardHeader>
            <CardTitle>振込先情報</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">
              {(doc as InvoiceDetail).bank_info}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Remarks */}
      {doc.remarks && (
        <Card>
          <CardHeader>
            <CardTitle>備考</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{doc.remarks}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
