'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ALL_SERVICES, SERVICE_LABELS, type ServiceKey } from '@/lib/tenant-sync'
import { Pencil, Plus, Trash2 } from 'lucide-react'

type Tenant = {
  id: string
  canonical_id: string
  name: string
  slug: string
  contact_email: string | null
  status: 'active' | 'suspended' | 'deleted'
  enabled_services: ServiceKey[]
  created_at: string
  updated_at: string
}

type FormState = {
  name: string
  slug: string
  contact_email: string
  status: 'active' | 'suspended' | 'deleted'
  enabled_services: ServiceKey[]
}

const emptyForm: FormState = {
  name: '',
  slug: '',
  contact_email: '',
  status: 'active',
  enabled_services: [],
}

export function TenantManager({ initialTenants }: { initialTenants: Tenant[] }) {
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants)
  const [editing, setEditing] = useState<Tenant | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [pending, startTransition] = useTransition()

  function openCreate() {
    setForm(emptyForm)
    setEditing(null)
    setCreating(true)
  }
  function openEdit(t: Tenant) {
    setForm({
      name: t.name,
      slug: t.slug,
      contact_email: t.contact_email ?? '',
      status: t.status,
      enabled_services: t.enabled_services ?? [],
    })
    setEditing(t)
    setCreating(false)
  }
  function close() {
    setEditing(null)
    setCreating(false)
  }

  function toggleService(s: ServiceKey) {
    setForm((f) => ({
      ...f,
      enabled_services: f.enabled_services.includes(s)
        ? f.enabled_services.filter((x) => x !== s)
        : [...f.enabled_services, s],
    }))
  }

  async function submit() {
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase(),
      contact_email: form.contact_email.trim() || null,
      status: form.status,
      enabled_services: form.enabled_services,
    }

    startTransition(async () => {
      try {
        const res = await fetch(
          editing
            ? `/api/super-admin/tenants/${editing.id}`
            : '/api/super-admin/tenants',
          {
            method: editing ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
        )
        const j = await res.json()
        if (!res.ok) throw new Error(j?.error || 'failed')

        const saved: Tenant = j.tenant
        setTenants((prev) =>
          editing
            ? prev.map((t) => (t.id === saved.id ? saved : t))
            : [saved, ...prev],
        )
        const failed = (j.sync ?? []).filter(
          (r: { ok: boolean; skipped: boolean }) => !r.ok,
        )
        if (failed.length > 0) {
          toast.warning(
            `保存は成功しましたが、一部サービスへの反映に失敗: ${failed
              .map((f: { service: string; error?: string }) => `${f.service}(${f.error ?? 'err'})`)
              .join(', ')}`,
          )
        } else {
          toast.success('保存しました')
        }
        close()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '保存失敗')
      }
    })
  }

  async function softDelete(t: Tenant) {
    if (!confirm(`${t.name} を論理削除しますか? (status=deleted)`)) return
    startTransition(async () => {
      try {
        const res = await fetch(`/api/super-admin/tenants/${t.id}`, {
          method: 'DELETE',
        })
        const j = await res.json()
        if (!res.ok) throw new Error(j?.error || 'failed')
        setTenants((prev) => prev.map((x) => (x.id === t.id ? j.tenant : x)))
        toast.success('論理削除しました')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '削除失敗')
      }
    })
  }

  const dialogOpen = creating || !!editing

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          テナントを作成
        </Button>
        <Dialog
          open={dialogOpen}
          onOpenChange={(o) => {
            if (!o) close()
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editing ? `${editing.name} を編集` : 'テナントを作成'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>名称</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="株式会社◯◯"
                />
              </div>
              <div>
                <Label>slug</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="example-inc"
                  disabled={!!editing}
                />
              </div>
              <div>
                <Label>連絡先メール</Label>
                <Input
                  type="email"
                  value={form.contact_email}
                  onChange={(e) =>
                    setForm({ ...form, contact_email: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>ステータス</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm({ ...form, status: v as FormState['status'] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="suspended">suspended</SelectItem>
                    <SelectItem value="deleted">deleted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>有効サービス</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {ALL_SERVICES.map((s) => (
                    <label
                      key={s}
                      className="flex items-center gap-2 text-sm border rounded px-2 py-1 cursor-pointer hover:bg-muted"
                    >
                      <Checkbox
                        checked={form.enabled_services.includes(s)}
                        onChange={() => toggleService(s)}
                      />
                      {SERVICE_LABELS[s]}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={close} disabled={pending}>
                キャンセル
              </Button>
              <Button onClick={submit} disabled={pending || !form.name || !form.slug}>
                {pending ? '保存中...' : '保存'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr className="text-left">
              <th className="px-3 py-2">名称</th>
              <th className="px-3 py-2">slug</th>
              <th className="px-3 py-2">canonical_id</th>
              <th className="px-3 py-2">status</th>
              <th className="px-3 py-2">有効サービス</th>
              <th className="px-3 py-2 w-32">操作</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="px-3 py-2 font-medium">{t.name}</td>
                <td className="px-3 py-2 font-mono text-xs">{t.slug}</td>
                <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                  {t.canonical_id}
                </td>
                <td className="px-3 py-2">
                  <Badge
                    variant={
                      t.status === 'active'
                        ? 'default'
                        : t.status === 'suspended'
                        ? 'secondary'
                        : 'destructive'
                    }
                  >
                    {t.status}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {(t.enabled_services ?? []).map((s) => (
                      <Badge key={s} variant="outline" className="text-xs">
                        {SERVICE_LABELS[s] ?? s}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(t)}
                      title="編集"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => softDelete(t)}
                      disabled={t.status === 'deleted'}
                      title="論理削除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  テナントがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
