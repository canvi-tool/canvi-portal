'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, FileImage, ExternalLink } from 'lucide-react'
import { ID_DOCUMENT_TYPES } from '@/lib/validations/staff'

interface IdentityDocumentCardProps {
  staffId: string
  customFields: Record<string, unknown> | null
}

interface DocumentData {
  type: string
  frontUrl: string | null
  backUrl: string | null
}

export function IdentityDocumentCard({ staffId, customFields }: IdentityDocumentCardProps) {
  const [loading, setLoading] = useState(true)
  const [documents, setDocuments] = useState<DocumentData | null>(null)

  // custom_fieldsにidentity_documentがあるか事前チェック
  const idDoc = customFields?.identity_document as { type?: string; front?: string; back?: string } | undefined
  const hasDocuments = !!(idDoc?.front && idDoc?.back)

  useEffect(() => {
    if (!hasDocuments) {
      setLoading(false)
      return
    }

    fetch(`/api/staff/${staffId}/documents`)
      .then((res) => res.json())
      .then((data) => {
        setDocuments(data.documents || null)
      })
      .catch(() => {
        setDocuments(null)
      })
      .finally(() => setLoading(false))
  }, [staffId, hasDocuments])

  if (!hasDocuments) return null

  const docTypeInfo = ID_DOCUMENT_TYPES.find((d) => d.value === idDoc?.type)
  const docTypeLabel = docTypeInfo?.label || '本人確認書類'
  const frontLabel = docTypeInfo?.frontLabel || '表面'
  const backLabel = docTypeInfo?.backLabel || '裏面'

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileImage className="h-5 w-5" />
          本人確認書類
          <Badge variant="secondary">{docTypeLabel}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : documents ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{frontLabel}</p>
              {documents.frontUrl ? (
                <a href={documents.frontUrl} target="_blank" rel="noopener noreferrer" className="block group">
                  <div className="relative rounded-lg border overflow-hidden bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={documents.frontUrl}
                      alt={frontLabel}
                      className="w-full h-48 object-contain"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <ExternalLink className="h-6 w-6 text-white drop-shadow" />
                    </div>
                  </div>
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">画像を読み込めません</p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{backLabel}</p>
              {documents.backUrl ? (
                <a href={documents.backUrl} target="_blank" rel="noopener noreferrer" className="block group">
                  <div className="relative rounded-lg border overflow-hidden bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={documents.backUrl}
                      alt={backLabel}
                      className="w-full h-48 object-contain"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <ExternalLink className="h-6 w-6 text-white drop-shadow" />
                    </div>
                  </div>
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">画像を読み込めません</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">書類の読み込みに失敗しました</p>
        )}
      </CardContent>
    </Card>
  )
}
