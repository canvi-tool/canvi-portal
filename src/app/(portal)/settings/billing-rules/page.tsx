'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValueWithLabel,
} from '@/components/ui/select'

const RULE_TYPES = [
  'HOURLY',
  'MONTHLY_FIXED',
  'DAILY',
  'PER_CALL',
  'PER_APPOINTMENT',
  'PER_CLOSING',
  'REVENUE_SHARE',
  'MANAGEMENT_FEE',
  'DISCOUNT_FIXED',
  'DISCOUNT_RATE',
] as const

const RULE_LABELS: Record<string, string> = {
  HOURLY: '時給',
  MONTHLY_FIXED: '月額固定',
  DAILY: '日額',
  PER_CALL: '架電単価',
  PER_APPOINTMENT: 'アポ単価',
  PER_CLOSING: '成約単価',
  REVENUE_SHARE: '売上%',
  MANAGEMENT_FEE: '管理費%',
  DISCOUNT_FIXED: '値引(固定)',
  DISCOUNT_RATE: '値引(%)',
}

interface Rule {
  id: string
  project_id: string
  rule_type: string
  label: string
  unit_price: number | null
  rate_percent: number | null
  fixed_amount: number | null
  effective_from: string
  effective_to: string | null
  sort_order: number
  project: { id: string; name: string } | null
}

interface Project {
  id: string
  name: string
}

export default function BillingRulesPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    rule_type: 'HOURLY' as (typeof RULE_TYPES)[number],
    label: '',
    unit_price: '',
    rate_percent: '',
    fixed_amount: '',
    effective_from: new Date().toISOString().slice(0, 10),
  })

  async function loadProjects() {
    try {
      const res = await fetch('/api/projects')
      const json = await res.json()
      const list: Project[] = Array.isArray(json) ? json : (json.data ?? [])
      setProjects(list)
      if (list.length > 0 && !projectId) setProjectId(list[0].id)
    } catch {
      // ignore
    }
  }

  async function loadRules() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (projectId) params.set('project_id', projectId)
      const res = await fetch(`/api/project-billing-rules?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setRules(json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    if (projectId) loadRules()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId) return alert('プロジェクトを選択してください')
    try {
      const payload: Record<string, unknown> = {
        project_id: projectId,
        rule_type: form.rule_type,
        label: form.label,
        effective_from: form.effective_from,
      }
      if (form.unit_price) payload.unit_price = Number(form.unit_price)
      if (form.rate_percent) payload.rate_percent = Number(form.rate_percent)
      if (form.fixed_amount) payload.fixed_amount = Number(form.fixed_amount)

      const res = await fetch('/api/project-billing-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setForm({
        rule_type: 'HOURLY',
        label: '',
        unit_price: '',
        rate_percent: '',
        fixed_amount: '',
        effective_from: new Date().toISOString().slice(0, 10),
      })
      await loadRules()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'unknown')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('このルールを失効化しますか？')) return
    try {
      const res = await fetch(`/api/project-billing-rules?id=${id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      await loadRules()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'unknown')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="請求ルール設定"
        description="プロジェクト別の請求ルールを管理します"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">プロジェクト選択</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={projectId} onValueChange={(v) => setProjectId(v ?? '')}>
            <SelectTrigger className="w-80">
              <SelectValueWithLabel
                value={projectId}
                labels={Object.fromEntries(projects.map((p) => [p.id, p.name]))}
              />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ルール一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="text-destructive text-sm">{error}</p>}
          {loading ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">ルールがありません</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="py-2">種別</th>
                  <th>ラベル</th>
                  <th className="text-right">単価</th>
                  <th className="text-right">率%</th>
                  <th className="text-right">固定額</th>
                  <th>適用開始</th>
                  <th>失効</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="py-2">{RULE_LABELS[r.rule_type] ?? r.rule_type}</td>
                    <td>{r.label}</td>
                    <td className="text-right font-mono">{r.unit_price ?? '-'}</td>
                    <td className="text-right font-mono">{r.rate_percent ?? '-'}</td>
                    <td className="text-right font-mono">{r.fixed_amount ?? '-'}</td>
                    <td>{r.effective_from}</td>
                    <td>{r.effective_to ?? '-'}</td>
                    <td>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(r.id)}
                      >
                        失効
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ルール追加</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-xs text-muted-foreground">種別</label>
              <Select
                value={form.rule_type}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    rule_type: (v as (typeof RULE_TYPES)[number]) ?? 'HOURLY',
                  })
                }
              >
                <SelectTrigger>
                  <SelectValueWithLabel value={form.rule_type} labels={RULE_LABELS} />
                </SelectTrigger>
                <SelectContent>
                  {RULE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {RULE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">ラベル</label>
              <Input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">適用開始</label>
              <Input
                type="date"
                value={form.effective_from}
                onChange={(e) =>
                  setForm({ ...form, effective_from: e.target.value })
                }
                required
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">単価</label>
              <Input
                type="number"
                value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">率(%)</label>
              <Input
                type="number"
                step="0.001"
                value={form.rate_percent}
                onChange={(e) => setForm({ ...form, rate_percent: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">固定額</label>
              <Input
                type="number"
                value={form.fixed_amount}
                onChange={(e) => setForm({ ...form, fixed_amount: e.target.value })}
              />
            </div>
            <div className="md:col-span-3">
              <Button type="submit">追加</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
