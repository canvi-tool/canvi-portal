/**
 * 請求書PDF（共通テンプレ使用）
 *
 * 既存 src/lib/pdf/invoice-document.tsx の見た目に近い形で
 * lib/billing/pdf-base-template.ts のスタイルを使って描画する。
 *
 * `請求書_20260403 (1).pdf` のヘッダ構成 (請求書 / 請求番号 / 発行日 /
 * 支払期限 / 件名 / 御中宛名 / GMOあおぞらネット銀行振込先 / 明細表 /
 * 小計 / 消費税 / 合計 / 免税事業者表記) を踏襲する。
 */

import React from 'react'
import { Document, Page, Text, View } from '@react-pdf/renderer'
import {
  ensureJapaneseFontRegistered,
  billingPdfStyles as s,
  formatJpDate,
  formatYen,
  formatBankInfo,
  type BillingDocumentBankInfo,
  type BillingDocumentLine,
} from './pdf-base-template'

ensureJapaneseFontRegistered()

export interface InvoicePdfInput {
  invoiceNumber: string
  issueDate: string
  dueDate: string
  subject: string // 件名 (PJ名 + 期間)
  clientName: string
  clientAddress?: string | null
  issuer: {
    company_name: string
    address?: string | null
    tel?: string | null
    email?: string | null
  }
  bank: BillingDocumentBankInfo | null
  items: BillingDocumentLine[]
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  taxRate: number // 0.10
  isTaxExempt: boolean // 免税事業者表記
  notes?: string | null
}

export function InvoicePdfDocument({ data }: { data: InvoicePdfInput }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* 発行元（右上） */}
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}
        >
          <View style={{ flex: 1 }} />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.companyName}>{data.issuer.company_name}</Text>
            {data.issuer.address && (
              <Text style={s.companyDetail}>{data.issuer.address}</Text>
            )}
            {data.issuer.tel && (
              <Text style={s.companyDetail}>TEL: {data.issuer.tel}</Text>
            )}
            {data.issuer.email && (
              <Text style={s.companyDetail}>{data.issuer.email}</Text>
            )}
          </View>
        </View>

        <Text style={s.title}>請 求 書</Text>

        {/* 宛名 + メタ */}
        <View style={s.metaSection}>
          <View style={s.metaBlock}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={s.clientName}>{data.clientName}</Text>
              <Text style={s.honorific}> 御中</Text>
            </View>
            {data.clientAddress && (
              <Text style={{ ...s.companyDetail, marginTop: 4 }}>
                {data.clientAddress}
              </Text>
            )}
          </View>
          <View style={s.metaBlock}>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>請求番号:</Text>
              <Text style={s.metaValue}>{data.invoiceNumber}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>発行日:</Text>
              <Text style={s.metaValue}>{formatJpDate(data.issueDate)}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>支払期限:</Text>
              <Text style={s.metaValue}>{formatJpDate(data.dueDate)}</Text>
            </View>
          </View>
        </View>

        {/* 件名 */}
        <View style={s.subjectLine}>
          <Text style={s.metaLabel}>件名:</Text>
          <Text style={{ ...s.metaValue, fontSize: 11, fontWeight: 700 }}>
            {data.subject}
          </Text>
        </View>

        {/* 合計強調 */}
        <View style={s.grandTotal}>
          <Text style={s.grandTotalLabel}>ご請求金額（税込）</Text>
          <Text style={s.grandTotalAmount}>{formatYen(data.totalAmount)}</Text>
        </View>

        {/* 明細 */}
        <View style={s.table}>
          <View style={s.tableHeader}>
            <Text style={{ ...s.tableHeaderText, ...s.colDesc }}>摘要</Text>
            <Text style={{ ...s.tableHeaderText, ...s.colQty }}>数量</Text>
            <Text style={{ ...s.tableHeaderText, ...s.colUnit }}>単位</Text>
            <Text style={{ ...s.tableHeaderText, ...s.colUnitPrice }}>単価</Text>
            <Text style={{ ...s.tableHeaderText, ...s.colAmount }}>金額</Text>
          </View>
          {data.items.map((item, i) => (
            <View
              key={i}
              style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}
            >
              <Text style={s.colDesc}>{item.description}</Text>
              <Text style={s.colQty}>{item.quantity}</Text>
              <Text style={s.colUnit}>{item.unit ?? ''}</Text>
              <Text style={s.colUnitPrice}>
                {item.unit_price != null ? formatYen(item.unit_price) : '-'}
              </Text>
              <Text style={s.colAmount}>{formatYen(item.amount)}</Text>
            </View>
          ))}
        </View>

        {/* 集計 */}
        <View style={s.summarySection}>
          <View style={s.summaryTable}>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>小計</Text>
              <Text style={s.summaryValue}>{formatYen(data.subtotal)}</Text>
            </View>
            {data.discountAmount > 0 && (
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>値引</Text>
                <Text style={s.summaryValue}>
                  - {formatYen(data.discountAmount)}
                </Text>
              </View>
            )}
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>
                消費税（{Math.round(data.taxRate * 100)}%）
              </Text>
              <Text style={s.summaryValue}>{formatYen(data.taxAmount)}</Text>
            </View>
            <View style={s.summaryTotalRow}>
              <Text style={s.summaryTotalLabel}>合計金額</Text>
              <Text style={s.summaryTotalValue}>
                {formatYen(data.totalAmount)}
              </Text>
            </View>
          </View>
        </View>

        {/* 免税事業者表記 */}
        {data.isTaxExempt && (
          <Text style={s.taxNote}>
            ※ 当社は適格請求書発行事業者ではありません（免税事業者）。
          </Text>
        )}

        {/* 振込先 */}
        {data.bank && (
          <View style={s.bankSection}>
            <Text style={s.sectionTitle}>お振込先</Text>
            <Text style={s.bankText}>{formatBankInfo(data.bank)}</Text>
          </View>
        )}

        {/* 備考 */}
        {data.notes && (
          <View style={s.notesBox}>
            <Text style={s.sectionTitle}>備考</Text>
            <Text style={s.bankText}>{data.notes}</Text>
          </View>
        )}

        <Text style={s.footer}>
          {data.issuer.company_name}
          {data.issuer.address ? ` | ${data.issuer.address}` : ''}
          {data.issuer.tel ? ` | TEL: ${data.issuer.tel}` : ''}
        </Text>
      </Page>
    </Document>
  )
}
