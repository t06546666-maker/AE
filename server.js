require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const axios    = require('axios');
const QRCode   = require('qrcode');
const fs       = require('fs');
const path     = require('path');
const os       = require('os');
const crypto   = require('crypto');
const ExcelJS  = require('exceljs');
const PDFDocument = require('pdfkit');
const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');
let vercelWaitUntil = null;
try {
  ({ waitUntil: vercelWaitUntil } = require('@vercel/functions'));
} catch {}

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
const reactBuildPath = path.join(__dirname, 'dist');
const webRoot = fs.existsSync(path.join(reactBuildPath, 'index.html'))
  ? reactBuildPath
  : path.join(__dirname, 'public');
app.use(express.static(webRoot));

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
const WA_REQUEST_TIMEOUT_MS = Math.max(3000, Number(process.env.WA_REQUEST_TIMEOUT_MS || 8000));
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

async function processPurchase(params, idempotencyKey) {
  const withIdempotency = {
    ...params,
    p_idempotency_key: cleanText(idempotencyKey, 120) || crypto.randomUUID(),
  };
  let result = await supabaseAdmin.rpc('process_purchase', withIdempotency);
  if (result.error && (
    result.error.code === 'PGRST202'
    || /idempotency|function.*process_purchase|schema cache/i.test(result.error.message || '')
  )) {
    result = await supabaseAdmin.rpc('process_purchase', params);
  }
  return result;
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
      {
        headers: { Authorization: `Bearer ${WA_TOKEN}`, ...form.getHeaders() },
        timeout: WA_REQUEST_TIMEOUT_MS,
      },
    );
    return response.data.id;
  } catch (error) {
    const apiError = error.response?.data?.error;
    throw new Error(apiError?.error_data?.details || apiError?.message || error.message);
  } finally {
    try { fs.unlinkSync(qrPath); } catch {}
  }
}

function cleanSearch(value) {
  return cleanText(value, 80).replace(/[,()]/g, ' ').replace(/\s+/g, ' ');
}

function paginationFromRequest(req, defaultSize = 25, maxSize = 100) {
  const enabled = req.query.page !== undefined
    || req.query.pageSize !== undefined
    || req.query.search !== undefined;
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(maxSize, Math.max(1, Number.parseInt(req.query.pageSize, 10) || defaultSize));
  return {
    enabled,
    page,
    pageSize,
    from: (page - 1) * pageSize,
    to: page * pageSize - 1,
    search: cleanSearch(req.query.search),
  };
}

function paginationMeta(paging, total) {
  return {
    page: paging.page,
    pageSize: paging.pageSize,
    total: Number(total || 0),
    totalPages: Math.max(1, Math.ceil(Number(total || 0) / paging.pageSize)),
  };
}

function scheduleBackground(task) {
  if (process.env.VERCEL && vercelWaitUntil) {
    vercelWaitUntil(Promise.resolve().then(task));
    return;
  }
  setImmediate(() => Promise.resolve().then(task).catch((error) => {
    console.error('Background task failed:', error.message);
  }));
}

async function sendWhatsAppTemplate({
  customerId,
  orderId,
  recipient,
  templateName,
  components,
  logId,
}) {
  if (!WA_TOKEN || !WA_PHONE_ID) {
    return { sent: false, error: 'WhatsApp Cloud API is not configured' };
  }

  let messageLogId = logId;
  if (!messageLogId) {
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
    messageLogId = log.id;
  }

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
      timeout: WA_REQUEST_TIMEOUT_MS,
    });
    const messageId = response.data?.messages?.[0]?.id;
    await supabaseAdmin.from('whatsapp_messages').update({
      meta_message_id: messageId || null,
      status: 'sent',
      status_timestamp: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', messageLogId);
    return { sent: true, messageId };
  } catch (error) {
    const apiError = error.response?.data?.error;
    const apiDetails = apiError?.error_data?.details;
    const errorMessage = [apiError?.message || error.message, apiDetails]
      .filter(Boolean)
      .join(' - ');
    await supabaseAdmin.from('whatsapp_messages').update({
      status: 'failed',
      error_code: apiError?.code ? String(apiError.code) : null,
      error_message: errorMessage,
      status_timestamp: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', messageLogId);
    return { sent: false, error: errorMessage };
  }
}

async function sendRegistrationWhatsApp(purchase, logId) {
  if (!WA_TOKEN || !WA_PHONE_ID) {
    return { sent: false, error: 'WhatsApp Cloud API is not configured' };
  }
  const bodyComponent = {
    type: 'body',
    parameters: [
      { type: 'text', text: purchase.customer_name },
      { type: 'text', text: purchase.merchant_name },
      { type: 'text', text: purchase.customer_code },
      { type: 'text', text: `${Number(purchase.reward_percentage)}%` },
      { type: 'text', text: formatPoints(purchase.points_earned) },
      { type: 'text', text: formatPoints(purchase.total_points) },
    ],
  };
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
      logId,
      components: [
        { type: 'header', parameters: [{ type: 'image', image: { id: mediaId } }] },
        bodyComponent,
      ],
    });
  } catch (error) {
    const fallback = await sendWhatsAppTemplate({
      customerId: purchase.customer_id,
      orderId: purchase.order_id,
      recipient: purchase.customer_phone,
      templateName: WA_REGISTRATION_TEMPLATE,
      logId,
      components: [bodyComponent],
    });
    if (fallback.sent) return fallback;
    return { sent: false, error: `${error.message}; fallback: ${fallback.error}` };
  }
}

async function sendRewardWhatsApp(purchase, logId) {
  return sendWhatsAppTemplate({
    customerId: purchase.customer_id,
    orderId: purchase.order_id,
    recipient: purchase.customer_phone,
    templateName: WA_REWARD_TEMPLATE,
    logId,
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
  const paging = paginationFromRequest(req, 20, 100);
  let query = supabaseAdmin.from('merchants')
    .select('id, name, email, phone, created_at', paging.enabled ? { count: 'exact' } : undefined)
    .order('name');
  if (req.auth.profile.role === 'merchant') query = query.eq('id', req.auth.profile.merchant_id);
  if (paging.search) {
    const pattern = `%${paging.search}%`;
    query = query.or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`);
  }
  if (paging.enabled) query = query.range(paging.from, paging.to);
  const { data, error, count } = await query;
  if (error) return res.status(500).json({ success: false, error: error.message });
  const merchantIds = (data || []).map((row) => row.id);
  const orderCounts = new Map();
  if (merchantIds.length) {
    const { data: orderRows } = await supabaseAdmin.from('orders')
      .select('merchant_id')
      .in('merchant_id', merchantIds)
      .limit(10000);
    (orderRows || []).forEach((row) => {
      orderCounts.set(row.merchant_id, (orderCounts.get(row.merchant_id) || 0) + 1);
    });
  }
  res.json({
    success: true,
    merchants: (data || []).map((row) => ({
      id: row.id, name: row.name, email: row.email, phone: row.phone, joined: row.created_at,
      orderCount: orderCounts.get(row.id) || 0,
    })),
    ...(paging.enabled ? { pagination: paginationMeta(paging, count) } : {}),
  });
});

app.get('/api/merchants/:id/summary', requireAuth, requireRole('admin'), async (req, res) => {
  const merchantId = cleanText(req.params.id, 100);
  const { data: merchant, error: merchantError } = await supabaseAdmin
    .from('merchants')
    .select('id,name,email,phone,created_at')
    .eq('id', merchantId)
    .single();
  if (merchantError || !merchant) {
    return res.status(404).json({ success: false, error: 'Merchant not found' });
  }

  const [ordersResult, membershipsResult] = await Promise.all([
    supabaseAdmin
      .from('orders')
      .select('id,customer_id,order_no,amount,reward_points,created_at')
      .eq('merchant_id', merchantId)
      .limit(10000),
    supabaseAdmin
      .from('customer_merchants')
      .select('customer_id,reward_points,qr_scans,joined_at')
      .eq('merchant_id', merchantId)
      .limit(10000),
  ]);
  const baseError = ordersResult.error || membershipsResult.error;
  if (baseError) return res.status(500).json({ success: false, error: baseError.message });

  const memberships = membershipsResult.data || [];
  const orders = ordersResult.data || [];
  const customerIds = [...new Set(memberships.map((row) => row.customer_id).filter(Boolean))];
  const customersResult = customerIds.length
    ? await supabaseAdmin.from('customers')
      .select('id,customer_code,name,phone,email,created_at')
      .in('id', customerIds)
    : { data: [], error: null };
  if (customersResult.error) return res.status(500).json({ success: false, error: customersResult.error.message });

  const orderTotals = new Map();
  orders.forEach((order) => {
    const current = orderTotals.get(order.customer_id) || { orders: 0, revenue: 0, points: 0 };
    current.orders += 1;
    current.revenue += Number(order.amount || 0);
    current.points += Number(order.reward_points || 0);
    orderTotals.set(order.customer_id, current);
  });
  const customerById = new Map((customersResult.data || []).map((customer) => [customer.id, customer]));
  const retainedCustomers = [...orderTotals.values()].filter((row) => row.orders >= 2).length;
  const totalCustomers = memberships.length;
  const totalRevenue = orders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const pointsIssued = orders.reduce((sum, order) => sum + Number(order.reward_points || 0), 0);

  res.json({
    success: true,
    merchant: {
      id: merchant.id,
      name: merchant.name,
      email: merchant.email,
      phone: merchant.phone,
      joined: merchant.created_at,
    },
    summary: {
      totalOrders: orders.length,
      totalRevenue,
      pointsIssued,
      totalCustomers,
      retainedCustomers,
      retentionRate: totalCustomers ? Math.round((retainedCustomers / totalCustomers) * 100) : 0,
    },
    customers: memberships.map((row) => {
      const customer = customerById.get(row.customer_id) || {};
      const totals = orderTotals.get(row.customer_id) || { orders: 0, revenue: 0, points: 0 };
      return {
        id: customer.customer_code || '',
        databaseId: row.customer_id,
        name: customer.name || 'Unknown customer',
        phone: customer.phone || '',
        email: customer.email || '',
        registeredAt: row.joined_at,
        rewardPoints: Number(row.reward_points || 0),
        qrScans: row.qr_scans || 0,
        orderCount: totals.orders,
        totalSpend: totals.revenue,
        pointsIssued: totals.points,
        isRetained: totals.orders >= 2,
      };
    }).sort((a, b) => b.orderCount - a.orderCount || b.rewardPoints - a.rewardPoints),
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
  const merchantId = cleanText(req.params.id, 100);
  const { data: merchant, error: merchantError } = await supabaseAdmin
    .from('merchants')
    .select('id,name')
    .eq('id', merchantId)
    .single();
  if (merchantError || !merchant) return res.status(404).json({ success: false, error: 'Merchant not found' });

  const [{ data: profiles }, { data: orders }, { data: memberships }, { data: legacyCustomers }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id').eq('role', 'merchant').eq('merchant_id', merchantId),
    supabaseAdmin.from('orders').select('id,customer_id').eq('merchant_id', merchantId),
    supabaseAdmin.from('customer_merchants').select('customer_id').eq('merchant_id', merchantId),
    supabaseAdmin.from('customers').select('id,merchant_id').eq('merchant_id', merchantId),
  ]);

  for (const profile of profiles || []) {
    await supabaseAdmin.auth.admin.deleteUser(profile.id);
  }
  await supabaseAdmin.from('profiles').delete().eq('merchant_id', merchantId);

  const orderIds = [...new Set((orders || []).map((order) => order.id).filter(Boolean))];
  const customerIds = [...new Set([
    ...(orders || []).map((order) => order.customer_id),
    ...(memberships || []).map((row) => row.customer_id),
    ...(legacyCustomers || []).map((customer) => customer.id),
  ].filter(Boolean))];

  if (orderIds.length) {
    await supabaseAdmin.from('whatsapp_messages').delete().in('order_id', orderIds);
  }
  await supabaseAdmin.from('orders').delete().eq('merchant_id', merchantId);
  await supabaseAdmin.from('customer_merchants').delete().eq('merchant_id', merchantId);

  let deletedCustomers = 0;
  if (customerIds.length) {
    const [{ data: remainingMemberships }, { data: candidateCustomers }] = await Promise.all([
      supabaseAdmin.from('customer_merchants').select('customer_id,merchant_id').in('customer_id', customerIds),
      supabaseAdmin.from('customers').select('id,merchant_id').in('id', customerIds),
    ]);
    const remainingByCustomer = new Map();
    for (const row of remainingMemberships || []) {
      if (!remainingByCustomer.has(row.customer_id)) remainingByCustomer.set(row.customer_id, []);
      remainingByCustomer.get(row.customer_id).push(row.merchant_id);
    }
    const orphanCustomerIds = [];
    for (const customer of candidateCustomers || []) {
      const remainingMerchantIds = remainingByCustomer.get(customer.id) || [];
      if (!remainingMerchantIds.length) {
        orphanCustomerIds.push(customer.id);
      } else if (customer.merchant_id === merchantId) {
        await supabaseAdmin.from('customers').update({ merchant_id: remainingMerchantIds[0] }).eq('id', customer.id);
      }
    }
    if (orphanCustomerIds.length) {
      const { data: orphanOrders } = await supabaseAdmin.from('orders').select('id').in('customer_id', orphanCustomerIds);
      const orphanOrderIds = (orphanOrders || []).map((order) => order.id).filter(Boolean);
      if (orphanOrderIds.length) await supabaseAdmin.from('whatsapp_messages').delete().in('order_id', orphanOrderIds);
      await supabaseAdmin.from('whatsapp_messages').delete().in('customer_id', orphanCustomerIds);
      await supabaseAdmin.from('orders').delete().in('customer_id', orphanCustomerIds);
      await supabaseAdmin.from('customer_merchants').delete().in('customer_id', orphanCustomerIds);
      const { error: customerDeleteError } = await supabaseAdmin.from('customers').delete().in('id', orphanCustomerIds);
      if (customerDeleteError) return res.status(400).json({ success: false, error: customerDeleteError.message });
      deletedCustomers = orphanCustomerIds.length;
    }
  }

  const { error } = await supabaseAdmin.from('merchants').delete().eq('id', merchantId);
  if (error) return res.status(400).json({ success: false, error: error.message });
  res.json({ success: true, deletedCustomers });
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

async function pagedCustomers(req, res, paging) {
  const isAdmin = req.auth.profile.role === 'admin';
  let customerRows = [];
  let memberships = [];
  let total = 0;

  if (isAdmin) {
    let customerQuery = supabaseAdmin.from('customers')
      .select('id,customer_code,name,phone,email,created_at', { count: 'exact' })
      .order('created_at', { ascending: false });
    if (paging.search) {
      const pattern = `%${paging.search}%`;
      customerQuery = customerQuery.or(
        `customer_code.ilike.${pattern},name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`,
      );
    }
    const customerResult = await customerQuery.range(paging.from, paging.to);
    if (customerResult.error) throw customerResult.error;
    customerRows = customerResult.data || [];
    total = customerResult.count || 0;
    if (customerRows.length) {
      const membershipResult = await supabaseAdmin.from('customer_merchants')
        .select('customer_id,merchant_id,reward_points,qr_scans,joined_at')
        .in('customer_id', customerRows.map((row) => row.id));
      if (membershipResult.error) throw membershipResult.error;
      memberships = membershipResult.data || [];
    }
  } else {
    let matchingCustomerIds = null;
    if (paging.search) {
      const pattern = `%${paging.search}%`;
      const matchingResult = await supabaseAdmin.from('customers')
        .select('id')
        .or(`customer_code.ilike.${pattern},name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`)
        .limit(1000);
      if (matchingResult.error) throw matchingResult.error;
      matchingCustomerIds = (matchingResult.data || []).map((row) => row.id);
      if (!matchingCustomerIds.length) {
        return res.json({ success: true, customers: [], pagination: paginationMeta(paging, 0) });
      }
    }
    let membershipQuery = supabaseAdmin.from('customer_merchants')
      .select('customer_id,merchant_id,reward_points,qr_scans,joined_at', { count: 'exact' })
      .eq('merchant_id', req.auth.profile.merchant_id)
      .order('joined_at', { ascending: false });
    if (matchingCustomerIds) membershipQuery = membershipQuery.in('customer_id', matchingCustomerIds);
    const membershipResult = await membershipQuery.range(paging.from, paging.to);
    if (membershipResult.error) throw membershipResult.error;
    memberships = membershipResult.data || [];
    total = membershipResult.count || 0;
    if (memberships.length) {
      const customerResult = await supabaseAdmin.from('customers')
        .select('id,customer_code,name,phone,email,created_at')
        .in('id', memberships.map((row) => row.customer_id));
      if (customerResult.error) throw customerResult.error;
      customerRows = customerResult.data || [];
    }
  }

  const customerIds = customerRows.map((row) => row.id);
  const merchantIds = [...new Set(memberships.map((row) => row.merchant_id))];
  const [merchantResult, orderResult] = await Promise.all([
    merchantIds.length
      ? supabaseAdmin.from('merchants').select('id,name').in('id', merchantIds)
      : Promise.resolve({ data: [], error: null }),
    customerIds.length
      ? (() => {
        let query = supabaseAdmin.from('orders')
          .select('customer_id,merchant_id,amount')
          .in('customer_id', customerIds)
          .limit(10000);
        if (!isAdmin) query = query.eq('merchant_id', req.auth.profile.merchant_id);
        return query;
      })()
      : Promise.resolve({ data: [], error: null }),
  ]);
  const relatedError = merchantResult.error || orderResult.error;
  if (relatedError) throw relatedError;

  const customerById = new Map(customerRows.map((row) => [row.id, row]));
  const merchantById = new Map((merchantResult.data || []).map((row) => [row.id, row.name]));
  const orderTotals = new Map();
  (orderResult.data || []).forEach((row) => {
    const current = orderTotals.get(row.customer_id) || { count: 0, spend: 0 };
    current.count += 1;
    current.spend += Number(row.amount || 0);
    orderTotals.set(row.customer_id, current);
  });

  if (isAdmin) {
    const membershipsByCustomer = new Map();
    memberships.forEach((row) => {
      const list = membershipsByCustomer.get(row.customer_id) || [];
      list.push({
        merchantId: row.merchant_id,
        merchant: merchantById.get(row.merchant_id) || '',
        rewardPoints: Number(row.reward_points || 0),
        qrScans: Number(row.qr_scans || 0),
        joinedAt: row.joined_at,
      });
      membershipsByCustomer.set(row.customer_id, list);
    });
    return res.json({
      success: true,
      customers: customerRows.map((customer) => {
        const customerMemberships = membershipsByCustomer.get(customer.id) || [];
        const totals = orderTotals.get(customer.id) || { count: 0, spend: 0 };
        const totalRewardPoints = customerMemberships
          .reduce((sum, row) => sum + Number(row.rewardPoints || 0), 0);
        return {
          id: customer.customer_code,
          databaseId: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email || '',
          registeredAt: customer.created_at,
          qrScans: customerMemberships.reduce((sum, row) => sum + row.qrScans, 0),
          rewardPoints: totalRewardPoints,
          totalRewardPoints,
          merchantCount: customerMemberships.length,
          merchant: `${customerMemberships.length} merchant${customerMemberships.length === 1 ? '' : 's'}`,
          merchantId: customerMemberships[0]?.merchantId || '',
          memberships: customerMemberships,
          orderCount: totals.count,
          totalSpend: totals.spend,
          isRetained: totals.count >= 2,
        };
      }),
      pagination: paginationMeta(paging, total),
    });
  }

  return res.json({
    success: true,
    customers: memberships.flatMap((row) => {
      const customer = customerById.get(row.customer_id);
      if (!customer) return [];
      const totals = orderTotals.get(customer.id) || { count: 0, spend: 0 };
      return [{
        id: customer.customer_code,
        databaseId: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email || '',
        registeredAt: row.joined_at || customer.created_at,
        qrScans: Number(row.qr_scans || 0),
        rewardPoints: Number(row.reward_points || 0),
        totalRewardPoints: Number(row.reward_points || 0),
        merchantId: row.merchant_id,
        merchant: merchantById.get(row.merchant_id) || '',
        orderCount: totals.count,
        totalSpend: totals.spend,
        isRetained: totals.count >= 2,
      }];
    }),
    pagination: paginationMeta(paging, total),
  });
}

app.get('/api/customers', requireAuth, async (req, res) => {
  const paging = paginationFromRequest(req, 18, 100);
  if (paging.enabled) {
    try {
      return await pagedCustomers(req, res, paging);
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
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

  if (req.auth.profile.role === 'admin') {
    const grouped = new Map();
    memberships.forEach((row) => {
      const customer = customerById.get(row.customer_id);
      if (!customer) return;
      const existing = grouped.get(customer.id) || {
        id: customer.customer_code,
        databaseId: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email || '',
        registeredAt: customer.created_at,
        qrScans: 0,
        rewardPoints: 0,
        totalRewardPoints: 0,
        merchantCount: 0,
        merchant: '',
        merchantId: '',
        memberships: [],
      };
      const points = Number(row.reward_points || 0);
      existing.qrScans += Number(row.qr_scans || 0);
      existing.rewardPoints += points;
      existing.totalRewardPoints += points;
      if (!existing.merchantId) existing.merchantId = row.merchant_id;
      existing.memberships.push({
        merchantId: row.merchant_id,
        merchant: merchantById.get(row.merchant_id)?.name || '',
        rewardPoints: points,
        qrScans: Number(row.qr_scans || 0),
        joinedAt: row.joined_at,
      });
      existing.merchantCount = existing.memberships.length;
      existing.merchant = `${existing.merchantCount} merchant${existing.merchantCount === 1 ? '' : 's'}`;
      const joined = new Date(row.joined_at).getTime();
      if (Number.isFinite(joined) && joined < new Date(existing.registeredAt).getTime()) {
        existing.registeredAt = row.joined_at;
      }
      grouped.set(customer.id, existing);
    });
    return res.json({
      success: true,
      customers: [...grouped.values()].sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt)),
    });
  }

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

app.delete('/api/customers/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const rawId = cleanText(req.params.id, 100);
  let query = supabaseAdmin.from('customers').select('id,customer_code,name').limit(1);
  query = rawId.startsWith('C') ? query.eq('customer_code', rawId) : query.eq('id', rawId);
  const { data: matches, error: customerError } = await query;
  const customer = matches?.[0];
  if (customerError) return res.status(500).json({ success: false, error: customerError.message });
  if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

  const { data: orders, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select('id')
    .eq('customer_id', customer.id);
  if (ordersError) return res.status(500).json({ success: false, error: ordersError.message });
  const orderIds = (orders || []).map((order) => order.id).filter(Boolean);

  if (orderIds.length) await supabaseAdmin.from('whatsapp_messages').delete().in('order_id', orderIds);
  await supabaseAdmin.from('whatsapp_messages').delete().eq('customer_id', customer.id);
  await supabaseAdmin.from('orders').delete().eq('customer_id', customer.id);
  await supabaseAdmin.from('customer_merchants').delete().eq('customer_id', customer.id);
  const { error: deleteError } = await supabaseAdmin.from('customers').delete().eq('id', customer.id);
  if (deleteError) return res.status(400).json({ success: false, error: deleteError.message });

  res.json({ success: true });
});

app.post('/api/customers', requireAuth, async (req, res) => {
  const name = cleanText(req.body.name, 100);
  const phone = normalizePhone(req.body.phone);
  const email = cleanText(req.body.email, 254).toLowerCase();
  const amount = Number(req.body.amount);
  const rewardPercentage = Number(req.body.rewardPercentage);
  const rewardSettings = await getRewardSettings();
  const merchantId = req.auth.profile.role === 'admin'
    ? cleanText(req.body.merchantId, 100)
    : req.auth.profile.merchant_id;
  if (
    !name ||
    !phone ||
    (email && !isEmail(email)) ||
    !merchantId ||
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

  const { data: purchases, error: purchaseError } = await processPurchase({
    p_customer_code: customer.customer_code,
    p_merchant_id: merchantId,
    p_amount: amount,
    p_reward_percentage: rewardPercentage,
    p_source: 'registration',
    p_location: cleanText(req.body.location, 160) || 'In-store',
  }, req.get('Idempotency-Key'));
  if (purchaseError || !purchases?.[0]) {
    if (createdCustomer) await supabaseAdmin.from('customers').delete().eq('id', customer.id);
    return res.status(400).json({
      success: false,
      error: purchaseError?.message || 'Could not create first purchase',
    });
  }
  const purchase = purchases[0];
  const whatsapp = await queueWhatsApp(purchase, 'registration');
  const emailResult = purchase.customer_email && resend && process.env.RESEND_FROM_EMAIL
    ? { queued: true, sent: false }
    : { queued: false, sent: false, error: 'Email not configured or not provided' };
  scheduleBackground(() => runPurchaseNotifications(
    purchase,
    'registration',
    whatsapp,
    emailResult.queued,
  ));
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
  const { data, error } = await processPurchase({
    p_customer_code: customerCode,
    p_merchant_id: req.auth.profile.merchant_id,
    p_amount: amount,
    p_reward_percentage: rewardPercentage,
    p_source: 'qr',
    p_location: cleanText(req.body.location, 160) || 'In-store',
  }, req.get('Idempotency-Key'));
  if (error || !data?.[0]) {
    return res.status(400).json({ success: false, error: error?.message || 'Checkout failed' });
  }
  const purchase = data[0];
  const whatsapp = await queueWhatsApp(purchase, 'reward');
  scheduleBackground(() => runPurchaseNotifications(purchase, 'reward', whatsapp));
  res.status(201).json({ success: true, purchase, whatsapp });
});

app.get('/api/orders', requireAuth, async (req, res) => {
  const paging = paginationFromRequest(req, 25, 100);
  let query = supabaseAdmin.from('orders')
    .select(
      'id, order_no, amount, reward_points, reward_percentage, is_returning, source, location, email_sent, created_at, customers(customer_code,name,phone,email), merchants(name), whatsapp_messages(status,updated_at)',
      paging.enabled ? { count: 'exact' } : undefined,
    )
    .order('created_at', { ascending: false });
  if (req.auth.profile.role === 'merchant') query = query.eq('merchant_id', req.auth.profile.merchant_id);
  if (paging.search) {
    const pattern = `%${paging.search}%`;
    const customerResult = await supabaseAdmin.from('customers')
      .select('id')
      .or(`customer_code.ilike.${pattern},name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`)
      .limit(1000);
    if (customerResult.error) return res.status(500).json({ success: false, error: customerResult.error.message });
    const customerIds = (customerResult.data || []).map((row) => row.id);
    query = customerIds.length
      ? query.or(`order_no.ilike.${pattern},customer_id.in.(${customerIds.join(',')})`)
      : query.ilike('order_no', pattern);
  }
  if (paging.enabled) query = query.range(paging.from, paging.to);
  const { data, error, count } = await query;
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
    ...(paging.enabled ? { pagination: paginationMeta(paging, count) } : {}),
  });
});

function parseExportDateRange(req) {
  const from = req.query.from ? new Date(req.query.from) : new Date('1970-01-01T00:00:00.000Z');
  const to = req.query.to ? new Date(req.query.to) : new Date('2999-12-31T00:00:00.000Z');
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) {
    return null;
  }
  return { from, to };
}

async function queueWhatsApp(purchase, kind) {
  if (!WA_TOKEN || !WA_PHONE_ID) {
    return { queued: false, sent: false, error: 'WhatsApp Cloud API is not configured' };
  }
  const templateName = kind === 'registration' ? WA_REGISTRATION_TEMPLATE : WA_REWARD_TEMPLATE;
  const { data, error } = await supabaseAdmin.from('whatsapp_messages').insert({
    customer_id: purchase.customer_id,
    order_id: purchase.order_id,
    template_name: templateName,
    recipient: purchase.customer_phone,
    status: 'queued',
  }).select('id').single();
  if (error) return { queued: false, sent: false, error: error.message };
  return { queued: true, sent: false, logId: data.id };
}

async function runPurchaseNotifications(purchase, kind, whatsappJob, sendEmail = false) {
  const tasks = [];
  if (whatsappJob.queued) {
    tasks.push(kind === 'registration'
      ? sendRegistrationWhatsApp(purchase, whatsappJob.logId)
      : sendRewardWhatsApp(purchase, whatsappJob.logId));
  }
  if (sendEmail && purchase.customer_email) {
    tasks.push(sendWelcomeEmail(purchase).then(async (result) => {
      if (result.sent) {
        await supabaseAdmin.from('orders').update({ email_sent: true }).eq('id', purchase.order_id);
      }
      return result;
    }));
  }
  await Promise.allSettled(tasks);
}

function makeKey(customerId, merchantId) {
  return `${customerId || ''}::${merchantId || ''}`;
}

function money(value) {
  return Number(value || 0).toFixed(2);
}

async function buildExportReport(req) {
  const range = parseExportDateRange(req);
  if (!range) {
    const error = new Error('Valid from and to dates are required');
    error.statusCode = 400;
    throw error;
  }

  const requestedMerchantId = cleanText(req.query.merchantId, 100);
  const requestedSection = cleanText(req.query.section, 30) || 'all';
  const allowedSections = new Set(['all', 'orders', 'points', 'merchants', 'summary']);
  const section = allowedSections.has(requestedSection) ? requestedSection : 'all';
  const isAdmin = req.auth.profile.role === 'admin';
  const merchantId = isAdmin ? requestedMerchantId : req.auth.profile.merchant_id;

  if (requestedMerchantId && !isAdmin) {
    const error = new Error('Admin access required for merchant export filters');
    error.statusCode = 403;
    throw error;
  }

  let scopedMerchantsQuery = supabaseAdmin
    .from('merchants')
    .select('id,name,email,phone,created_at')
    .order('name');
  if (merchantId) scopedMerchantsQuery = scopedMerchantsQuery.eq('id', merchantId);

  let membershipsQuery = supabaseAdmin
    .from('customer_merchants')
    .select('customer_id,merchant_id,reward_points,qr_scans,joined_at,customers(id,customer_code,name,phone,email,created_at),merchants(id,name,email,phone,created_at)')
    .limit(10000);
  if (merchantId) membershipsQuery = membershipsQuery.eq('merchant_id', merchantId);

  let selectedOrdersQuery = supabaseAdmin
    .from('orders')
    .select('id,order_no,customer_id,merchant_id,amount,reward_points,reward_percentage,is_returning,source,location,email_sent,created_at,customers(customer_code,name,phone,email),merchants(name),whatsapp_messages(status,updated_at)')
    .gte('created_at', range.from.toISOString())
    .lt('created_at', range.to.toISOString())
    .order('created_at', { ascending: false })
    .limit(10000);
  if (merchantId) selectedOrdersQuery = selectedOrdersQuery.eq('merchant_id', merchantId);

  let lifetimeOrdersQuery = supabaseAdmin
    .from('orders')
    .select('id,customer_id,merchant_id,amount,reward_points,is_returning,created_at')
    .limit(10000);
  if (merchantId) lifetimeOrdersQuery = lifetimeOrdersQuery.eq('merchant_id', merchantId);

  const [merchantsResult, membershipsResult, selectedOrdersResult, lifetimeOrdersResult] = await Promise.all([
    scopedMerchantsQuery,
    membershipsQuery,
    selectedOrdersQuery,
    lifetimeOrdersQuery,
  ]);
  const queryError = merchantsResult.error || membershipsResult.error
    || selectedOrdersResult.error || lifetimeOrdersResult.error;
  if (queryError) throw queryError;

  const memberships = membershipsResult.data || [];
  const selectedOrders = selectedOrdersResult.data || [];
  const lifetimeOrders = lifetimeOrdersResult.data || [];

  const selectedByMembership = new Map();
  selectedOrders.forEach((order) => {
    const key = makeKey(order.customer_id, order.merchant_id);
    const current = selectedByMembership.get(key) || { orders: 0, amount: 0, points: 0 };
    current.orders += 1;
    current.amount += Number(order.amount || 0);
    current.points += Number(order.reward_points || 0);
    selectedByMembership.set(key, current);
  });

  const lifetimeByMembership = new Map();
  lifetimeOrders.forEach((order) => {
    const key = makeKey(order.customer_id, order.merchant_id);
    const current = lifetimeByMembership.get(key) || { orders: 0, amount: 0, points: 0 };
    current.orders += 1;
    current.amount += Number(order.amount || 0);
    current.points += Number(order.reward_points || 0);
    lifetimeByMembership.set(key, current);
  });

  const customers = memberships.map((row) => {
    const customer = row.customers || {};
    const selectedTotals = selectedByMembership.get(makeKey(row.customer_id, row.merchant_id))
      || { orders: 0, amount: 0, points: 0 };
    const lifetimeTotals = lifetimeByMembership.get(makeKey(row.customer_id, row.merchant_id))
      || { orders: 0, amount: 0, points: 0 };
    return {
      customerId: customer.customer_code || '',
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      merchant: row.merchants?.name || '',
      merchantId: row.merchant_id,
      totalPoints: Number(row.reward_points || 0),
      selectedOrders: selectedTotals.orders,
      selectedPoints: selectedTotals.points,
      lifetimeOrders: lifetimeTotals.orders,
      retained: lifetimeTotals.orders >= 2 ? 'Yes' : 'No',
      registeredAt: row.joined_at || customer.created_at || '',
    };
  }).sort((a, b) => a.merchant.localeCompare(b.merchant) || a.name.localeCompare(b.name));

  const orders = selectedOrders.map((row) => ({
    orderNo: row.order_no,
    customerId: row.customers?.customer_code || '',
    customer: row.customers?.name || '',
    phone: row.customers?.phone || '',
    email: row.customers?.email || '',
    merchant: row.merchants?.name || '',
    amount: Number(row.amount || 0),
    rewardPercentage: Number(row.reward_percentage || 0),
    pointsEarned: Number(row.reward_points || 0),
    source: row.source || '',
    returning: row.is_returning ? 'Yes' : 'No',
    whatsappStatus: [...(row.whatsapp_messages || [])]
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0]?.status || 'not_sent',
    createdAt: row.created_at,
  }));

  const customerCountInRange = memberships.filter((row) => {
    const joined = new Date(row.joined_at);
    return Number.isFinite(joined.getTime()) && joined >= range.from && joined < range.to;
  }).length;

  const retainedCustomerKeys = new Set(
    [...lifetimeByMembership.entries()]
      .filter(([, totals]) => totals.orders >= 2)
      .map(([key]) => key),
  );

  const merchantRows = (merchantsResult.data || []).map((merchant) => {
    const memberRows = memberships.filter((row) => row.merchant_id === merchant.id);
    const merchantOrders = selectedOrders.filter((order) => order.merchant_id === merchant.id);
    const retainedCount = memberRows.filter((row) => (
      (lifetimeByMembership.get(makeKey(row.customer_id, row.merchant_id))?.orders || 0) >= 2
    )).length;
    return {
      name: merchant.name,
      email: merchant.email || '',
      phone: merchant.phone || '',
      customers: memberRows.length,
      orders: merchantOrders.length,
      pointsIssued: merchantOrders.reduce((sum, order) => sum + Number(order.reward_points || 0), 0),
      retainedCustomers: retainedCount,
      joinedAt: merchant.created_at,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    section,
    range,
    scope: {
      role: req.auth.profile.role,
      merchantId: merchantId || '',
      merchantName: merchantId
        ? (merchantsResult.data || []).find((merchant) => merchant.id === merchantId)?.name || ''
        : 'All merchants',
    },
    summary: {
      totalOrders: orders.length,
      totalCustomers: customerCountInRange,
      totalPointsIssued: selectedOrders.reduce((sum, order) => sum + Number(order.reward_points || 0), 0),
      retainedCustomers: retainedCustomerKeys.size,
      returningVisits: selectedOrders.filter((order) => order.is_returning).length,
    },
    customers,
    orders,
    merchants: isAdmin ? merchantRows : [],
  };
}

function addExcelColumns(sheet, columns) {
  sheet.columns = columns.map((column) => ({ ...column, width: column.width || 18 }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF4FF' } };
}

async function createExcelReport(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RewardHub';
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.addRows([
    ['Report Scope', report.scope.merchantName || 'All merchants'],
    ['From', report.range.from.toISOString()],
    ['To', report.range.to.toISOString()],
    ['Generated At', report.generatedAt],
    [],
    ['Total Orders', report.summary.totalOrders],
    ['Total Customers', report.summary.totalCustomers],
    ['Total Points Issued', money(report.summary.totalPointsIssued)],
    ['Retained Customers', report.summary.retainedCustomers],
    ['Returning Visits', report.summary.returningVisits],
  ]);
  summarySheet.getColumn(1).width = 24;
  summarySheet.getColumn(2).width = 34;

  if (['all', 'points'].includes(report.section)) {
    const customersSheet = workbook.addWorksheet('Customer Points');
    addExcelColumns(customersSheet, [
      { header: 'Customer ID', key: 'customerId' },
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Phone', key: 'phone' },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Merchant', key: 'merchant', width: 24 },
      { header: 'Total Points', key: 'totalPoints' },
      { header: 'Selected Orders', key: 'selectedOrders' },
      { header: 'Selected Points', key: 'selectedPoints' },
      { header: 'Lifetime Orders', key: 'lifetimeOrders' },
      { header: 'Retained', key: 'retained' },
      { header: 'Registered Date', key: 'registeredAt', width: 24 },
    ]);
    report.customers.forEach((row) => customersSheet.addRow(row));
  }

  if (['all', 'orders'].includes(report.section)) {
    const ordersSheet = workbook.addWorksheet('Orders');
    addExcelColumns(ordersSheet, [
      { header: 'Order No', key: 'orderNo' },
      { header: 'Customer ID', key: 'customerId' },
      { header: 'Customer', key: 'customer', width: 24 },
      { header: 'Phone', key: 'phone' },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Merchant', key: 'merchant', width: 24 },
      { header: 'Amount', key: 'amount' },
      { header: 'Reward %', key: 'rewardPercentage' },
      { header: 'Points Earned', key: 'pointsEarned' },
      { header: 'Source', key: 'source' },
      { header: 'Returning', key: 'returning' },
      { header: 'WhatsApp Status', key: 'whatsappStatus' },
      { header: 'Date', key: 'createdAt', width: 24 },
    ]);
    report.orders.forEach((row) => ordersSheet.addRow(row));
  }

  if (['all', 'merchants'].includes(report.section) && report.merchants.length) {
    const merchantsSheet = workbook.addWorksheet('Merchants');
    addExcelColumns(merchantsSheet, [
      { header: 'Merchant', key: 'name', width: 24 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Phone', key: 'phone' },
      { header: 'Customers', key: 'customers' },
      { header: 'Orders', key: 'orders' },
      { header: 'Points Issued', key: 'pointsIssued' },
      { header: 'Retained Customers', key: 'retainedCustomers' },
      { header: 'Joined Date', key: 'joinedAt', width: 24 },
    ]);
  }
  if (['all', 'merchants'].includes(report.section) && report.merchants.length) {
    const merchantsSheet = workbook.getWorksheet('Merchants');
    report.merchants.forEach((row) => merchantsSheet.addRow(row));
  }

  return workbook.xlsx.writeBuffer();
}

async function streamExcelReport(report, output) {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: output,
    useStyles: true,
    useSharedStrings: true,
  });
  workbook.creator = 'RewardHub';

  const summarySheet = workbook.addWorksheet('Summary');
  [
    ['Report Scope', report.scope.merchantName || 'All merchants'],
    ['From', report.range.from.toISOString()],
    ['To', report.range.to.toISOString()],
    ['Generated At', report.generatedAt],
    [],
    ['Total Orders', report.summary.totalOrders],
    ['Total Customers', report.summary.totalCustomers],
    ['Total Points Issued', money(report.summary.totalPointsIssued)],
    ['Retained Customers', report.summary.retainedCustomers],
    ['Returning Visits', report.summary.returningVisits],
  ].forEach((row) => summarySheet.addRow(row).commit());
  summarySheet.getColumn(1).width = 24;
  summarySheet.getColumn(2).width = 34;
  summarySheet.commit();

  function addSheet(name, columns, rows) {
    const sheet = workbook.addWorksheet(name);
    sheet.columns = columns.map((column) => ({ ...column, width: column.width || 18 }));
    const heading = sheet.getRow(1);
    heading.font = { bold: true };
    heading.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF4FF' } };
    heading.commit();
    rows.forEach((row) => sheet.addRow(row).commit());
    sheet.commit();
  }

  if (['all', 'points'].includes(report.section)) addSheet('Customer Points', [
    { header: 'Customer ID', key: 'customerId' },
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Phone', key: 'phone' },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Merchant', key: 'merchant', width: 24 },
    { header: 'Total Points', key: 'totalPoints' },
    { header: 'Selected Orders', key: 'selectedOrders' },
    { header: 'Selected Points', key: 'selectedPoints' },
    { header: 'Lifetime Orders', key: 'lifetimeOrders' },
    { header: 'Retained', key: 'retained' },
    { header: 'Registered Date', key: 'registeredAt', width: 24 },
  ], report.customers);

  if (['all', 'orders'].includes(report.section)) addSheet('Orders', [
    { header: 'Order No', key: 'orderNo' },
    { header: 'Customer ID', key: 'customerId' },
    { header: 'Customer', key: 'customer', width: 24 },
    { header: 'Phone', key: 'phone' },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Merchant', key: 'merchant', width: 24 },
    { header: 'Amount', key: 'amount' },
    { header: 'Reward %', key: 'rewardPercentage' },
    { header: 'Points Earned', key: 'pointsEarned' },
    { header: 'Source', key: 'source' },
    { header: 'Returning', key: 'returning' },
    { header: 'WhatsApp Status', key: 'whatsappStatus' },
    { header: 'Date', key: 'createdAt', width: 24 },
  ], report.orders);

  if (['all', 'merchants'].includes(report.section) && report.merchants.length) addSheet('Merchants', [
    { header: 'Merchant', key: 'name', width: 24 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Phone', key: 'phone' },
    { header: 'Customers', key: 'customers' },
    { header: 'Orders', key: 'orders' },
    { header: 'Points Issued', key: 'pointsIssued' },
    { header: 'Retained Customers', key: 'retainedCustomers' },
    { header: 'Joined Date', key: 'joinedAt', width: 24 },
  ], report.merchants);

  await workbook.commit();
}

function tableLine(doc, columns, y) {
  columns.forEach((column) => {
    doc.text(String(column.text ?? ''), column.x, y, {
      width: column.width,
      ellipsis: true,
    });
  });
}

function addPdfTable(doc, title, headers, rows, mapper, maxRows = 30) {
  doc.moveDown(1).fontSize(13).fillColor('#111827').text(title, { underline: true });
  let y = doc.y + 8;
  doc.fontSize(8).fillColor('#374151');
  tableLine(doc, headers.map((header) => ({ ...header, text: header.label })), y);
  y += 14;
  doc.moveTo(40, y - 4).lineTo(555, y - 4).strokeColor('#e5e7eb').stroke();
  rows.slice(0, maxRows).forEach((row) => {
    if (y > 730) {
      doc.addPage();
      y = 50;
    }
    tableLine(doc, mapper(row), y);
    y += 14;
  });
  if (rows.length > maxRows) {
    doc.fillColor('#6b7280').text(`Showing first ${maxRows} of ${rows.length} rows. Use Excel for full details.`, 40, y + 4);
  }
}

function renderPdfReport(doc, report) {
  doc.fontSize(20).fillColor('#111827').text('RewardHub Export Report');
  doc.moveDown(0.4).fontSize(10).fillColor('#4b5563')
    .text(`Scope: ${report.scope.merchantName || 'All merchants'}`)
    .text(`From: ${report.range.from.toISOString()}`)
    .text(`To: ${report.range.to.toISOString()}`)
    .text(`Generated: ${report.generatedAt}`);

  doc.moveDown(1).fontSize(13).fillColor('#111827').text('Summary', { underline: true });
  doc.fontSize(10).fillColor('#111827')
    .text(`Total Orders: ${report.summary.totalOrders}`)
    .text(`Total Customers: ${report.summary.totalCustomers}`)
    .text(`Total Points Issued: ${money(report.summary.totalPointsIssued)}`)
    .text(`Retained Customers: ${report.summary.retainedCustomers}`)
    .text(`Returning Visits: ${report.summary.returningVisits}`);

  if (['all', 'points'].includes(report.section)) addPdfTable(doc, 'Customer Points', [
    { label: 'ID', x: 40, width: 50 },
    { label: 'Name', x: 92, width: 95 },
    { label: 'Phone', x: 190, width: 75 },
    { label: 'Merchant', x: 268, width: 95 },
    { label: 'Points', x: 366, width: 55 },
    { label: 'Orders', x: 424, width: 45 },
    { label: 'Retained', x: 472, width: 55 },
  ], report.customers, (row) => [
    { text: row.customerId, x: 40, width: 50 },
    { text: row.name, x: 92, width: 95 },
    { text: row.phone, x: 190, width: 75 },
    { text: row.merchant, x: 268, width: 95 },
    { text: money(row.totalPoints), x: 366, width: 55 },
    { text: row.lifetimeOrders, x: 424, width: 45 },
    { text: row.retained, x: 472, width: 55 },
  ]);

  if (['all', 'orders'].includes(report.section)) addPdfTable(doc, 'Orders', [
    { label: 'Order', x: 40, width: 65 },
    { label: 'Customer', x: 108, width: 90 },
    { label: 'Merchant', x: 201, width: 95 },
    { label: 'Amount', x: 299, width: 55 },
    { label: 'Rate', x: 357, width: 42 },
    { label: 'Points', x: 402, width: 50 },
    { label: 'WA', x: 455, width: 75 },
  ], report.orders, (row) => [
    { text: row.orderNo, x: 40, width: 65 },
    { text: row.customer, x: 108, width: 90 },
    { text: row.merchant, x: 201, width: 95 },
    { text: `Rs. ${money(row.amount)}`, x: 299, width: 55 },
    { text: `${row.rewardPercentage}%`, x: 357, width: 42 },
    { text: money(row.pointsEarned), x: 402, width: 50 },
    { text: row.whatsappStatus, x: 455, width: 75 },
  ]);

  if (['all', 'merchants'].includes(report.section) && report.merchants.length) {
    addPdfTable(doc, 'Merchants', [
      { label: 'Merchant', x: 40, width: 120 },
      { label: 'Email', x: 163, width: 120 },
      { label: 'Phone', x: 286, width: 75 },
      { label: 'Customers', x: 364, width: 55 },
      { label: 'Orders', x: 422, width: 45 },
      { label: 'Points', x: 470, width: 55 },
    ], report.merchants, (row) => [
      { text: row.name, x: 40, width: 120 },
      { text: row.email, x: 163, width: 120 },
      { text: row.phone, x: 286, width: 75 },
      { text: row.customers, x: 364, width: 55 },
      { text: row.orders, x: 422, width: 45 },
      { text: money(row.pointsIssued), x: 470, width: 55 },
    ]);
  }
}

function streamPdfReport(report, output) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(output);
  renderPdfReport(doc, report);
  doc.end();
}

function exportFilename(ext) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `rewardhub-export-${stamp}.${ext}`;
}

app.get('/api/exports/full.xlsx', requireAuth, async (req, res) => {
  try {
    const report = await buildExportReport(req);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${exportFilename('xlsx')}"`);
    await streamExcelReport(report, res);
  } catch (error) {
    if (!res.headersSent) res.status(error.statusCode || 500).json({ success: false, error: error.message });
    else res.destroy(error);
  }
});

app.get('/api/exports/full.pdf', requireAuth, async (req, res) => {
  try {
    const report = await buildExportReport(req);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${exportFilename('pdf')}"`);
    streamPdfReport(report, res);
  } catch (error) {
    if (!res.headersSent) res.status(error.statusCode || 500).json({ success: false, error: error.message });
    else res.destroy(error);
  }
});

app.get('/api/dashboard', requireAuth, async (req, res) => {
  const from = new Date(req.query.from);
  const to = new Date(req.query.to);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) {
    return res.status(400).json({ success: false, error: 'Valid from and to dates are required' });
  }

  const merchantId = req.auth.profile.role === 'merchant'
    ? req.auth.profile.merchant_id
    : null;
  const analyticsResult = await supabaseAdmin.rpc('get_dashboard_analytics', {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_merchant_id: merchantId,
  });
  if (!analyticsResult.error && analyticsResult.data) {
    return res.json(analyticsResult.data);
  }
  if (analyticsResult.error && !(
    analyticsResult.error.code === 'PGRST202'
    || /get_dashboard_analytics|schema cache/i.test(analyticsResult.error.message || '')
  )) {
    return res.status(500).json({ success: false, error: analyticsResult.error.message });
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
    .select('id,order_no,amount,reward_points,reward_percentage,created_at')
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
    reward_percentage: order?.reward_percentage || 0,
    total_points: membership.reward_points,
    merchant_name: membership.merchants?.name || '',
  };
  const whatsapp = await queueWhatsApp(purchase, 'registration');
  if (!whatsapp.queued) {
    return res.status(502).json({ success: false, whatsapp, error: whatsapp.error });
  }
  const delivery = await sendRegistrationWhatsApp(purchase, whatsapp.logId);
  res.status(delivery.sent ? 200 : 502).json({
    success: delivery.sent,
    whatsapp: {
      ...whatsapp,
      queued: false,
      sent: delivery.sent,
      status: delivery.sent ? 'sent' : 'failed',
      error: delivery.error,
    },
    error: delivery.sent ? undefined : delivery.error,
  });
});

app.get('/api/whatsapp/messages/:id', requireAuth, async (req, res) => {
  const messageId = cleanText(req.params.id, 100);
  const { data: message, error } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('id,customer_id,status,error_code,error_message,created_at,updated_at')
    .eq('id', messageId)
    .single();

  if (error || !message) {
    return res.status(404).json({ success: false, error: 'WhatsApp message was not found' });
  }

  if (req.auth.profile.role === 'merchant') {
    const { data: membership } = await supabaseAdmin
      .from('customer_merchants')
      .select('customer_id')
      .eq('customer_id', message.customer_id)
      .eq('merchant_id', req.auth.profile.merchant_id)
      .maybeSingle();
    if (!membership) {
      return res.status(403).json({ success: false, error: 'You cannot view this message' });
    }
  }

  return res.json({
    id: message.id,
    status: message.status,
    errorCode: message.error_code || null,
    error: message.error_message || null,
    createdAt: message.created_at,
    updatedAt: message.updated_at,
  });
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
    waRegistrationTemplate: WA_REGISTRATION_TEMPLATE,
    waRewardTemplate: WA_REWARD_TEMPLATE,
    waTemplateLanguage: WA_TEMPLATE_LANGUAGE,
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    service: 'affiliate-ae-backend',
    database: supabaseAdmin ? 'configured' : 'not-configured',
  });
});

if (webRoot === reactBuildPath) {
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(reactBuildPath, 'index.html'));
  });
}

module.exports = app;

const PORT = process.env.PORT || 3000;
if (require.main === module) app.listen(PORT, () => {
  console.log(`\n🚀  Affiliate AE → http://localhost:${PORT}`);
  console.log(`    Resend   : ${process.env.RESEND_API_KEY ? '✅' : '❌ RESEND_API_KEY not set'}`);
  console.log(`    WhatsApp : ${WA_TOKEN && WA_PHONE_ID    ? '✅' : '❌ WA_TOKEN / WA_PHONE_ID not set'}\n`);
});

// ══════════════════════════════════════════
