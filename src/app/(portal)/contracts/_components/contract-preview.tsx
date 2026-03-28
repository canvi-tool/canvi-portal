'use client'

import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Download, Printer } from 'lucide-react'
import { useGenerateContractPdf } from '@/hooks/use-contracts'
import { toast } from 'sonner'

interface ContractPreviewProps {
  title: string
  content: string
  staffName?: string
  startDate?: string
  endDate?: string | null
  contractId?: string
  companyName?: string
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

function interpolateContent(template: string, variables: Record<string, unknown>): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
    result = result.replace(regex, String(value ?? ''))
  }
  return result
}

export function ContractPreview({
  title,
  content,
  staffName,
  startDate,
  endDate,
  contractId,
  companyName = '株式会社キャンビ',
}: ContractPreviewProps) {
  const generatePdf = useGenerateContractPdf()

  const handleDownloadPdf = useCallback(async () => {
    if (!contractId) {
      toast.error('契約を保存してからPDFをダウンロードしてください')
      return
    }
    try {
      const blob = await generatePdf.mutateAsync(contractId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('PDFをダウンロードしました')
    } catch {
      toast.error('PDFの生成に失敗しました')
    }
  }, [contractId, title, generatePdf])

  const handlePrint = useCallback(() => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const paragraphs = content
      .split(/\n\n+/)
      .filter((p) => p.trim())
      .map((p) => `<p style="margin-bottom: 12px; line-height: 1.8;">${p.replace(/\n/g, '<br/>')}</p>`)
      .join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif; padding: 40px; font-size: 12px; color: #1a1a1a; max-width: 210mm; margin: 0 auto; }
          h1 { text-align: center; font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 24px; }
          .meta { background: #f8f8f8; padding: 12px; border-radius: 4px; margin-bottom: 20px; }
          .meta-row { display: flex; margin-bottom: 4px; }
          .meta-label { width: 100px; font-weight: bold; color: #555; font-size: 11px; }
          .meta-value { flex: 1; font-size: 11px; }
          .section-title { font-size: 14px; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 16px; margin-bottom: 8px; }
          .parties { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #eee; }
          .party-row { display: flex; margin-bottom: 6px; }
          .party-label { width: 120px; font-weight: bold; }
          .signature { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; }
          .signature-row { display: flex; justify-content: space-between; margin-top: 20px; }
          .signature-block { width: 45%; }
          .signature-line { border-bottom: 1px solid #333; height: 30px; margin-bottom: 6px; }
          .signature-caption { font-size: 10px; color: #666; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <div class="meta">
          <div class="meta-row">
            <span class="meta-label">契約期間:</span>
            <span class="meta-value">${formatDate(startDate)}${endDate ? ` 〜 ${formatDate(endDate)}` : ' 〜 無期限'}</span>
          </div>
        </div>
        <div class="parties">
          <div class="section-title">契約当事者</div>
          <div class="party-row"><span class="party-label">甲（発注者）:</span><span>${companyName}</span></div>
          <div class="party-row"><span class="party-label">乙（受注者）:</span><span>${staffName || ''}</span></div>
        </div>
        <div class="section-title">契約内容</div>
        ${paragraphs}
        <div class="signature">
          <div class="section-title">署名欄</div>
          <div class="signature-row">
            <div class="signature-block">
              <div style="font-weight: bold; margin-bottom: 8px;">甲（発注者）</div>
              <div class="signature-line"></div>
              <div class="signature-caption">${companyName}</div>
            </div>
            <div class="signature-block">
              <div style="font-weight: bold; margin-bottom: 8px;">乙（受注者）</div>
              <div class="signature-line"></div>
              <div class="signature-caption">${staffName || ''}</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }, [title, content, staffName, startDate, endDate, companyName])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">契約書プレビュー</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            印刷
          </Button>
          {contractId && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={generatePdf.isPending}
            >
              <Download className="mr-2 h-4 w-4" />
              {generatePdf.isPending ? '生成中...' : 'PDFダウンロード'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Preview area - styled to look like a document */}
        <div className="mx-auto max-w-[210mm] rounded-lg border bg-white p-8 shadow-sm">
          {/* Title */}
          <h1 className="mb-6 border-b-2 border-gray-800 pb-2 text-center text-xl font-bold">
            {title || '無題の契約書'}
          </h1>

          {/* Meta Info */}
          <div className="mb-5 rounded bg-gray-50 p-3">
            <div className="flex gap-2 text-sm">
              <span className="w-24 font-bold text-gray-500">契約期間:</span>
              <span className="text-gray-700">
                {formatDate(startDate)}
                {endDate ? ` 〜 ${formatDate(endDate)}` : ' 〜 無期限'}
              </span>
            </div>
          </div>

          {/* Parties */}
          <div className="mb-5 border-b pb-4">
            <h2 className="mb-2 border-b border-gray-300 pb-1 text-sm font-bold">
              契約当事者
            </h2>
            <div className="space-y-1 text-sm">
              <div className="flex gap-2">
                <span className="w-28 font-bold">甲（発注者）:</span>
                <span>{companyName}</span>
              </div>
              <div className="flex gap-2">
                <span className="w-28 font-bold">乙（受注者）:</span>
                <span>{staffName || '（未選択）'}</span>
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Content Body */}
          <h2 className="mb-2 border-b border-gray-300 pb-1 text-sm font-bold">
            契約内容
          </h2>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
            {content || '（契約内容が入力されていません）'}
          </div>

          <Separator className="my-6" />

          {/* Signature Area */}
          <div className="mt-8 border-t pt-4">
            <h2 className="mb-4 border-b border-gray-300 pb-1 text-sm font-bold">
              署名欄
            </h2>
            <div className="flex justify-between">
              <div className="w-[45%]">
                <p className="mb-2 text-sm font-bold">甲（発注者）</p>
                <div className="mb-1 h-8 border-b border-gray-800" />
                <p className="text-xs text-gray-500">{companyName}</p>
              </div>
              <div className="w-[45%]">
                <p className="mb-2 text-sm font-bold">乙（受注者）</p>
                <div className="mb-1 h-8 border-b border-gray-800" />
                <p className="text-xs text-gray-500">{staffName || ''}</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export { interpolateContent }
