import { prisma } from '../lib/prisma'

interface AuditEntry {
  actorId: string
  entityType: string
  entityId: string
  action: string
  oldValue?: unknown
  newValue?: unknown
}

export async function createAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actor_id: entry.actorId,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        action: entry.action,
        old_value: entry.oldValue !== undefined ? (entry.oldValue as object) : undefined,
        new_value: entry.newValue !== undefined ? (entry.newValue as object) : undefined,
      },
    })
  } catch (err) {
    console.error('[AUDIT ERROR]', (err as Error).message)
  }
}
