'use client'

import { useState } from 'react'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { COMPENSATION_RULE_TYPE_LABELS } from '@/lib/constants'
import type { Tables } from '@/lib/types/database'

interface PjBreakdownTableProps {
  lines: Tables<'payment_calculation_lines'>[]
  totalAmount: number
}

/**
 * 明細行をプロジェクト別（rule_type の先頭文字をヒントに）にグループ化する。
 * input_data に project_name がある場合はそれを使用する。
 * なければルール名と並び順でグループ化する。
 */
interface ProjectGroup {
  projectName: string
  lines: Tables<'payment_calculation_lines'>[]
  subtotal: number
}

function groupLinesByProject(
  lines: Tables<'payment_calculation_lines'>[]
): ProjectGroup[] {
  // input_data からプロジェクト情報を取得する試み
  // 簡易実装: sort_order で連続するルールを1つのグループとして扱う
  // 消費税行は独立グループ
  const groups: ProjectGroup[] = []
  let currentGroup: ProjectGroup | null = null

  for (const line of lines) {
    const inputData = line.input_data as Record<string, unknown> | null

    if (line.rule_type === 'tax') {
      // 消費税は独立グループ
      groups.push({
        projectName: '消費税',
        lines: [line],
        subtotal: line.amount,
      })
      continue
    }

    // 新しいグループを作成する条件
    // sort_order の連続性を見る（gapがあれば新グループ）
    const projectName =
      (inputData?.project_name as string) || '報酬明細'

    if (!currentGroup || currentGroup.projectName !== projectName) {
      currentGroup = {
        projectName,
        lines: [],
        subtotal: 0,
      }
      groups.push(currentGroup)
    }

    currentGroup.lines.push(line)
    currentGroup.subtotal += line.amount
  }

  return groups
}

function ExpandableProjectGroup({ group }: { group: ProjectGroup }) {
  const [expanded, setExpanded] = useState(true)
  const isTax = group.lines[0]?.rule_type === 'tax'

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell colSpan={3}>
          <div className="flex items-center gap-2">
            {!isTax && (
              expanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )
            )}
            <span className="font-medium">{group.projectName}</span>
            <Badge variant="outline" className="text-xs">
              {group.lines.length}件
            </Badge>
          </div>
        </TableCell>
        <TableCell className="text-right font-mono font-medium">
          {group.subtotal.toLocaleString('ja-JP')}円
        </TableCell>
      </TableRow>
      {expanded &&
        group.lines.map((line) => (
          <TableRow key={line.id} className="bg-muted/20">
            <TableCell className="pl-10">{line.rule_name}</TableCell>
            <TableCell>
              <Badge variant="secondary" className="text-xs">
                {COMPENSATION_RULE_TYPE_LABELS[line.rule_type] ?? line.rule_type}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
              {line.detail}
            </TableCell>
            <TableCell className="text-right font-mono">
              {line.amount >= 0 ? '' : '-'}
              {Math.abs(line.amount).toLocaleString('ja-JP')}円
            </TableCell>
          </TableRow>
        ))}
    </>
  )
}

export function PjBreakdownTable({ lines, totalAmount }: PjBreakdownTableProps) {
  const groups = groupLinesByProject(lines)

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">ルール名</TableHead>
            <TableHead className="w-[120px]">種別</TableHead>
            <TableHead>明細</TableHead>
            <TableHead className="text-right w-[140px]">金額</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="h-24 text-center text-muted-foreground"
              >
                明細データがありません
              </TableCell>
            </TableRow>
          ) : (
            groups.map((group, idx) => (
              <ExpandableProjectGroup key={idx} group={group} />
            ))
          )}
          {/* Grand Total */}
          {groups.length > 0 && (
            <TableRow className="border-t-2 bg-muted/30">
              <TableCell colSpan={3} className="font-bold text-base">
                合計
              </TableCell>
              <TableCell className="text-right font-mono font-bold text-base">
                {totalAmount.toLocaleString('ja-JP')}円
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
