'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, ChevronLeft } from 'lucide-react'
import { useTemplateList, useCreateTemplate } from '@/hooks/use-contracts'
import { toast } from 'sonner'

export default function ContractTemplatesPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('')

  const { data, isLoading } = useTemplateList({
    search: debouncedSearch,
    is_active: activeFilter,
  })

  const createTemplate = useCreateTemplate()

  const handleSearchChange = useMemo(() => {
    let timeout: NodeJS.Timeout
    return (value: string) => {
      setSearch(value)
      clearTimeout(timeout)
      timeout = setTimeout(() => setDebouncedSearch(value), 300)
    }
  }, [])

  const handleCreateNew = async () => {
    try {
      const template = await createTemplate.mutateAsync({
        name: '新規テンプレート',
        description: '',
        content_template: '{{staff_name}} 殿\n\n以下の通り契約を締結いたします。\n\n【契約期間】\n{{start_date}} 〜 {{end_date}}\n\n【契約内容】\nここに契約内容を記載してください。\n\n以上',
        variables: [
          { key: 'staff_name', label: 'スタッフ名', type: 'text' as const, required: true },
          { key: 'start_date', label: '開始日', type: 'date' as const, required: true },
          { key: 'end_date', label: '終了日', type: 'date' as const, required: false },
        ],
        is_active: true,
      })
      toast.success('テンプレートを作成しました')
      router.push(`/contracts/templates/${template.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'テンプレートの作成に失敗しました')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="契約テンプレート"
        description="契約書テンプレートの作成と管理"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" render={<Link href="/contracts" />}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              契約一覧
            </Button>
            <Button onClick={handleCreateNew} disabled={createTemplate.isPending}>
              <Plus className="h-4 w-4 mr-2" />
              {createTemplate.isPending ? '作成中...' : '新規作成'}
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="テンプレート名、説明で検索..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
        >
          <option value="">すべて</option>
          <option value="true">有効</option>
          <option value="false">無効</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>テンプレート名</TableHead>
              <TableHead>説明</TableHead>
              <TableHead>変数数</TableHead>
              <TableHead>有効/無効</TableHead>
              <TableHead>更新日</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data?.data && data.data.length > 0 ? (
              data.data.map((template) => {
                const variableCount = Array.isArray(template.variables)
                  ? (template.variables as unknown[]).length
                  : 0

                return (
                  <TableRow key={template.id}>
                    <TableCell>
                      <Link
                        href={`/contracts/templates/${template.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {template.name}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {template.description || '-'}
                    </TableCell>
                    <TableCell>{variableCount}</TableCell>
                    <TableCell>
                      <Badge variant={template.is_active ? 'default' : 'secondary'}>
                        {template.is_active ? '有効' : '無効'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(template.updated_at).toLocaleDateString('ja-JP')}
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  テンプレートが見つかりません
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {data && (
        <p className="text-sm text-muted-foreground">
          {data.total}件中 {data.data.length}件を表示
        </p>
      )}
    </div>
  )
}
