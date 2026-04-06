'use client'

import { useState, useMemo, useEffect } from 'react'
import { Search, X, UserPlus, Mail } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface Attendee {
  email: string
  name?: string
  staff_id?: string
}

interface StaffWithEmail {
  id: string
  name: string
  email?: string | null
}

interface AttendeePickerProps {
  value: Attendee[]
  onChange: (attendees: Attendee[]) => void
  label?: string
}

export function AttendeePicker({ value, onChange, label = '招待者' }: AttendeePickerProps) {
  const [staffList, setStaffList] = useState<StaffWithEmail[]>([])
  const [search, setSearch] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch('/api/staff?limit=500')
      .then(r => r.json())
      .then((res) => {
        const items = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped: StaffWithEmail[] = items.map((s: any) => ({
          id: s.id,
          name: `${s.last_name || ''} ${s.first_name || ''}`.trim() || s.email || '',
          email: s.email || null,
        })).filter((s: StaffWithEmail) => s.email)
        setStaffList(mapped)
      })
      .catch(() => setStaffList([]))
      .finally(() => setLoading(false))
  }, [])

  const selectedEmails = useMemo(() => new Set(value.map(a => a.email.toLowerCase())), [value])

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return staffList
    return staffList.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q)
    )
  }, [staffList, search])

  const toggleStaff = (s: StaffWithEmail) => {
    if (!s.email) return
    const emailLower = s.email.toLowerCase()
    if (selectedEmails.has(emailLower)) {
      onChange(value.filter(a => a.email.toLowerCase() !== emailLower))
    } else {
      onChange([...value, { email: s.email, name: s.name, staff_id: s.id }])
    }
  }

  const addEmail = () => {
    const email = emailInput.trim()
    if (!email) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return
    if (selectedEmails.has(email.toLowerCase())) {
      setEmailInput('')
      return
    }
    onChange([...value, { email }])
    setEmailInput('')
  }

  const removeAttendee = (email: string) => {
    onChange(value.filter(a => a.email.toLowerCase() !== email.toLowerCase()))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <UserPlus className="h-3.5 w-3.5" />
          {label}{value.length > 0 && <span className="text-xs text-muted-foreground">（{value.length}名）</span>}
        </Label>
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="text-xs text-primary hover:underline"
        >
          {expanded ? '閉じる' : '追加'}
        </button>
      </div>

      {/* Selected chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(a => (
            <span
              key={a.email}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
            >
              {a.staff_id ? <UserPlus className="h-3 w-3 text-blue-500" /> : <Mail className="h-3 w-3 text-muted-foreground" />}
              <span className="max-w-[140px] truncate">{a.name || a.email}</span>
              <button
                type="button"
                onClick={() => removeAttendee(a.email)}
                className="hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {expanded && (
        <div className="space-y-2 rounded-md border p-2">
          {/* Canviメンバー検索 */}
          <div className="space-y-1.5">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Canviメンバーを検索..."
                className="h-8 pl-7 text-xs"
              />
            </div>
            <div className="max-h-[160px] overflow-y-auto rounded border divide-y">
              {loading ? (
                <div className="p-2 text-xs text-muted-foreground">読み込み中...</div>
              ) : filteredStaff.length === 0 ? (
                <div className="p-2 text-xs text-muted-foreground">該当なし</div>
              ) : (
                filteredStaff.map(s => {
                  const checked = s.email ? selectedEmails.has(s.email.toLowerCase()) : false
                  return (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-muted cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleStaff(s)}
                        className="h-3.5 w-3.5"
                      />
                      <span className="font-medium truncate flex-1">{s.name}</span>
                      <span className="text-muted-foreground truncate max-w-[140px]">{s.email}</span>
                    </label>
                  )
                })
              )}
            </div>
          </div>

          {/* 外部メール入力 */}
          <div className="space-y-1.5 pt-2 border-t">
            <Label className="text-[11px] text-muted-foreground">外部ゲスト（メールアドレス）</Label>
            <div className="flex gap-1.5">
              <Input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail() } }}
                placeholder="example@external.com"
                className="h-8 text-xs"
              />
              <button
                type="button"
                onClick={addEmail}
                className="px-3 h-8 rounded-md bg-primary text-primary-foreground text-xs hover:opacity-90"
              >
                追加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
