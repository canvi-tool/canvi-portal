import { NextRequest, NextResponse } from 'next/server'
import { getAnthropicClient, DEFAULT_MODEL } from '@/lib/ai/client'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

interface FormSalesRequest {
  // サービス情報
  serviceName: string
  serviceDescription: string
  differentiators: string
  competitiveAdvantages: string
  trackRecord: string
  // ターゲット情報
  targetIndustry: string
  targetCompanyName: string
  targetPainPoints: string
  // メッセージ設定
  tone: 'formal' | 'friendly' | 'concise'
  maxChars: number
  cta: 'meeting' | 'call' | 'document' | 'trial'
  // 追加指示
  additionalInstructions: string
  // 生成数
  variations: number
}

const TONE_LABELS: Record<string, string> = {
  formal: 'フォーマル（丁寧・ビジネスライク）',
  friendly: 'フレンドリー（親しみやすい・柔らかい）',
  concise: '簡潔（要点重視・ストレート）',
}

const CTA_LABELS: Record<string, string> = {
  meeting: 'オンラインミーティングの設定',
  call: '電話でのご相談',
  document: '資料送付・ダウンロード',
  trial: '無料トライアル・デモの申し込み',
}

function buildPrompt(input: FormSalesRequest): string {
  return `あなたはBtoB営業のプロフェッショナルコピーライターです。
企業のお問い合わせフォームから送る営業メッセージを作成してください。

## 重要な制約
- 文字数は${input.maxChars}文字以内に収めること（厳守）
- スパムと判定されにくい自然な文面にすること
- 相手企業の課題に寄り添い、押し売り感を出さないこと
- 具体的な数字や実績を盛り込むこと
- フォーム送信であることを意識し、簡潔かつインパクトのある文面にすること

## サービス情報
- サービス名: ${input.serviceName}
- サービス概要: ${input.serviceDescription}
${input.differentiators ? `- 差別化ポイント: ${input.differentiators}` : ''}
${input.competitiveAdvantages ? `- 競争優位性: ${input.competitiveAdvantages}` : ''}
${input.trackRecord ? `- 実績・事例: ${input.trackRecord}` : ''}

## ターゲット情報
- ターゲット業界: ${input.targetIndustry}
${input.targetCompanyName ? `- 送信先企業名: ${input.targetCompanyName}` : ''}
${input.targetPainPoints ? `- 想定される課題: ${input.targetPainPoints}` : ''}

## メッセージ設定
- トーン: ${TONE_LABELS[input.tone]}
- CTA（行動喚起）: ${CTA_LABELS[input.cta]}
${input.additionalInstructions ? `\n## 追加の指示\n${input.additionalInstructions}` : ''}

## 出力形式
${input.variations}パターンのメッセージを生成してください。
各パターンは異なるアプローチで書いてください（例：課題解決型、実績アピール型、共感型など）。

以下のJSON形式で出力してください（JSON以外のテキストは含めないこと）:
{
  "messages": [
    {
      "approach": "アプローチの名前（例：課題解決型）",
      "subject": "件名（20文字以内）",
      "body": "本文",
      "charCount": 本文の文字数,
      "tips": "このパターンのポイント・効果的な使い方"
    }
  ]
}
`
}

// Demo response for when API key is not set
function getDemoResponse(input: FormSalesRequest) {
  const companyRef = input.targetCompanyName ? `${input.targetCompanyName}様` : '貴社'
  return {
    messages: [
      {
        approach: '課題解決型',
        subject: `${input.targetIndustry}の業務効率化のご提案`,
        body: `${companyRef}\n\n突然のご連絡失礼いたします。\n${input.serviceName}を提供しております。\n\n${input.targetIndustry}業界では${input.targetPainPoints || '業務効率化やコスト削減'}が課題となっているケースが多く、弊社サービスでは${input.differentiators || '独自のアプローチ'}により、多くの企業様の課題解決をサポートしてまいりました。\n\n${input.trackRecord || '導入企業様からは高い評価をいただいております。'}\n\nもしよろしければ、${CTA_LABELS[input.cta]}をご検討いただけますと幸いです。\n\n何卒よろしくお願いいたします。`,
        charCount: 250,
        tips: '相手の課題に焦点を当て、解決策として自社サービスを提示するパターン。共感を得やすい。',
      },
      {
        approach: '実績アピール型',
        subject: `${input.serviceName}のご紹介`,
        body: `${companyRef}\n\nお忙しいところ恐れ入ります。\n\n${input.serviceName}は${input.serviceDescription}\n\n${input.competitiveAdvantages || '他社にはない強み'}を活かし、${input.trackRecord || '多数の実績'}がございます。\n\n${input.targetIndustry}業界でもご導入いただいており、具体的な事例もご紹介可能です。\n\nご興味がございましたら、${CTA_LABELS[input.cta]}いただければ、詳しくご説明させていただきます。\n\nご検討のほどよろしくお願いいたします。`,
        charCount: 230,
        tips: '具体的な数字や実績を前面に出し、信頼感を構築するパターン。実績が豊富な場合に効果的。',
      },
      {
        approach: '共感・提案型',
        subject: `${input.targetIndustry}でお困りのことはありませんか？`,
        body: `${companyRef}\n\nはじめまして。${input.serviceName}の担当です。\n\n${input.targetIndustry}業界の企業様とお話しする中で、「${input.targetPainPoints || '人手不足やコスト増加'}」というお声をよくいただきます。\n\n弊社では${input.serviceDescription}\n${input.differentiators || ''}を強みとしており、同様の課題を抱える企業様のお力になれると考えております。\n\nまずは情報交換からでも構いませんので、${CTA_LABELS[input.cta]}いただけますと幸いです。\n\n何卒よろしくお願いいたします。`,
        charCount: 240,
        tips: '相手の悩みに共感しつつ、自然な流れで提案につなげるパターン。初回接触で警戒感を下げたい時に有効。',
      },
    ],
  }
}

export async function POST(request: NextRequest) {
  const body: FormSalesRequest = await request.json()

  // Validation
  if (!body.serviceName || !body.serviceDescription || !body.targetIndustry) {
    return NextResponse.json(
      { error: 'サービス名、サービス概要、ターゲット業界は必須です' },
      { status: 400 }
    )
  }

  // Demo mode or no API key: return demo response
  if (DEMO_MODE || !process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_claude_api_key') {
    return NextResponse.json(getDemoResponse(body))
  }

  try {
    const client = getAnthropicClient()
    const prompt = buildPrompt(body)

    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      messages: [
        { role: 'user', content: prompt },
      ],
    })

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => ('text' in block ? block.text : ''))
      .join('')

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'AIの応答からJSONを抽出できませんでした', raw: text },
        { status: 500 }
      )
    }

    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json(result)
  } catch (error) {
    console.error('AI form sales generation error:', error)
    return NextResponse.json(
      { error: 'メッセージ生成中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
