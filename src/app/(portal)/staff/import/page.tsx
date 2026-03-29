'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/page-header'
import {
  Upload,
  FileSpreadsheet,
  Users,
  FolderKanban,
  Calculator,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'

type CsvType = 'staff' | 'assignments' | 'compensation'

interface ImportResult {
  success: boolean
  inserted: number
  updated: number
  errors: string[]
  total: number
}

const CSV_TYPES: {
  key: CsvType
  label: string
  description: string
  icon: typeof Users
  filename: string
  step: number
}[] = [
  {
    key: 'staff',
    label: 'スタッフ情報',
    description: '基本情報・連絡先・銀行口座',
    icon: Users,
    filename: '01_staff.csv',
    step: 1,
  },
  {
    key: 'assignments',
    label: 'PJアサイン',
    description: 'スタッフ×プロジェクトの紐付け',
    icon: FolderKanban,
    filename: '02_project_assignments.csv',
    step: 2,
  },
  {
    key: 'compensation',
    label: '報酬ルール',
    description: '時給・インセンティブ・固定給等',
    icon: Calculator,
    filename: '03_compensation_rules.csv',
    step: 3,
  },
]

export default function StaffImportPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeType, setActiveType] = useState<CsvType>('staff')
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setResult(null)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    setIsUploading(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('type', activeType)

      const res = await fetch('/api/staff/import', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        setResult({
          success: false,
          inserted: 0,
          updated: 0,
          errors: [data.error || 'インポートに失敗しました'],
          total: 0,
        })
      } else {
        setResult(data as ImportResult)
      }
    } catch {
      setResult({
        success: false,
        inserted: 0,
        updated: 0,
        errors: ['ネットワークエラーが発生しました'],
        total: 0,
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleDownloadTemplate = (filename: string) => {
    window.open(`/csv-templates/${filename}`, '_blank')
  }

  const activeConfig = CSV_TYPES.find((c) => c.key === activeType)!

  return (
    <div className="space-y-6">
      <PageHeader
        title="CSV一括インポート"
        description="スタッフ情報・PJアサイン・報酬ルールをCSVで一括登録・更新します"
        actions={
          <Button variant="outline" onClick={() => router.push('/staff')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            スタッフ一覧へ戻る
          </Button>
        }
      />

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {CSV_TYPES.map((config, i) => {
          const Icon = config.icon
          const isActive = config.key === activeType
          return (
            <div key={config.key} className="flex items-center gap-2">
              {i > 0 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
              <button
                onClick={() => {
                  setActiveType(config.key)
                  setSelectedFile(null)
                  setResult(null)
                }}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 transition-all ${
                  isActive
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <Badge variant={isActive ? 'default' : 'secondary'} className="h-6 w-6 p-0 justify-center">
                  {config.step}
                </Badge>
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium">{config.label}</span>
              </button>
            </div>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload area */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <activeConfig.icon className="h-5 w-5" />
              {activeConfig.label}のインポート
            </CardTitle>
            <CardDescription>{activeConfig.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Template download */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownloadTemplate(activeConfig.filename)}
            >
              <Download className="h-4 w-4 mr-2" />
              テンプレートCSVをダウンロード
            </Button>

            {/* File upload area */}
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-indigo-400 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              {selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <FileSpreadsheet className="h-10 w-10 text-indigo-500" />
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    クリックしてCSVファイルを選択
                  </p>
                </div>
              )}
            </div>

            {/* Upload button */}
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className="w-full"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {isUploading ? 'インポート中...' : 'インポート実行'}
            </Button>

            {/* Result */}
            {result && (
              <div
                className={`rounded-lg border p-4 ${
                  result.errors.length > 0
                    ? 'border-amber-300 bg-amber-50 dark:bg-amber-950'
                    : 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {result.errors.length > 0 ? (
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  )}
                  <span className="font-semibold">
                    {result.errors.length > 0 ? '一部エラーあり' : 'インポート完了'}
                  </span>
                </div>
                <div className="text-sm space-y-1">
                  <p>全{result.total}件中: 新規 {result.inserted}件 / 更新 {result.updated}件</p>
                  {result.errors.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="font-medium text-amber-700 dark:text-amber-300">
                        エラー ({result.errors.length}件):
                      </p>
                      <ul className="list-disc list-inside text-xs space-y-0.5 max-h-40 overflow-y-auto">
                        {result.errors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Field guide */}
        <Card>
          <CardHeader>
            <CardTitle>入力項目ガイド</CardTitle>
            <CardDescription>
              {activeType === 'staff' && 'スタッフの基本情報・連絡先・口座情報を入力します'}
              {activeType === 'assignments' && 'スタッフとプロジェクトの紐付けを定義します（先にスタッフをインポートしてください）'}
              {activeType === 'compensation' && '報酬計算ルールを定義します（先にPJアサインをインポートしてください）'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeType === 'staff' && <StaffFieldGuide />}
            {activeType === 'assignments' && <AssignmentFieldGuide />}
            {activeType === 'compensation' && <CompensationFieldGuide />}
          </CardContent>
        </Card>
      </div>

      {/* Import order guide */}
      <Card>
        <CardHeader>
          <CardTitle>インポート順序</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950 px-3 py-2">
              <Badge>1</Badge>
              <span>スタッフ情報 (01_staff.csv)</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-2 rounded-lg bg-purple-50 dark:bg-purple-950 px-3 py-2">
              <Badge>2</Badge>
              <span>PJアサイン (02_project_assignments.csv)</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 px-3 py-2">
              <Badge>3</Badge>
              <span>報酬ルール (03_compensation_rules.csv)</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            ※ 報酬ルールはPJアサインに紐付くため、必ず上記の順序でインポートしてください。
            既に登録済みのデータは上書き更新されます。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function StaffFieldGuide() {
  return (
    <div className="space-y-3 text-sm">
      <FieldRow name="staff_code" required desc="スタッフコード（一意）" example="S001" />
      <FieldRow name="full_name" required desc="氏名（姓 名）" example="岡林 太郎" />
      <FieldRow name="full_name_kana" desc="フリガナ" example="オカバヤシ タロウ" />
      <FieldRow name="email" required desc="Canviメール（業務用）" example="taro@canvi.co.jp" />
      <FieldRow name="personal_email" desc="個人メール（契約書・支払通知書送付用）" example="taro@gmail.com" />
      <FieldRow name="phone" desc="電話番号" example="090-1234-5678" />
      <FieldRow name="date_of_birth" desc="生年月日" example="1990-05-15" />
      <FieldRow name="employment_type" desc="雇用区分: employee / contractor / freelancer" example="contractor" />
      <FieldRow name="status" desc="ステータス: active / on_leave / suspended / retired" example="active" />
      <FieldRow name="join_date" desc="入社日" example="2024-04-01" />
      <FieldRow name="address" desc="住所" example="東京都渋谷区..." />
      <FieldRow name="bank_name" desc="銀行名" example="三菱UFJ銀行" />
      <FieldRow name="bank_branch" desc="支店名" example="渋谷支店" />
      <FieldRow name="bank_account_type" desc="口座種別" example="普通" />
      <FieldRow name="bank_account_number" desc="口座番号" example="1234567" />
      <FieldRow name="bank_account_holder" desc="口座名義（カナ）" example="オカバヤシ タロウ" />
      <FieldRow name="notes" desc="備考" example="" />
    </div>
  )
}

function AssignmentFieldGuide() {
  return (
    <div className="space-y-3 text-sm">
      <FieldRow name="staff_code" required desc="スタッフコード（01_staffと一致させる）" example="S001" />
      <FieldRow name="project_name" required desc="プロジェクト名（DB登録済みの名前と完全一致）" example="プロジェクトA" />
      <FieldRow name="role" desc="役割・ポジション" example="マネージャー" />
      <FieldRow name="status" desc="ステータス: active / proposed / completed" example="active" />
      <FieldRow name="start_date" required desc="アサイン開始日" example="2024-04-01" />
      <FieldRow name="end_date" desc="アサイン終了日（なければ空欄）" example="2024-12-31" />
    </div>
  )
}

function CompensationFieldGuide() {
  return (
    <div className="space-y-3 text-sm">
      <FieldRow name="staff_code" required desc="スタッフコード" example="S001" />
      <FieldRow name="project_name" required desc="プロジェクト名" example="プロジェクトA" />
      <FieldRow name="rule_type" required desc="報酬タイプ（下記参照）" example="time_rate" />
      <FieldRow name="name" required desc="ルール名" example="基本時給" />
      <FieldRow name="priority" desc="優先度（大きいほど優先）" example="10" />
      <FieldRow name="effective_from" desc="適用開始日" example="2024-04-01" />
      <FieldRow name="effective_to" desc="適用終了日" example="" />

      <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 space-y-3">
        <p className="font-semibold">報酬タイプ別パラメータ（param_XX列）:</p>

        <div className="space-y-2">
          <p className="font-medium text-indigo-600 dark:text-indigo-400">time_rate（時給制）</p>
          <FieldRow name="param_rate_per_hour" desc="時給" example="1500" />
          <FieldRow name="param_overtime_multiplier" desc="残業割増率" example="1.25" />
          <FieldRow name="param_overtime_threshold_hours" desc="残業開始時間" example="8" />
        </div>

        <div className="space-y-2">
          <p className="font-medium text-emerald-600 dark:text-emerald-400">count_rate（件数制・インセンティブ）</p>
          <FieldRow name="param_unit_name" desc="単位名" example="契約獲得" />
          <FieldRow name="param_rate_per_unit" desc="1件あたり金額" example="500" />
          <FieldRow name="param_minimum_count" desc="最低件数" example="0" />
        </div>

        <div className="space-y-2">
          <p className="font-medium text-amber-600 dark:text-amber-400">standby_rate（待機手当）</p>
          <FieldRow name="param_rate_per_hour" desc="時間あたり" example="500" />
          <FieldRow name="param_rate_per_day" desc="日あたり" example="3000" />
        </div>

        <div className="space-y-2">
          <p className="font-medium text-blue-600 dark:text-blue-400">monthly_fixed（月額固定）</p>
          <FieldRow name="param_amount" desc="月額" example="300000" />
        </div>

        <div className="space-y-2">
          <p className="font-medium text-purple-600 dark:text-purple-400">fixed_plus_variable（固定+変動）</p>
          <FieldRow name="param_fixed_amount" desc="固定額" example="200000" />
          <FieldRow name="param_variable_unit" desc="変動単位名" example="件" />
          <FieldRow name="param_variable_rate" desc="変動単価" example="1000" />
        </div>

        <div className="space-y-2">
          <p className="font-medium text-pink-600 dark:text-pink-400">percentage（歩合制）</p>
          <FieldRow name="param_percentage" desc="歩合率（%）" example="10" />
          <FieldRow name="param_base_rule_name" desc="基準ルール名" example="基本時給" />
        </div>

        <div className="space-y-2">
          <p className="font-medium text-slate-600 dark:text-slate-400">adjustment（調整・手当）</p>
          <FieldRow name="param_amount" desc="金額" example="10000" />
          <FieldRow name="param_reason" desc="理由" example="通勤手当" />
        </div>
      </div>
    </div>
  )
}

function FieldRow({
  name,
  required,
  desc,
  example,
}: {
  name: string
  required?: boolean
  desc: string
  example: string
}) {
  return (
    <div className="flex items-start gap-3 py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className="flex items-center gap-1.5 min-w-[200px]">
        <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">
          {name}
        </code>
        {required && (
          <Badge variant="destructive" className="text-[10px] h-4 px-1">
            必須
          </Badge>
        )}
      </div>
      <div className="flex-1">
        <span className="text-slate-600 dark:text-slate-400">{desc}</span>
        {example && (
          <span className="ml-2 text-xs text-slate-400">例: {example}</span>
        )}
      </div>
    </div>
  )
}
