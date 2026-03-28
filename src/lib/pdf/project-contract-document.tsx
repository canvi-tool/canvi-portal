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

export interface ProjectContractPdfData {
  contractNumber: string
  title: string
  clientName: string
  clientAddress?: string
  clientContactPerson?: string
  content?: string
  items: Array<{
    name: string
    description?: string
    quantity: number
    unit: string
    unit_price: number
    amount: number
  }>
  subtotal: number
  taxRate: number
  taxAmount: number
  totalAmount: number
  startDate?: string
  endDate?: string
  paymentTerms?: string
  notes?: string
  createdAt: string
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
  title: {
    fontSize: 20,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 24,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#333',
    borderBottomStyle: 'solid',
  },
  // Meta
  metaSection: {
    marginBottom: 16,
    padding: 10,
    backgroundColor: '#f8f8f8',
    borderRadius: 4,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  metaLabel: {
    width: 90,
    fontSize: 9,
    fontWeight: 700,
    color: '#555',
  },
  metaValue: {
    flex: 1,
    fontSize: 9,
    color: '#333',
  },
  // Parties
  partiesSection: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    borderBottomStyle: 'solid',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginTop: 16,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    borderBottomStyle: 'solid',
  },
  partiesRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  partiesLabel: {
    width: 130,
    fontWeight: 700,
    fontSize: 10,
  },
  partiesValue: {
    flex: 1,
    fontSize: 10,
  },
  partiesSubDetail: {
    fontSize: 8,
    color: '#666',
    marginLeft: 130,
    marginBottom: 2,
  },
  // Content
  contentSection: {
    marginBottom: 20,
  },
  contentText: {
    fontSize: 10,
    lineHeight: 1.8,
    marginBottom: 8,
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
  // Period & Payment
  infoSection: {
    marginBottom: 12,
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
  notesBox: {
    padding: 10,
    backgroundColor: '#f8f8f8',
    borderRadius: 4,
    marginBottom: 16,
  },
  // Signature
  signatureSection: {
    marginTop: 30,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
    borderTopStyle: 'solid',
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  signatureBlock: {
    width: '45%',
  },
  signatureLabel: {
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 8,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    borderBottomStyle: 'solid',
    height: 30,
    marginBottom: 6,
  },
  signatureCaption: {
    fontSize: 8,
    color: '#666',
  },
  stampRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  stampBlock: {
    width: '45%',
    alignItems: 'flex-end',
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
  // Date
  dateSection: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: 700,
    marginRight: 8,
  },
  dateValue: {
    fontSize: 10,
    minWidth: 120,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    borderBottomStyle: 'solid',
    textAlign: 'center',
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

export function ProjectContractDocument({
  data,
}: {
  data: ProjectContractPdfData
}) {
  const contentParagraphs = data.content
    ? data.content.split(/\n\n+/).filter((p) => p.trim().length > 0)
    : []

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Title */}
        <Text style={styles.title}>業 務 委 託 契 約 書</Text>

        {/* Meta */}
        <View style={styles.metaSection}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>契約番号:</Text>
            <Text style={styles.metaValue}>{data.contractNumber}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>契約日:</Text>
            <Text style={styles.metaValue}>{formatDate(data.createdAt)}</Text>
          </View>
          {data.startDate && data.endDate && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>契約期間:</Text>
              <Text style={styles.metaValue}>
                {formatDate(data.startDate)} 〜 {formatDate(data.endDate)}
              </Text>
            </View>
          )}
        </View>

        {/* Parties */}
        <View style={styles.partiesSection}>
          <Text style={styles.sectionTitle}>契約当事者</Text>
          <View style={styles.partiesRow}>
            <Text style={styles.partiesLabel}>甲（委託者）:</Text>
            <Text style={styles.partiesValue}>{data.clientName}</Text>
          </View>
          {data.clientAddress && (
            <Text style={styles.partiesSubDetail}>{data.clientAddress}</Text>
          )}
          {data.clientContactPerson && (
            <Text style={styles.partiesSubDetail}>
              担当: {data.clientContactPerson} 様
            </Text>
          )}
          <View style={styles.partiesRow}>
            <Text style={styles.partiesLabel}>乙（受託者）:</Text>
            <Text style={styles.partiesValue}>Canvi株式会社</Text>
          </View>
        </View>

        {/* Contract Content */}
        {contentParagraphs.length > 0 && (
          <View style={styles.contentSection}>
            <Text style={styles.sectionTitle}>契約内容</Text>
            {contentParagraphs.map((paragraph, index) => (
              <Text key={index} style={styles.contentText}>
                {paragraph.trim()}
              </Text>
            ))}
          </View>
        )}

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
          {data.items.map((item, index) => (
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
          ))}
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

        {/* Period */}
        {data.startDate && (
          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>契約期間</Text>
            <Text style={styles.infoValue}>
              {formatDate(data.startDate)}
              {data.endDate
                ? ` 〜 ${formatDate(data.endDate)}`
                : ' 〜 別途協議'}
            </Text>
          </View>
        )}

        {/* Payment Terms */}
        {data.paymentTerms && (
          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>支払条件</Text>
            <Text style={styles.infoValue}>{data.paymentTerms}</Text>
          </View>
        )}

        {/* Notes */}
        {data.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.infoLabel}>備考</Text>
            <Text style={styles.infoValue}>{data.notes}</Text>
          </View>
        )}

        {/* Date */}
        <View style={styles.dateSection}>
          <Text style={styles.dateLabel}>契約締結日:</Text>
          <Text style={styles.dateValue}>{formatDate(data.createdAt)}</Text>
        </View>

        {/* Signature Section */}
        <View style={styles.signatureSection}>
          <Text style={styles.sectionTitle}>署名欄</Text>
          <View style={styles.signatureRow}>
            <View style={styles.signatureBlock}>
              <Text style={styles.signatureLabel}>甲（委託者）</Text>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureCaption}>{data.clientName}</Text>
            </View>
            <View style={styles.signatureBlock}>
              <Text style={styles.signatureLabel}>乙（受託者）</Text>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureCaption}>Canvi株式会社</Text>
            </View>
          </View>
          <View style={styles.stampRow}>
            <View style={styles.stampBlock}>
              <View style={styles.stampBox}>
                <Text style={styles.stampText}>印</Text>
              </View>
            </View>
            <View style={styles.stampBlock}>
              <View style={styles.stampBox}>
                <Text style={styles.stampText}>印</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          本契約書は電子的に作成されました。 | Canvi株式会社
        </Text>
      </Page>
    </Document>
  )
}
