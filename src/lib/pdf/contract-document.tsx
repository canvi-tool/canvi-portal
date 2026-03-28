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

const styles = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansJP',
    fontSize: 10,
    paddingTop: 60,
    paddingBottom: 60,
    paddingLeft: 60,
    paddingRight: 60,
    lineHeight: 1.8,
    color: '#1a1a1a',
  },
  header: {
    textAlign: 'center',
    marginBottom: 30,
  },
  companyName: {
    fontSize: 11,
    marginBottom: 4,
    color: '#555',
  },
  logoPlaceholder: {
    width: 120,
    height: 30,
    marginBottom: 10,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 8,
    color: '#999',
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 24,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#333',
    borderBottomStyle: 'solid',
  },
  partiesSection: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    borderBottomStyle: 'solid',
  },
  partiesRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  partiesLabel: {
    width: 120,
    fontWeight: 700,
    fontSize: 10,
  },
  partiesValue: {
    flex: 1,
    fontSize: 10,
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
  body: {
    fontSize: 10,
    lineHeight: 1.8,
    marginBottom: 20,
    whiteSpace: 'pre-wrap',
  },
  bodyParagraph: {
    fontSize: 10,
    lineHeight: 1.8,
    marginBottom: 8,
  },
  signatureSection: {
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
    borderTopStyle: 'solid',
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
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
  stampSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
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
    marginLeft: 16,
  },
  stampText: {
    fontSize: 7,
    color: '#cc0000',
  },
  dateSection: {
    marginTop: 20,
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
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 60,
    right: 60,
    textAlign: 'center',
    fontSize: 8,
    color: '#999',
  },
  metaInfo: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 4,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  metaLabel: {
    width: 100,
    fontSize: 9,
    fontWeight: 700,
    color: '#555',
  },
  metaValue: {
    flex: 1,
    fontSize: 9,
    color: '#333',
  },
})

export interface ContractPdfData {
  title: string
  contractNumber?: string
  companyName?: string
  staffName: string
  staffEmail?: string
  content: string
  startDate: string
  endDate?: string | null
  signedAt?: string | null
  createdAt?: string
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

function splitContentIntoParagraphs(content: string): string[] {
  return content.split(/\n\n+/).filter((p) => p.trim().length > 0)
}

export function ContractDocument({ data }: { data: ContractPdfData }) {
  const paragraphs = splitContentIntoParagraphs(data.content)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoText}>COMPANY LOGO</Text>
          </View>
          <Text style={styles.companyName}>
            {data.companyName || '株式会社キャンビ'}
          </Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{data.title}</Text>

        {/* Contract Meta Info */}
        <View style={styles.metaInfo}>
          {data.contractNumber && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>契約番号:</Text>
              <Text style={styles.metaValue}>{data.contractNumber}</Text>
            </View>
          )}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>契約期間:</Text>
            <Text style={styles.metaValue}>
              {formatDate(data.startDate)}
              {data.endDate ? ` 〜 ${formatDate(data.endDate)}` : ' 〜 無期限'}
            </Text>
          </View>
        </View>

        {/* Parties */}
        <View style={styles.partiesSection}>
          <Text style={styles.sectionTitle}>契約当事者</Text>
          <View style={styles.partiesRow}>
            <Text style={styles.partiesLabel}>甲（発注者）:</Text>
            <Text style={styles.partiesValue}>
              {data.companyName || '株式会社キャンビ'}
            </Text>
          </View>
          <View style={styles.partiesRow}>
            <Text style={styles.partiesLabel}>乙（受注者）:</Text>
            <Text style={styles.partiesValue}>{data.staffName}</Text>
          </View>
          {data.staffEmail && (
            <View style={styles.partiesRow}>
              <Text style={styles.partiesLabel}>連絡先:</Text>
              <Text style={styles.partiesValue}>{data.staffEmail}</Text>
            </View>
          )}
        </View>

        {/* Contract Body */}
        <Text style={styles.sectionTitle}>契約内容</Text>
        {paragraphs.map((paragraph, index) => (
          <Text key={index} style={styles.bodyParagraph}>
            {paragraph.trim()}
          </Text>
        ))}

        {/* Date Section */}
        <View style={styles.dateSection}>
          <Text style={styles.dateLabel}>契約日:</Text>
          <Text style={styles.dateValue}>
            {data.signedAt
              ? formatDate(data.signedAt)
              : formatDate(data.createdAt || new Date().toISOString())}
          </Text>
        </View>

        {/* Signature Section */}
        <View style={styles.signatureSection}>
          <Text style={styles.sectionTitle}>署名欄</Text>
          <View style={styles.signatureRow}>
            <View style={styles.signatureBlock}>
              <Text style={styles.signatureLabel}>甲（発注者）</Text>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureCaption}>
                {data.companyName || '株式会社キャンビ'}
              </Text>
            </View>
            <View style={styles.signatureBlock}>
              <Text style={styles.signatureLabel}>乙（受注者）</Text>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureCaption}>{data.staffName}</Text>
            </View>
          </View>

          {/* Stamp Section */}
          <View style={styles.stampSection}>
            <View style={styles.stampBox}>
              <Text style={styles.stampText}>印</Text>
            </View>
            <View style={styles.stampBox}>
              <Text style={styles.stampText}>印</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          この契約書は電子的に作成されました。 | {data.companyName || '株式会社キャンビ'}
        </Text>
      </Page>
    </Document>
  )
}
