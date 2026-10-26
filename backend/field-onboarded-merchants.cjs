function coordinate(value, maximum) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= maximum ? number : null;
}

function mapOnboardedMerchants(records, merchants) {
  const first = new Map();
  for (const row of records) {
    if (!row.merchant_id || !Number.isFinite(Date.parse(row.created_at))) continue;
    const existing = first.get(row.merchant_id);
    if (!existing || Date.parse(row.created_at) < Date.parse(existing.created_at)) first.set(row.merchant_id, row);
  }
  const rows = merchants.filter(row => first.has(row.id)).map(row => {
    const latitude = coordinate(row.latitude, 90), longitude = coordinate(row.longitude, 180);
    const located = latitude !== null && longitude !== null;
    return {
      id: row.id, name: row.name, merchant_code: row.merchant_code,
      address: row.address || '', category_id: row.category_id || undefined,
      merchant_categories: row.merchant_categories || null,
      latitude: located ? latitude : null, longitude: located ? longitude : null,
      onboarded_at: first.get(row.id).created_at,
    };
  }).sort((a, b) => Date.parse(b.onboarded_at) - Date.parse(a.onboarded_at) || a.id.localeCompare(b.id));
  return { merchants: rows, missingLocations: rows.filter(row => row.latitude === null).length };
}

async function readOnboardedMerchants(db, managerId) {
  const records = [];
  for (let offset = 0; ; offset += 500) {
    const result = await db.from('field_manager_merchant_updates')
      .select('id,merchant_id,created_at')
      .eq('manager_id', managerId).eq('status', 'approved').eq('payload->>action', 'onboard_merchant')
      .order('created_at', { ascending: true }).order('id', { ascending: true }).range(offset, offset + 499);
    if (result.error) throw new Error('Onboarding records unavailable');
    records.push(...result.data);
    if (result.data.length < 500) break;
  }
  const ids = [...new Set(records.map(row => row.merchant_id).filter(Boolean))];
  const merchants = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const result = await db.from('merchants')
      .select('id,name,merchant_code,address,latitude,longitude,category_id,merchant_categories(name)')
      .in('id', ids.slice(offset, offset + 100));
    if (result.error) throw new Error('Saved shop locations unavailable');
    merchants.push(...result.data);
  }
  return mapOnboardedMerchants(records, merchants);
}

function registerFieldOnboardingMaps(app, { auth, fieldRole, adminRole, db }) {
  async function respond(managerId, res) {
    try {
      res.setHeader('Cache-Control', 'no-store');
      return res.json(await readOnboardedMerchants(db, managerId));
    } catch {
      return res.status(503).json({ error: 'Onboarded shop locations are unavailable. Please retry.' });
    }
  }
  app.get('/api/field/onboarded-merchants', auth, fieldRole, (req, res) => respond(req.auth.profile.id, res));
  app.get('/api/admin/field-managers/:id/onboarded-merchants', auth, adminRole, async (req, res) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) return res.status(400).json({ error: 'Invalid field manager.' });
    const profile = await db.from('profiles').select('id').eq('id', req.params.id).eq('role', 'field_manager').maybeSingle();
    if (profile.error) return res.status(503).json({ error: 'Field manager unavailable.' });
    if (!profile.data) return res.status(404).json({ error: 'Field manager not found.' });
    return respond(req.params.id, res);
  });
}

module.exports = { coordinate, mapOnboardedMerchants, readOnboardedMerchants, registerFieldOnboardingMaps };
