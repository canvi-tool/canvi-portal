'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectValueWithLabel,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Brain,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  Lightbulb,
  Target,
  Award,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  FileText,
  Zap,
} from 'lucide-react'

// --- Types ---

interface GeneratedMessage {
  approach: string
  subject: string
  body: string
  charCount: number
  tips: string
}

interface FormData {
  serviceName: string
  serviceDescription: string
  differentiators: string
  competitiveAdvantages: string
  trackRecord: string
  targetIndustry: string
  targetCompanyName: string
  targetPainPoints: string
  tone: string
  maxChars: number
  cta: string
  additionalInstructions: string
  variations: number
}

const INITIAL_FORM: FormData = {
  serviceName: '',
  serviceDescription: '',
  differentiators: '',
  competitiveAdvantages: '',
  trackRecord: '',
  targetIndustry: '',
  targetCompanyName: '',
  targetPainPoints: '',
  tone: 'formal',
  maxChars: 400,
  cta: 'meeting',
  additionalInstructions: '',
  variations: 3,
}

// Pre-filled example for quick start
const EXAMPLE_FORM: FormData = {
  serviceName: 'テレアポ代行サービス「Canviコール」',
  serviceDescription: 'BtoB企業向けのテレアポ・インサイドセールス代行。専任チームがターゲットリスト作成からアポ獲得まで一気通貫で対応します。',
  differentiators: '業界特化型のスクリプト設計、リアルタイムダッシュボードでの進捗可視化、AI音声分析による品質管理',
  competitiveAdvantages: '架電スタッフ全員が営業経験3年以上。成果報酬型プランあり。最短3営業日で稼働開始可能。',
  trackRecord: '導入企業150社以上、平均アポ率8.2%（業界平均3%）、顧客継続率92%',
  targetIndustry: 'IT・SaaS企業',
  targetCompanyName: '',
  targetPainPoints: '営業リソース不足、新規開拓の停滞、テレアポの内製化コストが高い',
  tone: 'formal',
  maxChars: 400,
  cta: 'meeting',
  additionalInstructions: '',
  variations: 3,
}

const TONE_OPTIONS = [
  { value: 'formal', label: 'フォーマル', desc: '丁寧・ビジネスライク' },
  { value: 'friendly', label: 'フレンドリー', desc: '親しみやすい・柔らかい' },
  { value: 'concise', label: '簡潔', desc: '要点重視・ストレート' },
]

const CTA_OPTIONS = [
  { value: 'meeting', label: 'ミーティング設定' },
  { value: 'call', label: '電話でのご相談' },
  { value: 'document', label: '資料送付' },
  { value: 'trial', label: '無料トライアル' },
]

const APPROACH_ICONS: Record<string, React.ElementType> = {
  '課題解決型': Target,
  '実績アピール型': Award,
  '共感・提案型': MessageSquare,
}

// --- Component ---

export default function FormSalesPage() {
  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [messages, setMessages] = useState<GeneratedMessage[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleGenerate = async () => {
    setError(null)
    setIsGenerating(true)
    setMessages([])

    try {
      const res = await fetch('/api/ai/form-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'メッセージ生成に失敗しました')
      }

      const data = await res.json()
      setMessages(data.messages || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = async (text: string, idx: number) => {
    await navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  const handleLoadExample = () => {
    setForm(EXAMPLE_FORM)
  }

  const canGenerate = form.serviceName && form.serviceDescription && form.targetIndustry

  return (
    <div className="space-y-6">
      <PageHeader
        title="フォーム営業メッセージ生成"
        description="AIがターゲット企業に最適化された営業メッセージを自動生成します"
        actions={
          <div className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700">
            <Brain className="h-4 w-4" />
            AI Powered
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: Input Form */}
        <div className="lg:col-span-2 space-y-4">

          {/* Quick start */}
          <Card className="border-dashed border-indigo-200 bg-indigo-50/30">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Lightbulb className="h-4 w-4 text-indigo-600" />
                  <span className="text-indigo-700">入力例で試す</span>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleLoadExample}>
                  <Zap className="h-3 w-3 mr-1" />
                  サンプルを読み込み
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Service Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                サービス情報
              </CardTitle>
              <CardDescription className="text-xs">
                売りたいサービスの情報を入力してください
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  サービス名 <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="例: テレアポ代行サービス「Canviコール」"
                  value={form.serviceName}
                  onChange={(e) => updateField('serviceName', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  サービス概要 <span className="text-red-500">*</span>
                </Label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  rows={3}
                  placeholder="例: BtoB企業向けのテレアポ・インサイドセールス代行。専任チームがアポ獲得まで対応。"
                  value={form.serviceDescription}
                  onChange={(e) => updateField('serviceDescription', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">差別化ポイント</Label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  rows={2}
                  placeholder="例: 業界特化型スクリプト設計、リアルタイムダッシュボード"
                  value={form.differentiators}
                  onChange={(e) => updateField('differentiators', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">競争優位性</Label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  rows={2}
                  placeholder="例: 全スタッフ営業経験3年以上、成果報酬型プランあり"
                  value={form.competitiveAdvantages}
                  onChange={(e) => updateField('competitiveAdvantages', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">実績・事例</Label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  rows={2}
                  placeholder="例: 導入企業150社以上、平均アポ率8.2%"
                  value={form.trackRecord}
                  onChange={(e) => updateField('trackRecord', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Target Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-600" />
                ターゲット情報
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  ターゲット業界 <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="例: IT・SaaS企業"
                  value={form.targetIndustry}
                  onChange={(e) => updateField('targetIndustry', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">送信先企業名（任意）</Label>
                <Input
                  placeholder="例: 株式会社○○"
                  value={form.targetCompanyName}
                  onChange={(e) => updateField('targetCompanyName', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">想定される課題</Label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  rows={2}
                  placeholder="例: 営業リソース不足、新規開拓の停滞"
                  value={form.targetPainPoints}
                  onChange={(e) => updateField('targetPainPoints', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Message Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-violet-600" />
                メッセージ設定
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">トーン</Label>
                  <Select value={form.tone} onValueChange={(v) => updateField('tone', v)}>
                    <SelectTrigger>
                      <SelectValueWithLabel value={form.tone} labels={{ formal: 'フォーマル', friendly: 'フレンドリー', concise: '簡潔' }} />
                    </SelectTrigger>
                    <SelectContent>
                      {TONE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">CTA（行動喚起）</Label>
                  <Select value={form.cta} onValueChange={(v) => updateField('cta', v)}>
                    <SelectTrigger>
                      <SelectValueWithLabel value={form.cta} labels={{ meeting: 'ミーティング設定', call: '電話でのご相談', document: '資料送付', trial: '無料トライアル' }} />
                    </SelectTrigger>
                    <SelectContent>
                      {CTA_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">文字数上限</Label>
                  <Select
                    value={String(form.maxChars)}
                    onValueChange={(v) => updateField('maxChars', Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValueWithLabel value={String(form.maxChars)} labels={{ '200': '200文字', '300': '300文字', '400': '400文字', '600': '600文字', '800': '800文字', '1000': '1000文字' }} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="200">200文字</SelectItem>
                      <SelectItem value="300">300文字</SelectItem>
                      <SelectItem value="400">400文字</SelectItem>
                      <SelectItem value="600">600文字</SelectItem>
                      <SelectItem value="800">800文字</SelectItem>
                      <SelectItem value="1000">1000文字</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">生成パターン数</Label>
                  <Select
                    value={String(form.variations)}
                    onValueChange={(v) => updateField('variations', Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValueWithLabel value={String(form.variations)} labels={{ '1': '1パターン', '2': '2パターン', '3': '3パターン', '5': '5パターン' }} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1パターン</SelectItem>
                      <SelectItem value="2">2パターン</SelectItem>
                      <SelectItem value="3">3パターン</SelectItem>
                      <SelectItem value="5">5パターン</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Advanced */}
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                追加の指示
              </button>
              {showAdvanced && (
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  rows={3}
                  placeholder="例: 「御社のXX事業に特化した内容にして」「技術的な専門用語を避けて」など"
                  value={form.additionalInstructions}
                  onChange={(e) => updateField('additionalInstructions', e.target.value)}
                />
              )}
            </CardContent>
          </Card>

          {/* Generate Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleGenerate}
            disabled={!canGenerate || isGenerating}
          >
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                AIがメッセージを生成中...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                メッセージを生成する
              </>
            )}
          </Button>
        </div>

        {/* Right: Generated Messages */}
        <div className="lg:col-span-3 space-y-4">
          {messages.length === 0 && !isGenerating && !error && (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <Sparkles className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  左のフォームに情報を入力して<br />
                  「メッセージを生成する」をクリックしてください
                </p>
                <p className="text-xs text-muted-foreground/60 mt-2">
                  AIが複数パターンの営業メッセージを自動生成します
                </p>
              </CardContent>
            </Card>
          )}

          {error && (
            <Card className="border-red-200 bg-red-50/50">
              <CardContent className="py-4 px-4">
                <p className="text-sm text-red-700">{error}</p>
              </CardContent>
            </Card>
          )}

          {isGenerating && (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="inline-flex items-center gap-3">
                  <RefreshCw className="h-5 w-5 animate-spin text-indigo-600" />
                  <div className="text-left">
                    <p className="text-sm font-medium">AIがメッセージを生成しています...</p>
                    <p className="text-xs text-muted-foreground">サービス情報とターゲットに最適化した文面を作成中</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {messages.map((msg, idx) => {
            const Icon = APPROACH_ICONS[msg.approach] || MessageSquare
            const isCopied = copiedIdx === idx

            return (
              <Card key={idx}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Icon className="h-4 w-4 text-indigo-600" />
                      <span>パターン{idx + 1}</span>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {msg.approach}
                      </Badge>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        {msg.charCount}文字
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleCopy(`件名: ${msg.subject}\n\n${msg.body}`, idx)}
                      >
                        {isCopied ? (
                          <>
                            <Check className="h-3 w-3 mr-1 text-green-600" />
                            コピー済
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            コピー
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Subject */}
                  <div className="rounded-md bg-muted/50 px-3 py-2">
                    <span className="text-[10px] text-muted-foreground">件名</span>
                    <p className="text-sm font-medium">{msg.subject}</p>
                  </div>

                  {/* Body */}
                  <div className="rounded-md border bg-white px-3 py-2.5">
                    <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                      {msg.body}
                    </pre>
                  </div>

                  {/* Tips */}
                  <div className="flex items-start gap-2 rounded-md bg-amber-50/50 border border-amber-200/50 px-3 py-2">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-800 leading-relaxed">{msg.tips}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {messages.length > 0 && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={handleGenerate} disabled={isGenerating}>
                <RefreshCw className={cn('h-4 w-4 mr-2', isGenerating && 'animate-spin')} />
                別のパターンを再生成
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
