require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const axios    = require('axios');
const QRCode   = require('qrcode');
const fs       = require('fs');
const path     = require('path');
const os       = require('os');
const crypto   = require('crypto');
const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by CORS'));
  },
}));
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Clients ──
const resend      = process.env.RESEND_API_KEY    ? new Resend(process.env.RESEND_API_KEY) : null;
const WA_TOKEN    = process.env.WA_TOKEN;
const WA_PHONE_ID = process.env.WA_PHONE_ID;
const WA_URL      = `https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`;
const F2S_KEY     = process.env.FAST2SMS_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAuth = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  : null;
const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15 ? digits : '';
}

function isEmail(value) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function requireSupabase(res) {
  if (supabaseAuth && supabaseAdmin) return true;
  res.status(503).json({ success: false, error: 'Supabase is not configured' });
  return false;
}

async function requireAuth(req, res, next) {
  if (!requireSupabase(res)) return;
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ success: false, error: 'Authentication required' });

  const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
  if (error || !user) return res.status(401).json({ success: false, error: 'Invalid or expired session' });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role, merchant_id')
    .eq('id', user.id)
    .single();
  if (profileError || !profile) {
    return res.status(403).json({ success: false, error: 'Account profile is not configured' });
  }

  req.auth = { user, profile, token };
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.auth.profile.role !== role) {
      return res.status(403).json({ success: false, error: `${role} access required` });
    }
    next();
  };
}

function customerDto(row) {
  return {
    id: row.customer_code,
    databaseId: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email || '',
    registeredAt: row.created_at,
    qrScans: row.qr_scans,
    rewardPoints: row.reward_points,
    merchantId: row.merchant_id,
    merchant: row.merchants?.name || '',
  };
}

app.post('/api/auth/login', async (req, res) => {
  if (!requireSupabase(res)) return;
  const email = cleanText(req.body.email, 254).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!isEmail(email) || !password) {
    return res.status(400).json({ success: false, error: 'Valid email and password are required' });
  }

  const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ success: false, error: 'Invalid email or password' });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role, merchant_id')
    .eq('id', data.user.id)
    .single();
  if (profileError || !profile) {
    return res.status(403).json({ success: false, error: 'Account profile is not configured' });
  }
  res.json({
    success: true,
    accessToken: data.session.access_token,
    expiresAt: data.session.expires_at,
    user: { email: data.user.email, ...profile },
  });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ success: true, user: { email: req.auth.user.email, ...req.auth.profile } });
});

app.get('/api/merchants', requireAuth, async (req, res) => {
  let query = supabaseAdmin.from('merchants').select('id, name, email, phone, created_at').order('name');
  if (req.auth.profile.role === 'merchant') query = query.eq('id', req.auth.profile.merchant_id);
  const { data, error } = await query;
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({
    success: true,
    merchants: data.map((row) => ({
      id: row.id, name: row.name, email: row.email, phone: row.phone, joined: row.created_at,
    })),
  });
});

app.post('/api/merchants', requireAuth, requireRole('admin'), async (req, res) => {
  const name = cleanText(req.body.name, 120);
  const email = cleanText(req.body.email, 254).toLowerCase();
  const phone = normalizePhone(req.body.phone);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!name || !email || !isEmail(email) || !phone || password.length < 8) {
    return res.status(400).json({
      success: false,
      error: 'Name, valid email/phone, and a password of at least 8 characters are required',
    });
  }

  const { data: merchant, error: merchantError } = await supabaseAdmin
    .from('merchants').insert({ name, email, phone }).select().single();
  if (merchantError) return res.status(400).json({ success: false, error: merchantError.message });

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: name, role: 'merchant', merchant_id: merchant.id },
  });
  if (authError) {
    await supabaseAdmin.from('merchants').delete().eq('id', merchant.id);
    return res.status(400).json({ success: false, error: authError.message });
  }

  await supabaseAdmin.from('profiles').upsert({
    id: authData.user.id, full_name: name, role: 'merchant', merchant_id: merchant.id,
  });
  res.status(201).json({ success: true, merchant });
});

app.delete('/api/merchants/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { error } = await supabaseAdmin.from('merchants').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ success: false, error: error.message });
  res.json({ success: true });
});

app.get('/api/admins', requireAuth, requireRole('admin'), async (_req, res) => {
  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, created_at')
    .eq('role', 'admin')
    .order('created_at');
  if (error) return res.status(500).json({ success: false, error: error.message });

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1, perPage: 1000,
  });
  if (authError) return res.status(500).json({ success: false, error: authError.message });
  const emails = new Map(authData.users.map((user) => [user.id, user.email]));
  res.json({
    success: true,
    admins: profiles.map((profile) => ({
      id: profile.id,
      fullName: profile.full_name,
      email: emails.get(profile.id) || '',
      createdAt: profile.created_at,
      isCurrent: profile.id === _req.auth.user.id,
    })),
  });
});

app.post('/api/admins', requireAuth, requireRole('admin'), async (req, res) => {
  const fullName = cleanText(req.body.fullName, 120);
  const email = cleanText(req.body.email, 254).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!fullName || !email || !isEmail(email) || password.length < 8) {
    return res.status(400).json({
      success: false,
      error: 'Name, valid email, and a password of at least 8 characters are required',
    });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: 'admin' },
  });
  if (authError) return res.status(400).json({ success: false, error: authError.message });

  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: authData.user.id,
    full_name: fullName,
    role: 'admin',
    merchant_id: null,
  });
  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return res.status(400).json({ success: false, error: profileError.message });
  }
  res.status(201).json({ success: true });
});

app.delete('/api/admins/:id', requireAuth, requireRole('admin'), async (req, res) => {
  if (req.params.id === req.auth.user.id) {
    return res.status(400).json({ success: false, error: 'You cannot remove your own account' });
  }
  const { count, error: countError } = await supabaseAdmin
    .from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin');
  if (countError) return res.status(500).json({ success: false, error: countError.message });
  if (count <= 1) {
    return res.status(400).json({ success: false, error: 'At least one admin is required' });
  }
  const { error } = await supabaseAdmin.auth.admin.deleteUser(req.params.id);
  if (error) return res.status(400).json({ success: false, error: error.message });
  res.json({ success: true });
});

app.get('/api/customers', requireAuth, async (req, res) => {
  let query = supabaseAdmin
    .from('customers')
    .select('id, customer_code, name, phone, email, qr_scans, reward_points, merchant_id, created_at, merchants(name)')
    .order('created_at', { ascending: false });
  if (req.auth.profile.role === 'merchant') query = query.eq('merchant_id', req.auth.profile.merchant_id);
  const { data, error } = await query;
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, customers: data.map(customerDto) });
});

app.post('/api/customers', requireAuth, async (req, res) => {
  const name = cleanText(req.body.name, 100);
  const phone = normalizePhone(req.body.phone);
  const email = cleanText(req.body.email, 254).toLowerCase();
  const amount = Number(req.body.amount);
  const merchantId = req.auth.profile.role === 'admin'
    ? cleanText(req.body.merchantId, 100)
    : req.auth.profile.merchant_id;
  if (!name || !phone || !isEmail(email) || !merchantId || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ success: false, error: 'Valid customer and purchase details are required' });
  }

  const customerCode = `C${Date.now().toString(36).toUpperCase()}`;
  const { data: customer, error } = await supabaseAdmin
    .from('customers')
    .insert({ customer_code: customerCode, name, phone, email: email || null, merchant_id: merchantId })
    .select('id, customer_code, name, phone, email, qr_scans, reward_points, merchant_id, created_at, merchants(name)')
    .single();
  if (error) return res.status(400).json({ success: false, error: error.message });

  const orderNo = `AE-${Date.now().toString().slice(-8)}`;
  const { error: orderError } = await supabaseAdmin.from('orders').insert({
    order_no: orderNo, customer_id: customer.id, merchant_id: merchantId, amount,
    location: cleanText(req.body.location, 160) || 'In-store',
  });
  if (orderError) {
    await supabaseAdmin.from('customers').delete().eq('id', customer.id);
    return res.status(400).json({ success: false, error: orderError.message });
  }
  res.status(201).json({ success: true, customer: customerDto(customer), orderNo });
});

app.patch('/api/customers/:code/reward', requireAuth, async (req, res) => {
  const points = Number(req.body.points);
  if (!Number.isInteger(points) || points < 0) {
    return res.status(400).json({ success: false, error: 'Points must be a positive integer' });
  }
  let lookup = supabaseAdmin.from('customers').select('id, reward_points, qr_scans')
    .eq('customer_code', req.params.code);
  if (req.auth.profile.role === 'merchant') {
    lookup = lookup.eq('merchant_id', req.auth.profile.merchant_id);
  }
  const { data: customer, error: lookupError } = await lookup.single();
  if (lookupError || !customer) {
    return res.status(404).json({ success: false, error: 'Customer not found' });
  }
  const { data, error } = await supabaseAdmin.from('customers').update({
    reward_points: customer.reward_points + points,
    qr_scans: customer.qr_scans + 1,
  }).eq('id', customer.id).select('reward_points, qr_scans').single();
  if (error) return res.status(400).json({ success: false, error: error.message });
  res.json({ success: true, rewardPoints: data.reward_points, qrScans: data.qr_scans });
});

app.get('/api/orders', requireAuth, async (req, res) => {
  let query = supabaseAdmin.from('orders')
    .select('id, order_no, amount, location, whatsapp_sent, email_sent, created_at, customers(customer_code,name,phone,email), merchants(name)')
    .order('created_at', { ascending: false });
  if (req.auth.profile.role === 'merchant') query = query.eq('merchant_id', req.auth.profile.merchant_id);
  const { data, error } = await query;
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({
    success: true,
    orders: data.map((row) => ({
      id: row.id, orderNo: row.order_no, cid: row.customers?.customer_code,
      customer: row.customers?.name, phone: row.customers?.phone,
      email: row.customers?.email || '', amount: Number(row.amount),
      merchant: row.merchants?.name || '', location: row.location,
      timestamp: row.created_at, waSent: row.whatsapp_sent, emailSent: row.email_sent,
    })),
  });
});

app.get('/api/settings/reward', requireAuth, async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('app_settings').select('value').eq('key', 'reward_percentage').single();
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, rewardPercentage: Number(data.value) });
});

app.put('/api/settings/reward', requireAuth, requireRole('admin'), async (req, res) => {
  const rewardPercentage = Number(req.body.rewardPercentage);
  if (!Number.isFinite(rewardPercentage) || rewardPercentage < 0.1 || rewardPercentage > 20) {
    return res.status(400).json({
      success: false, error: 'Reward percentage must be between 0.1 and 20',
    });
  }
  const rounded = Math.round(rewardPercentage * 10) / 10;
  const { error } = await supabaseAdmin.from('app_settings').upsert({
    key: 'reward_percentage', value: rounded, updated_by: req.auth.user.id,
    updated_at: new Date().toISOString(),
  });
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, rewardPercentage: rounded });
});

// ══════════════════════════════════════════
//  POST /api/send-qr
//  Called on new customer registration.
//  Sends WhatsApp QR image + welcome email.
// ══════════════════════════════════════════
app.post('/api/send-qr', requireAuth, async (req, res) => {
  const name = cleanText(req.body.name, 100);
  const phone = normalizePhone(req.body.phone);
  const email = cleanText(req.body.email, 254).toLowerCase();
  const cid = cleanText(req.body.cid, 100);
  const merchant = cleanText(req.body.merchant, 120);

  if (!name || !phone || !cid || !merchant) {
    return res.status(400).json({
      success: false,
      error: 'name, a valid phone, cid, and merchant are required',
    });
  }
  if (!isEmail(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email address' });
  }

  const results = { whatsapp: null, email: null };

  // ── Generate QR PNG ──
  const qrPayload = JSON.stringify({ id: cid, name, phone, merchant });
  const qrPath = path.join(os.tmpdir(), `ae-qr-${crypto.randomUUID()}.png`);
  try {
    await QRCode.toFile(qrPath, qrPayload, {
      type: 'png', width: 400, margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    });
    console.log(`✅ QR generated → ${qrPath}`);
  } catch (err) {
    return res.status(500).json({ success: false, error: 'QR generation failed: ' + err.message });
  }

  // ── WhatsApp ──
  if (WA_TOKEN && WA_PHONE_ID) {
    try {
      const toPhone = phone;

      // Upload QR to Meta
      let mediaId = null;
      try {
        const FormData = require('form-data');
        const form = new FormData();
        form.append('messaging_product', 'whatsapp');
        form.append('type', 'image/png');
        form.append('file', fs.createReadStream(qrPath), { contentType: 'image/png', filename: 'qr.png' });
        const up = await axios.post(
          `https://graph.facebook.com/v19.0/${WA_PHONE_ID}/media`, form,
          { headers: { Authorization: `Bearer ${WA_TOKEN}`, ...form.getHeaders() } }
        );
        mediaId = up.data.id;
      } catch (e) {
        console.warn('Media upload failed, using text fallback:', e.message);
      }

      if (mediaId) {
        await axios.post(WA_URL, {
          messaging_product: 'whatsapp', to: toPhone, type: 'image',
          image: { id: mediaId, caption: `🎉 Welcome to *${merchant}*, ${name}!\n\nYour ID: *${cid}*\n\n📲 Save this QR and show it at checkout for instant recognition!\n\n— Affiliate AE` },
        }, { headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' } });
      } else {
        await axios.post(WA_URL, {
          messaging_product: 'whatsapp', to: toPhone, type: 'text',
          text: { body: `🎉 Welcome to *${merchant}*, ${name}!\n\nYour Customer ID: *${cid}*\n\n📲 Show this ID at checkout for instant recognition.\n\n— Affiliate AE` },
        }, { headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' } });
      }

      results.whatsapp = { sent: true, to: phone };
      console.log(`✅ WhatsApp sent → ${phone}`);
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      console.error('WhatsApp error:', msg);
      results.whatsapp = { sent: false, error: msg };
    }
  } else {
    results.whatsapp = { sent: false, error: 'WA_TOKEN / WA_PHONE_ID not configured' };
  }

  // ── Welcome Email ──
  if (resend && process.env.RESEND_FROM_EMAIL && email) {
    try {
      const { data, error } = await resend.emails.send({
        from: `Affiliate AE <${process.env.RESEND_FROM_EMAIL}>`,
        to:   [email],
        subject: `Welcome to ${merchant} — Your AE ID: ${cid}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#0a0a0f;color:#f0f0fa;border-radius:16px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#7c6ef7,#e84d8a);padding:30px;text-align:center">
            <h1 style="margin:0;font-size:22px;color:#fff">Welcome to Affiliate AE</h1>
            <p style="margin:5px 0 0;color:rgba(255,255,255,.75);font-size:13px">${merchant}</p>
          </div>
          <div style="padding:28px">
            <p style="font-size:15px">Hi <strong>${name}</strong>,</p>
            <p style="color:#8888aa;font-size:13px;margin:10px 0 20px">You've been registered at <strong style="color:#f0f0fa">${merchant}</strong>.</p>
            <div style="background:#1a1a24;border:1px solid #2a2a3a;border-radius:10px;padding:16px;margin-bottom:18px">
              <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #2a2a3a">
                <span style="color:#8888aa;font-size:12px">Customer ID</span>
                <span style="font-weight:700;color:#7c6ef7;font-family:monospace">${cid}</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding:5px 0">
                <span style="color:#8888aa;font-size:12px">WhatsApp</span>
                <span style="font-size:13px">${phone}</span>
              </div>
            </div>
            <div style="background:rgba(37,211,102,.1);border:1px solid rgba(37,211,102,.22);border-radius:8px;padding:12px;font-size:13px;color:#25d366">
              💬 Your QR code has been sent to your WhatsApp (${phone}).<br>Show it at checkout — no typing needed next time!
            </div>
          </div>
          <div style="background:#13131a;padding:14px;text-align:center">
            <p style="color:#8888aa;font-size:11px;margin:0">© ${new Date().getFullYear()} Affiliate AE</p>
          </div>
        </div>`,
        text: `Hi ${name}, welcome to ${merchant}!\nYour ID: ${cid}\nQR sent to WhatsApp: ${phone}\n\n— Affiliate AE`,
      });
      if (error) throw new Error(error.message);
      results.email = { sent: true, to: email, id: data?.id };
      console.log(`✅ Email sent → ${email}`);
    } catch (err) {
      console.error('Resend error:', err.message);
      results.email = { sent: false, error: err.message };
    }
  } else {
    results.email = { sent: false, error: 'Resend not configured or no email provided' };
  }

  // cleanup temp QR
  try { fs.unlinkSync(qrPath); } catch {}

  return res.json({
    success:   true,
    waSent:    results.whatsapp?.sent === true,
    emailSent: results.email?.sent    === true,
    results,
  });
});

// ══════════════════════════════════════════
//  POST /api/send-reward-sms
//  Called when merchant confirms reward after QR scan.
//  Sends SMS via Fast2SMS with points balance.
// ══════════════════════════════════════════
app.post('/api/send-reward-sms', requireAuth, async (req, res) => {
  const name = cleanText(req.body.name, 100);
  const phone = normalizePhone(req.body.phone);
  const merchant = cleanText(req.body.merchant, 120);
  const amount = Number(req.body.amount);
  const pts = Number(req.body.pts);
  const totalPts = Number(req.body.totalPts);
  const rewardPct = Number(req.body.rewardPct);

  if (
    !name ||
    !phone ||
    !merchant ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    !Number.isFinite(pts) ||
    pts < 0 ||
    !Number.isFinite(totalPts) ||
    totalPts < 0 ||
    !Number.isFinite(rewardPct) ||
    rewardPct < 0
  ) {
    return res.status(400).json({ success: false, error: 'Invalid reward details' });
  }

  if (!F2S_KEY) {
    console.warn('Fast2SMS not configured — FAST2SMS_API_KEY missing');
    return res.status(503).json({
      success: false,
      error: 'Fast2SMS not configured (FAST2SMS_API_KEY missing)',
    });
  }

  try {
    // Fast2SMS Quick SMS API
    const message =
      `Hi ${name}! You earned ${pts} reward points (${rewardPct}%) on your Rs.${amount} purchase at ${merchant}. ` +
      `Total balance: ${totalPts} pts. Show your QR at next visit! - Affiliate AE`;

    const smsRes = await axios.get('https://www.fast2sms.com/dev/bulkV2', {
      params: {
        authorization: F2S_KEY,
        message,
        language:  'english',
        route:     'q',           // quick transactional route
        numbers:   phone.replace(/\D/g, '').slice(-10), // last 10 digits
      },
      headers: { 'cache-control': 'no-cache' },
    });

    if (smsRes.data?.return === true) {
      console.log(`✅ SMS sent → ${phone} (${pts} pts)`);
      return res.json({ success: true, to: phone, pts, totalPts, response: smsRes.data });
    } else {
      console.error('Fast2SMS failed:', smsRes.data);
      return res.json({ success: false, error: JSON.stringify(smsRes.data) });
    }
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error('Fast2SMS error:', msg);
    return res.json({ success: false, error: msg });
  }
});

// ══════════════════════════════════════════
//  GET /api/status
// ══════════════════════════════════════════
app.get('/api/status', (_req, res) => {
  res.json({
    supabase:  !!(supabaseAuth && supabaseAdmin),
    resend:    !!process.env.RESEND_API_KEY,
    whatsapp:  !!(WA_TOKEN && WA_PHONE_ID),
    sms:       !!F2S_KEY,
    fromEmail: process.env.RESEND_FROM_EMAIL || null,
    waPhoneId: WA_PHONE_ID || null,
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    service: 'affiliate-ae-backend',
    database: supabaseAdmin ? 'configured' : 'not-configured',
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀  Affiliate AE → http://localhost:${PORT}`);
  console.log(`    Resend   : ${process.env.RESEND_API_KEY ? '✅' : '❌ RESEND_API_KEY not set'}`);
  console.log(`    WhatsApp : ${WA_TOKEN && WA_PHONE_ID    ? '✅' : '❌ WA_TOKEN / WA_PHONE_ID not set'}`);
  console.log(`    Fast2SMS : ${F2S_KEY                    ? '✅' : '❌ FAST2SMS_API_KEY not set'}\n`);
});

// ══════════════════════════════════════════
//  POST /api/send-reward-sms
//  Called when merchant confirms reward after QR scan.
//  Sends reward SMS via Fast2SMS.
// ══════════════════════════════════════════
if (false) app.post('/api/send-reward-sms-legacy-disabled', async (req, res) => {
  const { name, phone, amount, pts, totalPts, merchant, rewardPct } = req.body;
  if (!name || !phone || pts === undefined) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  const smsBody =
    `Hi ${name}! You earned ${pts} reward points on your Rs.${amount} purchase at ${merchant} (${rewardPct}% reward). ` +
    `Total balance: ${totalPts} pts. Thank you for shopping with us! - Affiliate AE`;

  if (!process.env.FAST2SMS_API_KEY) {
    console.log(`[SMS - no key] Would send to ${phone}: ${smsBody}`);
    return res.json({ success: false, error: 'FAST2SMS_API_KEY not configured', smsBody });
  }

  try {
    // Strip country code — Fast2SMS needs 10-digit Indian mobile numbers
    const mobile = phone.replace(/\D/g, '').slice(-10);

    const response = await axios.post(
      'https://www.fast2sms.com/dev/bulkV2',
      {
        route:   'q',          // transactional route
        message: smsBody,
        language: 'english',
        flash:    0,
        numbers:  mobile,
      },
      {
        headers: {
          authorization: process.env.FAST2SMS_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.return === true) {
      console.log(`✅ SMS sent → ${phone}`);
      return res.json({ success: true, to: phone, pts, totalPts });
    } else {
      throw new Error(response.data.message || 'Fast2SMS returned false');
    }
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error('Fast2SMS error:', msg);
    return res.json({ success: false, error: msg });
  }
});
