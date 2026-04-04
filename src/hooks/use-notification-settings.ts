'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// 通知設定の型
export interface ProjectNotificationSettings {
  id?: string
  project_id: string

  // トグル設定
  attendance_clock_in: boolean
  attendance_clock_out: boolean
  attendance_missing: boolean
  shift_submitted: boolean
  shift_approved: boolean
  shift_rejected: boolean
  report_submitted: boolean
  report_overdue: boolean
  overtime_warning: boolean
  leave_requested: boolean
  member_assigned: boolean
  member_removed: boolean
  general_alert: boolean

  // 打刻漏れアラートのタイミング
  attendance_missing_delay_minutes: number
  attendance_missing_repeat_interval_minutes: number
  attendance_missing_max_repeats: number

  // シフト提出アラートのタイミング
  shift_submission_deadline_day: number
  shift_submission_alert_start_days_before: number
  shift_submission_alert_repeat_interval_days: number

  // 日報未提出リマインドのタイミング
  report_overdue_delay_hours: number
  report_overdue_repeat_interval_hours: number
  report_overdue_max_repeats: number

  // 残業警告の閾値
  overtime_warning_threshold_hours: number

  _isDefault?: boolean
}

// トグル可能なフィールドのキー
export type ToggleSettingKey = Extract<keyof ProjectNotificationSettings,
  | 'attendance_clock_in' | 'attendance_clock_out' | 'attendance_missing'
  | 'shift_submitted' | 'shift_approved' | 'shift_rejected'
  | 'report_submitted' | 'report_overdue'
  | 'overtime_warning' | 'leave_requested'
  | 'member_assigned' | 'member_removed'
  | 'general_alert'
>

// 数値パラメータのキー
export type NumericSettingKey = Extract<keyof ProjectNotificationSettings,
  | 'attendance_missing_delay_minutes' | 'attendance_missing_repeat_interval_minutes' | 'attendance_missing_max_repeats'
  | 'shift_submission_deadline_day' | 'shift_submission_alert_start_days_before' | 'shift_submission_alert_repeat_interval_days'
  | 'report_overdue_delay_hours' | 'report_overdue_repeat_interval_hours' | 'report_overdue_max_repeats'
  | 'overtime_warning_threshold_hours'
>

// 通知アイテムの定義
export interface NotificationItem {
  key: ToggleSettingKey
  label: string
  description: string
  // タイミング設定パラメータ（この通知に紐づく設定）
  timingParams?: {
    key: NumericSettingKey
    label: string
    unit: string
    min: number
    max: number
    step?: number
  }[]
}

// 通知イベントのカテゴリ定義
export interface NotificationCategory {
  key: string
  label: string
  icon: string
  items: NotificationItem[]
}

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {
    key: 'attendance',
    label: '出退勤',
    icon: '🕐',
    items: [
      {
        key: 'attendance_clock_in',
        label: '出勤通知',
        description: 'メンバーが出勤打刻した際に通知',
      },
      {
        key: 'attendance_clock_out',
        label: '退勤通知',
        description: 'メンバーが退勤打刻した際に通知',
      },
      {
        key: 'attendance_missing',
        label: '打刻漏れアラート',
        description: 'シフトがあるのに打刻がないメンバーを通知',
        timingParams: [
          {
            key: 'attendance_missing_delay_minutes',
            label: '初回アラートまでの時間',
            unit: '分後',
            min: 5,
            max: 120,
            step: 5,
          },
          {
            key: 'attendance_missing_repeat_interval_minutes',
            label: '繰り返し間隔',
            unit: '分ごと',
            min: 10,
            max: 120,
            step: 5,
          },
          {
            key: 'attendance_missing_max_repeats',
            label: '最大繰り返し回数',
            unit: '回',
            min: 0,
            max: 10,
          },
        ],
      },
    ],
  },
  {
    key: 'shift',
    label: 'シフト',
    icon: '📅',
    items: [
      {
        key: 'shift_submitted',
        label: 'シフト提出通知',
        description: 'メンバーがシフトを提出した際に通知',
        timingParams: [
          {
            key: 'shift_submission_deadline_day',
            label: '提出締切日（毎月）',
            unit: '日',
            min: 1,
            max: 28,
          },
          {
            key: 'shift_submission_alert_start_days_before',
            label: '締切の何日前からアラート開始',
            unit: '日前',
            min: 1,
            max: 14,
          },
          {
            key: 'shift_submission_alert_repeat_interval_days',
            label: 'アラート繰り返し間隔',
            unit: '日ごと',
            min: 1,
            max: 7,
          },
        ],
      },
      {
        key: 'shift_approved',
        label: 'シフト承認通知',
        description: 'シフトが承認された際に通知',
      },
      {
        key: 'shift_rejected',
        label: 'シフト差戻し通知',
        description: 'シフトが差し戻された際に通知',
      },
    ],
  },
  {
    key: 'report',
    label: '勤務報告',
    icon: '📝',
    items: [
      {
        key: 'report_submitted',
        label: '日報提出通知',
        description: 'メンバーが日報を提出した際に通知',
      },
      {
        key: 'report_overdue',
        label: '日報未提出リマインド',
        description: '日報未提出のメンバーをリマインド',
        timingParams: [
          {
            key: 'report_overdue_delay_hours',
            label: '退勤後リマインドまでの時間',
            unit: '時間後',
            min: 1,
            max: 24,
          },
          {
            key: 'report_overdue_repeat_interval_hours',
            label: '繰り返し間隔',
            unit: '時間ごと',
            min: 1,
            max: 24,
          },
          {
            key: 'report_overdue_max_repeats',
            label: '最大繰り返し回数',
            unit: '回',
            min: 0,
            max: 10,
          },
        ],
      },
    ],
  },
  {
    key: 'work',
    label: '勤務時間',
    icon: '⏰',
    items: [
      {
        key: 'overtime_warning',
        label: '残業警告',
        description: 'メンバーの勤務時間が閾値を超えた際に通知',
        timingParams: [
          {
            key: 'overtime_warning_threshold_hours',
            label: '警告を出す勤務時間',
            unit: '時間超過',
            min: 4,
            max: 16,
            step: 0.5,
          },
        ],
      },
      {
        key: 'leave_requested',
        label: '休暇申請通知',
        description: 'メンバーが休暇を申請した際に通知',
      },
    ],
  },
  {
    key: 'member',
    label: 'メンバー',
    icon: '👥',
    items: [
      {
        key: 'member_assigned',
        label: 'メンバーアサイン通知',
        description: '新しいメンバーがアサインされた際に通知',
      },
      {
        key: 'member_removed',
        label: 'メンバー解除通知',
        description: 'メンバーのアサインが解除された際に通知',
      },
    ],
  },
  {
    key: 'general',
    label: 'その他',
    icon: '🔔',
    items: [
      {
        key: 'general_alert',
        label: '汎用アラート',
        description: 'その他の重要な通知',
      },
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
