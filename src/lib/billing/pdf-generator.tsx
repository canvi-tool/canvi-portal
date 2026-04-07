/**
 * 支払通知書 / 請求書 共通 PDF テンプレート
 *
 * 既存 `支払通知書_20260408.pdf` のフォーマットを踏襲:
 *   - ヘッダ切替: docType = 'notice' (支払通知書) | 'invoice' (請求書)
 *   - 件名 / 宛名(様/御中) / 発行日 / 支払予定日 / 支払方法 / 備考
 *   - 明細: 摘要 / 数量(小数可) / 単位 / 単価 / 金額
 *   - FS成果報酬は formula_text を表示
 *   - 内訳: 10%対象(税抜) / 10%消費税 / 0%対象
 *
 * 技術: @react-pdf/renderer (Vercel軽量・サーバレス対応)
 */

import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  renderToBuffer,
} from '@react-pdf/renderer'

Font.register({
  family: 'NotoSansJP',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/notosansjp/v53/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFJEk757Y0rw_qMHVdbR2L8Y9QTJ1LwkRg8UGzMQ.0.woff2',
      fontWeight: 400,
    },
    {
      src: 'https://fonts.gstatic.com/s/notosansjp/v53/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFJEk757Y0rw_qMHVdbR2L8Y9QTJ1LwkRg8UGzMQp.0.woff2',
      fontWeight: 700,
    },
  ],
})

export type DocumentType = 'notice' | 'invoice'

export interface BillingPdfLine {
  description: string
  quantity: number
  unit: string
  unit_price: number | null
  amount: number
  is_taxable: boolean
  formula_text?: string | null
}

export interface BillingPdfData {
  docType: DocumentType
  documentNumber: string
  subject: string
  recipientName: string
  recipientHonorific: '様' | '御中'
  issueDate: string
  paymentDueDate: string
  paymentMethod: string
  notes?: string
  lines: BillingPdfLine[]
  taxable_amount_10: number
  tax_amount_10: number
  non_taxable_amount: number
  total_amount: number
  issuer?: {
    companyName?: string
    address?: string
    tel?: string
    email?: string
  }
}

function fmtYen(n: number): string {
  return `\u00a5${Math.floor(n).toLocaleString('ja-JP')}`
}

function fmtDate(s?: string): string {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

function fmtQty(n: number): string {
  // 小数があれば最大2桁、なければ整数
  return Number.isInteger(n) ? n.toString() : n.toFixed(2)
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansJP',
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 60,
    paddingLeft: 40,
    paddingRight: 40,
    lineHeight: 1.5,
    color: '#1a1a1a',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  issuer: { textAlign: 'right' },
  issuerName: { fontSize: 11, fontWeight: 700, marginBottom: 2 },
  issuerDetail: { fontSize: 8, color: '#555' },
  title: {
    fontSize: 22,
    fontWeight: 700,
    textAlign: 'center',
    marginVertical: 14,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: '#333',
    borderBottomStyle: 'solid',
  },
  metaRow: { flexDirection: 'row', marginBottom: 3 },
  metaLabel: { width: 80, fontSize: 9, fontWeight: 700, color: '#555' },
  metaValue: { flex: 1, fontSize: 9 },
  twoCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  half: { width: '48%' },
  recipientName: { fontSize: 16, fontWeight: 700 },
  recipientHonorific: { fontSize: 12, marginLeft: 4 },
  subjectRow: { marginBottom: 10 },
  subjectLabel: { fontSize: 9, color: '#555', fontWeight: 700 },
  subjectValue: { fontSize: 12, fontWeight: 700, marginTop: 2 },
  totalBox: {
    marginVertical: 12,
    padding: 14,
    backgroundColor: '#222',
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { fontSize: 13, fontWeight: 700, color: '#fff' },
  totalAmount: { fontSize: 20, fontWeight: 700, color: '#fff' },
  table: { marginTop: 6, marginBottom: 12 },
  th: {
    flexDirection: 'row',
    backgroundColor: '#333',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  thText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 700,
    textAlign: 'center',
  },
  tr: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    borderBottomStyle: 'solid',
    paddingVertical: 5,
    paddingHorizontal: 4,
    minHeight: 24,
  },
  trAlt: { backgroundColor: '#fafafa' },
  cDesc: { width: '46%', fontSize: 9 },
  cQty: { width: '12%', fontSize: 9, textAlign: 'right' },
  cUnit: { width: '10%', fontSize: 9, textAlign: 'center' },
  cPrice: { width: '16%', fontSize: 9, textAlign: 'right' },
  cAmt: { width: '16%', fontSize: 9, textAlign: 'right' },
  formulaText: { fontSize: 7, color: '#777', marginTop: 2 },
  summary: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 14,
  },
  summaryTbl: { width: 240 },
  sRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    borderBottomStyle: 'solid',
  },
  sLabel: { fontSize: 9, color: '#555' },
  sValue: { fontSize: 9, fontWeight: 700 },
  sTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderTopWidth: 2,
    borderTopColor: '#333',
    borderTopStyle: 'solid',
  },
  sTotalLabel: { fontSize: 11, fontWeight: 700 },
  sTotalValue: { fontSize: 11, fontWeight: 700 },
  notesBox: {
    padding: 10,
    backgroundColor: '#f8f8f8',
    borderRadius: 4,
    marginBottom: 12,
  },
  notesLabel: { fontSize: 9, fontWeight: 700, marginBottom: 4, color: '#555' },
  notesText: { fontSize: 9, color: '#333' },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 7,
    color: '#999',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    borderTopStyle: 'solid',
    paddingTop: 6,
  },
})

export function BillingDocument({ data }: { data: BillingPdfData }) {
  const titleText = data.docType === 'notice' ? '支 払 通 知 書' : '請 求 書'
  const totalLabel =
    data.docType === 'notice' ? 'お支払金額（税込）' : 'ご請求金額（税込）'

  const issuer = data.issuer ?? {}
  const issuerName = issuer.companyName ?? 'Canvi株式会社'
  const issuerAddress = issuer.address ?? '東京都渋谷区xxx 1-2-3'
  const issuerTel = issuer.tel ?? 'TEL: 03-1234-5678'
  const issuerEmail = issuer.email ?? 'invoice@canvi.co.jp'

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }} />
          <View style={styles.issuer}>
            <Text style={styles.issuerName}>{issuerName}</Text>
            <Text style={styles.issuerDetail}>{issuerAddress}</Text>
            <Text style={styles.issuerDetail}>{issuerTel}</Text>
            <Text style={styles.issuerDetail}>Email: {issuerEmail}</Text>
          </View>
        </View>

        <Text style={styles.title}>{titleText}</Text>

        {/* 宛名 + メタ */}
        <View style={styles.twoCol}>
          <View style={styles.half}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                marginBottom: 6,
              }}
            >
              <Text style={styles.recipientName}>{data.recipientName}</Text>
              <Text style={styles.recipientHonorific}>
                {' '}
                {data.recipientHonorific}
              </Text>
            </View>
          </View>
          <View style={styles.half}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>番号:</Text>
              <Text style={styles.metaValue}>{data.documentNumber}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>
                {data.docType === 'notice' ? '支払通知日:' : '発行日:'}
              </Text>
              <Text style={styles.metaValue}>{fmtDate(data.issueDate)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>
                {data.docType === 'notice' ? '支払予定日:' : '支払期日:'}
              </Text>
              <Text style={styles.metaValue}>
                {fmtDate(data.paymentDueDate)}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>支払方法:</Text>
              <Text style={styles.metaValue}>{data.paymentMethod}</Text>
            </View>
          </View>
        </View>

        {/* 件名 */}
        <View style={styles.subjectRow}>
          <Text style={styles.subjectLabel}>件名</Text>
          <Text style={styles.subjectValue}>{data.subject}</Text>
        </View>

        {/* 合計ボックス */}
        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>{totalLabel}</Text>
          <Text style={styles.totalAmount}>{fmtYen(data.total_amount)}</Text>
        </View>

        {/* 明細表 */}
        <View style={styles.table}>
          <View style={styles.th}>
            <Text style={[styles.thText, styles.cDesc]}>摘要</Text>
            <Text style={[styles.thText, styles.cQty]}>数量</Text>
            <Text style={[styles.thText, styles.cUnit]}>単位</Text>
            <Text style={[styles.thText, styles.cPrice]}>単価</Text>
            <Text style={[styles.thText, styles.cAmt]}>金額</Text>
          </View>
          {data.lines.map((l, i) => (
            <View
              key={i}
              style={[styles.tr, i % 2 === 1 ? styles.trAlt : {}]}
            >
              <View style={styles.cDesc}>
                <Text>{l.description}</Text>
                {l.formula_text ? (
                  <Text style={styles.formulaText}>{l.formula_text}</Text>
                ) : null}
              </View>
              <Text style={styles.cQty}>{fmtQty(l.quantity)}</Text>
              <Text style={styles.cUnit}>{l.unit}</Text>
              <Text style={styles.cPrice}>
                {l.unit_price !== null && l.unit_price !== undefined
                  ? fmtYen(l.unit_price)
                  : '-'}
              </Text>
              <Text style={styles.cAmt}>{fmtYen(l.amount)}</Text>
            </View>
          ))}
        </View>

        {/* 内訳サマリ */}
        <View style={styles.summary}>
          <View style={styles.summaryTbl}>
            <View style={styles.sRow}>
              <Text style={styles.sLabel}>10%対象（税抜）</Text>
              <Text style={styles.sValue}>
                {fmtYen(data.taxable_amount_10)}
              </Text>
            </View>
            <View style={styles.sRow}>
              <Text style={styles.sLabel}>消費税（10%）</Text>
              <Text style={styles.sValue}>{fmtYen(data.tax_amount_10)}</Text>
            </View>
            <View style={styles.sRow}>
              <Text style={styles.sLabel}>0%対象</Text>
              <Text style={styles.sValue}>
                {fmtYen(data.non_taxable_amount)}
              </Text>
            </View>
            <View style={styles.sTotalRow}>
              <Text style={styles.sTotalLabel}>合計金額</Text>
              <Text style={styles.sTotalValue}>
                {fmtYen(data.total_amount)}
              </Text>
            </View>
          </View>
        </View>

        {/* 備考 */}
        {data.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>備考</Text>
            <Text style={styles.notesText}>{data.notes}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>
          {issuerName} | {issuerAddress} | {issuerEmail}
        </Text>
      </Page>
    </Document>
  )
}

/**
 * サーバ側で PDF を Buffer 化して返す。
 * API ルートからレスポンスとして直接ダウンロード可能。
 */
export async function renderBillingPdfBuffer(
  data: BillingPdfData
): Promise<Buffer> {
  return renderToBuffer(<BillingDocument data={data} />)
}
