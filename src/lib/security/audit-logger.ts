import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/types/database'

export type AuditAction = 'create' | 'read' | 'update' | 'delete' | 'export' | 'login' | 'logout' | 'permission_change'

interface AuditLogEntry {
  userId: string
  action: AuditAction
  resource: string
  resourceId?: string
  oldData?: Record<string, unknown>
  newData?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

/**
 * Enterprise audit logger - records security-relevant actions
 * Non-blocking: errors are logged but don't affect the calling function
 */
export async function auditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = createAdminClient()
    await supabase.from('audit_logs').insert({
      user_id: entry.userId,
      action: entry.action,
      resource: entry.resource,
      resource_id: entry.resourceId || null,
      old_data: (entry.oldData as Record<string, Json>) || null,
      new_data: (entry.newData as Record<string, Json>) || null,
    })
  } catch (error) {
    // Non-blocking - log error but don't throw
    console.error('[AuditLog] Failed to write audit log:', error)
  }
}

/**
 * Log sensitive data access for compliance
 */
export async function auditSensitiveAccess(
  userId: string,
  resource: string,
  resourceId: string,
  accessType: string
): Promise<void> {
  await auditLog({
    userId,
    action: 'read',
    resource,
    resourceId,
    newData: {
      access_type: accessType,
      accessed_at: new Date().toISOString(),
      ip_info: 'server-side',
    },
  })
}
