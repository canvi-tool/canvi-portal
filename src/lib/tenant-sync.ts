// ============================================================
// Tenant propagation
//
// Portal の master_tenants に対する CRUD を、各サービスDBの tenants テーブルへ
// 伝播（propagation）させるためのユーティリティ。
//
// 各サービスは独立DB（Supabase 別プロジェクト or 独立Postgres）であり、
// - Supabase系: PostgREST (`/rest/v1/tenants`) を service_role key で叩く
// - Canvas:     独自 admin API（X-Admin-Key ヘッダ）を叩く
//
// canonical_id = 各サービスDBの tenants.id と一致させる UUID。
// Portal 側の master_tenants.canonical_id と各サービス tenants.id は 1:1 で揃える。
// ============================================================

export type ServiceKey = 'canvas' | 'teleapo' | 'ai-shachiku' | 'opemane' | 'tatsujin'

export const ALL_SERVICES: ServiceKey[] = [
  'canvas',
  'teleapo',
  'ai-shachiku',
  'opemane',
  'tatsujin',
]

export const SERVICE_LABELS: Record<ServiceKey, string> = {
  canvas: 'Canvas',
  teleapo: 'テレアポくん',
  'ai-shachiku': 'AI社畜',
  opemane: 'オペマネ',
  tatsujin: '達人',
}

export interface MasterTenantPayload {
  canonical_id: string
  name: string
  slug: string
  contact_email: string | null
  status: 'active' | 'suspended' | 'deleted'
}

type SupabaseEndpoint = {
  kind: 'supabase'
  supabaseUrl: string | undefined
  serviceRoleKey: string | undefined
}

type CanvasEndpoint = {
  kind: 'canvas'
  url: string | undefined
  adminKey: string | undefined
}

type Endpoint = SupabaseEndpoint | CanvasEndpoint

/**
 * 各サービスの propagation 先エンドポイント。
 * 全て環境変数から読む（未設定なら該当サービスは skip + warn 返却）。
 */
export function getServiceEndpoints(): Record<ServiceKey, Endpoint> {
  return {
    canvas: {
      kind: 'canvas',
      url: process.env.CANVAS_API_URL ?? 'https://canvas.canvi.co.jp',
      adminKey: process.env.CANVAS_ADMIN_KEY,
    },
    teleapo: {
      kind: 'supabase',
      supabaseUrl: process.env.TELEAPO_SUPABASE_URL,
      serviceRoleKey: process.env.TELEAPO_SUPABASE_SERVICE_ROLE_KEY,
    },
    'ai-shachiku': {
      kind: 'supabase',
      supabaseUrl: process.env.AI_SHACHIKU_SUPABASE_URL,
      serviceRoleKey: process.env.AI_SHACHIKU_SUPABASE_SERVICE_ROLE_KEY,
    },
    opemane: {
      kind: 'supabase',
      supabaseUrl: process.env.OPEMANE_SUPABASE_URL,
      serviceRoleKey: process.env.OPEMANE_SUPABASE_SERVICE_ROLE_KEY,
    },
    tatsujin: {
      kind: 'supabase',
      supabaseUrl: process.env.TATSUJIN_SUPABASE_URL,
      serviceRoleKey: process.env.TATSUJIN_SUPABASE_SERVICE_ROLE_KEY,
    },
  }
}

export interface SyncResult {
  service: ServiceKey
  ok: boolean
  skipped: boolean
  status?: number
  error?: string
}

/**
 * Supabase PostgREST で tenants を UPSERT。
 * primary key は id（= canonical_id）を想定。
 */
async function upsertToSupabase(
  endpoint: SupabaseEndpoint,
  tenant: MasterTenantPayload,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!endpoint.supabaseUrl || !endpoint.serviceRoleKey) {
    return { ok: false, error: 'missing_env' }
  }

  const body = [
    {
      id: tenant.canonical_id,
      name: tenant.name,
      slug: tenant.slug,
      contact_email: tenant.contact_email,
      status: tenant.status,
    },
  ]

  const res = await fetch(`${endpoint.supabaseUrl}/rest/v1/tenants?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: endpoint.serviceRoleKey,
      Authorization: `Bearer ${endpoint.serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { ok: false, status: res.status, error: text.slice(0, 500) }
  }
  return { ok: true, status: res.status }
}

/**
 * Canvas 独自 API での UPSERT。
 * POST {CANVAS_API_URL}/api/admin/tenants  X-Admin-Key: CANVAS_ADMIN_KEY
 */
async function upsertToCanvas(
  endpoint: CanvasEndpoint,
  tenant: MasterTenantPayload,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!endpoint.url || !endpoint.adminKey) {
    return { ok: false, error: 'missing_env' }
  }
  const res = await fetch(`${endpoint.url.replace(/\/$/, '')}/api/admin/tenants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': endpoint.adminKey,
    },
    body: JSON.stringify({
      id: tenant.canonical_id,
      name: tenant.name,
      slug: tenant.slug,
      contact_email: tenant.contact_email,
      status: tenant.status,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { ok: false, status: res.status, error: text.slice(0, 500) }
  }
  return { ok: true, status: res.status }
}

async function syncTenantTo(
  service: ServiceKey,
  tenant: MasterTenantPayload,
): Promise<SyncResult> {
  const endpoints = getServiceEndpoints()
  const ep = endpoints[service]
  try {
    let r: { ok: boolean; status?: number; error?: string }
    if (ep.kind === 'canvas') {
      r = await upsertToCanvas(ep, tenant)
    } else {
      r = await upsertToSupabase(ep, tenant)
    }
    if (!r.ok && r.error === 'missing_env') {
      return { service, ok: false, skipped: true, error: 'missing_env' }
    }
    return { service, ok: r.ok, skipped: false, status: r.status, error: r.error }
  } catch (e) {
    return {
      service,
      ok: false,
      skipped: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

/**
 * master_tenants の変更を、enabled サービスへ並列 propagation。
 * status='deleted' の場合も UPSERT（各サービスDBで論理削除として status を持つ想定）。
 */
export async function propagateTenant(
  tenant: MasterTenantPayload,
  enabledServices: ServiceKey[],
): Promise<SyncResult[]> {
  const targets = enabledServices.filter((s) => ALL_SERVICES.includes(s))
  const results = await Promise.all(targets.map((svc) => syncTenantTo(svc, tenant)))
  return results
}
