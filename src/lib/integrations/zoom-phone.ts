/**
 * Zoom Phone API クライアント
 *
 * Zoom Phoneのコールキュー、電話番号、通話ログ管理を提供します。
 * zoom.ts の認証基盤を利用します。
 *
 * 必要な環境変数: zoom.ts と同じ
 */

import { getAccessToken, ZoomApiError, ZoomPhoneNumber } from './zoom'

// ============================================================
// Types
// ============================================================

export type { ZoomPhoneNumber }

export interface ZoomCallQueue {
  id: string
  name: string
  extension_number: string
  description: string
  status: 'active' | 'inactive'
  site_id: string
  phone_numbers: ZoomPhoneNumber[]
  members: ZoomCallQueueMember[]
  distribution_type: 'simultaneous' | 'sequential' | 'rotating' | 'longest_idle'
  max_wait_time: number
  business_hours: ZoomBusinessHours
}

export interface ZoomCallQueueMember {
  id: string
  email: string
  name: string
  extension_number: string
  receive_call: boolean
  status: 'available' | 'offline'
}

export interface ZoomBusinessHours {
  type: 'custom' | '24hours'
  timezone: string
  schedule?: Array<{
    weekday: number // 1=Sun, 2=Mon, ... 7=Sat
    from: string
    to: string
  }>
}

export interface ZoomCallLog {
  id: string
  caller_number: string
  callee_number: string
  direction: 'inbound' | 'outbound'
  duration: number
  result: 'answered' | 'missed' | 'voicemail' | 'busy'
  date_time: string
  recording_url?: string
}

export interface CreateCallQueueParams {
  name: string
  extension_number?: string
  description?: string
  site_id?: string
  distribution_type?: 'simultaneous' | 'sequential' | 'rotating' | 'longest_idle'
  max_wait_time?: number
}

export interface UpdateCallQueueParams {
  name?: string
  description?: string
  distribution_type?: 'simultaneous' | 'sequential' | 'rotating' | 'longest_idle'
  max_wait_time?: number
  status?: 'active' | 'inactive'
}

export interface CallQueueMemberParams {
  id: string
  receive_call?: boolean
}

interface ZoomListCallQueuesResponse {
  total_records: number
  call_queues: ZoomCallQueue[]
  page_size: number
  next_page_token: string
}

interface ZoomListPhoneNumbersResponse {
  total_records: number
  phone_numbers: ZoomPhoneNumber[]
  page_size: number
  next_page_token: string
}

interface ZoomListCallLogsResponse {
  total_records: number
  call_logs: ZoomCallLog[]
  page_size: number
  next_page_token: string
}

interface ZoomListQueueMembersResponse {
  total_records: number
  members: ZoomCallQueueMember[]
  page_size: number
  next_page_token: string
}

// ============================================================
// Internal request helper
// ============================================================

async function phoneRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  attempt = 1
): Promise<T> {
  const maxRetries = 3
  const token = await getAccessToken()
  const baseUrl = 'https://api.zoom.us/v2'
  const url = `${baseUrl}${path}`

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (res.status === 204) {
      return {} as T
    }

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({
        code: 0,
        message: `HTTP ${res.status}: ${res.statusText}`,
      }))
      throw new ZoomApiError(
        String(errorBody.code || 'UNKNOWN'),
        errorBody.message || `HTTP ${res.status}`,
        res.status
      )
    }

    return (await res.json()) as T
  } catch (err) {
    if (err instanceof ZoomApiError) {
      if (attempt < maxRetries && (err.statusCode === 429 || err.statusCode >= 500)) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10_000)
        await new Promise((resolve) => setTimeout(resolve, delay))
        return phoneRequest<T>(method, path, body, attempt + 1)
      }
      throw err
    }
    if (attempt < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10_000)
      await new Promise((resolve) => setTimeout(resolve, delay))
      return phoneRequest<T>(method, path, body, attempt + 1)
    }
    throw new ZoomApiError(
      'NETWORK_ERROR',
      err instanceof Error ? err.message : 'ネットワークエラーが発生しました',
      0
    )
  }
}

// ============================================================
// Call Queue Management
// ============================================================

/**
 * コールキュー一覧を取得する
 */
export async function listCallQueues(
  pageSize = 30,
  nextPageToken?: string
): Promise<ZoomListCallQueuesResponse> {
  let path = `/phone/call_queues?page_size=${pageSize}`
  if (nextPageToken) path += `&next_page_token=${encodeURIComponent(nextPageToken)}`
  return phoneRequest<ZoomListCallQueuesResponse>('GET', path)
}

/**
 * コールキュー詳細を取得する（メンバー含む）
 */
export async function getCallQueue(queueId: string): Promise<ZoomCallQueue> {
  return phoneRequest<ZoomCallQueue>('GET', `/phone/call_queues/${encodeURIComponent(queueId)}`)
}

/**
 * コールキューを作成する
 */
export async function createCallQueue(params: CreateCallQueueParams): Promise<ZoomCallQueue> {
  return phoneRequest<ZoomCallQueue>('POST', '/phone/call_queues', params)
}

/**
 * コールキューを更新する
 */
export async function updateCallQueue(
  queueId: string,
  params: UpdateCallQueueParams
): Promise<void> {
  await phoneRequest<Record<string, never>>(
    'PATCH',
    `/phone/call_queues/${encodeURIComponent(queueId)}`,
    params
  )
}

/**
 * コールキューを削除する
 */
export async function deleteCallQueue(queueId: string): Promise<void> {
  await phoneRequest<Record<string, never>>(
    'DELETE',
    `/phone/call_queues/${encodeURIComponent(queueId)}`
  )
}

/**
 * コールキューのメンバー一覧を取得する
 */
export async function listQueueMembers(
  queueId: string,
  pageSize = 30,
  nextPageToken?: string
): Promise<ZoomListQueueMembersResponse> {
  let path = `/phone/call_queues/${encodeURIComponent(queueId)}/members?page_size=${pageSize}`
  if (nextPageToken) path += `&next_page_token=${encodeURIComponent(nextPageToken)}`
  return phoneRequest<ZoomListQueueMembersResponse>('GET', path)
}

/**
 * コールキューにメンバーを追加する
 */
export async function addQueueMembers(
  queueId: string,
  members: CallQueueMemberParams[]
): Promise<void> {
  await phoneRequest<Record<string, never>>(
    'POST',
    `/phone/call_queues/${encodeURIComponent(queueId)}/members`,
    { members: members.map((m) => ({ id: m.id, receive_call: m.receive_call ?? true })) }
  )
}

/**
 * コールキューからメンバーを削除する
 */
export async function removeQueueMembers(
  queueId: string,
  memberIds: string[]
): Promise<void> {
  const ids = memberIds.join(',')
  await phoneRequest<Record<string, never>>(
    'DELETE',
    `/phone/call_queues/${encodeURIComponent(queueId)}/members?member_ids=${encodeURIComponent(ids)}`
  )
}

// ============================================================
// Phone Numbers
// ============================================================

/**
 * 電話番号一覧を取得する
 */
export async function listPhoneNumbers(
  pageSize = 30,
  nextPageToken?: string,
  assigneeType?: 'user' | 'callQueue' | 'autoReceptionist' | 'unassigned'
): Promise<ZoomListPhoneNumbersResponse> {
  let path = `/phone/numbers?page_size=${pageSize}`
  if (nextPageToken) path += `&next_page_token=${encodeURIComponent(nextPageToken)}`
  if (assigneeType) path += `&type=${encodeURIComponent(assigneeType)}`
  return phoneRequest<ZoomListPhoneNumbersResponse>('GET', path)
}

/**
 * 電話番号を割り当てる
 */
export async function assignPhoneNumber(
  numberId: string,
  assigneeId: string,
  assigneeType: 'user' | 'callQueue' | 'autoReceptionist'
): Promise<void> {
  await phoneRequest<Record<string, never>>(
    'PATCH',
    `/phone/numbers/${encodeURIComponent(numberId)}`,
    {
      assignee: {
        id: assigneeId,
        type: assigneeType,
      },
    }
  )
}

// ============================================================
// Call Logs
// ============================================================

/**
 * 通話ログを取得する
 */
export async function getCallLogs(
  from: string,
  to: string,
  userId?: string,
  pageSize = 30,
  nextPageToken?: string
): Promise<ZoomListCallLogsResponse> {
  const basePath = userId
    ? `/phone/users/${encodeURIComponent(userId)}/call_logs`
    : '/phone/call_logs'
  let path = `${basePath}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&page_size=${pageSize}`
  if (nextPageToken) path += `&next_page_token=${encodeURIComponent(nextPageToken)}`
  return phoneRequest<ZoomListCallLogsResponse>('GET', path)
}

// ============================================================
// User Phone Settings
// ============================================================

export interface ZoomUserPhoneSettings {
  extension_number: string
  calling_plans: Array<{ type: number; name: string }>
  phone_numbers: ZoomPhoneNumber[]
  status: 'activate' | 'deactivate'
}

/**
 * ユーザーの電話設定を取得する
 */
export async function getUserPhoneSettings(userId: string): Promise<ZoomUserPhoneSettings> {
  return phoneRequest<ZoomUserPhoneSettings>(
    'GET',
    `/phone/users/${encodeURIComponent(userId)}/settings`
  )
}

/**
 * ユーザーの電話設定を更新する
 */
export async function updateUserPhoneSettings(
  userId: string,
  settings: Partial<Pick<ZoomUserPhoneSettings, 'extension_number' | 'status'>>
): Promise<void> {
  await phoneRequest<Record<string, never>>(
    'PATCH',
    `/phone/users/${encodeURIComponent(userId)}/settings`,
    settings
  )
}
