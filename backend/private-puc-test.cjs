const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { registration } = require('./puc-register.cjs');
const ISSUER = 'ae-private-puc-test';
const pointsFor = (amount, rate) => amount < 10 ? 1 : amount < 50 ? 2 : amount < 100 ? 5 : Math.min(100, Math.round(amount * rate) / 100);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// These identities never enter Supabase merchants, profiles, customers or orders.
// Every authenticated sandbox request terminates here; it cannot reach live handlers.
function privatePucTest({ database, signingKey, rewards, adminAuth, adminRole }) {
  const secret = signingKey ? crypto.createHmac('sha256', signingKey).update(ISSUER).digest('hex') : null;
  const accountRef = (db, id) => db.collection('ae_private_puc_tests').doc(id);
  const passwordFor = id => 'Ae!9' + crypto.createHmac('sha256', secret).update('password:' + id).digest('base64url').slice(0, 20);
  const publicUser = account => ({ id: account.id, merchant_id: account.id, email: account.email, full_name: 'AE PUC TEST · TEST ONLY', role: 'merchant', must_change_password: false, testAccount: true });
  const tokens = account => ({ accessToken: jwt.sign({ sandbox: true, kind: 'access' }, secret, { algorithm: 'HS256', issuer: ISSUER, audience: ISSUER, subject: account.id, expiresIn: '8h' }), refreshToken: jwt.sign({ sandbox: true, kind: 'refresh' }, secret, { algorithm: 'HS256', issuer: ISSUER, audience: ISSUER, subject: account.id, expiresIn: '7d' }) });
  const decodeSandbox = token => { try { return jwt.decode(token)?.iss === ISSUER; } catch { return false; } };
  const readAccount = async token => {
    const claims = jwt.verify(token, secret, { algorithms: ['HS256'], issuer: ISSUER, audience: ISSUER });
    const db = await database(), doc = await accountRef(db, claims.sub).get(), account = doc.data();
    if (!doc.exists || account.disabled || account.liveMerchantId || account.expiresAt <= Date.now()) throw Error('Expired test account');
    return { claims, account, db };
  };
  const create = async (req, res) => {
    if (!secret) return res.status(503).json({ error: 'Private test accounts are unavailable.' });
    const key = req.body.requestId;
    if (!/^[a-f0-9-]{36}$/.test(key || '')) return res.status(400).json({ error: 'Invalid test-account request.' });
    const id = hash(req.auth.profile.id + ':' + key).slice(0, 32), password = passwordFor(id);
    const account = { id, code: 'TESTPUC' + id.slice(0, 8).toUpperCase(), email: 'puc-' + id + '@ae.invalid', phone: '0000000000', name: 'AE PUC TEST · TEST ONLY', category: 'Polution Testing centre', createdBy: req.auth.profile.id, createdAt: Date.now(), expiresAt: Date.now() + 30 * 86400000, passwordHash: hash(password), disabled: false };
    const db = await database(), ref = accountRef(db, id);
    const saved = await db.runTransaction(async tx => { const old = await tx.get(ref); if (old.exists) return old.data(); tx.set(ref, account); return account; });
    res.status(201).json({ merchantCode: saved.code, loginEmail: saved.email, temporaryPassword: password, testAccount: true, expiresAt: saved.expiresAt, whatsapp: { sent: false, status: 'disabled_test_account', error: null } });
  };
  const middleware = async (req, res, next) => {
    if (!req.path.startsWith('/api/')) return next();
    const login = req.path === '/api/auth/login' && req.method === 'POST';
    const identifier = String(req.body?.email || '').trim().toLowerCase();
    const testLogin = login && (identifier === 'puctest@gmail.com' || /^testpuc[a-f0-9]{8}$/i.test(identifier) || /^puc-[a-f0-9]{32}@ae\.invalid$/.test(identifier));
    const refresh = req.path === '/api/auth/refresh' && req.method === 'POST' && decodeSandbox(req.body?.refreshToken);
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
    if (!testLogin && !refresh && !decodeSandbox(bearer)) return next();
    res.set('Cache-Control', 'no-store');
    if (!secret) return res.status(503).json({ error: 'Private test accounts are unavailable.' });
    try {
      if (testLogin) {
        const db = await database(), field = identifier.includes('@') ? 'email' : 'code', value = field === 'code' ? identifier.toUpperCase() : identifier;
        const docs = await db.collection('ae_private_puc_tests').where(field, '==', value).limit(1).get();
        const account = docs.docs[0]?.data();
        if(account?.liveMerchantId){req.body.email=account.email;return next();}
        if (!account || account.disabled || account.expiresAt <= Date.now() || !equal(hash(String(req.body.password || '')), account.passwordHash)) return res.status(401).json({ error: 'Invalid email or password' });
        return res.json({ success: true, ...tokens(account), user: publicUser(account) });
      }
      let session;
      try { session = await readAccount(refresh ? req.body.refreshToken : bearer); } catch { return res.status(401).json({ error: 'Sign in again to your PUC test account.' }); }
      const { account, claims, db } = session;
      if (refresh) return claims.kind === 'refresh' ? res.json(tokens(account)) : res.status(401).json({ error: 'Invalid refresh session.' });
      if (claims.kind !== 'access') return res.status(401).json({ error: 'Invalid test session.' });
      if (req.path === '/api/auth/me' && req.method === 'GET') return res.json({ success: true, user: publicUser(account) });
      // Synthetic identities do not accept or record real merchant contracts.
      if (req.path === '/api/profile/legal' && req.method === 'GET') return res.json({ enabled: false, accepted: false, termsVersion: 'private-test-only', privacyVersion: 'private-test-only', testAccount: true });
      if (req.path === '/api/merchant/puc/config' && req.method === 'GET') { const config = await rewards(); return res.json({ eligible: true, shopName: account.name, earnOptions: config.earnOptions, testAccount: true }); }
      const records = accountRef(db, account.id).collection('registrations');
      if (/^\/api\/merchant\/puc\/records\/[a-f0-9]{64}\/reminder$/.test(req.path) && req.method === 'POST') return res.json({success:true,testAccount:true,message:'Test preview only: PUC shop renewal reminder. Customer, vehicle, expiry, shop name and location will be filled from the saved record. No WhatsApp message was sent.'});
      if (req.path === '/api/merchant/puc/records/batch-reminders' && req.method === 'POST') {
        const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
        return res.json({ success: true, testAccount: true, processed: ids.length, whatsappAccepted: ids.length, pushAccepted: ids.length, message: `Test preview: Sent ${ids.length} WhatsApp & Push reminder(s).` });
      }
      if (req.path === '/api/merchant/puc/records' && req.method === 'POST') {
        let value; try { value = registration(req.body); } catch (e) { return res.status(400).json({ error: e.message }); }
        const config = await rewards();
        if (!config.earnOptions.includes(value.rate)) return res.status(400).json({ error: 'Choose a current official reward rate.' });
        const key = req.get('Idempotency-Key');
        if (!/^[a-zA-Z0-9-]{16,80}$/.test(key || '')) return res.status(400).json({ error: 'Reopen the registration form before saving.' });
        const id = hash(account.id + ':' + key), fingerprint = hash(JSON.stringify(value)), ref = records.doc(id);
        const result = await db.runTransaction(async tx => {
          const previous = await tx.get(ref);
          if (previous.exists) return { duplicate: true, record: previous.data() };
          const record = { ...value, id, fingerprint, status: 'completed', createdAt: Date.now(), points: pointsFor(value.amount, value.rate), orderNo: 'TEST-' + id.slice(0, 8).toUpperCase(), customerCode: 'TEST-' + hash(value.phone).slice(0, 8).toUpperCase(), testAccount: true };
          tx.set(ref, record); return { duplicate: false, record };
        });
        if (result.record.fingerprint !== fingerprint) return res.status(409).json({ error: 'This submission changed. Open a new form.' });
        return res.status(result.duplicate ? 200 : 201).json({ success: true, record: result.record, testAccount: true });
      }
      const readPaths = ['/api/merchant/puc/records', '/api/customers', '/api/orders', '/api/dashboard'];
      if (req.method === 'GET' && readPaths.includes(req.path)) {
        let rows = (await records.orderBy('createdAt', 'desc').limit(501).get()).docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (req.path === '/api/merchant/puc/records') {
          let range;try{range=require('./puc-expiry-filter.cjs').expiryFilter(String(req.query.filter||'all'),String(req.query.month||''));}catch(e){return res.status(400).json({error:e.message});}
          rows=range.empty?[]:rows.filter(row=>(!range.from||row.expiryDate>=range.from)&&(!range.to||row.expiryDate<=range.to));
          if(range.sortByExpiry)rows.sort((a,b)=>a.expiryDate.localeCompare(b.expiryDate));
          const after = String(req.query.after || ''), index = after ? rows.findIndex(row => row.id === after) : -1;
          if (after && index < 0) return res.status(400).json({ error: 'Page is unavailable.' });
          const page = rows.slice(index + 1, index + 101);
          return res.json({ records: page, nextCursor: rows.length > index + 101 ? page.at(-1).id : null, testAccount: true });
        }
        const customers = [...new Map(rows.slice().reverse().map(row => [row.phone, { id: row.customerCode, databaseId: row.customerCode, name: row.name, phone: row.phone, email: '', registeredAt: new Date(row.createdAt).toISOString(), qrScans: 0, rewardPoints: rows.filter(x => x.phone === row.phone).reduce((n, x) => n + x.points, 0), merchantId: account.id, merchant: account.name }])).values()];
        const orders = rows.map(row => ({ id: row.id, orderNo: row.orderNo, cid: row.customerCode, customer: row.name, phone: row.phone, email: '', amount: row.amount, salesAmount: row.amount, merchant: account.name, location: 'PRIVATE TEST ONLY', rewardPoints: row.points, rewardPercentage: row.rate, earningPointsPer100: row.rate, discountType: 'none', discountAmount: 0, discountPercentage: 0, isReturning: false, source: 'registration', timestamp: new Date(row.createdAt).toISOString(), whatsappStatus: 'not_sent', emailSent: false }));
        if (req.path === '/api/dashboard') return res.json({ summary: { totalOrders: rows.length, totalRevenue: rows.reduce((n, x) => n + x.amount, 0), rewardPointsIssued: rows.reduce((n, x) => n + x.points, 0), totalCustomers: customers.length }, intervals: [], retention: { lifetimeCustomers: customers.length, selectedVisits: rows.length, todayVisits: 0, weekVisits: 0, monthVisits: rows.length }, testAccount: true });
        const name = req.path === '/api/orders' ? 'orders' : 'customers', all = name === 'orders' ? orders : customers;
        const page = Math.max(1, Number(req.query.page) || 1), pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
        return res.json({ [name]: all.slice((page - 1) * pageSize, page * pageSize), pagination: { page, pageSize, total: all.length, totalPages: Math.max(1, Math.ceil(all.length / pageSize)) }, testAccount: true });
      }
      if (req.path === '/api/notifications' && req.method === 'GET') return res.json({ notifications: [], unreadCount: 0 });
      if (req.path === '/api/status' && req.method === 'GET') return res.json({ supabase: true, resend: false, whatsapp: false, testAccount: true });
      if (req.path === '/api/daily-greetings' && req.method === 'GET') return res.json({ messages: ['Private PUC test account · Test records only. No real rewards or messages.'], rotationStart: '2026-01-01' });
      if (req.path === '/api/profile/preferences' && ['PUT', 'POST'].includes(req.method)) return res.json({ success: true, testAccount: true, welcomeAccepted: false });
      if (req.path === '/api/merchant/sales-target' && req.method === 'GET') return res.json({ month: req.query.month, label: 'Private test sales', target: null, sales: 0, remaining: null, percent: 0, achieved: false, from: new Date(0).toISOString(), to: new Date(0).toISOString() });
      if (req.path === `/api/merchants/${account.id}/point-balance` && req.method === 'GET') return res.json({ balance: 0, testAccount: true });
      if (req.path === `/api/merchants/${account.id}` && req.method === 'GET') return res.json({ data: { id: account.id, merchantCode: account.code, name: account.name, email: account.email, phone: account.phone, category: account.category, joined: new Date(account.createdAt).toISOString(), point_balance: 0, testAccount: true } });
      return res.status(403).json({ error: 'Private PUC test account: this action is unavailable. Use Add Customer or Vehicle Expiry to test registrations.' });
    } catch { return res.status(503).json({ error: 'Private PUC testing is temporarily unavailable. Please retry.' }); }
  };
  return { middleware, register(app) { app.post('/api/admin/private-puc-test', adminAuth, adminRole, (req, res) => create(req, res).catch(() => res.status(503).json({ error: 'Could not prepare the test login. Retry the same request.' }))); } };
}
module.exports = { privatePucTest, pointsFor };
