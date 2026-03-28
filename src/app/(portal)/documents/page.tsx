'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { DataTable, type DataTableColumn } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ESTIMATE_STATUS_LABELS,
  PROJECT_CONTRACT_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
} from '@/lib/constants'
import { Plus, Search, FileText, FileCheck, Receipt } from 'lucide-react'

// --- Demo Data ---

interface Estimate {
  id: string
  estimate_number: string
  project_name: string
  client_name: string
  amount: number
  status: string
  created_at: string
  valid_until: string
}

interface ProjectContract {
  id: string
  contract_number: string
  project_name: string
  client_name: string
  amount: number
  status: string
  contract_period: string
  freee_sign_status: string
}

interface Invoice {
  id: string
  invoice_number: string
  project_name: string
  client_name: string
  amount: number
  status: string
  issued_at: string
  due_date: string
}

const demoEstimates: Estimate[] = [
  {
    id: 'est-001',
    estimate_number: 'EST-2026-001',
    project_name: 'Webリニューアル',
    client_name: '株式会社ABC商事',
    amount: 2500000,
    status: 'accepted',
    created_at: '2026-03-01',
    valid_until: '2026-03-31',
  },
  {
    id: 'est-002',
    estimate_number: 'EST-2026-002',
    project_name: 'SNSマーケ運用',
    client_name: '合同会社デジタルフロント',
    amount: 850000,
    status: 'sent',
    created_at: '2026-03-15',
    valid_until: '2026-04-14',
  },
  {
    id: 'est-003',
    estimate_number: 'EST-2026-003',
    project_name: '業務システム開発',
    client_name: '株式会社テクノソリューション',
    amount: 5800000,
    status: 'draft',
    created_at: '2026-03-25',
    valid_until: '',
  },
]

const demoContracts: ProjectContract[] = [
  {
    id: 'pc-001',
    contract_number: 'PC-2026-001',
    project_name: 'Webリニューアル',
    client_name: 'ABC商事',
    amount: 2500000,
    status: 'active',
    contract_period: '2026-04-01〜2026-09-30',
    freee_sign_status: '署名済',
  },
  {
    id: 'pc-002',
    contract_number: 'PC-2026-002',
    project_name: 'SNSマーケ運用',
    client_name: 'デジタルフロント',
    amount: 850000,
    status: 'pending_signature',
    contract_period: '2026-04-01〜2027-03-31',
    freee_sign_status: 'freeeサイン送付済',
  },
]

const demoInvoices: Invoice[] = [
  {
    id: 'inv-001',
    invoice_number: 'INV-2026-001',
    project_name: 'Webリニューアル',
    client_name: 'ABC商事',
    amount: 1250000,
    status: 'paid',
    issued_at: '2026-03-01',
    due_date: '2026-03-31',
  },
  {
    id: 'inv-002',
    invoice_number: 'INV-2026-002',
    project_name: 'Webリニューアル',
    client_name: 'ABC商事',
    amount: 1250000,
    status: 'sent',
    issued_at: '2026-03-15',
    due_date: '2026-04-15',
  },
  {
    id: 'inv-003',
    invoice_number: 'INV-2026-003',
    project_name: 'SNSマーケ運用',
    client_name: 'デジタルフロント',
    amount: 850000,
    status: 'draft',
    issued_at: '',
    due_date: '',
  },
]

// --- Helper ---

const formatCurrency = (value: number) =>
  `¥${value.toLocaleString('ja-JP')}`

// --- Component ---

export default function DocumentsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('estimates')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Filter helpers
  const filterBySearch = <T extends { project_name: string; client_name: string }>(
    data: T[],
    searchText: string
  ) => {
    if (!searchText) return data
    const lower = searchText.toLowerCase()
    return data.filter(
      (d) =>
        d.project_name.toLowerCase().includes(lower) ||
        d.client_name.toLowerCase().includes(lower)
    )
  }

  // Status labels for current tab
  const currentStatusLabels =
    activeTab === 'estimates'
      ? ESTIMATE_STATUS_LABELS
      : activeTab === 'contracts'
        ? PROJECT_CONTRACT_STATUS_LABELS
        : INVOICE_STATUS_LABELS

  // Estimate columns
  const estimateColumns: DataTableColumn<Estimate>[] = [
    {
      key: 'estimate_number',
      header: '見積番号',
      accessor: (row) => row.estimate_number,
      cell: (row) => (
        <Link
          href={`/documents/estimates/${row.id}`}
          className="font-mono text-sm text-primary hover:underline"
        >
          {row.estimate_number}
        </Link>
      ),
    },
    {
      key: 'project_name',
      header: 'PJ名',
      accessor: (row) => row.project_name,
      cell: (row) => <span className="font-medium">{row.project_name}</span>,
    },
    {
      key: 'client_name',
      header: 'クライアント名',
      accessor: (row) => row.client_name,
    },
    {
      key: 'amount',
      header: '金額',
      accessor: (row) => row.amount,
      cell: (row) => (
        <span className="font-medium">{formatCurrency(row.amount)}</span>
      ),
    },
    {
      key: 'status',
      header: 'ステータス',
      accessor: (row) => row.status,
      cell: (row) => (
        <StatusBadge status={row.status} labels={ESTIMATE_STATUS_LABELS} />
      ),
    },
    {
      key: 'created_at',
      header: '作成日',
      accessor: (row) => row.created_at,
      cell: (row) =>
        row.created_at || <span className="text-muted-foreground">-</span>,
    },
    {
      key: 'valid_until',
      header: '有効期限',
      accessor: (row) => row.valid_until,
      cell: (row) =>
        row.valid_until || <span className="text-muted-foreground">-</span>,
    },
  ]

  // Contract columns
  const contractColumns: DataTableColumn<ProjectContract>[] = [
    {
      key: 'contract_number',
      header: '契約番号',
      accessor: (row) => row.contract_number,
      cell: (row) => (
        <Link
          href={`/documents/contracts/${row.id}`}
          className="font-mono text-sm text-primary hover:underline"
        >
          {row.contract_number}
        </Link>
      ),
    },
    {
      key: 'project_name',
      header: 'PJ名',
      accessor: (row) => row.project_name,
      cell: (row) => <span className="font-medium">{row.project_name}</span>,
    },
    {
      key: 'client_name',
      header: 'クライアント名',
      accessor: (row) => row.client_name,
    },
    {
      key: 'amount',
      header: '金額',
      accessor: (row) => row.amount,
      cell: (row) => (
        <span className="font-medium">{formatCurrency(row.amount)}</span>
      ),
    },
    {
      key: 'status',
      header: 'ステータス',
      accessor: (row) => row.status,
      cell: (row) => (
        <StatusBadge status={row.status} labels={PROJECT_CONTRACT_STATUS_LABELS} />
      ),
    },
    {
      key: 'contract_period',
      header: '契約期間',
      accessor: (row) => row.contract_period,
    },
    {
      key: 'freee_sign_status',
      header: 'freeeサイン状態',
      accessor: (row) => row.freee_sign_status,
      cell: (row) => (
        <span className="text-sm">{row.freee_sign_status}</span>
      ),
    },
  ]

  // Invoice columns
  const invoiceColumns: DataTableColumn<Invoice>[] = [
    {
      key: 'invoice_number',
      header: '請求番号',
      accessor: (row) => row.invoice_number,
      cell: (row) => (
        <Link
          href={`/documents/invoices/${row.id}`}
          className="font-mono text-sm text-primary hover:underline"
        >
          {row.invoice_number}
        </Link>
      ),
    },
    {
      key: 'project_name',
      header: 'PJ名',
      accessor: (row) => row.project_name,
      cell: (row) => <span className="font-medium">{row.project_name}</span>,
    },
    {
      key: 'client_name',
      header: 'クライアント名',
      accessor: (row) => row.client_name,
    },
    {
      key: 'amount',
      header: '金額',
      accessor: (row) => row.amount,
      cell: (row) => (
        <span className="font-medium">{formatCurrency(row.amount)}</span>
      ),
    },
    {
      key: 'status',
      header: 'ステータス',
      accessor: (row) => row.status,
      cell: (row) => (
        <StatusBadge status={row.status} labels={INVOICE_STATUS_LABELS} />
      ),
    },
    {
      key: 'issued_at',
      header: '発行日',
      accessor: (row) => row.issued_at,
      cell: (row) =>
        row.issued_at || <span className="text-muted-foreground">-</span>,
    },
    {
      key: 'due_date',
      header: '支払期限',
      accessor: (row) => row.due_date,
      cell: (row) =>
        row.due_date || <span className="text-muted-foreground">-</span>,
    },
  ]

  // Filtered data
  const filteredEstimates = filterBySearch(demoEstimates, search).filter(
    (d) => statusFilter === 'all' || d.status === statusFilter
  )
  const filteredContracts = filterBySearch(demoContracts, search).filter(
    (d) => statusFilter === 'all' || d.status === statusFilter
  )
  const filteredInvoices = filterBySearch(demoInvoices, search).filter(
    (d) => statusFilter === 'all' || d.status === statusFilter
  )

  const getNewUrl = () => {
    switch (activeTab) {
      case 'estimates':
        return '/documents/estimates/new'
      case 'contracts':
        return '/documents/contracts/new'
      case 'invoices':
        return '/documents/invoices/new'
      default:
        return '/documents/estimates/new'
    }
  }

  const handleTabChange = (value: string | number | null) => {
    if (typeof value === 'string') {
      setActiveTab(value)
      setStatusFilter('all')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="書類管理"
        description="見積書・契約書・請求書の作成と管理"
        actions={
          <Button onClick={() => router.push(getNewUrl())}>
            <Plus className="h-4 w-4 mr-1" />
            新規作成
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="estimates">
            <FileText className="h-3.5 w-3.5 mr-1" />
            見積書
          </TabsTrigger>
          <TabsTrigger value="contracts">
            <FileCheck className="h-3.5 w-3.5 mr-1" />
            契約書
          </TabsTrigger>
          <TabsTrigger value="invoices">
            <Receipt className="h-3.5 w-3.5 mr-1" />
            請求書
          </TabsTrigger>
        </TabsList>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center mt-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="PJ名、クライアント名で検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val ?? 'all')}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {Object.entries(currentStatusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Estimates Tab */}
        <TabsContent value="estimates">
          <DataTable
            columns={estimateColumns}
            data={filteredEstimates}
            emptyMessage="条件に一致する見積書が見つかりません"
            keyExtractor={(row) => row.id}
          />
        </TabsContent>

        {/* Contracts Tab */}
        <TabsContent value="contracts">
          <DataTable
            columns={contractColumns}
            data={filteredContracts}
            emptyMessage="条件に一致する契約書が見つかりません"
            keyExtractor={(row) => row.id}
          />
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices">
          <DataTable
            columns={invoiceColumns}
            data={filteredInvoices}
            emptyMessage="条件に一致する請求書が見つかりません"
            keyExtractor={(row) => row.id}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
