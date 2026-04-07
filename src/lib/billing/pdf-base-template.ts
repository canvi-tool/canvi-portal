/**
 * 請求書 / 支払通知書 共通PDFテンプレ用 styles + 共有型
 *
 * 既存 src/lib/pdf/invoice-document.tsx のスタイルを切り出して
 * 請求書 / 支払通知書 双方から再利用できるようにしたもの。
 *
 * payment-notice 担当エージェントの作業と被る可能性があるため、
 * マージ時はこのファイル単位でリプレースまたは統合する想定。
 */

import { StyleSheet, Font } from '@react-pdf/renderer'

// Noto Sans JP 登録は1度だけ
let _fontRegistered = false
export function ensureJapaneseFontRegistered() {
  if (_fontRegistered) return
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
  _fontRegistered = true
}

export interface BillingDocumentBankInfo {
  bank_name: string
  bank_branch?: string | null
  bank_account_type?: string | null
  bank_account_number?: string | null
  bank_account_holder?: string | null
}

export interface BillingDocumentLine {
  description: string
  quantity: number
  unit?: string
  unit_price: number | null
  amount: number
}

export const billingPdfStyles = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansJP',
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 50,
    paddingLeft: 40,
    paddingRight: 40,
    lineHeight: 1.5,
    color: '#1a1a1a',
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 16,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: '#222',
    borderBottomStyle: 'solid',
  },
  metaSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metaBlock: { width: '48%' },
  metaRow: { flexDirection: 'row', marginBottom: 3 },
  metaLabel: { width: 70, fontSize: 9, fontWeight: 700, color: '#555' },
  metaValue: { flex: 1, fontSize: 9, color: '#222' },
  clientName: { fontSize: 14, fontWeight: 700 },
  honorific: { fontSize: 12 },
  companyName: { fontSize: 11, fontWeight: 700 },
  companyDetail: { fontSize: 8, color: '#555' },
  subjectLine: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  grandTotal: {
    padding: 14,
    backgroundColor: '#222',
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  grandTotalLabel: { fontSize: 13, fontWeight: 700, color: '#fff' },
  grandTotalAmount: { fontSize: 20, fontWeight: 700, color: '#fff' },
  table: { marginBottom: 12 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#222',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableHeaderText: { color: '#fff', fontSize: 9, fontWeight: 700, textAlign: 'center' },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    borderBottomStyle: 'solid',
    paddingVertical: 5,
    paddingHorizontal: 4,
    minHeight: 26,
  },
  tableRowAlt: { backgroundColor: '#fafafa' },
  colDesc: { width: '46%', fontSize: 9 },
  colQty: { width: '12%', textAlign: 'right', fontSize: 9 },
  colUnit: { width: '10%', textAlign: 'center', fontSize: 9 },
  colUnitPrice: { width: '16%', textAlign: 'right', fontSize: 9 },
  colAmount: { width: '16%', textAlign: 'right', fontSize: 9 },
  summarySection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  summaryTable: { width: 220 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    borderBottomStyle: 'solid',
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 2,
    borderTopColor: '#222',
    borderTopStyle: 'solid',
  },
  summaryLabel: { fontSize: 9, color: '#555' },
  summaryValue: { fontSize: 9, fontWeight: 700 },
  summaryTotalLabel: { fontSize: 11, fontWeight: 700 },
  summaryTotalValue: { fontSize: 11, fontWeight: 700 },
  bankSection: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#f6f6f6',
    borderRadius: 4,
  },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 6, color: '#222' },
  bankText: { fontSize: 9, color: '#222', lineHeight: 1.7 },
  taxNote: {
    marginBottom: 10,
    fontSize: 8,
    color: '#666',
  },
  notesBox: {
    padding: 10,
    backgroundColor: '#f6f6f6',
    borderRadius: 4,
    marginBottom: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
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

export function formatJpDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

export function formatYen(amount: number): string {
  return `\u00a5${Math.round(amount).toLocaleString('ja-JP')}`
}

export function formatBankInfo(b: BillingDocumentBankInfo | null | undefined): string {
  if (!b) return ''
  const lines = [b.bank_name]
  if (b.bank_branch) lines.push(b.bank_branch)
  const acct: string[] = []
  if (b.bank_account_type) acct.push(b.bank_account_type)
  if (b.bank_account_number) acct.push(b.bank_account_number)
  if (acct.length) lines.push(acct.join(' '))
  if (b.bank_account_holder) lines.push(`名義: ${b.bank_account_holder}`)
  return lines.join('\n')
}
