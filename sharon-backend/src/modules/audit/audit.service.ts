import { randomUUID } from 'crypto';
import { AuditLog } from '../../common/types';
import { db } from '../../database/db';

export class AuditService {
  static log(data: {
    network_id?: string;
    entity_type: string;
    entity_id: string;
    action: string;
    actor?: string;
    details?: Record<string, any>;
  }): AuditLog {
    const entry: AuditLog = {
      id: randomUUID(),
      network_id: data.network_id,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      action: data.action,
      actor: data.actor || 'SYSTEM',
      details: data.details || {},
      created_at: new Date().toISOString()
    };
    db.auditLogs.set(entry.id, entry);
    return entry;
  }

  static getAuditHistory(entityType: string, entityId: string): AuditLog[] {
    const logs: AuditLog[] = [];
    for (const log of db.auditLogs.values()) {
      if (log.entity_type.toLowerCase() === entityType.toLowerCase() && log.entity_id === entityId) {
        logs.push(log);
      }
    }
    return logs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }
}
