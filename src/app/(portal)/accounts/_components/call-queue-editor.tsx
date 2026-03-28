'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Save } from 'lucide-react'

// --- Types ---

type DistributionType = 'simultaneous' | 'sequential' | 'rotating' | 'longest_idle'

interface BusinessHoursEntry {
  dayLabel: string
  dayKey: string
  enabled: boolean
  startTime: string
  endTime: string
}

interface CallQueueEditorProps {
  distributionType: DistributionType
  maxWaitTime: number
  overflowAction: string
  businessHours: BusinessHoursEntry[]
  onSave?: (data: {
    distributionType: DistributionType
    maxWaitTime: number
    overflowAction: string
    businessHours: BusinessHoursEntry[]
  }) => void
}

const DISTRIBUTION_OPTIONS: { value: DistributionType; label: string; description: string }[] = [
  { value: 'simultaneous', label: '同時呼出', description: '全メンバーに同時に着信します' },
  { value: 'sequential', label: '順次呼出', description: 'リスト順にメンバーへ着信します' },
  { value: 'rotating', label: 'ローテーション', description: '前回応答した次のメンバーから着信します' },
  { value: 'longest_idle', label: '最長待機', description: '最も長く待機しているメンバーに着信します' },
]

const OVERFLOW_OPTIONS = [
  { value: 'voicemail', label: '留守番電話に転送' },
  { value: 'external', label: '外部番号に転送' },
  { value: 'disconnect', label: '切断' },
  { value: 'queue_full_message', label: '満員メッセージ再生' },
]

const DEFAULT_BUSINESS_HOURS: BusinessHoursEntry[] = [
  { dayLabel: '月曜日', dayKey: 'mon', enabled: true, startTime: '09:00', endTime: '18:00' },
  { dayLabel: '火曜日', dayKey: 'tue', enabled: true, startTime: '09:00', endTime: '18:00' },
  { dayLabel: '水曜日', dayKey: 'wed', enabled: true, startTime: '09:00', endTime: '18:00' },
  { dayLabel: '木曜日', dayKey: 'thu', enabled: true, startTime: '09:00', endTime: '18:00' },
  { dayLabel: '金曜日', dayKey: 'fri', enabled: true, startTime: '09:00', endTime: '18:00' },
  { dayLabel: '土曜日', dayKey: 'sat', enabled: false, startTime: '09:00', endTime: '18:00' },
  { dayLabel: '日曜日', dayKey: 'sun', enabled: false, startTime: '09:00', endTime: '18:00' },
]

// --- Component ---

export function CallQueueEditor({
  distributionType: initialDistType,
  maxWaitTime: initialMaxWait,
  overflowAction: initialOverflow,
  businessHours: initialHours,
  onSave,
}: CallQueueEditorProps) {
  const [distributionType, setDistributionType] = useState<string>(initialDistType)
  const [maxWaitTime, setMaxWaitTime] = useState(initialMaxWait)
  const [overflowAction, setOverflowAction] = useState<string>(initialOverflow)
  const [businessHours, setBusinessHours] = useState<BusinessHoursEntry[]>(initialHours)

  const updateBusinessHour = (index: number, field: keyof BusinessHoursEntry, value: string | boolean) => {
    const updated = [...businessHours]
    updated[index] = { ...updated[index], [field]: value }
    setBusinessHours(updated)
  }

  const handleSave = () => {
    onSave?.({
      distributionType: distributionType as DistributionType,
      maxWaitTime,
      overflowAction,
      businessHours,
    })
  }

  return (
    <div className="space-y-6">
      {/* Distribution Type */}
      <Card>
        <CardContent className="pt-0 space-y-4">
          <h3 className="text-sm font-semibold">分配設定</h3>

          <div className="space-y-2">
            <Label>分配方式</Label>
            <Select value={distributionType} onValueChange={setDistributionType}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISTRIBUTION_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {DISTRIBUTION_OPTIONS.find(o => o.value === distributionType)?.description}
            </p>
          </div>

          <div className="space-y-2">
            <Label>最大待機時間（秒）</Label>
            <Input
              type="number"
              value={maxWaitTime}
              onChange={e => setMaxWaitTime(Number(e.target.value))}
              min={10}
              max={600}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              この時間を超えるとオーバーフロー設定が適用されます
            </p>
          </div>

          <div className="space-y-2">
            <Label>オーバーフロー時の動作</Label>
            <Select value={overflowAction} onValueChange={setOverflowAction}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OVERFLOW_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Business Hours */}
      <Card>
        <CardContent className="pt-0 space-y-4">
          <h3 className="text-sm font-semibold">営業時間</h3>

          <div className="space-y-2">
            {businessHours.map((entry, index) => (
              <div key={entry.dayKey} className="flex items-center gap-3">
                <div className="w-16 text-sm font-medium">{entry.dayLabel}</div>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={entry.enabled}
                    onChange={e => updateBusinessHour(index, 'enabled', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-xs text-muted-foreground">有効</span>
                </label>
                <Input
                  type="time"
                  value={entry.startTime}
                  onChange={e => updateBusinessHour(index, 'startTime', e.target.value)}
                  disabled={!entry.enabled}
                  className="w-28 text-xs"
                />
                <span className="text-muted-foreground">〜</span>
                <Input
                  type="time"
                  value={entry.endTime}
                  onChange={e => updateBusinessHour(index, 'endTime', e.target.value)}
                  disabled={!entry.enabled}
                  className="w-28 text-xs"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-1" />
          設定を保存
        </Button>
      </div>
    </div>
  )
}

export { DEFAULT_BUSINESS_HOURS }
export type { BusinessHoursEntry, DistributionType }
