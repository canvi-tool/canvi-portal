import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'

// Register Japanese font
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

// ---- Types ----

export interface PaymentPdfLine {
  name: string
  type: string
  amount: number
  detail: string | null
}

export interface WorkScheduleEntry {
  date: string        // YYYY-MM-DD
  dayOfWeek: string   // 月, 火, ...
  shiftType: string   // WORK, PAID_LEAVE, etc.
  shiftStart: string | null  // HH:mm
  shiftEnd: string | null
  shiftBreak: number  // minutes
  clockIn: string | null
  clockOut: string | null
  actualBreak: number
  workMinutes: number | null
  shiftMinutes: number | null
  diffMinutes: number | null  // actual - shift
  note: string | null
}

export interface PaymentDocumentData {
  title: string
  yearMonth: string
  issuedDate: string
  staff: {
    name: string
    nameKana: string
    email: string
    employmentType: string
    staffCode: string
  }
  lines: PaymentPdfLine[]
  totalAmount: number
  notes: string | null
  // 勤務表データ
  workSchedule: WorkScheduleEntry[]
  workScheduleSummary: {
    totalWorkDays: number
    totalShiftMinutes: number
    totalActualMinutes: number
    totalOvertimeMinutes: number
    paidLeaveDays: number
    absenceDays: number
  }
}

// ---- Helpers ----

function formatYen(amount: number): string {
  return `\u00a5${amount.toLocaleString('ja-JP')}`
}

function formatMinutesToHM(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60)
  const m = Math.abs(minutes) % 60
  const sign = minutes < 0 ? '-' : ''
  return `${sign}${h}:${String(m).padStart(2, '0')}`
}

function parseYearMonth(ym: string): string {
  const [y, m] = ym.split('-')
  return `${y}年${parseInt(m)}月`
}

// ---- Styles ----

const styles = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansJP',
    fontSize: 9,
    paddingTop: 40,
    paddingBottom: 50,
    paddingLeft: 40,
    paddingRight: 40,
    lineHeight: 1.5,
    color: '#1a1a1a',
  },
  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  companyInfo: {
    textAlign: 'right',
  },
  companyName: {
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 2,
  },
  companyDetail: {
    fontSize: 7,
    color: '#555',
    marginBottom: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 16,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: '#333',
    borderBottomStyle: 'solid',
  },
  // Staff info
  staffSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  staffBlock: {
    width: '48%',
  },
  staffName: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 2,
  },
  staffDetail: {
    fontSize: 8,
    color: '#555',
    marginBottom: 1,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  metaLabel: {
    width: 70,
    fontSize: 8,
    fontWeight: 700,
    color: '#555',
  },
  metaValue: {
    flex: 1,
    fontSize: 8,
    color: '#333',
  },
  // Grand total
  grandTotal: {
    marginBottom: 20,
    padding: 14,
    backgroundColor: '#333',
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: '#fff',
  },
  grandTotalAmount: {
    fontSize: 20,
    fontWeight: 700,
    color: '#fff',
  },
  // Table
  table: {
    marginBottom: 14,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#333',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableHeaderText: {
    color: '#fff',
    fontSize: 7,
    fontWeight: 700,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    borderBottomStyle: 'solid',
    paddingVertical: 4,
    paddingHorizontal: 4,
    minHeight: 22,
  },
  tableRowAlt: {
    backgroundColor: '#fafafa',
  },
  colNo: { width: '6%', textAlign: 'center', fontSize: 8 },
  colName: { width: '30%', fontSize: 8 },
  colType: { width: '18%', fontSize: 7, color: '#666' },
  colDetail: { width: '26%', fontSize: 7, color: '#666' },
  colAmount: { width: '20%', textAlign: 'right', fontSize: 8 },
  // Summary
  summarySection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  summaryTable: {
    width: 200,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    borderBottomStyle: 'solid',
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderTopWidth: 2,
    borderTopColor: '#333',
    borderTopStyle: 'solid',
  },
  summaryLabel: { fontSize: 8, color: '#555' },
  summaryValue: { fontSize: 8, fontWeight: 700 },
  summaryTotalLabel: { fontSize: 10, fontWeight: 700 },
  summaryTotalValue: { fontSize: 10, fontWeight: 700 },
  // Notes
  notesBox: {
    padding: 8,
    backgroundColor: '#f8f8f8',
    borderRadius: 4,
    marginBottom: 12,
  },
  notesLabel: {
    fontSize: 8,
    fontWeight: 700,
    marginBottom: 3,
    color: '#555',
  },
  notesText: {
    fontSize: 8,
    color: '#333',
    lineHeight: 1.6,
  },
  // Stamp
  stampSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  stampBox: {
    width: 45,
    height: 45,
    borderWidth: 1,
    borderColor: '#cc0000',
    borderStyle: 'solid',
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stampText: {
    fontSize: 6,
    color: '#cc0000',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 6,
    color: '#999',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    borderTopStyle: 'solid',
    paddingTop: 6,
  },
  // --- Work Schedule Page ---
  wsTitle: {
    fontSize: 14,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 4,
  },
  wsSubtitle: {
    fontSize: 9,
    textAlign: 'center',
    marginBottom: 12,
    color: '#555',
  },
  wsTable: {
    marginBottom: 10,
  },
  wsHeader: {
    flexDirection: 'row',
    backgroundColor: '#333',
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  wsHeaderText: {
    color: '#fff',
    fontSize: 6,
    fontWeight: 700,
    textAlign: 'center',
  },
  wsRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#ddd',
    borderBottomStyle: 'solid',
    paddingVertical: 2,
    paddingHorizontal: 2,
    minHeight: 14,
  },
  wsRowWeekend: {
    backgroundColor: '#f5f5f5',
  },
  wsRowLeave: {
    backgroundColor: '#fff8e1',
  },
  wsCell: {
    fontSize: 6,
    textAlign: 'center',
  },
  // Column widths for work schedule
  wsColDate: { width: '10%' },
  wsColDay: { width: '5%' },
  wsColType: { width: '9%' },
  wsColShiftStart: { width: '8%' },
  wsColShiftEnd: { width: '8%' },
  wsColShiftBreak: { width: '7%' },
  wsColShiftWork: { width: '8%' },
  wsColActualIn: { width: '8%' },
  wsColActualOut: { width: '8%' },
  wsColActualBreak: { width: '7%' },
  wsColActualWork: { width: '8%' },
  wsColDiff: { width: '7%' },
  wsColNote: { width: '7%' },
  // Summary card on WS page
  wsSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
    padding: 8,
    backgroundColor: '#f8f8f8',
    borderRadius: 4,
  },
  wsSummaryItem: {
    width: '30%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  wsSummaryLabel: {
    fontSize: 7,
    color: '#555',
  },
  wsSummaryValue: {
    fontSize: 7,
    fontWeight: 700,
  },
  diffPositive: { color: '#d32f2f' },
  diffNegative: { color: '#1976d2' },
})

const SHIFT_TYPE_LABELS: Record<string, string> = {
  WORK: '出勤',
  PAID_LEAVE: '有給',
  ABSENCE: '欠勤',
  HALF_DAY_LEAVE: '半休',
  SPECIAL_LEAVE: '特休',
}

// ---- Component ----

export function PaymentDocument({ data }: { data: PaymentDocumentData }) {
  const subtotal = data.lines
    .filter((l) => l.type !== '消費税')
    .reduce((sum, l) => sum + l.amount, 0)
  const taxLine = data.lines.find((l) => l.type === '消費税')
  const taxAmount = taxLine?.amount ?? 0

  return (
    <Document>
      {/* Page 1: 支払通知書 */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }} />
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>Canvi株式会社</Text>
            <Text style={styles.companyDetail}>東京都渋谷区道玄坂1-2-3</Text>
            <Text style={styles.companyDetail}>TEL: 03-1234-5678</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>支 払 通 知 書</Text>

        {/* Staff + Meta */}
        <View style={styles.staffSection}>
          <View style={styles.staffBlock}>
            <Text style={styles.staffName}>{data.staff.name} 殿</Text>
            {data.staff.nameKana ? (
              <Text style={styles.staffDetail}>{data.staff.nameKana}</Text>
            ) : null}
            <Text style={styles.staffDetail}>{data.staff.employmentType}</Text>
          </View>
          <View style={styles.staffBlock}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>発行日:</Text>
              <Text style={styles.metaValue}>{data.issuedDate}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>対象期間:</Text>
              <Text style={styles.metaValue}>{parseYearMonth(data.yearMonth)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>スタッフCD:</Text>
              <Text style={styles.metaValue}>{data.staff.staffCode}</Text>
            </View>
          </View>
        </View>

        {/* Grand Total */}
        <View style={styles.grandTotal}>
          <Text style={styles.grandTotalLabel}>お支払金額</Text>
          <Text style={styles.grandTotalAmount}>{formatYen(data.totalAmount)}</Text>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.tableHeaderText, ...styles.colNo }}>No.</Text>
            <Text style={{ ...styles.tableHeaderText, ...styles.colName }}>項目</Text>
            <Text style={{ ...styles.tableHeaderText, ...styles.colType }}>種別</Text>
            <Text style={{ ...styles.tableHeaderText, ...styles.colDetail }}>摘要</Text>
            <Text style={{ ...styles.tableHeaderText, ...styles.colAmount }}>金額</Text>
          </View>
          {data.lines.map((line, idx) => (
            <View
              key={idx}
              style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <Text style={styles.colNo}>{idx + 1}</Text>
              <Text style={styles.colName}>{line.name}</Text>
              <Text style={styles.colType}>{line.type}</Text>
              <Text style={styles.colDetail}>{line.detail || ''}</Text>
              <Text style={styles.colAmount}>{formatYen(line.amount)}</Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={styles.summarySection}>
          <View style={styles.summaryTable}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>小計</Text>
              <Text style={styles.summaryValue}>{formatYen(subtotal)}</Text>
            </View>
            {taxAmount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>消費税</Text>
                <Text style={styles.summaryValue}>{formatYen(taxAmount)}</Text>
              </View>
            )}
            <View style={styles.summaryTotalRow}>
              <Text style={styles.summaryTotalLabel}>合計</Text>
              <Text style={styles.summaryTotalValue}>{formatYen(data.totalAmount)}</Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {data.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>備考</Text>
            <Text style={styles.notesText}>{data.notes}</Text>
          </View>
        )}

        {/* Stamp */}
        <View style={styles.stampSection}>
          <View style={styles.stampBox}>
            <Text style={styles.stampText}>印</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          Canvi株式会社 | 東京都渋谷区道玄坂1-2-3 | TEL: 03-1234-5678
        </Text>
      </Page>

      {/* Page 2: 勤務表 */}
      {data.workSchedule.length > 0 && (
        <Page size="A4" orientation="landscape" style={{ ...styles.page, paddingTop: 30, paddingBottom: 40 }}>
          <Text style={styles.wsTitle}>勤 務 表</Text>
          <Text style={styles.wsSubtitle}>
            {data.staff.name}（{data.staff.staffCode}） | {parseYearMonth(data.yearMonth)}
          </Text>

          {/* Summary */}
          <View style={styles.wsSummary}>
            <View style={styles.wsSummaryItem}>
              <Text style={styles.wsSummaryLabel}>出勤日数</Text>
              <Text style={styles.wsSummaryValue}>{data.workScheduleSummary.totalWorkDays}日</Text>
            </View>
            <View style={styles.wsSummaryItem}>
              <Text style={styles.wsSummaryLabel}>シフト合計</Text>
              <Text style={styles.wsSummaryValue}>{formatMinutesToHM(data.workScheduleSummary.totalShiftMinutes)}</Text>
            </View>
            <View style={styles.wsSummaryItem}>
              <Text style={styles.wsSummaryLabel}>実労働合計</Text>
              <Text style={styles.wsSummaryValue}>{formatMinutesToHM(data.workScheduleSummary.totalActualMinutes)}</Text>
            </View>
            <View style={styles.wsSummaryItem}>
              <Text style={styles.wsSummaryLabel}>残業合計</Text>
              <Text style={styles.wsSummaryValue}>{formatMinutesToHM(data.workScheduleSummary.totalOvertimeMinutes)}</Text>
            </View>
            <View style={styles.wsSummaryItem}>
              <Text style={styles.wsSummaryLabel}>有給日数</Text>
              <Text style={styles.wsSummaryValue}>{data.workScheduleSummary.paidLeaveDays}日</Text>
            </View>
            <View style={styles.wsSummaryItem}>
              <Text style={styles.wsSummaryLabel}>欠勤日数</Text>
              <Text style={styles.wsSummaryValue}>{data.workScheduleSummary.absenceDays}日</Text>
            </View>
          </View>

          {/* Work Schedule Table */}
          <View style={styles.wsTable}>
            <View style={styles.wsHeader}>
              <Text style={{ ...styles.wsHeaderText, ...styles.wsColDate }}>日付</Text>
              <Text style={{ ...styles.wsHeaderText, ...styles.wsColDay }}>曜</Text>
              <Text style={{ ...styles.wsHeaderText, ...styles.wsColType }}>区分</Text>
              <Text style={{ ...styles.wsHeaderText, ...styles.wsColShiftStart }}>予定開始</Text>
              <Text style={{ ...styles.wsHeaderText, ...styles.wsColShiftEnd }}>予定終了</Text>
              <Text style={{ ...styles.wsHeaderText, ...styles.wsColShiftBreak }}>予定休憩</Text>
              <Text style={{ ...styles.wsHeaderText, ...styles.wsColShiftWork }}>予定労働</Text>
              <Text style={{ ...styles.wsHeaderText, ...styles.wsColActualIn }}>実出勤</Text>
              <Text style={{ ...styles.wsHeaderText, ...styles.wsColActualOut }}>実退勤</Text>
              <Text style={{ ...styles.wsHeaderText, ...styles.wsColActualBreak }}>実休憩</Text>
              <Text style={{ ...styles.wsHeaderText, ...styles.wsColActualWork }}>実労働</Text>
              <Text style={{ ...styles.wsHeaderText, ...styles.wsColDiff }}>差異</Text>
              <Text style={{ ...styles.wsHeaderText, ...styles.wsColNote }}>備考</Text>
            </View>
            {data.workSchedule.map((entry, idx) => {
              const isWeekend = entry.dayOfWeek === '土' || entry.dayOfWeek === '日'
              const isLeave = entry.shiftType !== 'WORK'
              const rowStyle = [
                styles.wsRow,
                isWeekend ? styles.wsRowWeekend : {},
                isLeave && !isWeekend ? styles.wsRowLeave : {},
              ]
              const diffStyle = entry.diffMinutes
                ? entry.diffMinutes > 0
                  ? styles.diffPositive
                  : entry.diffMinutes < 0
                    ? styles.diffNegative
                    : {}
                : {}

              return (
                <View key={idx} style={rowStyle}>
                  <Text style={{ ...styles.wsCell, ...styles.wsColDate }}>{entry.date.slice(5)}</Text>
                  <Text style={{ ...styles.wsCell, ...styles.wsColDay }}>{entry.dayOfWeek}</Text>
                  <Text style={{ ...styles.wsCell, ...styles.wsColType }}>
                    {SHIFT_TYPE_LABELS[entry.shiftType] || entry.shiftType || '-'}
                  </Text>
                  <Text style={{ ...styles.wsCell, ...styles.wsColShiftStart }}>{entry.shiftStart || '-'}</Text>
                  <Text style={{ ...styles.wsCell, ...styles.wsColShiftEnd }}>{entry.shiftEnd || '-'}</Text>
                  <Text style={{ ...styles.wsCell, ...styles.wsColShiftBreak }}>
                    {entry.shiftBreak > 0 ? `${entry.shiftBreak}m` : '-'}
                  </Text>
                  <Text style={{ ...styles.wsCell, ...styles.wsColShiftWork }}>
                    {entry.shiftMinutes != null ? formatMinutesToHM(entry.shiftMinutes) : '-'}
                  </Text>
                  <Text style={{ ...styles.wsCell, ...styles.wsColActualIn }}>{entry.clockIn || '-'}</Text>
                  <Text style={{ ...styles.wsCell, ...styles.wsColActualOut }}>{entry.clockOut || '-'}</Text>
                  <Text style={{ ...styles.wsCell, ...styles.wsColActualBreak }}>
                    {entry.actualBreak > 0 ? `${entry.actualBreak}m` : '-'}
                  </Text>
                  <Text style={{ ...styles.wsCell, ...styles.wsColActualWork }}>
                    {entry.workMinutes != null ? formatMinutesToHM(entry.workMinutes) : '-'}
                  </Text>
                  <Text style={{ ...styles.wsCell, ...styles.wsColDiff, ...diffStyle }}>
                    {entry.diffMinutes != null ? formatMinutesToHM(entry.diffMinutes) : '-'}
                  </Text>
                  <Text style={{ ...styles.wsCell, ...styles.wsColNote }}>{entry.note || ''}</Text>
                </View>
              )
            })}
          </View>

          <Text style={styles.footer}>
            Canvi株式会社 | 勤務表 | {data.staff.name} | {parseYearMonth(data.yearMonth)}
          </Text>
        </Page>
      )}
    </Document>
  )
}
