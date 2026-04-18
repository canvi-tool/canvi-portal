// ============================================================
// PATCH  /api/super-admin/tenants/:id   部分更新 + propagation
// DELETE /api/super-admin/tenants/:id   論理削除 (status='deleted') + propagation
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/rbac'
import { requireSuperAdmin } from '@/lib/auth/super-admin'
import { ALL_SERVICES, propagateTenant, type ServiceKey } from '@/lib/tenant-sync'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  contact_email: z.string().email().nullable().optional(),
  status: z.enum(['active', 'suspended', 'deleted']).optional(),
  enabled_services: z
    .array(z.enum(ALL_SERVICES as [ServiceKey, ...ServiceKey[]]))
    .optional(),
})

async function loadTenant(id: string) {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any
  const { data, error } = await sb
    .from('master_tenants')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  return { data, error, sb }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const user = await getCurrentUser()
  const guard = requireSuperAdmin(user)
  if (guard) return guard

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { data: existing, error: loadErr, sb } = await loadTenant(params.id)
  if (loadErr || !existing) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  const { data, error } = await sb
    .from('master_tenants')
    .update(parsed.data)
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const syncResults = await propagateTenant(
    {
      canonical_id: data.canonical_id,
      name: data.name,
      slug: data.slug,
      contact_email: data.contact_email,
      status: data.status,
    },
    (data.enabled_services ?? []) as ServiceKey[],
  )

  return NextResponse.json({ tenant: data, sync: syncResults })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const user = await getCurrentUser()
  const guard = requireSuperAdmin(user)
  if (guard) return guard

  const { data: existing, error: loadErr, sb } = await loadTenant(params.id)
  if (loadErr || !existing) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  const { data, error } = await sb
    .from('master_tenants')
    .update({ status: 'deleted' })
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const syncResults = await propagateTenant(
    {
      canonical_id: data.canonical_id,
      name: data.name,
      slug: data.slug,
      contact_email: data.contact_email,
      status: 'deleted',
    },
    (data.enabled_services ?? []) as ServiceKey[],
  )

  return NextResponse.json({ tenant: data, sync: syncResults })
}
