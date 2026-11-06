// Read-only reporting. No points, balances or payment state are changed here.
const LIMIT = 100000;
function one(value) { return Array.isArray(value) ? value[0] : value; }
function summarize(rows, kind) {
  const cents = value => Math.round(Number(value || 0) * 100);
  const total = rows.reduce((sum, row) => {
    sum.bill += cents(row.amount); sum.discount += cents(row.discount);
    sum.points += Number(row.points || 0);
    if (row.amount == null) sum.missingAmounts++;
    return sum;
  }, { bill: 0, discount: 0, points: 0, missingAmounts: 0 });
  return { count: rows.length, billAmount: total.bill / 100, discountAmount: total.discount / 100,
    points: total.points, pointsKind: kind === 'redemptions' ? 'redeemed' : 'issued',
    netAmount: total.missingAmounts ? null : (total.bill - total.discount) / 100, missingAmounts: total.missingAmounts };
}
async function discountHistory(db, records) {
  const types = new Map();
  for (let offset = 0; offset < records.length; offset += 200) {
    const ids = records.slice(offset, offset + 200).map(row => row.id);
    const result = await db.from('ae_points_requests').select('merchant_id,parameters,result')
      .in('result->redemption->>id', ids).range(0, 999);
    if (result.error) {
      if (result.error.code === '42P01' || result.error.code === 'PGRST205') return { types: new Map(), unavailable: true };
      throw new Error('Discount history unavailable');
    }
    if ((result.data || []).length === 1000) throw new Error('Discount history is incomplete');
    for (const item of result.data || []) {
      const id = item.result?.redemption?.id, type = item.parameters?.discountType;
      if (!id || !ids.includes(id) || !['flat', 'percentage'].includes(type)) continue;
      const key = item.merchant_id + ':' + id;
      const value = Number(item.parameters.discountValue);
      const info = { type, value: Number.isFinite(value) ? value : null };
      const previous = types.get(key);
      types.set(key, previous && (previous.type !== type || previous.value !== info.value) ? {type:'unknown',value:null} : info);
    }
  }
  return { types, unavailable: false };
}
function discountCounts(rows) {
  return rows.reduce((counts, row) => {
    if (row.discount > 0) { counts.total++; counts[['flat','percentage'].includes(row.discountType) ? row.discountType : 'unknown']++; }
    return counts;
  }, {total:0, flat:0, percentage:0, unknown:0});
}
function registerAdminTransactionReports(app, { auth, adminRole, db, excel }) {
  app.get('/api/admin/transaction-report', auth, adminRole, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const kind = req.query.kind || 'redemptions';
    const from = Date.parse(req.query.from), to = Date.parse(req.query.to);
    const area = String(req.query.area || '').trim(), search = String(req.query.search || '').trim().toLowerCase();
    const page = Number(req.query.page || 1), pageSize = 25;
    const discountType = req.query.discountType || 'all';
    const discountsOnly = req.query.discountsOnly === '1';
    if (!['all','flat','percentage','unknown'].includes(discountType) || (kind === 'purchases' && discountType !== 'all') || !['redemptions', 'purchases'].includes(kind) || !Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 366 * 86400000 || !Number.isSafeInteger(page) || page < 1 || area.length > 120 || search.length > 120 || (req.query.format && req.query.format !== 'xlsx')) {
      return res.status(400).json({ error: 'Choose a valid report and date range of up to one year.' });
    }
    try {
      const redemption = kind === 'redemptions';
      const fields = redemption ? 'id,customer_id,merchant_id,transaction_amount,points_redeemed,discount_percentage,discount_amount,created_at' : 'id,order_no,customer_id,merchant_id,amount,reward_points,source,created_at';
      const merchantJoin = area ? 'merchants!inner(name,merchant_code,route_name,image_url,images)' : 'merchants(name,merchant_code,route_name,image_url,images)';
      const records = [];
      // Page through every matching record; never report a first-page subtotal as a full total.
      for (let offset = 0; ; offset += 1000) {
        let query = db.from(redemption ? 'point_redemptions' : 'orders')
          .select(fields + ',customers(name,customer_code),' + merchantJoin)
          .gte('created_at', new Date(from).toISOString()).lt('created_at', new Date(to).toISOString())
          .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 999);
        if (area) query = query.eq('merchants.route_name', area);
        const result = await query;
        if (result.error) throw new Error('Report unavailable');
        records.push(...(result.data || []));
        if (records.length > LIMIT || (records.length === LIMIT && result.data.length === 1000)) return res.status(422).json({ error: 'Too many records. Choose a shorter date range.' });
        if ((result.data || []).length < 1000) break;
      }
      if (req.query.summaryOnly === '1' && !search && discountType === 'all') {
        return res.json({discountCount: redemption ? records.filter(row => Number(row.discount_amount) > 0).length : 0});
      }
      const history = redemption ? await discountHistory(db, records) : {types:new Map(), unavailable:false};
      const matched = records.map(record => {
        const customer = one(record.customers), merchant = one(record.merchants);
        const info = history.types.get(record.merchant_id + ':' + record.id);
        const photo = merchant?.image_url || merchant?.images?.[0] || '';
        return { id: record.id, reference: record.order_no || record.id, timestamp: record.created_at,
          customer: customer?.name || '', customerCode: customer?.customer_code || '',
          merchant: merchant?.name || '', merchantCode: merchant?.merchant_code || '', area: merchant?.route_name || '',
          merchantPhoto: typeof photo === 'string' && /^https?:\/\//i.test(photo) ? photo : '',
          discountType: info?.type || 'unknown', discountValue: info?.value ?? null,
          amount: (redemption ? record.transaction_amount : record.amount) == null ? null : Number(redemption ? record.transaction_amount : record.amount),
          points: Number(redemption ? record.points_redeemed : record.reward_points) || 0,
          discount: redemption ? Number(record.discount_amount) || 0 : 0, source: record.source || '' };
      }).filter(row => !search || [row.reference, row.customer, row.customerCode, row.merchant, row.merchantCode].some(value => String(value).toLowerCase().includes(search)));
      const counts = discountCounts(matched);
      const eligible = discountsOnly ? matched.filter(row => row.discount > 0) : matched;
      const rows = discountType === 'all' ? eligible : eligible.filter(row => row.discount > 0 && row.discountType === discountType);
      const summary = { ...summarize(rows, kind), discountCounts: counts, discountHistoryUnavailable: history.unavailable };
      if (req.query.format === 'xlsx') {
        const output = rows.map(row => ({ 'Record ID': row.id, 'Reference': row.reference, 'Date and time (IST)': new Date(row.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), Customer: row.customer, 'Customer code': row.customerCode, Shop: row.merchant, 'Merchant code': row.merchantCode, Area: row.area, 'Bill amount (INR)': row.amount, [redemption ? 'Points redeemed' : 'Points issued']: row.points, 'Discount type': row.discountType, 'Configured discount value': row.discountValue, 'Merchant photo': row.merchantPhoto, 'Discount (INR)': row.discount, 'Net bill (INR)': row.amount == null ? null : Math.round((row.amount - row.discount) * 100) / 100 }));
        return await excel(res, output, 'AE-' + kind + '-report', ['Recorded AE transactions; net bill does not verify payment receipt.', 'From ' + new Date(from).toISOString() + ' to ' + new Date(to).toISOString() + ' (end exclusive).', 'Matching records: ' + summary.count + '; points: ' + summary.points + '; discount INR: ' + summary.discountAmount]);
      }
      res.json({ records: rows.slice((page - 1) * pageSize, page * pageSize), summary,
        pagination: { page, pageSize, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / pageSize)) } });
    } catch (error) {
      if (!res.headersSent) res.status(503).json({ error: 'The transaction report could not be loaded. Please retry.' });
    }
  });
}
module.exports = { registerAdminTransactionReports, summarize, discountHistory, discountCounts };
