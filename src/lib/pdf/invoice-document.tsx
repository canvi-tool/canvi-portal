import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'

// Register a Japanese-compatible font (Noto Sans JP from Google Fonts)
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

export interface InvoicePdfData {
  invoiceNumber: string
  title: string
  clientName: string
  clientAddress?: string
  clientContactPerson?: string
  items: Array<{
    name: string
    description?: string
    quantity: number
    unit: string
    unit_price: number
    amount: number
    row_type?: 'item' | 'text'
  }>
  subtotal: number
  taxRate: number
  taxAmount: number
  totalAmount: number
  issueDate: string
  dueDate?: string
  paymentMethod?: string
  bankInfo?: string
  notes?: string
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

function formatYen(amount: number): string {
  return `\u00a5${amount.toLocaleString('ja-JP')}`
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansJP',
    fontSize: 10,
    paddingTop: 50,
    paddingBottom: 60,
    paddingLeft: 50,
    paddingRight: 50,
    lineHeight: 1.6,
    color: '#1a1a1a',
  },
  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  companyInfo: {
    textAlign: 'right',
  },
  companyName: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 2,
  },
  companyDetail: {
    fontSize: 8,
    color: '#555',
    marginBottom: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 20,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#333',
    borderBottomStyle: 'solid',
  },
  // Meta
  metaSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metaBlock: {
    width: '48%',
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  metaLabel: {
    width: 80,
    fontSize: 9,
    fontWeight: 700,
    color: '#555',
  },
  metaValue: {
    flex: 1,
    fontSize: 9,
    color: '#333',
  },
  // Client
  clientSection: {
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    borderBottomStyle: 'solid',
  },
  clientName: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 4,
  },
  clientDetail: {
    fontSize: 9,
    color: '#555',
    marginBottom: 2,
  },
  honorific: {
    fontSize: 12,
    marginLeft: 4,
  },
  // Grand total
  grandTotalSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#333',
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
  },
  grandTotalAmount: {
    fontSize: 22,
    fontWeight: 700,
    color: '#fff',
  },
  // Table
  table: {
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#333',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableHeaderText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 700,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    borderBottomStyle: 'solid',
    paddingVertical: 5,
    paddingHorizontal: 4,
    minHeight: 28,
  },
  tableRowAlt: {
    backgroundColor: '#fafafa',
  },
  colNo: { width: '6%', textAlign: 'center', fontSize: 9 },
  colName: { width: '24%', fontSize: 9 },
  colDesc: { width: '20%', fontSize: 8, color: '#666' },
  colQty: { width: '10%', textAlign: 'right', fontSize: 9 },
  colUnit: { width: '8%', textAlign: 'center', fontSize: 9 },
  colUnitPrice: { width: '16%', textAlign: 'right', fontSize: 9 },
  colAmount: { width: '16%', textAlign: 'right', fontSize: 9 },
  // Summary
  summarySection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  summaryTable: {
    width: 220,
  },
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
    borderTopColor: '#333',
    borderTopStyle: 'solid',
  },
  summaryLabel: {
    fontSize: 9,
    color: '#555',
  },
  summaryValue: {
    fontSize: 9,
    fontWeight: 700,
  },
  summaryTotalLabel: {
    fontSize: 11,
    fontWeight: 700,
  },
  summaryTotalValue: {
    fontSize: 11,
    fontWeight: 700,
  },
  // Payment info
  paymentSection: {
    marginBottom: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'solid',
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 8,
    color: '#333',
  },
  paymentRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  paymentLabel: {
    width: 90,
    fontSize: 9,
    fontWeight: 700,
    color: '#555',
  },
  paymentValue: {
    flex: 1,
    fontSize: 9,
    color: '#333',
  },
  // Bank info
  bankSection: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 4,
  },
  bankText: {
    fontSize: 9,
    color: '#333',
    lineHeight: 1.8,
  },
  // Notes
  notesBox: {
    padding: 10,
    backgroundColor: '#f8f8f8',
    borderRadius: 4,
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 4,
    color: '#555',
  },
  infoValue: {
    fontSize: 9,
    color: '#333',
    lineHeight: 1.6,
  },
  // Stamp
  stampSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    marginBottom: 20,
  },
  stampBox: {
    width: 50,
    height: 50,
    borderWidth: 1,
    borderColor: '#cc0000',
    borderStyle: 'solid',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stampText: {
    fontSize: 7,
    color: '#cc0000',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    textAlign: 'center',
    fontSize: 7,
    color: '#999',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    borderTopStyle: 'solid',
    paddingTop: 8,
  },
})

export function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }} />
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>Canvi株式会社</Text>
            <Text style={styles.companyDetail}>東京都渋谷区xxx 1-2-3</Text>
            <Text style={styles.companyDetail}>TEL: 03-1234-5678</Text>
            <Text style={styles.companyDetail}>Email: info@canvi.co.jp</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>請 求 書</Text>

        {/* Meta + Client */}
        <View style={styles.metaSection}>
          <View style={styles.metaBlock}>
            <View style={styles.clientSection}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={styles.clientName}>{data.clientName}</Text>
                <Text style={styles.honorific}> 御中</Text>
              </View>
              {data.clientAddress && (
                <Text style={styles.clientDetail}>{data.clientAddress}</Text>
              )}
              {data.clientContactPerson && (
                <Text style={styles.clientDetail}>
                  担当: {data.clientContactPerson} 様
                </Text>
              )}
            </View>
          </View>
          <View style={styles.metaBlock}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>請求番号:</Text>
              <Text style={styles.metaValue}>{data.invoiceNumber}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>発行日:</Text>
              <Text style={styles.metaValue}>
                {formatDate(data.issueDate)}
              </Text>
            </View>
            {data.dueDate && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>支払期限:</Text>
                <Text style={styles.metaValue}>
                  {formatDate(data.dueDate)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Subject */}
        <View style={{ marginBottom: 12 }}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>件名:</Text>
            <Text
              style={{ ...styles.metaValue, fontSize: 11, fontWeight: 700 }}
            >
              {data.title}
            </Text>
          </View>
        </View>

        {/* Grand Total */}
        <View style={styles.grandTotalSection}>
          <Text style={styles.grandTotalLabel}>ご請求金額（税込）</Text>
          <Text style={styles.grandTotalAmount}>
            {formatYen(data.totalAmount)}
          </Text>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.tableHeaderText, ...styles.colNo }}>
              No.
            </Text>
            <Text style={{ ...styles.tableHeaderText, ...styles.colName }}>
              品名
            </Text>
            <Text style={{ ...styles.tableHeaderText, ...styles.colDesc }}>
              説明
            </Text>
            <Text style={{ ...styles.tableHeaderText, ...styles.colQty }}>
              数量
            </Text>
            <Text style={{ ...styles.tableHeaderText, ...styles.colUnit }}>
              単位
            </Text>
            <Text
              style={{ ...styles.tableHeaderText, ...styles.colUnitPrice }}
            >
              単価
            </Text>
            <Text style={{ ...styles.tableHeaderText, ...styles.colAmount }}>
              金額
            </Text>
          </View>
          {data.items.map((item, index) => {
            if (item.row_type === 'text') {
              return (
                <View
                  key={index}
                  style={[
                    styles.tableRow,
                    index % 2 === 1 ? styles.tableRowAlt : {},
                  ]}
                >
                  <Text style={{ width: '100%', fontSize: 9 }}>
                    {item.description || ''}
                  </Text>
                </View>
              )
            }
            return (
              <View
                key={index}
                style={[
                  styles.tableRow,
                  index % 2 === 1 ? styles.tableRowAlt : {},
                ]}
              >
                <Text style={styles.colNo}>{index + 1}</Text>
                <Text style={styles.colName}>{item.name}</Text>
                <Text style={styles.colDesc}>{item.description || ''}</Text>
                <Text style={styles.colQty}>{item.quantity}</Text>
                <Text style={styles.colUnit}>{item.unit}</Text>
                <Text style={styles.colUnitPrice}>
                  {formatYen(item.unit_price)}
                </Text>
                <Text style={styles.colAmount}>{formatYen(item.amount)}</Text>
              </View>
            )
          })}
        </View>

        {/* Summary */}
        <View style={styles.summarySection}>
          <View style={styles.summaryTable}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>小計</Text>
              <Text style={styles.summaryValue}>
                {formatYen(data.subtotal)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                消費税（{data.taxRate}%）
              </Text>
              <Text style={styles.summaryValue}>
                {formatYen(data.taxAmount)}
              </Text>
            </View>
            <View style={styles.summaryTotalRow}>
              <Text style={styles.summaryTotalLabel}>合計金額</Text>
              <Text style={styles.summaryTotalValue}>
                {formatYen(data.totalAmount)}
              </Text>
            </View>
          </View>
        </View>

        {/* Payment Due */}
        {data.dueDate && (
          <View style={styles.paymentSection}>
            <Text style={styles.sectionTitle}>お支払いについて</Text>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>支払期限:</Text>
              <Text style={styles.paymentValue}>
                {formatDate(data.dueDate)}
              </Text>
            </View>
            {data.paymentMethod && (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>支払方法:</Text>
                <Text style={styles.paymentValue}>{data.paymentMethod}</Text>
              </View>
            )}
          </View>
        )}

        {/* Bank Info */}
        {data.bankInfo && (
          <View style={styles.bankSection}>
            <Text style={styles.sectionTitle}>振込先情報</Text>
            <Text style={styles.bankText}>{data.bankInfo}</Text>
          </View>
        )}

        {/* Notes */}
        {data.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.infoLabel}>備考</Text>
            <Text style={styles.infoValue}>{data.notes}</Text>
          </View>
        )}

        {/* Stamp */}
        <View style={styles.stampSection}>
          <View style={styles.stampBox}>
            <Text style={styles.stampText}>印</Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Canvi株式会社 | 東京都渋谷区xxx 1-2-3 | TEL: 03-1234-5678 |
          info@canvi.co.jp
        </Text>
      </Page>
    </Document>
  )
}
