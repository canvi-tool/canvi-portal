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
import { ArrowLeft, Save, Eye } from 'lucide-react'

// Demo projects for dropdown
const demoProjects = [
  { id: 'pj-001', name: 'Webリニューアル', client_name: '株式会社ABC商事', client_address: '東京都渋谷区神宮前1-2-3', client_contact: '山田太郎', client_email: 'yamada@abc-shoji.co.jp' },
  { id: 'pj-002', name: 'SNSマーケ運用', client_name: '合同会社デジタルフロント', client_address: '東京都港区六本木4-5-6', client_contact: '鈴木花子', client_email: 'suzuki@digitalfront.co.jp' },
  { id: 'pj-003', name: '業務システム開発', client_name: '株式会社テクノソリューション', client_address: '大阪府大阪市北区梅田7-8-9', client_contact: '佐藤一郎', client_email: 'sato@techno-sol.co.jp' },
]

export default function EstimateNewPage() {
  const router = useRouter()

  // Form state
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [clientContact, setClientContact] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [estimateNumber] = useState(`EST-2026-${String(Math.floor(Math.random() * 900) + 100).padStart(3, '0')}`)
  const [title, setTitle] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [remarks, setRemarks] = useState('')
  const [items, setItems] = useState<DocumentItem[]>([
    { name: '', description: '', quantity: 1, unit: '式', unit_price: 0, amount: 0 },
  ])
  const [taxRate, setTaxRate] = useState(10)

  // Auto-fill client info when project is selected
  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId)
    const project = demoProjects.find((p) => p.id === projectId)
    if (project) {
      setClientName(project.client_name)
      setClientAddress(project.client_address)
      setClientContact(project.client_contact)
      setClientEmail(project.client_email)
      if (!title) {
        setTitle(`${project.name} 見積書`)
      }
    }
  }

  const handleSaveDraft = () => {
    toast.success('下書きとして保存しました')
    router.push('/documents')
  }

  const handlePreview = () => {
    toast.info('PDFプレビュー機能は今後実装予定です')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="見積書 新規作成"
        description="プロジェクトクライアント向け見積書を作成します"
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
              <Label>見積番号</Label>
              <Input value={estimateNumber} readOnly className="bg-muted" />
            </div>
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

      {/* Estimate Details */}
      <Card>
        <CardHeader>
          <CardTitle>見積内容</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>タイトル <span className="text-destructive">*</span></Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="見積書のタイトル"
              />
            </div>
            <div className="space-y-2">
              <Label>有効期限</Label>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
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
        <Button onClick={handleSaveDraft}>
          <Save className="h-4 w-4 mr-1" />
          下書き保存
        </Button>
      </div>
    </div>
  )
}
