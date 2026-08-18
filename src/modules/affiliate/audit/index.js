const { supabase } = require('../common/db');

/**
 * Logs an action to the immutable audit trail.
 */
async function logAudit(networkId, entityType, entityId, action, actor = 'SYSTEM', details = {}) {
  if (!supabase) return;
  const { error } = await supabase.from('audit_logs').insert({
    network_id: networkId || null,
    entity_type: entityType,
    entity_id: entityId,
    action,
    actor,
    details
  });
  if (error) {
    console.error(`Audit Log Failed [${entityType}:${action}]:`, error);
  }
}

module.exports = {
  logAudit
};
