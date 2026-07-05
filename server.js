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
app.use(express.json({
  limit: '100kb',
  verify(req, _res, buffer) {
    req.rawBody = buffer;
  },
}));
app.use('/vendor/html5-qrcode', express.static(
  path.join(__dirname, 'node_modules', 'html5-qrcode'),
  { fallthrough: false, maxAge: '7d' },
));
app.use(express.static(path.join(__dirname, 'public')));

// ── Clients ──
const resend      = process.env.RESEND_API_KEY    ? new Resend(process.env.RESEND_API_KEY) : null;
const WA_TOKEN    = process.env.WA_TOKEN;
const WA_PHONE_ID = process.env.WA_PHONE_ID;
const WA_API_VERSION = process.env.WA_API_VERSION || 'v23.0';
const WA_URL      = `https://graph.facebook.com/${WA_API_VERSION}/${WA_PHONE_ID}/messages`;
const WA_VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN;
const WA_APP_SECRET = process.env.WA_APP_SECRET;
const WA_REGISTRATION_TEMPLATE = process.env.WA_REGISTRATION_TEMPLATE || 'customer_welcome_qr';
const WA_REWARD_TEMPLATE = process.env.WA_REWARD_TEMPLATE || 'reward_receipt';
const WA_TEMPLATE_LANGUAGE = process.env.WA_TEMPLATE_LANGUAGE || 'en';
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
  const national = digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(national) ? `91${national}` : '';
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

const REWARD_PERCENTAGES = [0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function isAllowedRewardPercentage(value) {
  return REWARD_PERCENTAGES.includes(Number(value));
}

function formatPoints(value) {
  return Number(value || 0).toFixed(2);
}

async function getRewardSettings() {
  const { data, error } = await supabaseAdmin
    .from('app_settings')
    .select('key,value')
    .in('key', ['reward_percentage', 'reward_minimum']);
  if (error) throw error;
  const settings = Object.fromEntries(data.map((row) => [row.key, Number(row.value)]));
  const minimum = isAllowedRewardPercentage(settings.reward_minimum)
    ? settings.reward_minimum : 0.5;
  const defaultPercentage = (
    isAllowedRewardPercentage(settings.reward_percentage)
    && settings.reward_percentage >= minimum
  ) ? settings.reward_percentage : minimum;
  return { minimum, defaultPercentage };
}

async function uploadQrMedia(payload) {
  const qrPath = path.join(os.tmpdir(), `ae-qr-${crypto.randomUUID()}.png`);
  try {
    await QRCode.toFile(qrPath, JSON.stringify(payload), {
      type: 'png',
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
    const FormData = require('form-data');
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', 'image/png');
    form.append('file', fs.createReadStream(qrPath), {
      contentType: 'image/png',
      filename: 'customer-qr.png',
    });
    const response = await axios.post(
      `https://graph.facebook.com/${WA_API_VERSION}/${WA_PHONE_ID}/media`,
      form,
      { headers: { Authorization: `Bearer ${WA_TOKEN}`, ...form.getHeaders() } },
    );
    return response.data.id;
  } finally {
    try { fs.unlinkSync(qrPath); } catch {}
  }
}

async function sendWhatsAppTemplate({
  customerId,
  orderId,
  recipient,
  templateName,
  components,
}) {
  if (!WA_TOKEN || !WA_PHONE_ID) {
    return { sent: false, error: 'WhatsApp Cloud API is not configured' };
  }

  const { data: log, error: logError } = await supabaseAdmin
    .from('whatsapp_messages')
    .insert({
      customer_id: customerId,
      order_id: orderId,
      template_name: templateName,
      recipient,
      status: 'queued',
    })
    .select('id')
    .single();
  if (logError) return { sent: false, error: logError.message };

  try {
    const response = await axios.post(WA_URL, {
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'template',
      template: {
        name: templateName,
        language: { code: WA_TEMPLATE_LANGUAGE },
        components,
      },
    }, {
      headers: {
        Authorization: `Bearer ${WA_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    const messageId = response.data?.messages?.[0]?.id;
    await supabaseAdmin.from('whatsapp_messages').update({
      meta_message_id: messageId || null,
      status: 'sent',
      status_timestamp: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', log.id);
    return { sent: true, messageId };
  } catch (error) {
    const apiError = error.response?.data?.error;
    await supabaseAdmin.from('whatsapp_messages').update({
      status: 'failed',
      error_code: apiError?.code ? String(apiError.code) : null,
      error_message: apiError?.message || error.message,
      status_timestamp: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', log.id);
    return { sent: false, error: apiError?.message || error.message };
  }
}

async function sendRegistrationWhatsApp(purchase) {
  if (!WA_TOKEN || !WA_PHONE_ID) {
    return { sent: false, error: 'WhatsApp Cloud API is not configured' };
  }
  try {
    const mediaId = await uploadQrMedia({
      id: purchase.customer_code,
      name: purchase.customer_name,
      phone: purchase.customer_phone,
    });
    return sendWhatsAppTemplate({
      customerId: purchase.customer_id,
      orderId: purchase.order_id,
      recipient: purchase.customer_phone,
      templateName: WA_REGISTRATION_TEMPLATE,
      components: [
        { type: 'header', parameters: [{ type: 'image', image: { id: mediaId } }] },
        {
          type: 'body',
          parameters: [
            { type: 'text', text: purchase.customer_name },
            { type: 'text', text: purchase.merchant_name },
            { type: 'text', text: purchase.customer_code },
            { type: 'text', text: `${Number(purchase.reward_percentage)}%` },
            { type: 'text', text: formatPoints(purchase.points_earned) },
            { type: 'text', text: formatPoints(purchase.total_points) },
          ],
        },
      ],
    });
  } catch (error) {
    return { sent: false, error: error.message };
  }
}

async function sendRewardWhatsApp(purchase) {
  return sendWhatsAppTemplate({
    customerId: purchase.customer_id,
    orderId: purchase.order_id,
    recipient: purchase.customer_phone,
    templateName: WA_REWARD_TEMPLATE,
    components: [{
      type: 'body',
      parameters: [
        { type: 'text', text: purchase.customer_name },
        { type: 'text', text: purchase.merchant_name },
        { type: 'text', text: purchase.order_no },
        { type: 'text', text: Number(purchase.amount).toFixed(2) },
        { type: 'text', text: `${Number(purchase.reward_percentage)}%` },
        { type: 'text', text: formatPoints(purchase.points_earned) },
        { type: 'text', text: formatPoints(purchase.total_points) },
      ],
    }],
  });
}

async function sendWelcomeEmail(purchase) {
  if (!resend || !process.env.RESEND_FROM_EMAIL || !purchase.customer_email) {
    return { sent: false, error: 'Email not configured or not provided' };
  }
  const { data, error } = await resend.emails.send({
    from: `Affiliate AE <${process.env.RESEND_FROM_EMAIL}>`,
    to: [purchase.customer_email],
    subject: `Welcome to ${purchase.merchant_name}`,
    html: `<h2>Welcome, ${purchase.customer_name}</h2>
      <p>Your customer ID is <strong>${purchase.customer_code}</strong>.</p>
      <p>Reward rate: <strong>${Number(purchase.reward_percentage)}%</strong></p>
      <p>You earned <strong>${formatPoints(purchase.points_earned)} points</strong> on your first purchase.</p>`,
  });
  if (error) return { sent: false, error: error.message };
  return { sent: true, id: data?.id };
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
  let query = supabaseAdmin.from('customer_merchants')
    .select('customer_id,merchant_id,reward_points,qr_scans,joined_at')
    .order('joined_at', { ascending: false });
  if (req.auth.profile.role === 'merchant') {
    query = query.eq('merchant_id', req.auth.profile.merchant_id);
  }
  const { data: memberships, error } = await query;
  if (error) return res.status(500).json({ success: false, error: error.message });
  if (!memberships.length) return res.json({ success: true, customers: [] });

  const customerIds = [...new Set(memberships.map((row) => row.customer_id))];
  const merchantIds = [...new Set(memberships.map((row) => row.merchant_id))];
  const [customersResult, merchantsResult] = await Promise.all([
    supabaseAdmin.from('customers')
      .select('id,customer_code,name,phone,email,created_at')
      .in('id', customerIds),
    supabaseAdmin.from('merchants').select('id,name').in('id', merchantIds),
  ]);
  const relatedError = customersResult.error || merchantsResult.error;
  if (relatedError) return res.status(500).json({ success: false, error: relatedError.message });
  const customerById = new Map(customersResult.data.map((customer) => [customer.id, customer]));
  const merchantById = new Map(merchantsResult.data.map((merchant) => [merchant.id, merchant]));

  res.json({
    success: true,
    customers: memberships.flatMap((row) => {
      const customer = customerById.get(row.customer_id);
      if (!customer) return [];
      return [{
        id: customer.customer_code,
        databaseId: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email || '',
        registeredAt: row.joined_at,
        qrScans: row.qr_scans,
        rewardPoints: row.reward_points,
        merchantId: row.merchant_id,
        merchant: merchantById.get(row.merchant_id)?.name || '',
      }];
    }),
  });
});

app.post('/api/customers', requireAuth, async (req, res) => {
  const name = cleanText(req.body.name, 100);
  const phone = normalizePhone(req.body.phone);
  const email = cleanText(req.body.email, 254).toLowerCase();
  const amount = Number(req.body.amount);
  const rewardPercentage = Number(req.body.rewardPercentage);
  const rewardSettings = await getRewardSettings();
  const whatsappConsent = req.body.whatsappConsent === true;
  const merchantId = req.auth.profile.role === 'admin'
    ? cleanText(req.body.merchantId, 100)
    : req.auth.profile.merchant_id;
  if (
    !name ||
    !phone ||
    (email && !isEmail(email)) ||
    !merchantId ||
    !whatsappConsent ||
    !Number.isFinite(amount) ||
    amount < 100 ||
    !isAllowedRewardPercentage(rewardPercentage) ||
    rewardPercentage < rewardSettings.minimum
  ) {
    return res.status(400).json({
      success: false,
      error: `Purchase must be at least 100 and reward percentage must be between ${rewardSettings.minimum}% and 10%`,
    });
  }

  let { data: customer, error } = await supabaseAdmin
    .from('customers')
    .select('id,customer_code,name,phone,email,created_at')
    .eq('phone', phone)
    .maybeSingle();
  let createdCustomer = false;
  if (error) return res.status(400).json({ success: false, error: error.message });
  if (!customer) {
    const customerCode = `C${Date.now().toString(36).toUpperCase()}`;
    const created = await supabaseAdmin.from('customers').insert({
      customer_code: customerCode,
      name,
      phone,
      email: email || null,
      merchant_id: merchantId,
      whatsapp_opt_in_at: new Date().toISOString(),
    }).select('id,customer_code,name,phone,email,created_at').single();
    if (created.error) return res.status(400).json({ success: false, error: created.error.message });
    customer = created.data;
    createdCustomer = true;
  } else if (!customer.email && email) {
    await supabaseAdmin.from('customers').update({ email }).eq('id', customer.id);
    customer.email = email;
  }
  if (!createdCustomer) {
    await supabaseAdmin.from('customers').update({
      whatsapp_opt_in_at: new Date().toISOString(),
    }).eq('id', customer.id);
  }

  const { data: purchases, error: purchaseError } = await supabaseAdmin.rpc('process_purchase', {
    p_customer_code: customer.customer_code,
    p_merchant_id: merchantId,
    p_amount: amount,
    p_reward_percentage: rewardPercentage,
    p_source: 'registration',
    p_location: cleanText(req.body.location, 160) || 'In-store',
  });
  if (purchaseError || !purchases?.[0]) {
    if (createdCustomer) await supabaseAdmin.from('customers').delete().eq('id', customer.id);
    return res.status(400).json({
      success: false,
      error: purchaseError?.message || 'Could not create first purchase',
    });
  }
  const purchase = purchases[0];
  const [whatsapp, emailResult] = await Promise.all([
    sendRegistrationWhatsApp(purchase),
    sendWelcomeEmail(purchase),
  ]);
  res.status(201).json({
    success: true,
    customer: {
      id: customer.customer_code,
      databaseId: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      registeredAt: purchase.created_at,
      qrScans: purchase.qr_scans,
      merchantId,
      merchant: purchase.merchant_name,
      rewardPoints: purchase.total_points,
    },
    order: purchase,
    notifications: { whatsapp, email: emailResult },
  });
});

app.get('/api/customers/scan/:code', requireAuth, requireRole('merchant'), async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('id,customer_code,name,phone,email')
    .eq('customer_code', cleanText(req.params.code, 100))
    .single();
  if (error || !data) {
    return res.status(404).json({ success: false, error: 'Customer not found' });
  }
  const [{ data: membership }, { data: merchant }] = await Promise.all([
    supabaseAdmin.from('customer_merchants')
      .select('reward_points')
      .eq('customer_id', data.id)
      .eq('merchant_id', req.auth.profile.merchant_id)
      .maybeSingle(),
    supabaseAdmin.from('merchants')
      .select('name')
      .eq('id', req.auth.profile.merchant_id)
      .single(),
  ]);
  res.json({
    success: true,
    customer: {
      id: data.customer_code,
      name: data.name,
      phone: data.phone,
      email: data.email || '',
      rewardPoints: membership?.reward_points || 0,
      merchant: merchant?.name || '',
      isNewToMerchant: !membership,
    },
  });
});

app.post('/api/checkouts', requireAuth, requireRole('merchant'), async (req, res) => {
  const customerCode = cleanText(req.body.customerCode, 100);
  const amount = Number(req.body.amount);
  const rewardPercentage = Number(req.body.rewardPercentage);
  const rewardSettings = await getRewardSettings();
  if (
    !customerCode ||
    !Number.isFinite(amount) ||
    amount < 100 ||
    !isAllowedRewardPercentage(rewardPercentage) ||
    rewardPercentage < rewardSettings.minimum
  ) {
    return res.status(400).json({
      success: false,
      error: `Purchase must be at least 100 and reward percentage must be between ${rewardSettings.minimum}% and 10%`,
    });
  }
  const { data, error } = await supabaseAdmin.rpc('process_purchase', {
    p_customer_code: customerCode,
    p_merchant_id: req.auth.profile.merchant_id,
    p_amount: amount,
    p_reward_percentage: rewardPercentage,
    p_source: 'qr',
    p_location: cleanText(req.body.location, 160) || 'In-store',
  });
  if (error || !data?.[0]) {
    return res.status(400).json({ success: false, error: error?.message || 'Checkout failed' });
  }
  const purchase = data[0];
  const whatsapp = await sendRewardWhatsApp(purchase);
  res.status(201).json({ success: true, purchase, whatsapp });
});

app.get('/api/orders', requireAuth, async (req, res) => {
  let query = supabaseAdmin.from('orders')
    .select('id, order_no, amount, reward_points, reward_percentage, is_returning, source, location, email_sent, created_at, customers(customer_code,name,phone,email), merchants(name), whatsapp_messages(status,updated_at)')
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
      rewardPoints: Number(row.reward_points),
      rewardPercentage: Number(row.reward_percentage),
      isReturning: row.is_returning,
      source: row.source,
      timestamp: row.created_at,
      whatsappStatus: [...(row.whatsapp_messages || [])]
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0]?.status || 'not_sent',
      emailSent: row.email_sent,
    })),
  });
});

app.get('/api/dashboard', requireAuth, async (req, res) => {
  const from = new Date(req.query.from);
  const to = new Date(req.query.to);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) {
    return res.status(400).json({ success: false, error: 'Valid from and to dates are required' });
  }

  let ordersQuery = supabaseAdmin.from('orders')
    .select('amount,reward_points,is_returning,created_at,customer_id')
    .gte('created_at', from.toISOString())
    .lt('created_at', to.toISOString())
    .limit(10000);
  let customersQuery = req.auth.profile.role === 'merchant'
    ? supabaseAdmin.from('customer_merchants')
      .select('customer_id,joined_at')
      .eq('merchant_id', req.auth.profile.merchant_id)
      .gte('joined_at', from.toISOString())
      .lt('joined_at', to.toISOString())
      .limit(10000)
    : supabaseAdmin.from('customers')
      .select('id,created_at')
      .gte('created_at', from.toISOString())
      .lt('created_at', to.toISOString())
      .limit(10000);
  let lifetimeQuery = supabaseAdmin.from('orders')
    .select('customer_id,is_returning,created_at')
    .limit(10000);
  if (req.auth.profile.role === 'merchant') {
    const merchantId = req.auth.profile.merchant_id;
    ordersQuery = ordersQuery.eq('merchant_id', merchantId);
    lifetimeQuery = lifetimeQuery.eq('merchant_id', merchantId);
  }

  const [ordersResult, customersResult, lifetimeResult] = await Promise.all([
    ordersQuery,
    customersQuery,
    lifetimeQuery,
  ]);
  const queryError = ordersResult.error || customersResult.error || lifetimeResult.error;
  if (queryError) return res.status(500).json({ success: false, error: queryError.message });

  const orders = ordersResult.data || [];
  const lifetimeOrders = lifetimeResult.data || [];
  const intervals = [0, 1, 2, 3].map((index) => ({
    label: `${String(index * 6).padStart(2, '0')}–${String((index + 1) * 6).padStart(2, '0')}`,
    orders: 0,
    revenue: 0,
  }));
  const indiaHour = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    hourCycle: 'h23',
  });
  for (const order of orders) {
    const interval = Math.floor(Number(indiaHour.format(new Date(order.created_at))) / 6);
    intervals[interval].orders += 1;
    intervals[interval].revenue += Number(order.amount);
  }

  const indiaDateText = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [indiaYear, indiaMonth, indiaDay] = indiaDateText.split('-').map(Number);
  const startOfToday = new Date(`${indiaDateText}T00:00:00+05:30`);
  const indiaCalendarDate = new Date(Date.UTC(indiaYear, indiaMonth - 1, indiaDay));
  const mondayOffset = (indiaCalendarDate.getUTCDay() + 6) % 7;
  indiaCalendarDate.setUTCDate(indiaCalendarDate.getUTCDate() - mondayOffset);
  const weekText = indiaCalendarDate.toISOString().slice(0, 10);
  const startOfWeek = new Date(`${weekText}T00:00:00+05:30`);
  const startOfMonth = new Date(
    `${indiaYear}-${String(indiaMonth).padStart(2, '0')}-01T00:00:00+05:30`,
  );
  const returningVisits = lifetimeOrders.filter((order) => order.is_returning);
  const lifetimeRetained = new Set(returningVisits.map((order) => order.customer_id)).size;

  res.json({
    success: true,
    summary: {
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, order) => sum + Number(order.amount), 0),
      rewardPointsIssued: orders.reduce((sum, order) => sum + Number(order.reward_points), 0),
      totalCustomers: customersResult.data?.length || 0,
    },
    intervals,
    retention: {
      lifetimeCustomers: lifetimeRetained,
      selectedVisits: orders.filter((order) => order.is_returning).length,
      todayVisits: returningVisits.filter((order) => new Date(order.created_at) >= startOfToday).length,
      weekVisits: returningVisits.filter((order) => new Date(order.created_at) >= startOfWeek).length,
      monthVisits: returningVisits.filter((order) => new Date(order.created_at) >= startOfMonth).length,
    },
  });
});

app.get('/api/settings/reward', requireAuth, async (_req, res) => {
  try {
    const settings = await getRewardSettings();
    res.json({
      success: true,
      rewardPercentage: settings.defaultPercentage,
      rewardMinimum: settings.minimum,
      rewardOptions: REWARD_PERCENTAGES.filter((value) => value >= settings.minimum),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/settings/reward', requireAuth, requireRole('admin'), async (req, res) => {
  const rewardPercentage = Number(req.body.rewardPercentage);
  const rewardMinimum = Number(req.body.rewardMinimum);
  if (
    !isAllowedRewardPercentage(rewardPercentage) ||
    !isAllowedRewardPercentage(rewardMinimum) ||
    rewardPercentage < rewardMinimum
  ) {
    return res.status(400).json({
      success: false,
      error: 'Choose valid percentages and keep the default at or above the minimum',
    });
  }
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from('app_settings').upsert([
    {
      key: 'reward_percentage', value: rewardPercentage,
      updated_by: req.auth.user.id, updated_at: now,
    },
    {
      key: 'reward_minimum', value: rewardMinimum,
      updated_by: req.auth.user.id, updated_at: now,
    },
  ]);
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({
    success: true,
    rewardPercentage,
    rewardMinimum,
    rewardOptions: REWARD_PERCENTAGES.filter((value) => value >= rewardMinimum),
  });
});

app.get('/api/webhooks/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && WA_VERIFY_TOKEN && token === WA_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post('/api/webhooks/whatsapp', async (req, res) => {
  if (!WA_APP_SECRET || !req.rawBody) return res.sendStatus(503);
  const signature = req.headers['x-hub-signature-256'];
  const expected = `sha256=${crypto
    .createHmac('sha256', WA_APP_SECRET)
    .update(req.rawBody)
    .digest('hex')}`;
  const validSignature = typeof signature === 'string'
    && signature.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!validSignature) return res.sendStatus(401);

  const statusRank = { queued: 0, sent: 1, delivered: 2, read: 3, failed: 4 };
  const statuses = req.body?.entry?.flatMap((entry) =>
    entry.changes?.flatMap((change) => change.value?.statuses || []) || []) || [];
  for (const item of statuses) {
    const status = item.status;
    if (!(status in statusRank) || !item.id) continue;
    const { data: existing } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('id,status')
      .eq('meta_message_id', item.id)
      .maybeSingle();
    if (!existing || statusRank[status] < statusRank[existing.status]) continue;
    const error = item.errors?.[0];
    await supabaseAdmin.from('whatsapp_messages').update({
      status,
      error_code: error?.code ? String(error.code) : null,
      error_message: error?.title || error?.message || null,
      status_timestamp: item.timestamp
        ? new Date(Number(item.timestamp) * 1000).toISOString()
        : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', existing.id);
  }
  res.sendStatus(200);
});

app.post('/api/send-qr', requireAuth, async (req, res) => {
  const customerCode = cleanText(req.body.cid, 100);
  let customerQuery = supabaseAdmin
    .from('customers')
    .select('id,customer_code,name,phone,email')
    .eq('customer_code', customerCode);
  const { data: customer, error } = await customerQuery.single();
  if (error || !customer) {
    return res.status(404).json({ success: false, error: 'Customer not found' });
  }
  const merchantId = req.auth.profile.role === 'merchant'
    ? req.auth.profile.merchant_id
    : cleanText(req.body.merchantId, 100) || req.body.merchant_id;
  const { data: membership } = await supabaseAdmin.from('customer_merchants')
    .select('reward_points,merchants(name)')
    .eq('customer_id', customer.id)
    .eq('merchant_id', merchantId)
    .maybeSingle();
  if (!membership) {
    return res.status(403).json({ success: false, error: 'Customer is not linked to the merchant' });
  }
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id,order_no,amount,reward_points,created_at')
    .eq('customer_id', customer.id)
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  const purchase = {
    order_id: order?.id || null,
    order_no: order?.order_no || '',
    customer_id: customer.id,
    customer_code: customer.customer_code,
    customer_name: customer.name,
    customer_phone: customer.phone,
    customer_email: customer.email || '',
    amount: order?.amount || 0,
    points_earned: order?.reward_points || 0,
    total_points: membership.reward_points,
    merchant_name: membership.merchants?.name || '',
  };
  const whatsapp = await sendRegistrationWhatsApp(purchase);
  res.status(whatsapp.sent ? 200 : 502).json({ success: whatsapp.sent, whatsapp });
});

// Kept temporarily for reference while existing deployments migrate to templates.
if (false) app.post('/api/send-qr-legacy-disabled', requireAuth, async (req, res) => {
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
          image: { id: mediaId, caption: `🎉 Welcome to *${merchant}*, ${name}!\n\nYour ID: *${cid}*\n\n📲 Save the QR and show it at checkout for instant recognition!\n\n— Affiliate AE` },
        }, { headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' } });
      } else {
        await axios.post(WA_URL, {
          messaging_product: 'whatsapp', to: toPhone, type: 'text',
          text: { body: `🎉 Welcome to *${merchant}*, ${name}!\n\nYour Customer ID: *${cid}*\n\n📲 Show the ID at checkout for instant recognition.\n\n— Affiliate AE` },
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
//  GET /api/status
// ══════════════════════════════════════════
app.get('/api/status', (_req, res) => {
  res.json({
    supabase:  !!(supabaseAuth && supabaseAdmin),
    resend:    !!process.env.RESEND_API_KEY,
    whatsapp:  !!(WA_TOKEN && WA_PHONE_ID),
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
  console.log(`    WhatsApp : ${WA_TOKEN && WA_PHONE_ID    ? '✅' : '❌ WA_TOKEN / WA_PHONE_ID not set'}\n`);
});

// ══════════════════════════════════════════
