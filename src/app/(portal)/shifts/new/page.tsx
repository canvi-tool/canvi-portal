'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Save,
  Send,
  Clock,
  CalendarDays,
  Briefcase,
  FileText,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { PageHeader } from '@/components/layout/page-header'

// --- Types ---

type ApprovalMode = 'AUTO' | 'APPROVAL'

interface Project {
  id: string
  name: string
  approvalMode: ApprovalMode
}

// --- Demo Data ---

const ASSIGNED_PROJECTS: Project[] = [
  { id: 'pj1', name: 'AIアポブースト', approvalMode: 'AUTO' },
  { id: 'pj2', name: 'WHITE営業代行', approvalMode: 'APPROVAL' },
  { id: 'pj3', name: 'ミズテック受電', approvalMode: 'APPROVAL' },
  { id: 'pj4', name: 'リクモ架電PJ', approvalMode: 'AUTO' },
]

function getTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// --- Component ---

export default function ShiftNewPage() {
  const router = useRouter()

  const [date, setDate] = useState(getTodayStr())
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')
  const [projectId, setProjectId] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [resultStatus, setResultStatus] = useState<'APPROVED' | 'DRAFT' | null>(null)

  const selectedProject = ASSIGNED_PROJECTS.find(p => p.id === projectId)
  const isAutoApproval = selectedProject?.approvalMode === 'AUTO'

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!date) newErrors.date = '日付を入力してください'
    if (!startTime) newErrors.startTime = '開始時間を入力してください'
    if (!endTime) newErrors.endTime = '終了時間を入力してください'
    if (!projectId) newErrors.projectId = 'プロジェクトを選択してください'
    if (startTime && endTime && startTime >= endTime) {
      newErrors.endTime = '終了時間は開始時間より後にしてください'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSaveDraft = () => {
    if (!validate()) return
    setResultStatus('DRAFT')
    setSubmitted(true)
  }

  const handleSubmit = () => {
    if (!validate()) return
    if (isAutoApproval) {
      setResultStatus('APPROVED')
    } else {
      setResultStatus('DRAFT')
    }
    setSubmitted(true)
  }

  if (submitted && resultStatus) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="シフト登録"
          description="シフトの新規登録"
          actions={
            <Button variant="outline" size="sm" onClick={() => router.push('/shifts')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              シフト一覧に戻る
            </Button>
          }
        />
        <Card>
          <CardContent className="py-12 text-center">
            {resultStatus === 'APPROVED' ? (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                  <CalendarDays className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">シフトが登録されました</h3>
                <p className="text-sm text-muted-foreground mb-1">
                  プロジェクト「{selectedProject?.name}」は自動承認モードのため、即座に承認されました。
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Googleカレンダーへの同期が開始されます。
                </p>
                <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                  承認済み
                </Badge>
              </>
            ) : (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                  <FileText className="h-8 w-8 text-gray-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">シフトが下書き保存されました</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  プロジェクト「{selectedProject?.name}」は承認制のため、PMの承認が必要です。
                  <br />
                  「申請する」ボタンでPMに承認依頼を送信できます。
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Badge variant="outline" className="text-gray-700 border-gray-300">
                    下書き
                  </Badge>
                  <Button size="sm" onClick={() => {
                    // Simulate submitting for approval
                    setResultStatus('APPROVED')
                  }}>
                    <Send className="h-4 w-4 mr-1" />
                    申請する
                  </Button>
                </div>
              </>
            )}
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="outline" onClick={() => router.push('/shifts')}>
                シフト一覧へ
              </Button>
              <Button onClick={() => {
                setSubmitted(false)
                setResultStatus(null)
                setProjectId('')
                setNotes('')
              }}>
                続けて登録
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="シフト登録"
        description="新しいシフトを登録します"
        actions={
          <Button variant="outline" size="sm" onClick={() => router.push('/shifts')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            シフト一覧に戻る
          </Button>
        }
      />

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">シフト情報</CardTitle>
            <CardDescription>
              勤務日時とプロジェクトを入力してください
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date">
                <CalendarDays className="inline h-4 w-4 mr-1" />
                勤務日 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={e => { setDate(e.target.value); setErrors(prev => ({ ...prev, date: '' })) }}
              />
              {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
            </div>

            {/* Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">
                  <Clock className="inline h-4 w-4 mr-1" />
                  開始時間 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={e => { setStartTime(e.target.value); setErrors(prev => ({ ...prev, startTime: '', endTime: '' })) }}
                />
                {errors.startTime && <p className="text-xs text-destructive">{errors.startTime}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">
                  <Clock className="inline h-4 w-4 mr-1" />
                  終了時間 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={e => { setEndTime(e.target.value); setErrors(prev => ({ ...prev, endTime: '' })) }}
                />
                {errors.endTime && <p className="text-xs text-destructive">{errors.endTime}</p>}
              </div>
            </div>

            {/* Project */}
            <div className="space-y-2">
              <Label>
                <Briefcase className="inline h-4 w-4 mr-1" />
                プロジェクト <span className="text-destructive">*</span>
              </Label>
              <Select value={projectId} onValueChange={v => { setProjectId(v); setErrors(prev => ({ ...prev, projectId: '' })) }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="プロジェクトを選択" />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNED_PROJECTS.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.approvalMode === 'AUTO' ? ' (自動承認)' : ' (承認制)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.projectId && <p className="text-xs text-destructive">{errors.projectId}</p>}
              {selectedProject && (
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant={isAutoApproval ? 'default' : 'outline'}
                    className={isAutoApproval
                      ? 'bg-green-100 text-green-800 border-green-200'
                      : 'text-amber-700 border-amber-300'
                    }
                  >
                    {isAutoApproval ? '自動承認' : '承認制'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {isAutoApproval
                      ? '登録後すぐに承認されます'
                      : 'PMの承認が必要です'
                    }
                  </span>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">
                <FileText className="inline h-4 w-4 mr-1" />
                備考（任意）
              </Label>
              <Textarea
                id="notes"
                placeholder="備考があれば入力してください"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t">
              {selectedProject?.approvalMode === 'APPROVAL' && (
                <Button variant="outline" onClick={handleSaveDraft}>
                  <Save className="h-4 w-4 mr-1" />
                  下書き保存
                </Button>
              )}
              <Button onClick={handleSubmit}>
                {isAutoApproval ? (
                  <>
                    <CalendarDays className="h-4 w-4 mr-1" />
                    登録する
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    申請する
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
