'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DocumentItemsTable,
  type DocumentItem,
} from '../../_components/document-items-table'
import { ArrowLeft, Save, Eye, Mail } from 'lucide-react'

// Demo data
const demoProjects = [
  { id: 'pj-001', name: 'Webリニューアル', client_name: '株式会社ABC商事', client_address: '東京都渋谷区神宮前1-2-3', client_contact: '山田太郎', client_email: 'yamada@abc-shoji.co.jp' },
  { id: 'pj-002', name: 'SNSマーケ運用', client_name: '合同会社デジタルフロント', client_address: '東京都港区六本木4-5-6', client_contact: '鈴木花子', client_email: 'suzuki@digitalfront.co.jp' },
  { id: 'pj-003', name: '業務システム開発', client_name: '株式会社テクノソリューション', client_address: '大阪府大阪市北区梅田7-8-9', client_contact: '佐藤一郎', client_email: 'sato@techno-sol.co.jp' },
]

const demoContracts = [
  { id: 'pc-001', number: 'PC-2026-001', project_id: 'pj-001', title: 'Webリニューアル 業務委託契約書', amount: 2500000 },
  { id: 'pc-002', number: 'PC-2026-002', project_id: 'pj-002', title: 'SNSマーケ運用 業務委託契約書', amount: 850000 },
]

export default function InvoiceNewPage() {
  const router = useRouter()

  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedContractId, setSelectedContractId] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [clientContact, setClientContact] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [invoiceNumber] = useState(`INV-2026-${String(Math.floor(Math.random() * 900) + 100).padStart(3, '0')}`)
  const [title, setTitle] = useState('')
  const [issuedAt, setIssuedAt] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [bankInfo, setBankInfo] = useState(
    '三菱UFJ銀行 渋谷支店\n普通 1234567\nカ）キャンビ'
  )
  const [remarks, setRemarks] = useState('')
  const [items, setItems] = useState<DocumentItem[]>([
    { name: '', description: '', quantity: 1, unit: '式', unit_price: 0, amount: 0 },
  ])
  const [taxRate, setTaxRate] = useState(10)

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId)
    setSelectedContractId('')
    const project = demoProjects.find((p) => p.id === projectId)
    if (project) {
      setClientName(project.client_name)
      setClientAddress(project.client_address)
      setClientContact(project.client_contact)
      setClientEmail(project.client_email)
      if (!title) {
        setTitle(`${project.name} 請求書`)
      }
    }
  }

  const handleContractImport = (contractId: string) => {
    setSelectedContractId(contractId)
    const contract = demoContracts.find((c) => c.id === contractId)
    if (contract) {
      toast.success(`契約書 ${contract.number} からインポートしました`)
      setItems([
        { name: 'Webサイトリニューアル', description: '業務委託契約に基づく請求', quantity: 1, unit: '式', unit_price: contract.amount, amount: contract.amount },
      ])
    }
  }

  const availableContracts = demoContracts.filter(
    (c) => c.project_id === selectedProjectId
  )

  const handleSaveDraft = () => {
    toast.success('下書きとして保存しました')
    router.push('/documents')
  }

  const handlePreview = () => {
    toast.info('PDFプレビュー機能は今後実装予定です')
  }

  const handleSendEmail = () => {
    toast.info('メール送付機能は今後実装予定です')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="請求書 新規作成"
        description="プロジェクトクライアント向け請求書を作成します"
        actions={
          <Button variant="outline" onClick={() => router.push('/documents')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            一覧に戻る
          </Button>
        }
      />

      {/* Project Selection */}
      <Card>
        <CardHeader>
          <CardTitle>プロジェクト選択</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>プロジェクト <span className="text-destructive">*</span></Label>
              <Select value={selectedProjectId} onValueChange={handleProjectChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="プロジェクトを選択" />
                </SelectTrigger>
                <SelectContent>
                  {demoProjects.map((pj) => (
                    <SelectItem key={pj.id} value={pj.id}>
                      {pj.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>請求番号</Label>
              <Input value={invoiceNumber} readOnly className="bg-muted" />
            </div>
            {selectedProjectId && availableContracts.length > 0 && (
              <div className="space-y-2 sm:col-span-2">
                <Label>契約書からインポート（任意）</Label>
                <Select value={selectedContractId} onValueChange={handleContractImport}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="契約書を選択してインポート" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableContracts.map((ct) => (
                      <SelectItem key={ct.id} value={ct.id}>
                        {ct.number} - {ct.title}（¥{ct.amount.toLocaleString('ja-JP')}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Client Info */}
      <Card>
        <CardHeader>
          <CardTitle>クライアント情報</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>会社名</Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="会社名を入力"
              />
            </div>
            <div className="space-y-2">
              <Label>担当者名</Label>
              <Input
                value={clientContact}
                onChange={(e) => setClientContact(e.target.value)}
                placeholder="担当者名を入力"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>住所</Label>
              <Input
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="住所を入力"
              />
            </div>
            <div className="space-y-2">
              <Label>メールアドレス</Label>
              <Input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Details */}
      <Card>
        <CardHeader>
          <CardTitle>請求内容</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>タイトル <span className="text-destructive">*</span></Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="請求書のタイトル"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>発行日</Label>
              <Input
                type="date"
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>支払期限</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>品目</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentItemsTable
            items={items}
            onChange={setItems}
            taxRate={taxRate}
            onTaxRateChange={setTaxRate}
          />
        </CardContent>
      </Card>

      {/* Bank Info */}
      <Card>
        <CardHeader>
          <CardTitle>振込先情報</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={bankInfo}
            onChange={(e) => setBankInfo(e.target.value)}
            placeholder="銀行名 支店名&#10;口座種類 口座番号&#10;口座名義"
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Remarks */}
      <Card>
        <CardHeader>
          <CardTitle>備考</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="備考・特記事項を入力"
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={() => router.push('/documents')}>
          キャンセル
        </Button>
        <Button variant="outline" onClick={handlePreview}>
          <Eye className="h-4 w-4 mr-1" />
          PDFプレビュー
        </Button>
        <Button variant="outline" onClick={handleSendEmail}>
          <Mail className="h-4 w-4 mr-1" />
          メール送付
        </Button>
        <Button onClick={handleSaveDraft}>
          <Save className="h-4 w-4 mr-1" />
          下書き保存
        </Button>
      </div>
    </div>
  )
}
