'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// 通知設定の型
export interface ProjectNotificationSettings {
  id?: string
  project_id: string
  attendance_clock_in: boolean
  attendance_clock_out: boolean
  attendance_missing: boolean
  shift_submitted: boolean
  shift_approved: boolean
  shift_rejected: boolean
  report_submitted: boolean
  report_overdue: boolean
  contract_unsigned: boolean
  payment_anomaly: boolean
  overtime_warning: boolean
  leave_requested: boolean
  member_assigned: boolean
  member_removed: boolean
  general_alert: boolean
  _isDefault?: boolean
}

// 通知イベントのカテゴリ定義
export interface NotificationCategory {
  key: string
  label: string
  icon: string
  items: {
    key: keyof ProjectNotificationSettings
    label: string
    description: string
  }[]
}

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {
    key: 'attendance',
    label: '出退勤',
    icon: '🕐',
    items: [
      { key: 'attendance_clock_in', label: '出勤通知', description: 'メンバーが出勤打刻した際に通知' },
      { key: 'attendance_clock_out', label: '退勤通知', description: 'メンバーが退勤打刻した際に通知' },
      { key: 'attendance_missing', label: '打刻漏れアラート', description: 'シフトがあるのに打刻がないメンバーを通知' },
    ],
  },
  {
    key: 'shift',
    label: 'シフト',
    icon: '📅',
    items: [
      { key: 'shift_submitted', label: 'シフト提出通知', description: 'メンバーがシフトを提出した際に通知' },
      { key: 'shift_approved', label: 'シフト承認通知', description: 'シフトが承認された際に通知' },
      { key: 'shift_rejected', label: 'シフト差戻し通知', description: 'シフトが差し戻された際に通知' },
    ],
  },
  {
    key: 'report',
    label: '勤務報告',
    icon: '📝',
    items: [
      { key: 'report_submitted', label: '日報提出通知', description: 'メンバーが日報を提出した際に通知' },
      { key: 'report_overdue', label: '日報未提出リマインド', description: '日報未提出のメンバーをリマインド' },
    ],
  },
  {
    key: 'contract',
    label: '契約',
    icon: '📄',
    items: [
      { key: 'contract_unsigned', label: '契約未締結アラート', description: '契約が未締結のまま期限が近づいた際に通知' },
    ],
  },
  {
    key: 'payment',
    label: '支払',
    icon: '💰',
    items: [
      { key: 'payment_anomaly', label: '支払異常検知', description: '支払計算に異常が検出された際に通知' },
    ],
  },
  {
    key: 'work',
    label: '勤務時間',
    icon: '⏰',
    items: [
      { key: 'overtime_warning', label: '残業警告', description: 'メンバーの残業時間が閾値を超えた際に通知' },
      { key: 'leave_requested', label: '休暇申請通知', description: 'メンバーが休暇を申請した際に通知' },
    ],
  },
  {
    key: 'member',
    label: 'メンバー',
    icon: '👥',
    items: [
      { key: 'member_assigned', label: 'メンバーアサイン通知', description: '新しいメンバーがアサインされた際に通知' },
      { key: 'member_removed', label: 'メンバー解除通知', description: 'メンバーのアサインが解除された際に通知' },
    ],
  },
  {
    key: 'general',
    label: 'その他',
    icon: '🔔',
    items: [
      { key: 'general_alert', label: '汎用アラート', description: 'その他の重要な通知' },
    ],
  },
]

// Fetcher
async function fetchNotificationSettings(projectId: string): Promise<ProjectNotificationSettings> {
  const res = await fetch(`/api/projects/${projectId}/notification-settings`)
  if (!res.ok) throw new Error('通知設定の取得に失敗しました')
  return res.json()
}

async function updateNotificationSettings(
  projectId: string,
  settings: Partial<ProjectNotificationSettings>
): Promise<ProjectNotificationSettings> {
  const res = await fetch(`/api/projects/${projectId}/notification-settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '通知設定の更新に失敗しました')
  }
  return res.json()
}

// Query Keys
export const notificationSettingsKeys = {
  all: ['notification-settings'] as const,
  detail: (projectId: string) => [...notificationSettingsKeys.all, projectId] as const,
}

// Hooks
export function useNotificationSettings(projectId: string) {
  return useQuery({
    queryKey: notificationSettingsKeys.detail(projectId),
    queryFn: () => fetchNotificationSettings(projectId),
    enabled: !!projectId,
  })
}

export function useUpdateNotificationSettings(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (settings: Partial<ProjectNotificationSettings>) =>
      updateNotificationSettings(projectId, settings),
    onSuccess: (data) => {
      queryClient.setQueryData(notificationSettingsKeys.detail(projectId), data)
    },
  })
}
