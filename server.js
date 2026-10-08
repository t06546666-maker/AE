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
const multer   = require('multer');
const { Resend } = require('resend');
const Razorpay = require('razorpay');
const { createClient } = require('@supabase/supabase-js');
const jwt      = require('jsonwebtoken');
const dailyGreetings = require('./backend/daily-messages.json');
let initializeApp;
let cert;
let getAuth;
let getMessaging;

let firebaseInitialized = false;
let firebaseInitializationPromise;
async function initializeFirebaseAdmin() {
  try {
  ({ initializeApp, cert } = await import('firebase-admin/app'));
  ({ getAuth } = await import('firebase-admin/auth'));
  const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
  const serviceAccount = fs.existsSync(serviceAccountPath)
    ? require(serviceAccountPath)
    : process.env.FIREBASE_SERVICE_ACCOUNT_JSON
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
      : null;
  if (!serviceAccount) throw new Error('Firebase service account is not configured');
  initializeApp({
    credential: cert(serviceAccount)
  });
  firebaseInitialized = true;
  console.log('Firebase Admin initialized successfully.');
  } catch (e) {
  console.warn('Firebase Admin could not be initialized:', e.message);
  }
}
firebaseInitializationPromise = initializeFirebaseAdmin();

async function sendPushNotification(token, title, body, data = {}) {
  await firebaseInitializationPromise;
  if (!firebaseInitialized || !token) return false;
  try {
    ({ getMessaging } = await import('firebase-admin/messaging'));
    await getMessaging().send({
      token,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).filter(([, value]) => value != null).map(([key, value]) => [key, String(value)])),
      android: {
        priority: 'high',
        notification: {
          channelId: 'ae_notifications',
          sound: 'default'
        }
      }
    });
    return true;
  } catch (error) {
    console.error('Error sending push notification:', error.message);
    return false;
  }
}

// --- AE Settlement Engine ---
const { recordRewardEarned } = require('./src/modules/affiliate/rewards');
const { toPaise } = require('./src/modules/affiliate/common/money');
const networksRouter = require('./src/modules/affiliate/networks');
const redemptionsRouter = require('./src/modules/affiliate/redemptions');
const { router: rewardsRouter } = require('./src/modules/affiliate/rewards');
const { router: settlementsRouter } = require('./src/modules/affiliate/settlements');
const paymentsRouter = require('./src/modules/affiliate/payments');


function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password, hash) {
  if (!hash || typeof hash !== 'string' || !hash.includes(':')) return false;
  const [salt, key] = hash.split(':');
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
    return key === derivedKey;
  } catch {
    return false;
  }
}

function generateCustomerPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pwd = '';
  for(let i=0; i<6; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  return pwd;
}
// --------------------------------------

let vercelWaitUntil = null;
try {
  ({ waitUntil: vercelWaitUntil } = require('@vercel/functions'));
} catch {}

const app = express();
// Capacitor Android WebViews use localhost/capacitor origins, not only the
// hosted website origin. Always allow these native origins so FCM tokens can
// be saved automatically after login; deployment-specific origins remain env
// configurable.
const allowedOrigins = [...new Set(`${process.env.CORS_ORIGINS || ''},https://affiliateae.co.in,https://www.affiliateae.co.in,http://localhost,https://localhost,capacitor://localhost`
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean))];

app.disable('x-powered-by');
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    const error = new Error('Origin not allowed by CORS');
    error.status = 403;
    return callback(error);
  },
}));
// Express forwards middleware errors through next(), not the API wrapper's catch.
app.use((error, _req, res, next) => {
  if (error.message !== 'Origin not allowed by CORS') return next(error);
  return res.status(403).json({ success: false, error: 'This website origin is not allowed', code: 'ORIGIN_NOT_ALLOWED' });
});
app.use('/api/field/attendance/start', requireAuth, requireRole('field_manager'), express.json({ limit: '3mb' }));
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
app.use(express.static(webRoot, {
  setHeaders(res, filePath) {
    if (path.basename(filePath) === 'index.html') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      return;
    }
    if (filePath.includes(`${path.sep}assets${path.sep}`)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));

// ── Clients ──
const resend      = process.env.RESEND_API_KEY    ? new Resend(process.env.RESEND_API_KEY) : null;
const razorpay    = (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
  ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
  : null;
const WA_TOKEN    = process.env.WA_TOKEN;
const WA_PHONE_ID = process.env.WA_PHONE_ID;
const WA_API_VERSION = process.env.WA_API_VERSION || 'v23.0';
const WA_URL      = `https://graph.facebook.com/${WA_API_VERSION}/${WA_PHONE_ID}/messages`;
const WA_VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN;
const WA_APP_SECRET = process.env.WA_APP_SECRET;
const WA_REGISTRATION_TEMPLATE = process.env.WA_REGISTRATION_TEMPLATE || 'welcome';
const WA_TEMPORARY_TEMPLATE = cleanText(process.env.WA_TEMPORARY_TEMPLATE || 'temporary', 512);
const WA_REWARD_TEMPLATE = process.env.WA_REWARD_TEMPLATE || 'reward_receipt';
const WA_REDEEM_TEMPLATE = process.env.WA_REDEEM_TEMPLATE || 'redeem_receipt';
const WA_MERCHANT_CREDENTIALS_TEMPLATE = cleanText(
  process.env.WA_MERCHANT_CREDENTIALS_TEMPLATE || 'merchant_account_ready',
  512,
);
// Enable only after the exact welcome copy is approved in Meta and its bonus is confirmed.
const WA_MERCHANT_WELCOME_TEMPLATE = cleanText(process.env.WA_MERCHANT_WELCOME_TEMPLATE || '', 512);
const WA_OFFER_TEMPLATE = cleanText(
  process.env.WA_OFFER_TEMPLATE || 'merchant_offer_v1',
  512,
);
const WA_MERCHANT_ORDER_TEMPLATE = cleanText(
  process.env.WA_MERCHANT_ORDER_TEMPLATE || 'merchant_new_order_v1',
  512,
);
const WA_CUSTOMER_ORDER_STATUS_TEMPLATE = cleanText(
  process.env.WA_CUSTOMER_ORDER_STATUS_TEMPLATE || 'customer_order_status_v1',
  512,
);
const WA_OTP_TEMPLATE = cleanText(process.env.WA_OTP_TEMPLATE || 'customer_login_otp', 512);
// Keep WhatsApp limited to onboarding when the app uses Firebase push notifications
// for ongoing events. Set WA_REGISTRATION_ONLY=false only if additional WhatsApp
// templates are intentionally enabled later.
const WA_REGISTRATION_ONLY = String(process.env.WA_REGISTRATION_ONLY || 'true').toLowerCase() === 'true';
const WA_TEMPLATE_LANGUAGE = process.env.WA_TEMPLATE_LANGUAGE || 'en';
const WA_REQUEST_TIMEOUT_MS = Math.max(3000, Number(process.env.WA_REQUEST_TIMEOUT_MS || 8000));
const OFFER_QUEUE_SECRET = process.env.OFFER_QUEUE_SECRET;
const OFFER_IMAGE_BUCKET = 'offer-images';
const OFFER_BATCH_SIZE = Math.min(50, Math.max(1, Number(process.env.OFFER_BATCH_SIZE || 20)));
const offerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});
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

function redemptionDiscount(amount, type, value) {
  const normalizedType = type === 'flat' ? 'flat' : 'percentage';
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) return null;
  if (normalizedType === 'flat') {
    const allowed = !Number.isFinite(amount) || amount < 100 ? [] : amount < 200 ? [2, 5] : amount < 500 ? [2, 5, 10] : [2, 5, 10, 50];
    if (!allowed.includes(numericValue)) return null;
  }
  const rawAmount = normalizedType === 'flat' ? numericValue : amount * numericValue / 100;
  const discountAmount = Math.min(amount, Math.max(0, rawAmount));
  return {
    type: normalizedType,
    value: numericValue,
    amount: discountAmount,
    percentage: amount > 0 ? discountAmount * 100 / amount : 0,
  };
}

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const radians = (value) => value * Math.PI / 180;
  const dLat = radians(lat2 - lat1); const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const national = digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(national) ? `91${national}` : '';
}

function isEmail(value) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isStrongPassword(value) {
  return typeof value === 'string'
    && value.length >= 10
    && value.length <= 72
    && /[a-z]/.test(value)
    && /[A-Z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9]/.test(value);
}

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = crypto.randomBytes(16);
  const generated = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
  return `Aa1!${generated}`;
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
    .select('id, full_name, role, merchant_id, must_change_password, password_reset_at, password_changed_at')
    .eq('id', user.id)
    .single();
  if (profileError || !profile) {
    return res.status(403).json({ success: false, error: 'Account profile is not configured' });
  }

  req.auth = { user, profile, token };
  const passwordRoute = req.path === '/api/auth/change-password'
    || req.path === '/api/auth/me';
  if (profile.role === 'merchant' && profile.must_change_password && !passwordRoute) {
    return res.status(403).json({
      success: false,
      code: 'PASSWORD_CHANGE_REQUIRED',
      error: 'Change the temporary password before continuing',
    });
  }
  next();
}

const CUSTOMER_JWT_SECRET = process.env.CUSTOMER_JWT_SECRET || '07899040657f592d4f4d71c954e7977d7090e5e51e2c6cd44c1069c8ee06794c';
const customerOtps = new Map();

function customerSessionTokens(customer) {
  const credentialVersion = crypto.createHmac('sha256', CUSTOMER_JWT_SECRET).update(customer.password_hash || '').digest('hex');
  return {
    accessToken: jwt.sign({ customerId: customer.id, role: 'customer' }, CUSTOMER_JWT_SECRET, { expiresIn: '30d' }),
    refreshToken: jwt.sign({ customerId: customer.id, role: 'customer', purpose: 'refresh', credentialVersion }, CUSTOMER_JWT_SECRET, { expiresIn: '365d' }),
  };
}

app.post('/api/auth/refresh', async (req, res) => {
  if (!requireSupabase(res)) return;
  const refreshToken = typeof req.body.refreshToken === 'string' ? req.body.refreshToken : '';
  if (!refreshToken || refreshToken.length > 8192) return res.status(401).json({ error: 'Sign in again to renew your session.' });
  try {
    if (req.body.customer === true) {
      const claims = jwt.verify(refreshToken, CUSTOMER_JWT_SECRET);
      if (claims.purpose !== 'refresh' || claims.role !== 'customer') return res.status(401).json({ error: 'Invalid refresh session.' });
      const { data: customer, error } = await supabaseAdmin.from('customers').select('*').eq('id', claims.customerId).single();
      if (error) throw error;
      const version = customer && crypto.createHmac('sha256', CUSTOMER_JWT_SECRET).update(customer.password_hash || '').digest('hex');
      if (!customer || version !== claims.credentialVersion) return res.status(401).json({ error: 'Sign in again to renew your session.' });
      return res.json(customerSessionTokens(customer));
    }
    // A separate client prevents one person's refresh session affecting another.
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) return res.status(401).json({ error: 'Sign in again to renew your session.' });
    return res.json({ accessToken: data.session.access_token, refreshToken: data.session.refresh_token });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') return res.status(401).json({ error: 'Sign in again to renew your session.' });
    return res.status(503).json({ error: 'Session renewal is temporarily unavailable. Please retry.' });
  }
});

async function requireCustomerAuth(req, res, next) {
  if (!requireSupabase(res)) return;
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ success: false, error: 'Authentication required' });

  try {
    const payload = jwt.verify(token, CUSTOMER_JWT_SECRET);
    if (!payload.customerId || payload.purpose === 'refresh') return res.status(401).json({ success: false, error: 'Invalid token' });
    
    const { data: customer, error } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('id', payload.customerId)
      .single();
      
    if (error || !customer) return res.status(401).json({ success: false, error: 'Customer not found' });
    req.customer = { ...customer, role: 'customer' };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session' });
  }
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

const EARN_OPTIONS = [5, 10, 20, 30, 50];
const REDEEM_OPTIONS = [1, 2, 3, 4, 5, 10, 15, 20];

function formatPoints(value) {
  return Number(value || 0).toFixed(2);
}

async function getAdminRewardConfig() {
  const { data } = await supabaseAdmin.from('app_settings').select('key,value').in('key', ['earn_options', 'redeem_options', 'subscription_price', 'subscription_points', 'subscription_days', 'subscription_plans']);
  let earn = EARN_OPTIONS;
  let redeem = REDEEM_OPTIONS;
  if (data) {
    const earnStr = data.find(r => r.key === 'earn_options')?.value;
    const redeemStr = data.find(r => r.key === 'redeem_options')?.value;
    if (earnStr) earn = JSON.parse(earnStr);
    if (redeemStr) redeem = JSON.parse(redeemStr);
  }
  const valueFor = (key, fallback) => {
    const raw = data?.find(r => r.key === key)?.value;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  let plans = [
    { id: 'standard', name: 'Standard', monthly: 200, yearly: 2000, points: 10000, days: 30 },
    { id: 'pro', name: 'Pro', monthly: 499, yearly: 4990, points: 30000, days: 30 },
    { id: 'premium', name: 'Premium', monthly: 999, yearly: 9990, points: 75000, days: 30 },
  ];
  const plansStr = data?.find(r => r.key === 'subscription_plans')?.value;
  if (plansStr) { try { const parsed = JSON.parse(plansStr); if (Array.isArray(parsed) && parsed.length) plans = parsed; } catch (_) {} }
  return {
    earnOptions: earn,
    redeemOptions: redeem,
    subscription: {
      price: valueFor('subscription_price', 200),
      points: valueFor('subscription_points', 10000),
      days: valueFor('subscription_days', 30),
      plans,
    },
  };
}

async function pushToProfile(profileId, title, body, data = {}) {
  if (!profileId) return false;
  const { data: profile } = await supabaseAdmin.from('profiles').select('push_token,push_enabled').eq('id', profileId).maybeSingle();
  return profile?.push_enabled !== false && profile?.push_token
    ? sendPushNotification(profile.push_token, title, body, data) : false;
}

async function pushToRole(role, title, body, data = {}) {
  const { data: profiles } = await supabaseAdmin.from('profiles').select('id,push_token,push_enabled').eq('role', role).eq('push_enabled', true).not('push_token', 'is', null);
  await Promise.all((profiles || []).map((profile) => sendPushNotification(profile.push_token, title, body, data)));
}

async function pushToMerchant(merchantId, title, body, data = {}) {
  const { data: profiles } = await supabaseAdmin.from('profiles').select('push_token').eq('role', 'merchant').eq('merchant_id', merchantId).eq('push_enabled', true).not('push_token', 'is', null);
  await Promise.all((profiles || []).map((profile) => sendPushNotification(profile.push_token, title, body, data)));
}

async function pushToCustomer(customerId, title, body, data = {}) {
  try {
    const target = await getCustomerPushTarget(customerId);
    if (!target.push_token || target.push_enabled === false) {
      console.warn('Customer notification skipped:', { customerId, reason: target.push_enabled === false ? 'disabled' : 'no_firestore_token', title });
      return false;
    }
    return target.push_enabled !== false && target.push_token
      ? sendPushNotification(target.push_token, title, body, data) : false;
  } catch (error) {
    console.error('Customer Firestore notification lookup failed:', error.message);
    return false;
  }
}

// Private server-only registry. Authentication still uses the customer's AE
// account, but token storage and delivery no longer query Supabase push fields.
async function customerPushDocument(customerId) {
  await firebaseInitializationPromise;
  if (!firebaseInitialized) throw new Error('Firebase Admin is not configured');
  const { getFirestore } = await import('firebase-admin/firestore');
  return getFirestore().collection('ae_customer_notifications').doc(String(customerId));
}
async function getCustomerPushTarget(customerId) {
  const document = await customerPushDocument(customerId);
  return (await document.get()).data() || {};
}
async function saveCustomerPushTarget(customerId, updates) {
  const document = await customerPushDocument(customerId);
  const { FieldValue } = await import('firebase-admin/firestore');
  await document.set({ ...updates, updated_at: FieldValue.serverTimestamp() }, { merge: true });
}

async function getMerchantEarnRateWithCap(merchantId) {
  const settings = await getMerchantRewardSettings(merchantId);
  const earnRate = settings.earn_points_per_100;
  
  // Calculate points issued this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0,0,0,0);
  
  const { data, error } = await supabaseAdmin.from('orders')
    .select('reward_points')
    .eq('merchant_id', merchantId)
    .gte('created_at', startOfMonth.toISOString());
    
  if (!error && data) {
    const totalIssued = data.reduce((sum, order) => sum + (order.reward_points || 0), 0);
    if (totalIssued >= 5000) {
      return 0; // Cap reached
    }
  }
  return earnRate;
}

async function getMerchantRewardSettings(merchantId) {
  const { data, error } = await supabaseAdmin.from('merchants').select('earn_points_per_100, redeem_discount_per_100, redeem_discount_type, redeem_flat_amount').eq('id', merchantId).single();
  if (error?.code === '42703' || error?.code === 'PGRST204') {
    const legacy = await supabaseAdmin.from('merchants').select('earn_points_per_100, redeem_discount_per_100').eq('id', merchantId).single();
    if (legacy.error) throw legacy.error;
    return { ...legacy.data, redeem_discount_type: 'percentage', redeem_flat_amount: 50 };
  }
  if (error || !data) return { earn_points_per_100: 10, redeem_discount_per_100: 5 };
  return data;
}

// Fixed network reward rule: small purchases use fixed tiers, larger purchases
// earn 10 points per completed INR 100, capped at 100 points.
function calculateFixedPurchasePoints(amount, pointsPer100 = 10) {
  const value = Number(amount || 0);
  if (value < 10) return 0;
  if (value < 50) return 2;
  if (value < 100) return 5;
  const rate = Math.max(0, Math.min(100, Number(pointsPer100) || 10));
  return Math.min(100, Math.floor(value / 100) * rate);
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
  
  // -- AE Reward Engine Hook --
  if (!result.error && result.data && result.data.length > 0) {
    try {
      const orderData = result.data[0];
      // Convert earned points to integer paise (points are numeric so we multiply by 100)
      // Actually, reward points in existing system is a float (e.g., 1.50). 
      // 1 point = 1 INR = 100 paise.
      const rewardPaise = toPaise(orderData.points_earned);
      
      const tx = {
        id: orderData.order_id,
        order_no: orderData.order_no,
        customer_id: orderData.customer_id,
        merchant_id: params.p_merchant_id,
        network_id: '00000000-0000-0000-0000-000000000000' // Default legacy network
      };

      if (rewardPaise > 0) {
        await recordRewardEarned(tx, rewardPaise);
      }
    } catch (engineError) {
      console.error('AE Reward Engine Hook Failed:', engineError);
    }
  }
  // -------------------------------------

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

async function uploadWhatsAppMediaBuffer(buffer, contentType, filename) {
  if (!WA_TOKEN || !WA_PHONE_ID) {
    throw new Error('WhatsApp Cloud API is not configured');
  }
  const FormData = require('form-data');
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', contentType);
  form.append('file', buffer, { contentType, filename });
  try {
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
  }
}

function cleanSearch(value) {
  return cleanText(value, 80).replace(/[,()]/g, ' ').replace(/\s+/g, ' ');
}

function offerImageMiddleware(req, res, next) {
  offerUpload.single('image')(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'Offer image must be 5 MB or smaller' });
    }
    return res.status(400).json({ success: false, error: error.message || 'Offer image upload failed' });
  });
}

function validOfferImage(file) {
  return file && ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
}

function offerImageExtension(contentType) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}

function offerContentType(imagePath) {
  if (/\.png$/i.test(imagePath)) return 'image/png';
  if (/\.webp$/i.test(imagePath)) return 'image/webp';
  return 'image/jpeg';
}

async function uploadOfferImage(merchantId, file) {
  const extension = offerImageExtension(file.mimetype);
  const imagePath = `${merchantId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabaseAdmin.storage
    .from(OFFER_IMAGE_BUCKET)
    .upload(imagePath, file.buffer, {
      contentType: file.mimetype,
      cacheControl: '3600',
      upsert: false,
    });
  if (error) throw error;
  return imagePath;
}

async function signedOfferImageUrl(imagePath) {
  const { data, error } = await supabaseAdmin.storage
    .from(OFFER_IMAGE_BUCKET)
    .createSignedUrl(imagePath, 60 * 60);
  return error ? '' : data.signedUrl;
}

function campaignDto(campaign, failure) {
  if (!campaign) return null;
  return {
    id: campaign.id,
    status: campaign.status,
    totalRecipients: Number(campaign.total_recipients || 0),
    queued: Number(campaign.queued_count || 0),
    processing: Number(campaign.processing_count || 0),
    sent: Number(campaign.sent_count || 0),
    delivered: Number(campaign.delivered_count || 0),
    read: Number(campaign.read_count || 0),
    failed: Number(campaign.failed_count || 0),
    skipped: Number(campaign.skipped_count || 0),
    startedAt: campaign.started_at,
    completedAt: campaign.completed_at,
    createdAt: campaign.created_at,
    failureCode: failure?.error_code || null,
    failureReason: failure?.error_message || null,
  };
}

async function offerDto(row, failure) {
  const campaign = Array.isArray(row.offer_campaigns)
    ? row.offer_campaigns[0] : row.offer_campaigns;
  return {
    id: row.id,
    merchantId: row.merchant_id,
    merchant: row.merchants?.name || '',
    merchantCode: row.merchants?.merchant_code || '',
    title: row.title,
    description: row.description,
    category: row.category || null,
    audience: row.audience || 'all',
    imageUrl: await signedOfferImageUrl(row.image_path),
    expiresAt: row.expires_at,
    status: row.status,
    rejectionReason: row.rejection_reason || '',
    reviewedAt: row.reviewed_at,
    broadcastAt: row.broadcast_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    campaign: campaignDto(campaign, failure),
  };
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

function isTransientWhatsAppFailure(result) {
  const retryableCodes = new Set(['1', '2', '4', '17', '130429', '131000', '131016']);
  return result.httpStatus === 408
    || result.httpStatus === 429
    || result.httpStatus >= 500
    || retryableCodes.has(String(result.errorCode || ''));
}

async function ensureOfferCampaignMedia(campaignId, imagePath) {
  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from('offer_campaigns')
    .select('id,meta_media_id')
    .eq('id', campaignId)
    .single();
  if (campaignError) throw campaignError;
  if (campaign.meta_media_id) return campaign.meta_media_id;

  const { data: image, error: imageError } = await supabaseAdmin.storage
    .from(OFFER_IMAGE_BUCKET)
    .download(imagePath);
  if (imageError) throw imageError;
  const contentType = offerContentType(imagePath);
  const mediaId = await uploadWhatsAppMediaBuffer(
    Buffer.from(await image.arrayBuffer()),
    contentType,
    `merchant-offer.${offerImageExtension(contentType)}`,
  );
  const { error: updateError } = await supabaseAdmin
    .from('offer_campaigns')
    .update({ meta_media_id: mediaId, updated_at: new Date().toISOString() })
    .eq('id', campaignId)
    .is('meta_media_id', null);
  if (updateError) throw updateError;
  return mediaId;
}

async function processOfferRecipient(recipientRow, mediaCache) {
  const now = new Date().toISOString();
  if (!recipientRow.customer_id || !recipientRow.customer_name) {
    await supabaseAdmin.from('offer_recipients').update({
      status: 'skipped',
      error_message: 'Customer is no longer available',
      status_timestamp: now,
      updated_at: now,
    }).eq('id', recipientRow.recipient_id);
    return;
  }

  try {
    let mediaId = mediaCache.get(recipientRow.campaign_id);
    if (!mediaId) {
      mediaId = await ensureOfferCampaignMedia(
        recipientRow.campaign_id,
        recipientRow.image_path,
      );
      mediaCache.set(recipientRow.campaign_id, mediaId);
    }
    
    // Attempt to send a Push Notification
    try {
        await pushToCustomer(
          recipientRow.customer_id,
          `New Offer from ${recipientRow.merchant_name || 'Store'}!`,
          recipientRow.title || 'Tap to claim your exclusive offer.',
          { url: '/customer/offers' }
        );
    } catch (e) {
      console.warn('Failed to send push notification:', e.message);
    }

    const delivery = await sendOfferWhatsApp(recipientRow, mediaId);
    if (delivery.sent) {
      await supabaseAdmin.from('offer_recipients').update({
        status: 'sent',
        meta_message_id: delivery.messageId || null,
        status_timestamp: now,
        error_code: null,
        error_message: null,
        updated_at: now,
      }).eq('id', recipientRow.recipient_id);
      return;
    }

    const retry = recipientRow.attempts < 3 && isTransientWhatsAppFailure(delivery);
    await supabaseAdmin.from('offer_recipients').update({
      status: retry ? 'queued' : 'failed',
      attempts: retry ? recipientRow.attempts : 3,
      next_attempt_at: retry
        ? new Date(Date.now() + recipientRow.attempts * 60_000).toISOString()
        : now,
      error_code: delivery.errorCode || null,
      error_message: delivery.error || 'WhatsApp delivery failed',
      status_timestamp: now,
      updated_at: now,
    }).eq('id', recipientRow.recipient_id);
  } catch (error) {
    const retry = recipientRow.attempts < 3;
    await supabaseAdmin.from('offer_recipients').update({
      status: retry ? 'queued' : 'failed',
      attempts: retry ? recipientRow.attempts : 3,
      next_attempt_at: retry
        ? new Date(Date.now() + recipientRow.attempts * 60_000).toISOString()
        : now,
      error_message: error.message || 'Offer delivery failed',
      status_timestamp: now,
      updated_at: now,
    }).eq('id', recipientRow.recipient_id);
  }
}

async function processOfferQueue(maxBatches = 1) {
  const mediaCache = new Map();
  let processed = 0;
  for (let batch = 0; batch < maxBatches; batch += 1) {
    const { data: recipients, error } = await supabaseAdmin.rpc(
      'claim_offer_recipients',
      { p_limit: OFFER_BATCH_SIZE },
    );
    if (error) throw error;
    if (!recipients?.length) break;

    for (let index = 0; index < recipients.length; index += 5) {
      const group = recipients.slice(index, index + 5);
      await Promise.allSettled(group.map((recipient) =>
        processOfferRecipient(recipient, mediaCache)));
    }
    processed += recipients.length;
    const campaignIds = [...new Set(recipients.map((row) => row.campaign_id))];
    await Promise.allSettled(campaignIds.map((campaignId) =>
      supabaseAdmin.rpc('refresh_offer_campaign', { p_campaign_id: campaignId })));
    if (recipients.length < OFFER_BATCH_SIZE) break;
  }
  return processed;
}

async function sendWhatsAppTemplate({
  customerId,
  orderId,
  customerOrderId,
  merchantId,
  offerId,
  campaignId,
  offerRecipientId,
  messageType = 'order',
  recipient,
  templateName,
  components,
  logId,
}) {
  if (WA_REGISTRATION_ONLY && !['registration', 'registration_password', 'merchant_credentials'].includes(messageType)) {
    return { sent: false, skipped: true, error: 'WhatsApp is limited to registration messages' };
  }
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
        customer_order_id: customerOrderId,
        merchant_id: merchantId,
        offer_id: offerId,
        campaign_id: campaignId,
        offer_recipient_id: offerRecipientId,
        // Registration templates share the existing database onboarding type.
        // `registration_password` is a delivery label, not the Meta template name.
        message_type: messageType === 'registration_password' ? 'qr' : messageType,
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
    return { sent: true, messageId, logId: messageLogId };
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
    return {
      sent: false,
      error: errorMessage,
      errorCode: apiError?.code ? String(apiError.code) : null,
      httpStatus: Number(error.response?.status || 0),
      logId: messageLogId,
    };
  }
}

async function sendRegistrationWhatsApp(purchase, logId) {
  if (!WA_TOKEN || !WA_PHONE_ID) {
    return { sent: false, error: 'WhatsApp Cloud API is not configured' };
  }
  const templateName = WA_REGISTRATION_TEMPLATE;
  const bodyParameters = templateName === 'welcome'
    // The active Meta `welcome` template has three body placeholders.
    // Keep these in the same order as the approved template: name, phone,
    // then the customer code shown under the QR image.
    ? [{ type: 'text', text: purchase.customer_name }, { type: 'text', text: purchase.customer_phone.replace(/^\+91/, '') }, { type: 'text', text: purchase.customer_code }]
    : [{ type: 'text', text: purchase.customer_name }, { type: 'text', text: purchase.merchant_name }, { type: 'text', text: purchase.customer_code }, { type: 'text', text: `${Number(purchase.reward_percentage)}%` }, { type: 'text', text: formatPoints(purchase.points_earned) }, { type: 'text', text: formatPoints(purchase.total_points) }];
  const bodyComponent = {
    type: 'body',
    parameters: bodyParameters,
  };
  try {
    const mediaId = await uploadQrMedia({
      id: purchase.customer_code,
      name: purchase.customer_name,
      phone: purchase.customer_phone,
    });
    const welcomeComponents = [{ type: 'header', parameters: [{ type: 'image', image: { id: mediaId } }] }, bodyComponent];
    const welcomeResult = await sendWhatsAppTemplate({
      customerId: purchase.customer_id,
      orderId: purchase.order_id,
      recipient: purchase.customer_phone,
      templateName,
      messageType: 'registration',
      logId,
      components: welcomeComponents,
    });
    // Send the Utility password message independently. A Marketing welcome
    // template can be blocked by Meta policy and must not prevent credentials.
    let passwordResult = null;
    if (WA_TEMPORARY_TEMPLATE && purchase.temporary_password) {
      // The current Meta `temporary` template is static (zero body variables):
      // it explains that the password is the last six digits of the phone.
      // Custom templates may still use the three-variable format.
      const passwordParameters = WA_TEMPORARY_TEMPLATE === 'temporary' ? [] : [{ type: 'text', text: purchase.customer_name }, { type: 'text', text: purchase.temporary_password }, { type: 'text', text: purchase.customer_code }];
      passwordResult = await sendWhatsAppTemplate({ customerId: purchase.customer_id, orderId: purchase.order_id, recipient: purchase.customer_phone, templateName: WA_TEMPORARY_TEMPLATE, messageType: 'registration_password', components: passwordParameters.length ? [{ type: 'body', parameters: passwordParameters }] : [] });
    }
    return { ...welcomeResult, sent: welcomeResult.sent || Boolean(passwordResult?.sent), password: passwordResult };
  } catch (error) {
    {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await supabaseAdmin.from('whatsapp_messages').update({
        status: 'failed',
        error_message: errorMessage,
        status_timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', logId);
      return { sent: false, error: errorMessage };
    }
  }
}

async function sendRewardWhatsApp(purchase, logId) {
  const usesPurchaseReceiptV2 = WA_REWARD_TEMPLATE === 'purchase_reward_receipt_v2';
  const parameters = usesPurchaseReceiptV2
    ? [
      { type: 'text', text: purchase.customer_name },
      { type: 'text', text: purchase.merchant_name },
      { type: 'text', text: Number(purchase.reward_percentage).toString() },
      { type: 'text', text: purchase.order_no },
      { type: 'text', text: Number(purchase.amount).toFixed(2) },
      { type: 'text', text: formatPoints(purchase.points_earned) },
      { type: 'text', text: formatPoints(purchase.total_points) },
    ]
    : [
      { type: 'text', text: purchase.customer_name },
      { type: 'text', text: purchase.merchant_name },
      { type: 'text', text: purchase.order_no },
      { type: 'text', text: Number(purchase.amount).toFixed(2) },
      { type: 'text', text: `${Number(purchase.reward_percentage)}%` },
      { type: 'text', text: formatPoints(purchase.points_earned) },
      { type: 'text', text: formatPoints(purchase.total_points) },
    ];

  return sendWhatsAppTemplate({
    customerId: purchase.customer_id,
    orderId: purchase.order_id,
    recipient: purchase.customer_phone,
    templateName: WA_REWARD_TEMPLATE,
    logId,
    components: [{
      type: 'body',
      parameters,
    }],
  });
}

async function sendRedeemWhatsApp(purchase, logId) {
  const parameters = [
    { type: 'text', text: purchase.customer_name },
    { type: 'text', text: purchase.merchant_name },
    { type: 'text', text: formatPoints(Math.abs(purchase.points_earned)) },
    { type: 'text', text: Number(purchase.amount).toFixed(2) },
    { type: 'text', text: formatPoints(purchase.total_points) },
  ];

  return sendWhatsAppTemplate({
    customerId: purchase.customer_id,
    orderId: purchase.order_id,
    recipient: purchase.customer_phone,
    templateName: WA_REDEEM_TEMPLATE,
    logId,
    components: [{
      type: 'body',
      parameters,
    }],
  });
}

async function sendMerchantAccountReadyWhatsApp(merchant) {
  return sendWhatsAppTemplate({
    merchantId: merchant.id,
    messageType: 'merchant_credentials',
    recipient: merchant.phone,
    templateName: WA_MERCHANT_CREDENTIALS_TEMPLATE,
    components: [{
      type: 'body',
      parameters: [
        { type: 'text', text: merchant.name },
        { type: 'text', text: merchant.name },
        { type: 'text', text: merchant.merchant_code },
        { type: 'text', text: merchant.email },
      ],
    }],
  });
}

async function sendMerchantWelcomeWhatsApp(merchant) {
  if (!WA_MERCHANT_WELCOME_TEMPLATE) return sendMerchantAccountReadyWhatsApp(merchant);
  return sendWhatsAppTemplate({
    merchantId: merchant.id,
    messageType: 'merchant_credentials',
    recipient: merchant.phone,
    templateName: WA_MERCHANT_WELCOME_TEMPLATE,
    components: [{ type: 'body', parameters: [
      { type: 'text', text: merchant.name },
      { type: 'text', text: merchant.name },
    ] }],
  });
}

function offerExpiryText(value) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

async function sendOfferWhatsApp(recipientRow, mediaId) {
  return sendWhatsAppTemplate({
    customerId: recipientRow.customer_id,
    merchantId: recipientRow.merchant_id,
    offerId: recipientRow.offer_id,
    campaignId: recipientRow.campaign_id,
    offerRecipientId: recipientRow.recipient_id,
    messageType: 'offer',
    recipient: recipientRow.recipient,
    templateName: WA_OFFER_TEMPLATE,
    components: [
      {
        type: 'header',
        parameters: [{ type: 'image', image: { id: mediaId } }],
      },
      {
        type: 'body',
        parameters: [
          { type: 'text', text: recipientRow.customer_name || 'Customer' },
          { type: 'text', text: recipientRow.merchant_name },
          { type: 'text', text: recipientRow.offer_title },
          { type: 'text', text: recipientRow.offer_description },
          { type: 'text', text: offerExpiryText(recipientRow.offer_expires_at) },
        ],
      },
    ],
  });
}

async function sendWhatsAppInteractive(recipient, interactive) {
  if (WA_REGISTRATION_ONLY) return { sent: false, skipped: true, error: 'WhatsApp is limited to registration messages' };
  if (!WA_TOKEN || !WA_PHONE_ID) {
    return { sent: false, error: 'WhatsApp Cloud API is not configured' };
  }
  try {
    const response = await axios.post(WA_URL, {
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'interactive',
      interactive,
    }, {
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      timeout: WA_REQUEST_TIMEOUT_MS,
    });
    return { sent: true, messageId: response.data?.messages?.[0]?.id };
  } catch (error) {
    return { sent: false, error: error.response?.data?.error?.message || error.message };
  }
}

async function sendWhatsAppText(recipient, body) {
  if (WA_REGISTRATION_ONLY) return { sent: false, skipped: true, error: 'WhatsApp is limited to registration messages' };
  if (!WA_TOKEN || !WA_PHONE_ID) {
    return { sent: false, error: 'WhatsApp Cloud API is not configured' };
  }
  try {
    const response = await axios.post(WA_URL, {
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'text',
      text: { preview_url: false, body },
    }, {
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      timeout: WA_REQUEST_TIMEOUT_MS,
    });
    return { sent: true, messageId: response.data?.messages?.[0]?.id };
  } catch (error) {
    return { sent: false, error: error.response?.data?.error?.message || error.message };
  }
}

function sendCustomerOrderButtons(recipient, body, buttons) {
  return sendWhatsAppInteractive(recipient, {
    type: 'button',
    body: { text: body.slice(0, 1024) },
    action: {
      buttons: buttons.slice(0, 3).map(({ id, title }) => ({
        type: 'reply',
        reply: { id, title: title.slice(0, 20) },
      })),
    },
  });
}

function sendCustomerOrderList(recipient, body, button, rows) {
  return sendWhatsAppInteractive(recipient, {
    type: 'list',
    body: { text: body.slice(0, 1024) },
    action: {
      button: button.slice(0, 20),
      sections: [{ title: 'AE', rows: rows.slice(0, 10).map((row) => ({
        id: row.id.slice(0, 200),
        title: row.title.slice(0, 24),
        description: cleanText(row.description, 72) || undefined,
      })) }],
    },
  });
}

async function sendMerchantCustomerOrderWhatsApp(order) {
  const items = (order.items || []).map((item) => `${item.quantity} x ${item.product_name}`).join(', ');
  return sendWhatsAppTemplate({
    customerId: order.customer_id,
    customerOrderId: order.id,
    merchantId: order.merchant_id,
    messageType: 'customer_order',
    recipient: order.merchant_phone,
    templateName: WA_MERCHANT_ORDER_TEMPLATE,
    components: [{
      type: 'body',
      parameters: [
        { type: 'text', text: order.merchant_name },
        { type: 'text', text: order.request_no },
        { type: 'text', text: order.customer_name },
        { type: 'text', text: order.customer_phone },
        { type: 'text', text: items.slice(0, 512) || 'Custom request' },
      ],
    }],
  });
}

async function sendCustomerOrderStatusWhatsApp(order) {
  return sendWhatsAppTemplate({
    customerId: order.customer_id,
    customerOrderId: order.id,
    merchantId: order.merchant_id,
    messageType: 'customer_order_status',
    recipient: order.customer_phone,
    templateName: WA_CUSTOMER_ORDER_STATUS_TEMPLATE,
    components: [{
      type: 'body',
      parameters: [
        { type: 'text', text: order.customer_name },
        { type: 'text', text: order.request_no },
        { type: 'text', text: order.merchant_name },
        { type: 'text', text: order.status },
      ],
    }],
  });
}

function customerOrderItemText(cart) {
  if (!Array.isArray(cart) || !cart.length) return 'Your cart is empty.';
  const lines = cart.map((item, index) => {
    const price = Number.isFinite(Number(item.unitPrice)) ? ` - Rs ${Number(item.unitPrice).toFixed(2)}` : '';
    return `${index + 1}. ${item.quantity} x ${item.name}${price}`;
  });
  return `Your cart:\n${lines.join('\n')}`;
}

async function getCustomerOrderSession(customer) {
  const { data } = await supabaseAdmin.from('whatsapp_customer_sessions')
    .select('*').eq('customer_id', customer.id).maybeSingle();
  if (data && new Date(data.expires_at).getTime() > Date.now()) return data;
  const session = {
    customer_id: customer.id,
    phone: customer.phone,
    merchant_id: null,
    state: 'merchant',
    cart: [],
    pending_item: null,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  await supabaseAdmin.from('whatsapp_customer_sessions').upsert(session, { onConflict: 'customer_id' });
  return session;
}

async function saveCustomerOrderSession(session, changes) {
  const next = {
    ...changes,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  await supabaseAdmin.from('whatsapp_customer_sessions').update(next).eq('customer_id', session.customer_id);
  return { ...session, ...next };
}

async function showMerchantChoices(customer, session, page = 0) {
  const { data: products } = await supabaseAdmin.from('products')
    .select('merchant_id').eq('active', true);
  const merchantIds = [...new Set((products || []).map((product) => product.merchant_id))];
  if (!merchantIds.length) return sendWhatsAppText(customer.phone, 'No merchant catalogues are available yet. Please try again later.');
  const { data: merchants } = await supabaseAdmin.from('merchants')
    .select('id,name,merchant_code').in('id', merchantIds).order('name');
  const pageSize = 8;
  const start = Math.max(0, page) * pageSize;
  const list = (merchants || []).slice(start, start + pageSize);
  const rows = list.map((merchant) => ({
    id: `merchant:${merchant.id}`,
    title: merchant.name,
    description: merchant.merchant_code,
  }));
  if (start + pageSize < (merchants || []).length) rows.push({ id: `merchant-page:${page + 1}`, title: 'More merchants' });
  if (page > 0) rows.push({ id: `merchant-page:${page - 1}`, title: 'Previous merchants' });
  await saveCustomerOrderSession(session, { merchant_id: null, state: 'merchant', cart: [], pending_item: null });
  return sendCustomerOrderList(customer.phone, 'Welcome to AE. Choose the shop you want to order from.', 'Choose shop', rows);
}

async function showProductChoices(customer, session, page = 0) {
  if (!session.merchant_id) return showMerchantChoices(customer, session);
  const { data: merchant } = await supabaseAdmin.from('merchants')
    .select('id,name').eq('id', session.merchant_id).maybeSingle();
  const { data: products } = await supabaseAdmin.from('products')
    .select('id,name,description,price').eq('merchant_id', session.merchant_id).eq('active', true).order('name');
  const pageSize = 7;
  const start = Math.max(0, page) * pageSize;
  const rows = (products || []).slice(start, start + pageSize).map((product) => ({
    id: `product:${product.id}`,
    title: product.name,
    description: `Rs ${Number(product.price).toFixed(2)}${product.description ? ` - ${product.description}` : ''}`,
  }));
  rows.push({ id: 'cart', title: 'View cart' });
  if (start + pageSize < (products || []).length) rows.push({ id: `product-page:${page + 1}`, title: 'More products' });
  if (page > 0) rows.push({ id: `product-page:${page - 1}`, title: 'Previous products' });
  if (!(products || []).length) {
    return sendCustomerOrderButtons(customer.phone, `${merchant?.name || 'This merchant'} has no active products.`, [
      { id: 'merchant-menu', title: 'Choose another shop' },
    ]);
  }
  await saveCustomerOrderSession(session, { state: 'product', pending_item: null });
  return sendCustomerOrderList(customer.phone, `Choose products from ${merchant?.name || 'the shop'} or type a custom request.`, 'View products', rows);
}

async function showCustomerOrderCart(customer, session) {
  const cart = Array.isArray(session.cart) ? session.cart : [];
  await saveCustomerOrderSession(session, { state: 'product', pending_item: null });
  return sendCustomerOrderButtons(customer.phone, customerOrderItemText(cart), cart.length
    ? [{ id: 'confirm-order', title: 'Confirm order' }, { id: 'continue-products', title: 'Add more' }, { id: 'cancel-order', title: 'Cancel' }]
    : [{ id: 'continue-products', title: 'Choose products' }, { id: 'merchant-menu', title: 'Choose shop' }]);
}

async function handleIncomingCustomerWhatsApp(message) {
  const from = normalizePhone(message.from);
  if (!from) return;
  const { data: customer } = await supabaseAdmin.from('customers')
    .select('id,name,phone').eq('phone', from).maybeSingle();
  if (!customer) {
    await sendWhatsAppText(from, 'This WhatsApp number is not registered with AE. Please register at a participating merchant first.');
    return;
  }
  const session = await getCustomerOrderSession(customer);
  const replyId = message.interactive?.list_reply?.id || message.interactive?.button_reply?.id || '';
  const text = cleanText(message.text?.body, 500);
  const command = replyId || text.toLowerCase();

  if (!command || ['hi', 'hello', 'start', 'menu', 'shop', 'shops'].includes(command)) {
    return showMerchantChoices(customer, session);
  }
  if (command.startsWith('merchant-page:')) return showMerchantChoices(customer, session, Number(command.split(':')[1]) || 0);
  if (command === 'merchant-menu') return showMerchantChoices(customer, session);
  if (command.startsWith('merchant:')) {
    const merchantId = command.slice('merchant:'.length);
    const { data: merchant } = await supabaseAdmin.from('merchants').select('id').eq('id', merchantId).maybeSingle();
    if (!merchant) return sendWhatsAppText(customer.phone, 'That shop is no longer available. Please choose another shop.');
    const next = await saveCustomerOrderSession(session, { merchant_id: merchantId, state: 'product', cart: [], pending_item: null });
    return showProductChoices(customer, next);
  }
  if (command.startsWith('product-page:')) return showProductChoices(customer, session, Number(command.split(':')[1]) || 0);
  if (command === 'continue-products') return showProductChoices(customer, session);
  if (command === 'cart') return showCustomerOrderCart(customer, session);
  if (command === 'cancel-order') {
    await saveCustomerOrderSession(session, { state: 'merchant', merchant_id: null, cart: [], pending_item: null });
    return sendWhatsAppText(customer.phone, 'Your customer order was cancelled. Send “Hi” whenever you want to start again.');
  }
  if (command === 'confirm-order') {
    const cart = Array.isArray(session.cart) ? session.cart : [];
    if (!session.merchant_id || !cart.length) return showCustomerOrderCart(customer, session);
    const { data: created, error } = await supabaseAdmin.rpc('create_customer_order', {
      p_customer_id: customer.id,
      p_merchant_id: session.merchant_id,
      p_cart: cart,
    }).single();
    if (error || !created) return sendWhatsAppText(customer.phone, 'We could not place that order. Please try again in a moment.');
    await saveCustomerOrderSession(session, { state: 'merchant', merchant_id: null, cart: [], pending_item: null });
    const { data: order } = await supabaseAdmin.from('customer_orders')
      .select('id,request_no,customer_id,merchant_id,status,customers(name,phone),merchants(name,phone),customer_order_items(product_name,quantity,unit_price)')
      .eq('id', created.order_id).single();
    if (order) {
      const notificationOrder = {
        ...order,
        customer_name: order.customers?.name,
        customer_phone: order.customers?.phone,
        merchant_name: order.merchants?.name,
        merchant_phone: order.merchants?.phone,
        items: order.customer_order_items,
      };
      scheduleBackground(() => sendMerchantCustomerOrderWhatsApp(notificationOrder));
    }
    return sendWhatsAppText(customer.phone, `Your request ${created.request_no} was sent to the merchant. The merchant will update you soon.`);
  }
  if (command.startsWith('product:')) {
    const productId = command.slice('product:'.length);
    const { data: product } = await supabaseAdmin.from('products')
      .select('id,name,price,merchant_id').eq('id', productId).eq('merchant_id', session.merchant_id).eq('active', true).maybeSingle();
    if (!product) return sendWhatsAppText(customer.phone, 'That product is no longer available. Please select another product.');
    await saveCustomerOrderSession(session, { state: 'quantity', pending_item: { type: 'catalog', productId: product.id, name: product.name, unitPrice: product.price } });
    return sendWhatsAppText(customer.phone, `How many ${product.name} would you like? Reply with a number from 1 to 99.`);
  }
  if (session.state === 'quantity' && /^\d{1,2}$/.test(text)) {
    const quantity = Number(text);
    const pending = session.pending_item;
    if (!pending || quantity < 1 || quantity > 99) return sendWhatsAppText(customer.phone, 'Reply with a quantity from 1 to 99.');
    const cart = Array.isArray(session.cart) ? [...session.cart] : [];
    const matching = cart.find((item) => item.productId === pending.productId && item.name === pending.name);
    if (matching) matching.quantity = Math.min(99, Number(matching.quantity || 0) + quantity);
    else cart.push({ ...pending, quantity });
    const next = await saveCustomerOrderSession(session, { state: 'product', cart, pending_item: null });
    return showCustomerOrderCart(customer, next);
  }
  if (text && session.merchant_id) {
    await saveCustomerOrderSession(session, { state: 'quantity', pending_item: { type: 'custom', name: text, unitPrice: null } });
    return sendWhatsAppText(customer.phone, `How many would you like for “${text}”? Reply with a number from 1 to 99.`);
  }
  return showMerchantChoices(customer, session);
}

async function sendWelcomeEmail(purchase) {
  if (!resend || !process.env.RESEND_FROM_EMAIL || !purchase.customer_email) {
    return { sent: false, error: 'Email not configured or not provided' };
  }
  const { data, error } = await resend.emails.send({
    from: `AE <${process.env.RESEND_FROM_EMAIL}>`,
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

// --- AE Settlement Engine Modules ---
app.use('/api/networks', requireAuth, networksRouter);
app.use('/api/customers', requireAuth, (req, res, next) => {
  if (!['admin', 'merchant'].includes(req.auth.profile.role)) return res.status(403).json({ error: 'Customer data is restricted to Admin and Merchant roles' });
  next();
}, rewardsRouter);
app.use('/api/redemptions', requireAuth, redemptionsRouter);
app.use('/api/settlements', requireAuth, settlementsRouter);
app.use('/api/payments', paymentsRouter);
// ----------------------------------------------

app.post('/api/auth/customer/forgot-password/request-otp', async (req, res) => {
  const phone = cleanText(req.body.phone, 20);
  if (!phone) return res.status(400).json({ success: false, error: 'Phone number is required' });
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 8) return res.status(400).json({ success: false, error: 'Invalid phone number' });

  const { data: existing } = await supabaseAdmin.from('customers').select('id').eq('phone', cleanPhone).limit(1);
  if (!existing || existing.length === 0) {
    return res.status(404).json({ success: false, error: 'Customer not found. Please register first.' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  customerOtps.set(cleanPhone, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });
  
  const templateResult = await sendWhatsAppTemplate({
    recipient: cleanPhone,
    templateName: WA_OTP_TEMPLATE,
    components: [{ type: 'body', parameters: [{ type: 'text', text: otp }] }, { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: otp }] }],
  });
  if (!templateResult.sent) {
    await sendWhatsAppText(cleanPhone, `Your AE password reset code is: ${otp}. It expires in 5 minutes.`);
  }
  res.json({ success: true });
});

const fieldManagerRole = (req, res, next) => {
  if (!['field_manager', 'admin'].includes(req.auth.profile.role)) return res.status(403).json({ success: false, error: 'Field manager access required' });
  next();
};

const attendanceDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
app.get('/api/field/route-plan', requireAuth, requireRole('field_manager'), async (req, res) => {
  const workDate = attendanceDate();
  const { data, error } = await supabaseAdmin.from('field_route_plans').select('route_name,work_date').eq('manager_id', req.auth.profile.id).eq('work_date', workDate).maybeSingle();
  if (error) return res.status(503).json({ error: 'Route planning is unavailable. Apply supabase-field-route-planning.sql and check database access.' });
  res.json({ plan: data, workDate });
});
app.put('/api/field/route-plan', requireAuth, requireRole('field_manager'), async (req, res) => {
  const route_name = cleanText(req.body.route_name, 80);
  if (!['Chittur 1','Chittur 2','Chittur 3','Thathamangalam 1','Thathamangalam 2','Thathamangalam 3'].includes(route_name)) return res.status(400).json({ error: 'Select a valid merchant route.' });
  const { data, error } = await supabaseAdmin.from('field_route_plans').upsert({ manager_id: req.auth.profile.id, work_date: attendanceDate(), route_name, selected_at: new Date().toISOString() }, { onConflict: 'manager_id,work_date' }).select('route_name,work_date').single();
  if (error) return res.status(503).json({ error: 'Could not save the route. Check route-planning database setup.' });
  res.json({ plan: data });
});
app.get('/api/field/attendance', requireAuth, requireRole('field_manager'), async (req, res) => {
  const manager = req.auth.profile.id;
  const [day, requests] = await Promise.all([
    supabaseAdmin.from('field_attendance').select('id,started_at,ended_at,latitude,longitude').eq('manager_id', manager).or(`work_date.eq.${attendanceDate()},ended_at.is.null`).order('started_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('field_work_requests').select('id,kind,starts_at,ends_at,reason,status').eq('manager_id', manager).order('created_at', { ascending: false }).limit(30),
  ]);
  if (day.error || requests.error) return res.status(503).json({ error: 'Attendance is unavailable. Apply supabase-field-attendance.sql and check database access.' });
  res.json({ attendance: day.data, requests: requests.data || [] });
});
app.post('/api/field/attendance/start', requireAuth, requireRole('field_manager'), async (req, res) => {
  const { selfie, latitude, longitude, accuracy_m } = req.body;
  if (typeof selfie !== 'string' || !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+=*$/.test(selfie) || selfie.length > 2800000 || selfie.length < 100 || ![latitude, longitude, accuracy_m].every(value => typeof value === 'number' && Number.isFinite(value)) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || accuracy_m < 0) return res.status(400).json({ error: 'A valid selfie and GPS location are required.' });
  const { data, error } = await supabaseAdmin.from('field_attendance').insert({ manager_id: req.auth.profile.id, work_date: attendanceDate(), selfie, latitude, longitude, accuracy_m }).select('id,started_at').single();
  if (error) return res.status(error.code === '23505' ? 409 : 503).json({ error: error.code === '23505' ? 'Attendance already recorded for today. Refresh to view it.' : 'Could not record attendance. Check database setup.' });
  res.status(201).json({ attendance: data });
});
app.post('/api/field/attendance/end', requireAuth, requireRole('field_manager'), async (req, res) => {
  const { data, error } = await supabaseAdmin.from('field_attendance').update({ ended_at: new Date().toISOString() }).eq('manager_id', req.auth.profile.id).is('ended_at', null).select('id').maybeSingle();
  if (error) return res.status(503).json({ error: 'Could not end attendance. Check database setup.' });
  if (!data) return res.status(409).json({ error: 'No active working day found.' });
  res.json({ success: true });
});
app.post('/api/field/work-requests', requireAuth, requireRole('field_manager'), async (req, res) => {
  const { kind, starts_at, ends_at } = req.body; const reason = cleanText(req.body.reason, 300);
  const start = Date.parse(starts_at); const end = Date.parse(ends_at);
  if (!['leave','non_field'].includes(kind) || !reason || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return res.status(400).json({ error: 'Choose a reason and an end time after the start time.' });
  const { data, error } = await supabaseAdmin.from('field_work_requests').insert({ manager_id: req.auth.profile.id, kind, starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString(), reason }).select('id,status').single();
  if (error) return res.status(503).json({ error: 'Could not submit request. Check database setup.' });
  res.status(201).json({ request: data });
});

app.post('/api/field/sessions/end', requireAuth, requireRole('field_manager'), async (req, res) => {
  const { data, error } = await supabaseAdmin.from('field_manager_sessions').update({ logout_at: new Date().toISOString() }).eq('manager_id', req.auth.profile.id).is('logout_at', null).order('login_at', { ascending: false }).limit(1).select('id').maybeSingle();
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, session: data });
});

const shopImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.post('/api/field/upload-image', requireAuth, fieldManagerRole, shopImageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No image file provided' });
    const extension = offerImageExtension(req.file.mimetype);
    const fileName = `shops/${req.auth.profile.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(OFFER_IMAGE_BUCKET)
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.warn('Supabase storage upload failed, using Data URI fallback:', uploadError.message);
      const base64 = req.file.buffer.toString('base64');
      const dataUri = `data:${req.file.mimetype};base64,${base64}`;
      return res.json({ success: true, url: dataUri, path: fileName });
    }

    const { data: signedData } = await supabaseAdmin.storage
      .from(OFFER_IMAGE_BUCKET)
      .createSignedUrl(fileName, 60 * 60 * 24 * 365);

    const publicUrl = supabaseAdmin.storage.from(OFFER_IMAGE_BUCKET).getPublicUrl(fileName).data?.publicUrl;
    const url = signedData?.signedUrl || publicUrl;
    return res.json({ success: true, url, path: fileName });
  } catch (error) {
    console.error('Field image upload error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Legal drafts are deliberately not mandatory until approved and enabled.
const legalEnabled = process.env.LEGAL_ACCEPTANCE_ENABLED === 'true';
const legalTermsVersion = '2026-10-03-v1';
const legalPrivacyVersion = '2026-10-03-v1';
async function legalStatus(req, res) {
  if (!legalEnabled) return res.json({ enabled: false, accepted: false, termsVersion: legalTermsVersion, privacyVersion: legalPrivacyVersion });
  const actor = req.customer || req.auth.profile;
  const role = req.customer ? 'customer' : actor.role;
  if (role === 'admin') return res.json({ enabled: true, accepted: true, termsVersion: legalTermsVersion, privacyVersion: legalPrivacyVersion });
  const { data, error } = await supabaseAdmin.from('legal_acceptances').select('accepted_at').eq('actor_id', actor.id).eq('actor_role', role).eq('terms_version', legalTermsVersion).eq('privacy_version', legalPrivacyVersion).maybeSingle();
  if (error) return res.status(503).json({ error: 'Legal acceptance storage is unavailable. Contact support.' });
  res.json({ enabled: true, accepted: Boolean(data), termsVersion: legalTermsVersion, privacyVersion: legalPrivacyVersion });
}
async function acceptLegal(req, res) {
  if (!legalEnabled) return res.status(409).json({ error: 'Draft documents are not enabled for acceptance.' });
  const actor = req.customer || req.auth.profile;
  const role = req.customer ? 'customer' : actor.role;
  if (!['customer', 'merchant', 'field_manager'].includes(role)) return res.status(403).json({ error: 'This role does not require acceptance.' });
  if (req.body.termsAccepted !== true || req.body.privacyAcknowledged !== true || req.body.termsVersion !== legalTermsVersion || req.body.privacyVersion !== legalPrivacyVersion) return res.status(400).json({ error: 'Review and accept the current documents.' });
  const { error } = await supabaseAdmin.from('legal_acceptances').upsert({ actor_id: actor.id, actor_role: role, terms_version: legalTermsVersion, privacy_version: legalPrivacyVersion }, { onConflict: 'actor_id,actor_role,terms_version,privacy_version', ignoreDuplicates: true });
  if (error) return res.status(503).json({ error: 'Acceptance could not be saved. Please try again.' });
  res.json({ success: true });
}
app.get('/api/customer/legal', requireCustomerAuth, legalStatus);
app.post('/api/customer/legal', requireCustomerAuth, acceptLegal);
app.get('/api/profile/legal', requireAuth, legalStatus);
app.post('/api/profile/legal', requireAuth, acceptLegal);

app.get('/api/field/merchants', requireAuth, fieldManagerRole, async (_req, res) => {
  let selectQuery = 'id,merchant_code,name,email,phone,address,latitude,longitude,category_id,created_at,image_url,images,route_name,merchant_categories(name)';
  let { data, error } = await supabaseAdmin.from('merchants').select(selectQuery).order('name');
  if (error?.message?.includes('route_name')) {
    selectQuery = selectQuery.replace(',route_name', '');
    const retry = await supabaseAdmin.from('merchants').select(selectQuery).order('name');
    data = retry.data; error = retry.error;
  }
  if (error && (error.message?.includes('image') || error.code === '42703')) {
    selectQuery = 'id,merchant_code,name,email,phone,address,latitude,longitude,category_id,created_at,merchant_categories(name)';
    const retry = await supabaseAdmin.from('merchants').select(selectQuery).order('name');
    data = retry.data;
    error = retry.error;
  }
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, merchants: data || [] });
});

app.get('/api/field/visits', requireAuth, fieldManagerRole, async (req, res) => {
  let query = supabaseAdmin.from('field_manager_visits').select('*, merchants(id,name,merchant_code), profiles!field_manager_visits_manager_id_fkey(full_name)').order('created_at', { ascending: false }).limit(200);
  if (req.auth.profile.role !== 'admin') query = query.eq('manager_id', req.auth.profile.id);
  const { data, error } = await query;
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, visits: data || [] });
});

app.post(['/api/field/visits/check-in', '/api/field/visits/start'], requireAuth, requireRole('field_manager'), async (req, res) => {
  const merchantId = cleanText(req.body.merchantId, 100); const lat = Number(req.body.latitude); const lng = Number(req.body.longitude); const accuracy = Number(req.body.accuracy);
  if (!merchantId || req.body.latitude == null || req.body.longitude == null || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || typeof req.body.accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy < 0) return res.status(400).json({ success: false, error: 'Merchant and valid GPS coordinates are required' });
  const photo = req.body.photo;
  if (req.path.endsWith('/start') && (typeof photo !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(photo) || photo.length > 80000 || photo.length < 100)) return res.status(400).json({ error: 'Capture a valid shop photo before starting the visit.' });
  const { data: activeVisit, error: activeError } = await supabaseAdmin.from('field_manager_visits').select('id').eq('manager_id', req.auth.profile.id).eq('status', 'active').limit(1).maybeSingle();
  if (activeError) return res.status(503).json({ error: 'Could not verify active visits.' });
  if (activeVisit) return res.status(409).json({ error: 'Complete the current visit before starting another.' });
  if (req.path.endsWith('/start')) {
    const { data: day, error: dayError } = await supabaseAdmin.from('field_attendance').select('id').eq('manager_id', req.auth.profile.id).eq('work_date', attendanceDate()).is('ended_at', null).maybeSingle();
    if (dayError) return res.status(503).json({ error: 'Attendance is unavailable. Check attendance database setup.' });
    if (!day) return res.status(409).json({ error: 'Start your working day in Attendance before starting a visit.' });
  }
  const { data: merchant } = await supabaseAdmin.from('merchants').select('id,name,latitude,longitude').eq('id', merchantId).maybeSingle();
  if (!merchant) return res.status(404).json({ success: false, error: 'Merchant not found' });
  if (merchant.latitude == null || merchant.longitude == null || !Number.isFinite(Number(merchant.latitude)) || !Number.isFinite(Number(merchant.longitude))) return res.status(400).json({ success: false, error: 'This merchant has no saved GPS location' });
  const distance = haversineDistanceMeters(lat, lng, Number(merchant.latitude), Number(merchant.longitude));
  if (accuracy > 50) return res.status(400).json({ error: 'GPS accuracy must be 50 metres or better. Retry outdoors.' });
  if (distance > 50) return res.status(400).json({ success: false, error: `You are ${Math.round(distance)}m away. Check-in is allowed within 50m.`, distance });
  const { data: session } = await supabaseAdmin.from('field_manager_sessions').select('id').eq('manager_id', req.auth.profile.id).is('logout_at', null).order('login_at', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabaseAdmin.from('field_manager_visits').insert({ manager_id: req.auth.profile.id, merchant_id: merchantId, session_id: session?.id || null, check_in_latitude: lat, check_in_longitude: lng, accuracy_m: accuracy, distance_m: distance, ...(req.path.endsWith('/start') ? { photos: [photo] } : {}) }).select('*').single();
  if (error) return res.status(error.code === '23505' ? 409 : 500).json({ success: false, error: error.code === '23505' ? 'You already have an active visit. Refresh to view it.' : error.message });
  res.json({ success: true, visit: data, distance });
});

app.post('/api/field/visits/:id/check-out', requireAuth, requireRole('field_manager'), async (req, res) => {
  const lat = Number(req.body.latitude); const lng = Number(req.body.longitude);
  if (req.body.latitude == null || req.body.longitude == null || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return res.status(400).json({ success: false, error: 'Valid GPS coordinates are required' });
  const accuracy = Number(req.body.accuracy);
  if (typeof req.body.accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 50) return res.status(400).json({ error: 'GPS accuracy must be 50 metres or better.' });
  const { data: active, error: visitError } = await supabaseAdmin.from('field_manager_visits').select('merchant_id,merchants(latitude,longitude)').eq('id', req.params.id).eq('manager_id', req.auth.profile.id).eq('status', 'active').maybeSingle();
  if (visitError) return res.status(503).json({ error: 'Unable to verify visit location.' });
  if (!active) return res.status(404).json({ error: 'Active visit not found.' });
  const location = active.merchants;
  if (location?.latitude == null || location?.longitude == null) return res.status(400).json({ error: 'Merchant location is missing.' });
  const distance = haversineDistanceMeters(lat, lng, Number(location.latitude), Number(location.longitude));
  if (!Number.isFinite(distance) || distance > 50) return res.status(400).json({ error: 'Return within 50 metres of the merchant to End Visit.', distance });
  const outcome = cleanText(req.body.outcome, 80);
  const followUp = cleanText(req.body.follow_up_date, 10) || null;
  const reason = cleanText(req.body.reason, 80);
  const feedback = cleanText(req.body.feedback, 2000);
  const challenge = cleanText(req.body.challenge_status, 80) || null;
  const reportImage = req.body.report_image || null;
  if (!['Merchant request','Usual route visit','Demo and monitoring','Other'].includes(reason)) return res.status(400).json({ error: 'Select a visit reason.' });
  if (!feedback) return res.status(400).json({ error: 'Merchant feedback is required.' });
  if (challenge && !['Pending','Solved','Escalated to admin team','Follow-up required'].includes(challenge)) return res.status(400).json({ error: 'Select a valid challenge status.' });
  if (reportImage && (typeof reportImage !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(reportImage) || reportImage.length > 60000 || reportImage.length < 100)) return res.status(400).json({ error: 'Invalid report image.' });
  if (challenge === 'Follow-up required' && !followUp) return res.status(400).json({ error: 'Enter a follow-up date.' });
  if (!['Completed','Follow-up required','Merchant unavailable','Issue reported'].includes(outcome)) return res.status(400).json({ error: 'Select a visit outcome.' });
  if (followUp && (!/^\d{4}-\d{2}-\d{2}$/.test(followUp) || !Number.isFinite(Date.parse(followUp)) || new Date(followUp).toISOString().slice(0, 10) !== followUp)) return res.status(400).json({ error: 'Enter a valid follow-up date.' });
  if (outcome === 'Follow-up required' && !followUp) return res.status(400).json({ error: 'A follow-up date is required for this outcome.' });
  const { data, error } = await supabaseAdmin.from('field_manager_visits').update({ status: 'completed', check_out_at: new Date().toISOString(), check_out_latitude: lat, check_out_longitude: lng, notes: cleanText(req.body.notes, 2000) || null, outcome, follow_up_date: followUp, problems: cleanText(req.body.problems, 2000) || null, feedback, reason, challenge_status: challenge, report_image: reportImage }).eq('id', req.params.id).eq('manager_id', req.auth.profile.id).eq('status', 'active').select('*, merchants(name,merchant_code)').maybeSingle();
  if (error) return res.status(500).json({ success: false, error: error.message });
  if (!data) return res.status(404).json({ success: false, error: 'Active visit not found' });
  res.json({ success: true, visit: data });
});

app.post('/api/admin/field-visits/:id/force-close', requireAuth, requireRole('admin'), async (req, res) => {
  const reason = cleanText(req.body.reason, 2000);
  if (reason.length < 5) return res.status(400).json({ error: 'Enter a reason of at least 5 characters.' });
  const closedAt = new Date().toISOString();
  // Only an active visit may be overridden. Preserve its report and never fabricate GPS.
  const { data, error } = await supabaseAdmin.from('field_manager_visits').update({ status: 'completed', check_out_at: closedAt, check_out_latitude: null, check_out_longitude: null, admin_closed_by: req.auth.profile.id, admin_closed_at: closedAt, admin_close_reason: reason }).eq('id', req.params.id).eq('status', 'active').select('id,manager_id,merchant_id,admin_closed_at,admin_close_reason').maybeSingle();
  if (error) return res.status(503).json({ error: 'Unable to close visit. Ensure the admin-close database migration is applied.' });
  if (!data) return res.status(409).json({ error: 'Visit is no longer active. Refresh and check its status.' });
  return res.json({ success: true, visit: data });
});

app.post('/api/field/visits/:id/update', requireAuth, requireRole('field_manager'), async (req, res) => {
  const { data: visit } = await supabaseAdmin.from('field_manager_visits').select('id,merchant_id').eq('id', req.params.id).eq('manager_id', req.auth.profile.id).maybeSingle();
  if (!visit) return res.status(404).json({ success: false, error: 'Visit not found' });
  const allowed = ['name','email','phone','address','latitude','longitude','category','active','follow_up_date','notes'];
  const payload = Object.fromEntries(allowed.filter(key => Object.prototype.hasOwnProperty.call(req.body, key)).map(key => [key, req.body[key]]));
  const { data, error } = await supabaseAdmin.from('field_manager_merchant_updates').insert({ manager_id: req.auth.profile.id, merchant_id: visit.merchant_id, visit_id: visit.id, payload }).select('*').single();
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, update: data });
});

app.get('/api/field/merchants/:id/profile', requireAuth, requireRole('field_manager'), async (req, res) => {
  const { data: merchant, error } = await supabaseAdmin.from('merchants').select('id,name,merchant_code,phone,email,address,latitude,longitude,category_id,image_url,opening_time,closing_time,merchant_categories(name)').eq('id', req.params.id).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!merchant) return res.status(404).json({ error: 'Merchant not found' });
  const activity = await supabaseAdmin.from('field_manager_activity').insert({ manager_id: req.auth.profile.id, merchant_id: merchant.id, action: 'merchant_profile_view' });
  res.json({ merchant, activityRecorded: !activity.error });
});
app.get('/api/admin/field-managers/:id/profile', requireAuth, requireRole('admin'), async (req, res) => {
  const { data: profile, error } = await supabaseAdmin.from('profiles').select('id,full_name,role,created_at').eq('id', req.params.id).eq('role', 'field_manager').maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!profile) return res.status(404).json({ error: 'Field manager not found' });
  const account = await supabaseAdmin.auth.admin.getUserById(profile.id);
  const results = await Promise.all([
    supabaseAdmin.from('field_manager_sessions').select('id,login_at,logout_at').eq('manager_id', profile.id).order('login_at', { ascending: false }).limit(200),
    supabaseAdmin.from('field_manager_visits').select('id,merchant_id,status,check_in_at,check_out_at,accuracy_m,distance_m,check_in_latitude,check_in_longitude,check_out_latitude,check_out_longitude,admin_closed_by,admin_closed_at,admin_close_reason,notes,reason,challenge_status,report_image,outcome,follow_up_date,problems,feedback,photos,merchants(name,merchant_code)').eq('manager_id', profile.id).order('check_in_at', { ascending: false }).limit(200),
    supabaseAdmin.from('field_manager_merchant_updates').select('id,merchant_id,status,payload,created_at').eq('manager_id', profile.id).order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('field_manager_activity').select('id,merchant_id,action,created_at,merchants(name,merchant_code)').eq('manager_id', profile.id).order('created_at', { ascending: false }).limit(200),
  ]);
  const [attendance, workRequests, onboarded] = await Promise.all([
    supabaseAdmin.from('field_attendance').select('id,work_date,started_at,ended_at,latitude,longitude,accuracy_m,selfie').eq('manager_id', profile.id).order('work_date', { ascending: false }).limit(200),
    supabaseAdmin.from('field_work_requests').select('id,kind,starts_at,ends_at,reason,status').eq('manager_id', profile.id).order('starts_at', { ascending: false }).limit(200),
    supabaseAdmin.from('field_manager_merchant_updates').select('id', { count: 'exact', head: true }).eq('manager_id', profile.id).eq('payload->>action', 'onboard_merchant'),
  ]);
  const fatal = results.slice(0, 3).find(r => r.error);
  if (fatal) return res.status(500).json({ error: fatal.error.message });
  res.json({ profile: { ...profile, email: account.data?.user?.email || '', phone: account.data?.user?.phone || '' }, sessions: results[0].data, visits: results[1].data, updates: results[2].data, activity: results[3].data || [], activityAvailable: !results[3].error, attendance: attendance.data || [], attendanceAvailable: !attendance.error, workRequests: workRequests.data || [], workRequestsAvailable: !workRequests.error, onboardedTotal: onboarded.error ? null : onboarded.count });
});
app.get('/api/admin/merchants/:id/records', requireAuth, requireRole('admin'), async (req, res) => {
  const results = await Promise.all([
    supabaseAdmin.from('orders').select('id,order_no,customer_id,amount,reward_points,created_at').eq('merchant_id', req.params.id).order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('payment_transactions').select('id,customer_id,amount,status,created_at').eq('merchant_id', req.params.id).order('created_at', { ascending: false }).limit(200),
  ]);
  if (results.some(r => r.error)) return res.status(500).json({ error: 'Merchant records could not load' });
  res.json({ orders: results[0].data, payments: results[1].data });
});
app.get('/api/admin/field-managers', requireAuth, requireRole('admin'), async (_req, res) => {
  const { data: managers, error } = await supabaseAdmin.from('profiles').select('id,full_name,role,created_at').eq('role', 'field_manager').order('full_name');
  if (error) return res.status(500).json({ success: false, error: error.message });
  const { data: sessions } = await supabaseAdmin.from('field_manager_sessions').select('*').order('login_at', { ascending: false }).limit(200);
  const { data: updates } = await supabaseAdmin.from('field_manager_merchant_updates').select('*, merchants(name,merchant_code), profiles!field_manager_merchant_updates_manager_id_fkey(full_name)').order('created_at', { ascending: false }).limit(200);
  res.json({ success: true, managers: managers || [], sessions: sessions || [], updates: updates || [] });
});

app.post('/api/admin/field-managers', requireAuth, requireRole('admin'), async (req, res) => {
  const fullName = cleanText(req.body.fullName, 120); const email = cleanText(req.body.email, 254).toLowerCase(); const password = typeof req.body.password === 'string' ? req.body.password : generateTemporaryPassword();
  if (!fullName || !isEmail(email) || !isStrongPassword(password)) return res.status(400).json({ success: false, error: 'Name, valid email, and a strong password are required' });
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName, role: 'field_manager' } });
  if (authError || !authData.user) return res.status(400).json({ success: false, error: authError?.message || 'Could not create manager' });
  const { data, error } = await supabaseAdmin.from('profiles').insert({ id: authData.user.id, full_name: fullName, role: 'field_manager', merchant_id: null, must_change_password: false }).select('id,full_name,role,created_at').single();
  if (error) { await supabaseAdmin.auth.admin.deleteUser(authData.user.id); return res.status(400).json({ success: false, error: error.message }); }
  res.status(201).json({ success: true, manager: data, temporaryPassword: password });
});

app.delete('/api/admin/field-managers/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const id = req.params.id;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return res.status(400).json({ success: false, error: 'Invalid manager ID' });
  const { data: manager, error: lookupError } = await supabaseAdmin.from('profiles').select('id').eq('id', id).eq('role', 'field_manager').maybeSingle();
  if (lookupError) return res.status(500).json({ success: false, error: lookupError.message });
  if (!manager) return res.status(404).json({ success: false, error: 'Field manager not found' });
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) return res.status(400).json({ success: false, error: error.message });
  return res.json({ success: true });
});

app.patch('/api/admin/field-updates/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const status = ['approved','rejected'].includes(req.body.status) ? req.body.status : null;
  if (!status) return res.status(400).json({ success: false, error: 'Status must be approved or rejected' });
  const { data: update } = await supabaseAdmin.from('field_manager_merchant_updates').select('id,merchant_id,payload').eq('id', req.params.id).eq('status', 'pending').maybeSingle();
  if (!update) return res.status(404).json({ success: false, error: 'Pending update not found' });
  if (status === 'approved') {
    const allowed = ['name','email','phone','address','latitude','longitude','category','active'];
    const patch = Object.fromEntries(allowed.filter(key => Object.prototype.hasOwnProperty.call(update.payload || {}, key)).map(key => [key, update.payload[key]]));
    const { error } = await supabaseAdmin.from('merchants').update(patch).eq('id', update.merchant_id); if (error) return res.status(500).json({ success: false, error: error.message });
  }
  const { data, error } = await supabaseAdmin.from('field_manager_merchant_updates').update({ status, review_note: cleanText(req.body.reviewNote, 500) || null, reviewed_by: req.auth.profile.id, reviewed_at: new Date().toISOString() }).eq('id', req.params.id).select('*').single();
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, update: data });
});

app.post('/api/auth/customer/forgot-password/reset', async (req, res) => {
  const phone = cleanText(req.body.phone, 20);
  const otp = cleanText(req.body.otp, 10);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const cleanPhone = phone.replace(/\D/g, '');
  
  if (password.length < 8) return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
  
  const record = customerOtps.get(cleanPhone);
  if (!record || record.otp !== otp || record.expiresAt < Date.now()) {
    return res.status(400).json({ success: false, error: 'Invalid or expired code' });
  }
  
  customerOtps.delete(cleanPhone);
  
  const { data: customer } = await supabaseAdmin.from('customers').select('*').eq('phone', cleanPhone).single();
  if (!customer) return res.status(404).json({ success: false, error: 'Customer not found.' });

  const passwordHash = hashPassword(password);
  await supabaseAdmin.from('customers').update({ 
    password_hash: passwordHash, 
    must_change_password: false,
    password_reset_at: new Date().toISOString()
  }).eq('id', customer.id);

  res.json({ success: true });
});


// Background job to expire points dynamically
async function cleanupExpiredPoints(customerId) {
  try {
    const { data: expiredLots } = await supabaseAdmin
      .from('reward_lots')
      .select('id, available_amount_paise, funding_merchant_id')
      .eq('customer_id', customerId)
      .eq('status', 'AVAILABLE')
      .lt('expires_at', new Date().toISOString());

    if (!expiredLots || expiredLots.length === 0) return;

    let totalExpiredPaise = 0;
    const expiredByMerchant = {};

    for (const lot of expiredLots) {
      totalExpiredPaise += parseInt(lot.available_amount_paise, 10);
      expiredByMerchant[lot.funding_merchant_id] = (expiredByMerchant[lot.funding_merchant_id] || 0) + parseInt(lot.available_amount_paise, 10);
      
      await supabaseAdmin.from('reward_lots')
        .update({ status: 'EXPIRED' })
        .eq('id', lot.id);
        
      await supabaseAdmin.from('reward_ledger').insert({
        network_id: '00000000-0000-0000-0000-000000000000',
        customer_id: customerId,
        merchant_id: lot.funding_merchant_id,
        amount_paise: lot.available_amount_paise,
        event_type: 'REWARD_EXPIRED'
      });
    }

    const totalExpiredPoints = Math.floor(totalExpiredPaise / 100);
    if (totalExpiredPoints > 0) {
      // Deduct from global
      const { data: cust } = await supabaseAdmin.from('customers').select('reward_points').eq('id', customerId).single();
      if (cust) {
        await supabaseAdmin.from('customers')
          .update({ reward_points: Math.max(0, cust.reward_points - totalExpiredPoints) })
          .eq('id', customerId);
      }
      // Deduct from specific merchants
      for (const merchantId of Object.keys(expiredByMerchant)) {
        const points = Math.floor(expiredByMerchant[merchantId] / 100);
        const { data: cm } = await supabaseAdmin.from('customer_merchants').select('reward_points').eq('customer_id', customerId).eq('merchant_id', merchantId).single();
        if (cm) {
          await supabaseAdmin.from('customer_merchants')
            .update({ reward_points: Math.max(0, cm.reward_points - points) })
            .eq('customer_id', customerId).eq('merchant_id', merchantId);
        }
      }
    }
  } catch (error) {
    console.error('Failed to cleanup expired points for customer', customerId, error);
  }
}

app.post('/api/auth/customer/login', async (req, res) => {
  if (!requireSupabase(res)) return;
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const cleanPhone = normalizePhone(req.body.phone);
  
  if (!cleanPhone || !password) return res.status(400).json({ success: false, error: 'Phone and password are required' });
  
  const { data: customer } = await supabaseAdmin.from('customers').select('*').eq('phone', cleanPhone).single();
  if (!customer) return res.status(401).json({ success: false, error: 'Invalid phone or password' });
  
  if (!customer.password_hash || !verifyPassword(password, customer.password_hash)) {
    return res.status(401).json({ success: false, error: 'Invalid phone or password' });
  }

  const token = jwt.sign({ customerId: customer.id, role: 'customer' }, CUSTOMER_JWT_SECRET, { expiresIn: '30d' });
  
  // Ensure the object has the role defined explicitly for the frontend
  customer.role = 'customer';
  
  res.json({
    success: true,
    ...customerSessionTokens(customer),
    user: customer,
  });
});

app.post('/api/auth/customer/signup', async (req, res) => {
  await firebaseInitializationPromise;
  if (!requireSupabase(res)) return;
  const idToken = cleanText(req.body.idToken || req.body.id_token || req.body.token, 8192);
  const name = cleanText(req.body.name, 100);
  const email = cleanText(req.body.email, 254).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!firebaseInitialized) {
    console.error('Customer signup blocked: FIREBASE_ADMIN_UNAVAILABLE');
    return res.status(503).json({ success: false, code: 'FIREBASE_ADMIN_UNAVAILABLE', error: 'Account creation is temporarily unavailable because server verification could not start. Please contact AE support.' });
  }
  if (!idToken) {
    console.warn('Customer signup blocked: PHONE_TOKEN_MISSING');
    return res.status(400).json({ success: false, code: 'PHONE_TOKEN_MISSING', error: 'Phone verification token was not received. Please retry verification.' });
  }
  if (!name || name.length < 2) return res.status(400).json({ success: false, error: 'Please enter your full name' });
  if (email && !isEmail(email)) return res.status(400).json({ success: false, error: 'Please enter a valid email address' });
  if (password.length < 8) return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });

  let decodedToken;
  try {
    decodedToken = await getAuth().verifyIdToken(idToken);
  } catch (error) {
    console.error('Customer signup token verification failed:', error.code);
    return res.status(401).json({ success: false, code: 'PHONE_VERIFICATION_FAILED', error: 'Phone verification could not be confirmed. Please request a new code.' });
  }
  try {
    const cleanPhone = normalizePhone(decodedToken.phone_number);
    if (!cleanPhone) return res.status(400).json({ success: false, error: 'Verified phone number is invalid' });

    const existing = await supabaseAdmin.from('customers').select('id').eq('phone', cleanPhone).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return res.status(409).json({ success: false, error: 'This phone number is already registered. Please log in.' });

    const network = await supabaseAdmin.from('networks').select('id').eq('code', 'LEGACY-001').maybeSingle();
    if (network.error) throw network.error;
    const customerCode = `C${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const created = await supabaseAdmin.from('customers').insert({
      customer_code: customerCode,
      merchant_id: null,
      network_id: network.data?.id || '00000000-0000-0000-0000-000000000000',
      name,
      phone: cleanPhone,
      email: email || null,
      password_hash: hashPassword(password),
      must_change_password: false,
      password_reset_at: new Date().toISOString(),
      registration_source: 'self',
    }).select('*').single();
    if (created.error) throw created.error;

    const customer = { ...created.data, role: 'customer' };
    const accessToken = jwt.sign({ customerId: customer.id, role: 'customer' }, CUSTOMER_JWT_SECRET, { expiresIn: '30d' });
    return res.status(201).json({ success: true, ...customerSessionTokens(customer), user: customer });
  } catch (error) {
    console.error('Customer signup failed:', error);
    if (error.code === '23505') return res.status(409).json({ success: false, error: 'An account with these details already exists. Please log in.' });
    return res.status(503).json({ success: false, code: 'SIGNUP_STORAGE_FAILED', error: 'Your phone was verified, but we could not save your account. Please retry shortly; you do not need another SMS code.' });
  }
});

app.post('/api/auth/customer/reset-password-otp', async (req, res) => {
  const idToken = req.body.idToken;
  const newPassword = req.body.newPassword;
  
  if (!idToken || !newPassword) {
    return res.status(400).json({ success: false, error: 'Token and new password are required' });
  }
  
  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
  }
  
  try {
    // 1. Verify the Firebase ID Token
    if (!firebaseInitialized) {
      throw new Error("Firebase Admin is not configured. Cannot verify OTP.");
    }
    
    const decodedToken = await getAuth().verifyIdToken(idToken);
    let phoneNumber = decodedToken.phone_number;
    
    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: 'Token does not contain a verified phone number' });
    }
    
    // Normalize phone to match DB format (strip + if needed, or ensure +91 is there)
    // Our DB seems to store phone numbers dynamically. normalizePhone handles it.
    const cleanPhone = normalizePhone(phoneNumber);
    if (!cleanPhone) {
      return res.status(400).json({ success: false, error: 'Invalid phone number format in token' });
    }
    
    // 2. Find Customer
    const { data: customer } = await supabaseAdmin.from('customers').select('id').eq('phone', cleanPhone).single();
    if (!customer) {
      return res.status(404).json({ success: false, error: 'No account found for this verified phone number' });
    }
    
    // 3. Update Password
    const passwordHash = hashPassword(newPassword);
    const { error } = await supabaseAdmin.from('customers')
      .update({ password_hash: passwordHash })
      .eq('id', customer.id);
      
    if (error) throw error;
    
    res.json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    console.error("Firebase OTP verification failed:", error);
    res.status(401).json({ success: false, error: 'Invalid or expired token', details: error.message });
  }
});

app.post('/api/auth/customer/change-password', requireCustomerAuth, async (req, res) => {
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (password.length < 8) return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
  
  const passwordHash = hashPassword(password);
  const { error } = await supabaseAdmin.from('customers').update({ 
    password_hash: passwordHash, 
    must_change_password: false,
    password_reset_at: new Date().toISOString()
  }).eq('id', req.customer.id);
  
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true });
});

app.get('/api/auth/customer/me', requireCustomerAuth, (req, res) => {
  cleanupExpiredPoints(req.customer.id);
  res.json({ success: true, user: req.customer });
});

app.get('/api/customer/dashboard', requireCustomerAuth, async (req, res) => {
  try {
    const purchaseCount = await supabaseAdmin.from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', req.customer.id);
    if (purchaseCount.error) throw purchaseCount.error;
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('id, created_at, amount, points_earned:reward_points, merchants(name)')
      .eq('customer_id', req.customer.id)
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: redemptions } = await supabaseAdmin
      .from('point_redemptions')
      .select('id, created_at, transaction_amount, points_redeemed, merchants(name)')
      .eq('customer_id', req.customer.id)
      .order('created_at', { ascending: false })
      .limit(5);

    const bonusResult = await supabaseAdmin.from('loyalty_bonuses').select('id,created_at,points,merchants(name)').eq('customer_id', req.customer.id).order('created_at', { ascending: false }).limit(5);
    if (bonusResult.error && !['PGRST205','42P01'].includes(bonusResult.error.code)) throw bonusResult.error;
    const activity = [
      ...(bonusResult.data || []).map(b => ({ id: b.id, created_at: b.created_at, type: 'bonus', merchant_name: b.merchants?.name, amount: 0, points: b.points })),
      ...(orders || []).map(o => ({ id: o.id, created_at: o.created_at, type: 'earn', merchant_name: o.merchants?.name, amount: o.amount, points: o.points_earned })),
      ...(redemptions || []).map(r => ({ id: r.id, created_at: r.created_at, type: 'redeem', merchant_name: r.merchants?.name, amount: r.transaction_amount, points: r.points_redeemed }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

    res.json({
      success: true,
      reward_points: req.customer.reward_points,
      purchase_count: purchaseCount.count || 0,
      activity
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/customer/transactions', requireCustomerAuth, async (req, res) => {
  const paging = paginationFromRequest(req, 20, 100);
  try {
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('id, created_at, amount, points_earned:reward_points, merchants(name)')
      .eq('customer_id', req.customer.id)
      .order('created_at', { ascending: false });

    const { data: redemptions } = await supabaseAdmin
      .from('point_redemptions')
      .select('id, created_at, transaction_amount, points_redeemed, merchants(name)')
      .eq('customer_id', req.customer.id)
      .order('created_at', { ascending: false });

    const bonusResult = await supabaseAdmin.from('loyalty_bonuses').select('id,created_at,points,merchants(name)').eq('customer_id', req.customer.id).order('created_at', { ascending: false });
    if (bonusResult.error && !['PGRST205','42P01'].includes(bonusResult.error.code)) throw bonusResult.error;
    let transactions = [
      ...(bonusResult.data || []).map(b => ({ id: b.id, created_at: b.created_at, type: 'bonus', merchant_name: b.merchants?.name, amount: 0, points: b.points })),
      ...(orders || []).map(o => ({ id: o.id, created_at: o.created_at, type: 'earn', merchant_name: o.merchants?.name, amount: o.amount ?? null, points: o.points_earned })),
      ...(redemptions || []).map(r => ({ id: r.id, created_at: r.created_at, type: 'redeem', merchant_name: r.merchants?.name, amount: r.transaction_amount ?? null, points: r.points_redeemed }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total = transactions.length;
    if (paging.enabled) {
      transactions = transactions.slice(paging.from, paging.to + 1);
    }
    
    res.json({ success: true, transactions, pagination: paginationMeta(paging, total) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const DEFAULT_MERCHANT_CATEGORIES = ['Medicine', 'Hotel', 'Restaurant', 'Clothing', 'Cinema', 'Grocery', 'Electronics', 'Beauty & Salon', 'Travel', 'Education', 'Services', 'Other'];

async function ensureDefaultMerchantCategories() {
  await supabaseAdmin.from('merchant_categories').upsert(DEFAULT_MERCHANT_CATEGORIES.map(name => ({ name })), { onConflict: 'name', ignoreDuplicates: true });
}

app.get('/api/merchant-categories', requireAuth, async (req, res) => {
  try {
    if (!['admin', 'field_manager'].includes(req.auth.profile?.role)) return res.status(403).json({ success: false, error: 'Not authorized' });
    await ensureDefaultMerchantCategories();
    const { data: categories, error } = await supabaseAdmin.from('merchant_categories').select('id, name').order('name');
    if (error) throw error;
    res.json({ success: true, categories: categories || [] });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/api/merchant-categories', requireAuth, async (req, res) => {
  if (!['admin', 'field_manager'].includes(req.auth.profile?.role)) return res.status(403).json({ success: false, error: 'Not authorized' });
  const name = cleanText(req.body.name, 80);
  if (!name) return res.status(400).json({ success: false, error: 'Category name is required' });
  const { data, error } = await supabaseAdmin.from('merchant_categories').insert({ name }).select('id, name').single();
  if (error) return res.status(409).json({ success: false, error: 'Category already exists or could not be created' });
  res.status(201).json({ success: true, category: data });
});

app.delete('/api/merchant-categories/:id', requireAuth, async (req, res) => {
  if (req.auth.profile.role !== 'admin') return res.status(403).json({ success: false, error: 'Not authorized' });
  const { error } = await supabaseAdmin.from('merchant_categories').delete().eq('id', cleanText(req.params.id, 100));
  if (error) return res.status(500).json({ success: false, error: 'Unable to delete category' });
  res.json({ success: true });
});

// Public, non-personal dashboard copy; backend updates reach installed apps.
app.get('/api/daily-greetings', (req, res) => {
  const role = req.query.role;
  if (role !== 'customer' && role !== 'merchant') {
    return res.status(400).json({ error: 'Choose customer or merchant greetings.' });
  }
  res.set('Cache-Control', 'no-store');
  res.json({ messages: dailyGreetings[role], rotationStart: dailyGreetings.rotationStart });
});

app.get('/api/customer/categories', async (req, res) => {
  try {
    await ensureDefaultMerchantCategories();
    const { data: categories, error } = await supabaseAdmin.from('merchant_categories').select('id, name').order('name');
    if (error) throw error;
    res.json({ success: true, categories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/customer/merchants', requireCustomerAuth, async (req, res) => {
  const paging = paginationFromRequest(req, 20, 100);
  let query = supabaseAdmin.from('merchants').select('id, name, address, latitude, longitude, image_url, images, created_at, merchant_categories(name)', { count: 'exact' });
  if (req.query.categoryId && req.query.categoryId !== 'all') {
    query = query.eq('category_id', req.query.categoryId);
  }
  if (paging.enabled && paging.search) {
    query = query.or(`name.ilike.%${paging.search}%,merchant_code.ilike.%${paging.search}%`);
  }
  query = query.order('created_at', { ascending: false });
  if (paging.enabled) query = query.range(paging.from, paging.to);

  const { data: merchants, count, error } = await query;
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({
    success: true,
    merchants: (merchants || []).map((merchant) => ({
      id: merchant.id,
      merchant_name: merchant.name,
      image_url: merchant.image_url || merchant.images?.[0] || null,
      images: Array.isArray(merchant.images) ? merchant.images.filter(image => typeof image === 'string') : [],
      category: merchant.merchant_categories?.name || '',
      address: merchant.address || '',
      latitude: merchant.latitude === null ? null : Number(merchant.latitude),
      longitude: merchant.longitude === null ? null : Number(merchant.longitude),
      created_at: merchant.created_at,
    })),
    pagination: paginationMeta(paging, count),
  });
});

app.post('/api/customer/feedback', requireCustomerAuth, async (req, res) => {
  const feedbackType = req.body.feedback_type === 'merchant' ? 'merchant' : 'app';
  const message = cleanText(req.body.message, 2000);
  const rating = req.body.rating ? Number(req.body.rating) : null;
  const merchantId = feedbackType === 'merchant' ? cleanText(req.body.merchant_id, 80) : null;
  if (message.length < 2) return res.status(400).json({ success: false, error: 'Please enter your feedback' });
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });
  if (feedbackType === 'merchant' && !merchantId) return res.status(400).json({ success: false, error: 'Please select a merchant' });
  const created = await supabaseAdmin.from('customer_feedback').insert({ customer_id: req.customer.id, merchant_id: merchantId, feedback_type: feedbackType, rating, message }).select('id,feedback_type,rating,message,created_at').single();
  if (created.error) return res.status(500).json({ success: false, error: 'Unable to save feedback right now' });
  res.status(201).json({ success: true, feedback: created.data });
});

app.get('/api/customer/merchant-reviews/:merchantId', requireCustomerAuth, async (req, res) => {
  const merchantId = cleanText(req.params.merchantId, 100);
  const { data, error } = await supabaseAdmin.from('customer_feedback').select('id,rating,message,created_at,customers(name)').eq('merchant_id', merchantId).eq('feedback_type', 'merchant').order('created_at', { ascending: false }).limit(50);
  if (error) return res.status(500).json({ success: false, error: 'Unable to load reviews' });
  res.json({ success: true, reviews: (data || []).map(row => ({ id: row.id, rating: row.rating, message: row.message, createdAt: row.created_at, customerName: row.customers?.name || 'Customer' })) });
});

app.post('/api/merchant/feedback', requireAuth, requireRole('merchant'), async (req, res) => {
  const categories = ['App experience', 'Points & redemption', 'QR scanning', 'Product lists', 'Support', 'Suggestion', 'Other'];
  const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
  const rating = req.body.rating ?? null;
  const requestId = req.body.requestId;
  if (!req.auth.profile.merchant_id) return res.status(403).json({ error: 'Merchant account required' });
  if (!categories.includes(req.body.category) || message.length < 2 || message.length > 2000 || (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId || '')) return res.status(400).json({ error: 'Choose a category, enter 2–2,000 characters, and select a valid optional rating.' });
  const payload = { merchant_id: req.auth.profile.merchant_id, submitted_by: req.auth.user.id, request_id: requestId, category: req.body.category, rating, message };
  const created = await supabaseAdmin.from('merchant_feedback').insert(payload).select('id').single();
  if (created.error?.code === '23505') {
    const existing = await supabaseAdmin.from('merchant_feedback').select('*').eq('request_id', requestId).eq('merchant_id', payload.merchant_id).eq('submitted_by', payload.submitted_by).maybeSingle();
    if (existing.data && existing.data.category === payload.category && existing.data.rating === rating && existing.data.message === message) return res.json({ success: true, id: existing.data.id });
    return res.status(409).json({ error: 'Feedback request mismatch. Please reopen the feedback form.' });
  }
  if (created.error) return res.status(503).json({ error: 'Unable to save feedback. Ensure the merchant feedback migration is applied, then retry.' });
  return res.status(201).json({ success: true, id: created.data.id });
});

app.get('/api/admin/merchant-feedback', requireAuth, requireRole('admin'), async (_req, res) => {
  const { data, error } = await supabaseAdmin.from('merchant_feedback').select('id,category,rating,message,created_at,merchants(name)').order('created_at', { ascending: false }).limit(200);
  if (error) return res.status(503).json({ error: 'Unable to load merchant feedback. Ensure the merchant feedback migration is applied.' });
  return res.json({ feedback: (data || []).map(row => ({ id: row.id, category: row.category, rating: row.rating, message: row.message, createdAt: row.created_at, merchantName: row.merchants?.name || 'Merchant' })) });
});

app.get('/api/feedback', requireAuth, async (req, res) => {
  const isMerchant = req.auth.profile.role === 'merchant';
  if (isMerchant && !req.auth.profile.merchant_id) return res.status(403).json({ error: 'Merchant account required' });
  let query = supabaseAdmin.from('customer_feedback')
    .select(isMerchant ? 'id,feedback_type,rating,message,created_at,merchant_id,merchants(name)' : 'id,feedback_type,rating,message,created_at,merchant_id,customers(name,phone),merchants(name)')
    .order('created_at', { ascending: false }).limit(200);
  if (req.auth.profile.role === 'merchant') {
    query = query.eq('merchant_id', req.auth.profile.merchant_id).eq('feedback_type', 'merchant');
  } else if (req.auth.profile.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Not authorized' });
  }
  const { data, error } = await query;
  if (error) return res.status(500).json({ success: false, error: 'Unable to load feedback' });
  res.json({ success: true, feedback: (data || []).map((row) => ({
    id: row.id, type: row.feedback_type, rating: row.rating, message: row.message,
    createdAt: row.created_at, merchantId: row.merchant_id,
    ...(isMerchant ? { customerName: 'Anonymous' } : { customerName: row.customers?.name || 'Customer', customerPhone: row.customers?.phone || '' }),
    merchantName: row.merchants?.name || '',
  })) });
});

app.post('/api/customer/product-list-requests', requireCustomerAuth, offerImageMiddleware, async (req, res) => {
  const merchantId = cleanText(req.body.merchant_id, 100);
  const productList = cleanText(req.body.product_list, 5000);
  if (!merchantId || (!productList && !req.file)) return res.status(400).json({ success: false, error: 'Select a merchant and add a product list or image' });
  const { data: merchant } = await supabaseAdmin.from('merchants').select('id').eq('id', merchantId).maybeSingle();
  if (!merchant) return res.status(404).json({ success: false, error: 'Merchant not found' });
  let imagePath = null;
  if (req.file) imagePath = await uploadOfferImage(merchantId, req.file);
  const { data, error } = await supabaseAdmin.from('customer_product_list_requests').insert({ customer_id: req.customer.id, merchant_id: merchantId, product_list: productList || null, image_path: imagePath, status: 'pending' }).select('id,status,created_at').single();
  if (error) return res.status(500).json({ success: false, error: 'Unable to submit product list' });
  await pushToRole('admin', 'New product list request', 'A customer sent a product list for admin review.', { url: '/customer-product-lists', requestId: data.id });
  await pushToCustomer(req.customer.id, 'Product list submitted', 'Your product list was received and is awaiting review.', { url: '/customer/home?productList=1', requestId: data.id });
  res.status(201).json({ success: true, request: data });
});

app.get('/api/customer/product-list-requests', requireCustomerAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('customer_product_list_requests')
    .select('id,merchant_id,product_list,image_path,status,created_at,merchants(name)')
    .eq('customer_id', req.customer.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return res.status(500).json({ success: false, error: 'Unable to load product list history' });
  const requests = await Promise.all((data || []).map(async (request) => ({ ...request, image_url: request.image_path ? await signedOfferImageUrl(request.image_path) : '' })));
  res.json({ success: true, requests });
});

app.get('/api/product-list-requests', requireAuth, async (req, res) => {
  let query = supabaseAdmin.from('customer_product_list_requests').select('id,merchant_id,product_list,image_path,status,rejection_reason,created_at,customers(name,phone),merchants(name)').order('created_at', { ascending: false }).limit(200);
  if (req.auth.profile.role === 'merchant') query = query.eq('merchant_id', req.auth.profile.merchant_id).eq('status', 'approved');
  else if (req.auth.profile.role !== 'admin') return res.status(403).json({ success: false, error: 'Not authorized' });
  const { data, error } = await query;
  if (error) return res.status(500).json({ success: false, error: 'Unable to load product lists' });
  res.json({ success: true, requests: data || [] });
});

app.patch('/api/product-list-requests/:id/review', requireAuth, requireRole('admin'), async (req, res) => {
  const status = cleanText(req.body.status, 20).toLowerCase();
  if (!['approved', 'rejected', 'pending'].includes(status)) return res.status(400).json({ success: false, error: 'Invalid review status' });
  const rejectionReason = cleanText(req.body.rejection_reason, 500) || null;
  const { data: existing } = await supabaseAdmin.from('customer_product_list_requests').select('id,customer_id,merchant_id').eq('id', cleanText(req.params.id, 100)).maybeSingle();
  const { data, error } = await supabaseAdmin.from('customer_product_list_requests').update({ status, rejection_reason: status === 'rejected' ? rejectionReason : null, reviewed_at: status === 'pending' ? null : new Date().toISOString() }).eq('id', cleanText(req.params.id, 100)).select('id,status,rejection_reason').maybeSingle();
  if (error) return res.status(500).json({ success: false, error: 'Unable to review product list' });
  if (!data) return res.status(404).json({ success: false, error: 'Product list not found' });
  if (existing && status !== 'pending') await pushToMerchant(existing.merchant_id, `Product list ${status}`, `A customer product list was ${status} by admin.`, { url: '/customer-orders', requestId: data.id });
  if (existing && status !== 'pending') await pushToCustomer(existing.customer_id, `Product list ${status}`, `Your product list request was ${status}.`, { url: '/customer/home?productList=1', requestId: data.id });
  res.json({ success: true, request: data });
});

app.patch('/api/product-list-requests/:id/status', requireAuth, requireRole('merchant'), async (req, res) => {
  const status = cleanText(req.body.status, 20).toLowerCase();
  if (!['pending', 'accepted', 'rejected'].includes(status)) return res.status(400).json({ success: false, error: 'Invalid status' });
  const { data, error } = await supabaseAdmin.from('customer_product_list_requests').update({ status }).eq('id', cleanText(req.params.id, 100)).eq('merchant_id', req.auth.profile.merchant_id).select('id,status').maybeSingle();
  if (error) return res.status(500).json({ success: false, error: 'Unable to update product list status' });
  if (!data) return res.status(404).json({ success: false, error: 'Product list not found' });
  const { data: request } = await supabaseAdmin.from('customer_product_list_requests').select('customer_id').eq('id', data.id).maybeSingle();
  if (request) await pushToCustomer(request.customer_id, `Product list ${status}`, `The merchant has ${status} your product list.`, { url: '/customer/home?productList=1', requestId: data.id });
  res.json({ success: true, request: data });
});

app.get('/api/customer/offers', requireCustomerAuth, async (req, res) => {
  const { data: offers, error } = await supabaseAdmin
    .from('offers')
    .select('*, merchants(name)')
    .eq('status', 'approved')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(50);
    
  if (error) return res.status(500).json({ success: false, error: error.message });
  
  const eligibleMerchants = new Set();
  for (const merchantId of new Set((offers || []).filter(o => o.audience === 'loyal').map(o => o.merchant_id))) {
    const result = await supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('merchant_id', merchantId).eq('customer_id', req.customer.id);
    if (result.error) return res.status(503).json({ error: 'Unable to verify loyalty eligibility.' });
    if (result.count >= 5) eligibleMerchants.add(merchantId);
  }
  const visibleOffers = (offers || []).filter(o => o.audience !== 'loyal' || eligibleMerchants.has(o.merchant_id));
  const mappedOffers = await Promise.all(visibleOffers.map(async o => ({
    id: o.id,
    title: o.title,
    description: o.description,
    imageUrl: await signedOfferImageUrl(o.image_path),
    merchant_name: o.merchants?.name,
    expires_at: o.expires_at
  })));
  
  res.json({ success: true, offers: mappedOffers });
});

app.post('/api/customer/notifications/test', requireCustomerAuth, async (req, res) => {
  let target;
  try { target = await getCustomerPushTarget(req.customer.id); }
  catch (error) {
    console.error('Firestore notification test lookup failed:', error.message);
    return res.status(503).json({ success: false, error: 'Firebase notification storage is unavailable. Check Firestore setup and server permissions.' });
  }
  if (target.push_enabled === false) return res.status(400).json({ success: false, error: 'Enable notifications in your profile settings first.' });
  if (!target.push_token) return res.status(400).json({ success: false, error: 'No phone token is registered in Firebase. Open the updated Android app and allow notifications.' });
  const sent = await sendPushNotification(target.push_token, 'AE notification test', 'Your phone can receive AE notifications.', { url: '/customer/notifications' });
  if (!sent) return res.status(502).json({ success: false, error: 'Firebase rejected the notification. The server log contains the delivery error.' });
  res.json({ success: true });
});

app.put('/api/customer/preferences', requireCustomerAuth, async (req, res) => {
  const customerId = req.customer.id;
  const { push_token, push_enabled, whatsapp_enabled, location_enabled } = req.body;
  
  const updates = {};
  const pushUpdates = {};
  if (push_token !== undefined) {
    if (typeof push_token !== 'string' || !push_token.trim() || push_token.length > 4096) return res.status(400).json({ success: false, error: 'A valid phone notification token is required.' });
    pushUpdates.push_token = push_token.trim();
  }
  if (push_enabled !== undefined) {
    if (typeof push_enabled !== 'boolean') return res.status(400).json({ success: false, error: 'push_enabled must be true or false.' });
    pushUpdates.push_enabled = push_enabled;
  }
  if (whatsapp_enabled !== undefined) updates.whatsapp_enabled = Boolean(whatsapp_enabled);
  if (location_enabled !== undefined) updates.location_enabled = Boolean(location_enabled);
  
  if (Object.keys(updates).length === 0 && Object.keys(pushUpdates).length === 0) {
    return res.json({ success: true, message: 'No updates provided' });
  }

  if (Object.keys(pushUpdates).length) {
    try {
      await saveCustomerPushTarget(customerId, pushUpdates);
    } catch (error) {
      console.error('Firestore phone registration failed:', error.message);
      return res.status(503).json({ success: false, error: 'Could not save phone registration in Firebase. Check Firestore setup and server permissions.' });
    }
  }
  const { error } = Object.keys(updates).length ? await supabaseAdmin
    .from('customers')
    .update(updates)
    .eq('id', customerId) : { error: null };

  if (error) {
    return res.status(500).json({ success: false, error: error.message });
  }

  // The app owns the one-time welcome. Token refreshes must not send another.
  res.json({ success: true, welcomeAccepted: null });
});

app.put('/api/profile/preferences', requireAuth, async (req, res) => {
  const updates = {};
  if (req.body.push_token !== undefined) updates.push_token = cleanText(req.body.push_token, 4096);
  if (req.body.push_enabled !== undefined) updates.push_enabled = Boolean(req.body.push_enabled);
  if (!Object.keys(updates).length) return res.json({ success: true });
  const { data: previous, error: readError } = await supabaseAdmin.from('profiles')
    .select('push_token,push_enabled').eq('id', req.auth.user.id).single();
  if (readError) return res.status(400).json({ success: false, error: readError.message });
  const { error } = await supabaseAdmin.from('profiles').update(updates).eq('id', req.auth.user.id);
  if (error) return res.status(400).json({ success: false, error: error.message });
  const welcomeNeeded = updates.push_token && updates.push_enabled === true &&
    (previous.push_token !== updates.push_token || previous.push_enabled === false);
  const welcomeAccepted = welcomeNeeded ? await sendPushNotification(
    updates.push_token, 'Welcome to AE!',
    'Your phone is connected. Receive your business notifications here.',
    { url: '/', type: 'welcome' }
  ) : null;
  res.json({ success: true, welcomeAccepted });
});


app.post('/api/auth/login', async (req, res) => {
  if (!requireSupabase(res)) return;
  let email = cleanText(req.body.email, 254).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Valid user ID / email and password are required' });
  }

  if (!isEmail(email)) {
    const { data: m } = await supabaseAdmin.from('merchants').select('email').ilike('merchant_code', email).maybeSingle();
    if (m?.email) {
      email = m.email.toLowerCase();
    } else {
      email = `${email}@ae-rewards.com`;
    }
  }

  const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ success: false, error: 'Invalid email or password' });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role, merchant_id, must_change_password, password_reset_at, password_changed_at')
    .eq('id', data.user.id)
    .single();
  if (profileError || !profile) {
    return res.status(403).json({ success: false, error: 'Account profile is not configured' });
  }
  if (profile.role === 'field_manager') {
    await supabaseAdmin.from('field_manager_sessions').insert({ manager_id: profile.id, login_ip: req.ip, user_agent: req.get('user-agent') || null });
  }
  res.json({
    success: true,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    user: { email: data.user.email, ...profile },
  });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ success: true, user: { email: req.auth.user.email, ...req.auth.profile } });
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const currentPassword = typeof req.body.currentPassword === 'string'
    ? req.body.currentPassword : '';
  const newPassword = typeof req.body.newPassword === 'string'
    ? req.body.newPassword : '';
  if (!currentPassword || !isStrongPassword(newPassword)) {
    return res.status(400).json({
      success: false,
      error: 'Enter the temporary password and a new password with at least 10 characters, uppercase, lowercase, number, and symbol',
    });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({
      success: false,
      error: 'The new password must be different from the temporary password',
    });
  }

  const verifier = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: req.auth.user.email,
    password: currentPassword,
  });
  if (verifyError) {
    return res.status(401).json({ success: false, error: 'The current password is incorrect' });
  }

  const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
    req.auth.user.id,
    { password: newPassword },
  );
  if (passwordError) {
    return res.status(400).json({ success: false, error: passwordError.message });
  }
  const changedAt = new Date().toISOString();
  const { error: profileError } = await supabaseAdmin.from('profiles').update({
    must_change_password: false,
    password_changed_at: changedAt,
  }).eq('id', req.auth.user.id);
  if (profileError) {
    return res.status(500).json({ success: false, error: profileError.message });
  }
  return res.json({ success: true, changedAt });
});

app.get('/api/merchants/:id/point-balance', requireAuth, async (req, res) => {
  if (req.auth.profile.role !== 'admin' && (req.auth.profile.role !== 'merchant' || req.auth.profile.merchant_id !== req.params.id)) return res.status(403).json({ error: 'Forbidden' });
  const { data, error } = await supabaseAdmin.from('merchants').select('point_balance').eq('id', req.params.id).maybeSingle();
  if (error) return res.status(503).json({ error: 'Merchant points are unavailable. Apply the merchant point allocation migration.' });
  if (!data) return res.status(404).json({ error: 'Merchant not found' });
  return res.json({ balance: Number(data.point_balance || 0) });
});

app.post('/api/merchants/:id/point-allocation', requireAuth, requireRole('admin'), async (req, res) => {
  const points = req.body.points;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!Number.isInteger(points) || points < 1 || points > 1000000 || !uuid.test(req.params.id) || !uuid.test(req.body.requestId || '')) return res.status(400).json({ error: 'Valid merchant, request ID, and 1–1,000,000 whole points are required.' });
  const { data, error } = await supabaseAdmin.rpc('allocate_merchant_points', { p_merchant_id: req.params.id, p_admin_id: req.auth.user.id, p_points: points, p_request_id: req.body.requestId });
  if (error) return res.status(error.code === 'PGRST202' ? 503 : 400).json({ error: error.code === 'PGRST202' ? 'Apply the merchant point allocation migration first.' : error.message });
  return res.json({ success: true, balance: Number(data) });
});

app.get('/api/merchants/:id', requireAuth, async (req, res, next) => {
  if (req.params.id === 'summary' || req.params.id === 'reset-password') return next(); // Skip specific routes
  const { data, error } = await supabaseAdmin
    .from('merchants')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) return res.status(500).json({ success: false, error: error.message });
  if (!data) return res.status(404).json({ success: false, error: 'Merchant not found' });
  
  const { data: redemptionData } = await supabaseAdmin
    .from('point_redemptions')
    .select('points_redeemed')
    .eq('merchant_id', req.params.id);
  
  data.total_points_redeemed = (redemptionData || []).reduce((sum, r) => sum + r.points_redeemed, 0);
  
  return res.json({ success: true, data });
});

// Admins can maintain the merchant's business profile from the merchant detail screen.
app.patch('/api/merchants/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const merchantId = cleanText(req.params.id, 100);
  const updates = {};
  if (req.body.name !== undefined) updates.name = cleanText(req.body.name, 120);
  if (req.body.email !== undefined) updates.email = cleanText(req.body.email, 254).toLowerCase();
  if (req.body.phone !== undefined) updates.phone = normalizePhone(req.body.phone);
  if (req.body.address !== undefined) updates.address = cleanText(req.body.address, 300) || null;
  if (req.body.category_id !== undefined) updates.category_id = cleanText(req.body.category_id, 100) || null;
  for (const key of ['latitude', 'longitude']) if (req.body[key] !== undefined) updates[key] = req.body[key] === '' || req.body[key] === null ? null : Number(req.body[key]);
  if (!updates.name || !updates.email || !isEmail(updates.email) || !updates.phone) return res.status(400).json({ success: false, error: 'Name, valid email, and phone are required' });
  if ((updates.latitude === null) !== (updates.longitude === null) || (updates.latitude !== undefined && (!Number.isFinite(updates.latitude) || !Number.isFinite(updates.longitude)))) return res.status(400).json({ success: false, error: 'Latitude and longitude must be valid together' });
  const { data, error } = await supabaseAdmin.from('merchants').update(updates).eq('id', merchantId).select('*').single();
  if (error) return res.status(400).json({ success: false, error: error.message });
  return res.json({ success: true, data });
});

const defaultMerchantEntitlements = { plan: 'free', paid: false, expiresAt: null, features: { analytics: true, crm: false, advertising: false, offers: true, products: true, whatsapp: false, reports: false }, limits: { customers: 100, offers: 5, campaigns: 0 } };
app.get('/api/merchants/:id/entitlements', requireAuth, async (req, res) => {
  if (req.auth.profile.role !== 'admin' && req.auth.profile.merchant_id !== req.params.id) return res.status(403).json({ success: false, error: 'Forbidden' });
  const key = `merchant_entitlements_${cleanText(req.params.id, 100)}`;
  const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', key).maybeSingle();
  let value = defaultMerchantEntitlements; try { if (data?.value) value = { ...defaultMerchantEntitlements, ...JSON.parse(data.value), features: { ...defaultMerchantEntitlements.features, ...JSON.parse(data.value).features }, limits: { ...defaultMerchantEntitlements.limits, ...JSON.parse(data.value).limits } }; } catch (_) {}
  res.json({ success: true, data: value });
});
app.patch('/api/merchants/:id/entitlements', requireAuth, requireRole('admin'), async (req, res) => {
  const key = `merchant_entitlements_${cleanText(req.params.id, 100)}`;
  const value = { plan: cleanText(req.body.plan, 40) || 'free', paid: Boolean(req.body.paid), expiresAt: req.body.expiresAt || null, features: { ...defaultMerchantEntitlements.features, ...(req.body.features || {}) }, limits: { ...defaultMerchantEntitlements.limits, ...(req.body.limits || {}) } };
  const { error } = await supabaseAdmin.from('app_settings').upsert({ key, value: JSON.stringify(value) });
  if (error) return res.status(400).json({ success: false, error: error.message });
  res.json({ success: true, data: value });
});

// Merchant payment settings are kept as a merchant-scoped record in app_settings
// so they work on existing Supabase installations without a destructive migration.
const defaultMerchantPaymentSettings = { upiId: '', displayName: '', paymentEnabled: false, provider: 'upi', mode: 'live' };
function merchantPaymentKey(id) { return `merchant_payment_settings_${cleanText(id, 100)}`; }
async function readMerchantPaymentSettings(id) {
  const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', merchantPaymentKey(id)).maybeSingle();
  try {
    return { ...defaultMerchantPaymentSettings, ...(data?.value ? JSON.parse(data.value) : {}) };
  } catch (_) { return { ...defaultMerchantPaymentSettings }; }
}
app.get('/api/merchants/:id/payment-settings', requireAuth, async (req, res) => {
  if (req.auth.profile.role !== 'admin' && req.auth.profile.merchant_id !== req.params.id) return res.status(403).json({ success: false, error: 'Forbidden' });
  res.json({ success: true, data: await readMerchantPaymentSettings(req.params.id) });
});
app.patch('/api/merchants/:id/payment-settings', requireAuth, async (req, res) => {
  if (req.auth.profile.role !== 'admin' && req.auth.profile.merchant_id !== req.params.id) return res.status(403).json({ success: false, error: 'Forbidden' });
  const upiId = cleanText(req.body.upiId, 120).toLowerCase();
  if (upiId && !/^[a-z0-9._-]{2,}@[a-z0-9.-]{2,}$/i.test(upiId)) return res.status(400).json({ success: false, error: 'Enter a valid UPI ID, for example merchant@upi.' });
  const value = { ...defaultMerchantPaymentSettings, ...(await readMerchantPaymentSettings(req.params.id)), upiId, displayName: cleanText(req.body.displayName, 120), paymentEnabled: Boolean(req.body.paymentEnabled), provider: 'upi', mode: 'live' };
  const { error } = await supabaseAdmin.from('app_settings').upsert({ key: merchantPaymentKey(req.params.id), value: JSON.stringify(value) });
  if (error) return res.status(400).json({ success: false, error: error.message });
  res.json({ success: true, data: value });
});

// Direct UPI intent flow. No gateway is involved; payment remains pending until
// the merchant confirms the customer completed the transfer in their UPI app.
app.post('/api/payments/create-upi-intent', requireAuth, requireRole('merchant'), async (req, res) => {
  const merchantId = req.auth.profile.merchant_id;
  const amount = Number(req.body.amount);
  const settings = await readMerchantPaymentSettings(merchantId);
  if (!settings.paymentEnabled || !settings.upiId) return res.status(400).json({ success: false, error: 'Merchant UPI payments are not enabled' });
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, error: 'A valid payment amount is required' });
  const customerCode = cleanText(req.body.customer_id, 100);
  const { data: recipient, error: recipientError } = await supabaseAdmin.from('customers').select('id').eq('customer_code', customerCode).maybeSingle();
  if (recipientError || !recipient) return res.status(400).json({ success: false, error: 'The payment customer could not be found.' });
  const reference = `AE${Date.now().toString(36).toUpperCase()}`;
  const { data, error } = await supabaseAdmin.from('payment_transactions').insert({ merchant_id: merchantId, customer_id: recipient.id, amount, status: 'pending', metadata: { provider: 'upi', reference } }).select().single();
  if (error) return res.status(500).json({ success: false, error: error.message });
  const params = new URLSearchParams({ pa: settings.upiId, pn: settings.displayName || 'AE Merchant', am: amount.toFixed(2), cu: 'INR', tn: `AE payment ${reference}` });
  await pushToCustomer(recipient.id, 'Payment requested', `${settings.displayName || 'AE Merchant'} requested ₹${amount.toFixed(2)}. Open AE to pay.`, { url: '/customer/home', paymentId: data.id });
  res.status(201).json({ success: true, payment: data, upiUrl: `upi://pay?${params.toString()}`, reference });
});

app.get('/api/customer/payment-requests', requireCustomerAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin.from('payment_transactions').select('id,merchant_id,amount,metadata,created_at,merchants(name)').eq('customer_id', req.customer.id).eq('status', 'pending').order('created_at', { ascending: false }).limit(20);
  if (error) return res.status(500).json({ success: false, error: 'Could not load payment requests.' });
  const payments = await Promise.all((data || []).map(async payment => {
    const settings = await readMerchantPaymentSettings(payment.merchant_id);
    const params = new URLSearchParams({ pa: settings.upiId, pn: settings.displayName || payment.merchants?.name || 'AE Merchant', am: Number(payment.amount).toFixed(2), cu: 'INR', tn: `AE payment ${payment.metadata?.reference || payment.id}` });
    return { id: payment.id, amount: payment.amount, merchantName: payment.merchants?.name || settings.displayName || 'AE Merchant', upiUrl: settings.paymentEnabled && settings.upiId ? `upi://pay?${params}` : null };
  }));
  res.json({ success: true, payments });
});

app.post('/api/payments/confirm-upi', requireAuth, requireRole('merchant'), async (req, res) => {
  const paymentId = cleanText(req.body.paymentId, 100);
  const { data, error } = await supabaseAdmin.from('payment_transactions').update({ status: 'paid', updated_at: new Date().toISOString() }).eq('id', paymentId).eq('merchant_id', req.auth.profile.merchant_id).eq('status', 'pending').select('id,status,customer_id,amount').maybeSingle();
  if (error) return res.status(500).json({ success: false, error: error.message });
  if (!data) return res.status(404).json({ success: false, error: 'Pending UPI payment was not found' });
  await pushToCustomer(data.customer_id, 'Payment confirmed', `Your merchant confirmed receipt of ₹${Number(data.amount).toFixed(2)}.`, { url: '/customer/transactions', paymentId: data.id });
  res.json({ success: true, payment: data });
});

app.get('/api/merchants', requireAuth, async (req, res) => {
  const paging = paginationFromRequest(req, 20, 100);
  let query = supabaseAdmin.from('merchants')
    .select('id, merchant_code, name, email, phone, created_at', paging.enabled ? { count: 'exact' } : undefined)
    .order('name');
  if (req.auth.profile.role === 'merchant') query = query.eq('id', req.auth.profile.merchant_id);
  if (req.query.networkId) query = query.eq('network_id', req.query.networkId);
  if (paging.search) {
    const pattern = `%${paging.search}%`;
    query = query.or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`);
  }
  if (paging.enabled) query = query.range(paging.from, paging.to);
  const { data, error, count } = await query;
  if (error) return res.status(500).json({ success: false, error: error.message });
  const merchantIds = (data || []).map((row) => row.id);
  const orderCounts = new Map();
  const passwordStates = new Map();
  if (merchantIds.length) {
    const [{ data: orderRows }, { data: profileRows }] = await Promise.all([
      supabaseAdmin.from('orders')
        .select('merchant_id')
        .in('merchant_id', merchantIds)
        .limit(10000),
      supabaseAdmin.from('profiles')
        .select('merchant_id,must_change_password')
        .eq('role', 'merchant')
        .in('merchant_id', merchantIds),
    ]);
    (orderRows || []).forEach((row) => {
      orderCounts.set(row.merchant_id, (orderCounts.get(row.merchant_id) || 0) + 1);
    });
    (profileRows || []).forEach((row) => {
      passwordStates.set(row.merchant_id, Boolean(row.must_change_password));
    });
  }
  res.json({
    success: true,
    merchants: (data || []).map((row) => ({
      id: row.id, merchantCode: row.merchant_code,
      name: row.name, email: row.email, phone: row.phone, joined: row.created_at,
      orderCount: orderCounts.get(row.id) || 0,
      mustChangePassword: passwordStates.get(row.id) || false,
    })),
    ...(paging.enabled ? { pagination: paginationMeta(paging, count) } : {}),
  });
});

app.get('/api/merchants/:id/summary', requireAuth, requireRole('admin'), async (req, res) => {
  const merchantId = cleanText(req.params.id, 100);
  const { data: merchant, error: merchantError } = await supabaseAdmin
    .from('merchants')
    .select('id,merchant_code,name,email,phone,created_at')
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
      merchantCode: merchant.merchant_code,
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

app.post('/api/merchants', requireAuth, (req, res, next) => {
  if (!['admin', 'field_manager'].includes(req.auth.profile?.role)) {
    return res.status(403).json({ success: false, error: 'Admin or Field manager access required' });
  }
  next();
}, async (req, res) => {
  const name = cleanText(req.body.name, 120);
  const email = cleanText(req.body.email, 254).toLowerCase();
  const phone = normalizePhone(req.body.phone);
  let category_id = cleanText(req.body.category_id, 100) || null;
  const route_name = cleanText(req.body.route_name, 80) || null;
  if (route_name && !['Chittur 1', 'Chittur 2', 'Chittur 3', 'Thathamangalam 1', 'Thathamangalam 2', 'Thathamangalam 3'].includes(route_name)) {
    return res.status(400).json({ success: false, error: 'Select a valid merchant route' });
  }
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const new_category_name = cleanText(req.body.new_category_name || req.body.new_category || req.body.newCategory, 80);
  if ((!category_id || category_id === '__other__') && new_category_name) {
    const { data: existingCat } = await supabaseAdmin
      .from('merchant_categories')
      .select('id')
      .ilike('name', new_category_name)
      .maybeSingle();
    if (existingCat?.id) {
      category_id = existingCat.id;
    } else {
      const { data: newCat } = await supabaseAdmin
        .from('merchant_categories')
        .insert({ name: new_category_name })
        .select('id')
        .maybeSingle();
      if (newCat?.id) category_id = newCat.id;
    }
  } else if (category_id === '__other__') {
    category_id = null;
  }
  const address = cleanText(req.body.address, 300) || null;
  const latitude = req.body.latitude === undefined || req.body.latitude === '' ? null : Number(req.body.latitude);
  const longitude = req.body.longitude === undefined || req.body.longitude === '' ? null : Number(req.body.longitude);
  const images = Array.isArray(req.body.images) ? req.body.images.filter(x => typeof x === 'string' && x.trim()) : [];
  const image_url = typeof req.body.image_url === 'string' && req.body.image_url.trim() ? req.body.image_url.trim() : (images[0] || null);
  if (!image_url) return res.status(400).json({ error: 'At least one shop photo is required to onboard a merchant.' });

  if (!name || !email || !isEmail(email) || !phone || !isStrongPassword(password)) {
    return res.status(400).json({
      success: false,
      error: 'Name, valid email/phone, and a strong temporary password are required',
    });
  }
  if ((latitude === null) !== (longitude === null) || (latitude !== null && (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180))) {
    return res.status(400).json({ success: false, error: 'Enter both valid latitude and longitude values, or leave both blank' });
  }

  const openingTime = cleanText(req.body.opening_time, 20);
  const closingTime = cleanText(req.body.closing_time, 20);
  if ((Boolean(openingTime) !== Boolean(closingTime)) || (openingTime && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(openingTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(closingTime)))) return res.status(400).json({ error: 'Provide both valid opening and closing times.' });
  let insertPayload = {
    // Opening/closing times are local shop hours; overnight schedules are allowed.
    ...(openingTime ? { opening_time: openingTime, closing_time: closingTime } : {}),
    name,
    email,
    phone,
    address,
    latitude,
    longitude,
    category_id,
    image_url,
    images: images.length ? images : [],
    ...(route_name ? { route_name } : {}),
    network_id: req.body.network_id || '00000000-0000-0000-0000-000000000000'
  };

  let { data: merchant, error: merchantError } = await supabaseAdmin
    .from('merchants')
    .insert(insertPayload)
    .select('id,merchant_code,name,email,phone,created_at')
    .single();

  if (merchantError && route_name && (merchantError.code === '42703' || merchantError.code === 'PGRST204') && merchantError.message?.includes('route_name')) {
    return res.status(503).json({ success: false, error: 'Merchant routes need the supabase-merchant-routes.sql database migration before saving.' });
  }
  if (merchantError && /opening_time|closing_time/.test(merchantError.message || '')) return res.status(503).json({ error: 'Shop hours require the supabase-merchant-hours.sql database migration.' });
  if (merchantError && (merchantError.message?.includes('image') || merchantError.code === '42703')) {
    return res.status(503).json({ error: 'Merchant photo storage needs its database migration before onboarding.' });
  }
  if (merchantError) return res.status(400).json({ success: false, error: merchantError.message });

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: name, role: 'merchant', merchant_id: merchant.id },
  });
  if (authError) {
    await supabaseAdmin.from('merchants').delete().eq('id', merchant.id);
    return res.status(400).json({ success: false, error: authError.message });
  }

  const createdAt = new Date().toISOString();
  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: authData.user.id,
    full_name: name,
    role: 'merchant',
    merchant_id: merchant.id,
    must_change_password: true,
    password_reset_at: createdAt,
  });
  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    await supabaseAdmin.from('merchants').delete().eq('id', merchant.id);
    return res.status(400).json({ success: false, error: profileError.message });
  }

  if (req.auth.profile?.role === 'field_manager') {
    try {
      await supabaseAdmin.from('field_manager_merchant_updates').insert({
        manager_id: req.auth.profile.id,
        merchant_id: merchant.id,
        payload: {
          action: 'onboard_merchant',
          merchant_name: name,
          merchant_code: merchant.merchant_code,
          phone,
          email,
          address,
          latitude,
          longitude,
          image_url,
          images,
        },
        status: 'approved',
        review_note: `Onboarded by field manager (${req.auth.profile.full_name || req.auth.profile.email})`,
        reviewed_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Could not record field manager onboarding record:', e.message);
    }
  }

  const whatsapp = await sendMerchantWelcomeWhatsApp(merchant);
  res.status(201).json({
    success: true,
    merchant: {
      id: merchant.id,
      merchantCode: merchant.merchant_code,
      name: merchant.name,
      email: merchant.email,
      phone: merchant.phone,
      joined: merchant.created_at,
      mustChangePassword: true,
    },
    temporaryPassword: password,
    whatsapp: {
      sent: whatsapp.sent,
      status: whatsapp.sent ? 'sent' : 'failed',
      error: whatsapp.error || null,
    },
  });
});

app.post('/api/merchants/:id/reset-password', requireAuth, (req, res, next) => {
  if (!['admin', 'field_manager'].includes(req.auth.profile?.role)) {
    return res.status(403).json({ success: false, error: 'Admin or Field manager access required' });
  }
  next();
}, async (req, res) => {
  const merchantId = cleanText(req.params.id, 100);
  const [{ data: merchant }, { data: profile }] = await Promise.all([
    supabaseAdmin.from('merchants')
      .select('id,merchant_code,name,email,phone,created_at')
      .eq('id', merchantId)
      .maybeSingle(),
    supabaseAdmin.from('profiles')
      .select('id,merchant_id')
      .eq('role', 'merchant')
      .eq('merchant_id', merchantId)
      .maybeSingle(),
  ]);
  if (!merchant || !profile) {
    return res.status(404).json({ success: false, error: 'Merchant login was not found' });
  }

  const temporaryPassword = generateTemporaryPassword();
  const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
    profile.id,
    { password: temporaryPassword },
  );
  if (passwordError) {
    return res.status(400).json({ success: false, error: passwordError.message });
  }

  const resetAt = new Date().toISOString();
  const { error: profileError } = await supabaseAdmin.from('profiles').update({
    must_change_password: true,
    password_reset_at: resetAt,
  }).eq('id', profile.id);
  if (profileError) {
    return res.status(500).json({ success: false, error: profileError.message });
  }

  const whatsapp = await sendMerchantAccountReadyWhatsApp(merchant);
  return res.json({
    success: true,
    merchantCode: merchant.merchant_code,
    loginEmail: merchant.email,
    temporaryPassword,
    mustChangePassword: true,
    whatsapp: {
      sent: whatsapp.sent,
      status: whatsapp.sent ? 'sent' : 'failed',
      error: whatsapp.error || null,
    },
  });
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
  await supabaseAdmin.from('customer_orders').delete().eq('merchant_id', merchantId);

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
      await supabaseAdmin.from('customer_orders').delete().in('customer_id', orphanCustomerIds);
      
      const { error: customerDeleteError } = await supabaseAdmin.from('customers').delete().in('id', orphanCustomerIds);
      if (customerDeleteError) return res.status(400).json({ success: false, error: customerDeleteError.message });
      deletedCustomers = orphanCustomerIds.length;
    }
  }

  const { error } = await supabaseAdmin.from('merchants').delete().eq('id', merchantId);
  if (error) return res.status(400).json({ success: false, error: error.message });
  res.json({ success: true, deletedCustomers });
});

function customerOrderDto(row) {
  return {
    id: row.id,
    requestNo: row.request_no,
    customerId: row.customer_id,
    customer: row.customers?.name || '',
    customerPhone: row.customers?.phone || '',
    merchantId: row.merchant_id,
    merchant: row.merchants?.name || '',
    status: row.status,
    note: row.customer_note || '',
    total: row.total_amount === null ? null : Number(row.total_amount),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: (row.customer_order_items || []).map((item) => ({
      id: item.id,
      name: item.product_name,
      quantity: item.quantity,
      unitPrice: item.unit_price === null ? null : Number(item.unit_price),
      type: item.item_type,
    })),
  };
}

function customerOrderScope(query, auth) {
  return auth.profile.role === 'merchant'
    ? query.eq('merchant_id', auth.profile.merchant_id)
    : query;
}

app.get('/api/products', requireAuth, async (req, res) => {
  const paging = paginationFromRequest(req, 20, 100);
  let query = supabaseAdmin.from('products')
    .select('id,merchant_id,name,description,price,active,created_at,updated_at,merchants(name,merchant_code)', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (req.auth.profile.role === 'merchant') query = query.eq('merchant_id', req.auth.profile.merchant_id);
  const active = req.query.active;
  if (active === 'true' || active === 'false') query = query.eq('active', active === 'true');
  if (paging.search) query = query.ilike('name', `%${paging.search}%`);
  const { data, error, count } = await query.range(paging.from, paging.to);
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({
    success: true,
    products: (data || []).map((item) => ({
      id: item.id, merchantId: item.merchant_id, merchant: item.merchants?.name || '',
      merchantCode: item.merchants?.merchant_code || '', name: item.name,
      description: item.description || '', price: Number(item.price), active: item.active,
      createdAt: item.created_at, updatedAt: item.updated_at,
    })),
    pagination: paginationMeta(paging, count),
  });
});

app.post('/api/products', requireAuth, requireRole('merchant'), async (req, res) => {
  const name = cleanText(req.body.name, 100);
  const description = cleanText(req.body.description, 500);
  const price = Number(req.body.price);
  if (!name) return res.status(400).json({ success: false, error: 'Product name is required' });
  if (!Number.isFinite(price) || price < 0 || price > 1_000_000) {
    return res.status(400).json({ success: false, error: 'Enter a valid product price' });
  }
  const { data, error } = await supabaseAdmin.from('products').insert({
    merchant_id: req.auth.profile.merchant_id, name, description, price, active: true,
  }).select('id').single();
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.status(201).json({ success: true, productId: data.id });
});

app.put('/api/products/:id', requireAuth, requireRole('merchant'), async (req, res) => {
  const name = cleanText(req.body.name, 100);
  const description = cleanText(req.body.description, 500);
  const price = Number(req.body.price);
  const active = req.body.active !== false;
  if (!name) return res.status(400).json({ success: false, error: 'Product name is required' });
  if (!Number.isFinite(price) || price < 0 || price > 1_000_000) {
    return res.status(400).json({ success: false, error: 'Enter a valid product price' });
  }
  const { error } = await supabaseAdmin.from('products').update({
    name, description, price, active, updated_at: new Date().toISOString(),
  }).eq('id', cleanText(req.params.id, 100)).eq('merchant_id', req.auth.profile.merchant_id);
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true });
});

app.delete('/api/products/:id', requireAuth, requireRole('merchant'), async (req, res) => {
  const { error } = await supabaseAdmin.from('products').update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', cleanText(req.params.id, 100)).eq('merchant_id', req.auth.profile.merchant_id);
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true });
});

app.get('/api/customer-orders', requireAuth, async (req, res) => {
  const paging = paginationFromRequest(req, 20, 100);
  let query = customerOrderScope(supabaseAdmin.from('customer_orders').select(
    'id,request_no,customer_id,merchant_id,status,customer_note,total_amount,created_at,updated_at,customers(name,phone),merchants(name),customer_order_items(id,product_name,quantity,unit_price,item_type)',
    { count: 'exact' },
  ), req.auth).order('created_at', { ascending: false });
  const status = cleanText(req.query.status, 32);
  if (status) query = query.eq('status', status);
  if (paging.search) query = query.or(`request_no.ilike.%${paging.search}%,customer_note.ilike.%${paging.search}%`);
  const { data, error, count } = await query.range(paging.from, paging.to);
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, orders: (data || []).map(customerOrderDto), pagination: paginationMeta(paging, count) });
});

app.patch('/api/customer-orders/:id/status', requireAuth, async (req, res) => {
  const status = cleanText(req.body.status, 32);
  const allowed = ['pending', 'accepted', 'rejected', 'completed', 'cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ success: false, error: 'Choose a valid order status' });
  let lookup = customerOrderScope(supabaseAdmin.from('customer_orders').select(
    'id,request_no,customer_id,merchant_id,status,customers(name,phone),merchants(name,phone),customer_order_items(product_name,quantity)',
  ).eq('id', cleanText(req.params.id, 100)), req.auth);
  const { data: current, error: currentError } = await lookup.maybeSingle();
  if (currentError) return res.status(500).json({ success: false, error: currentError.message });
  if (!current) return res.status(404).json({ success: false, error: 'Customer order not found' });
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from('customer_orders').update({ status, updated_at: now }).eq('id', current.id);
  if (error) return res.status(500).json({ success: false, error: error.message });
  const order = {
    ...current, status,
    customer_name: current.customers?.name, customer_phone: current.customers?.phone,
    merchant_name: current.merchants?.name, merchant_phone: current.merchants?.phone,
    items: current.customer_order_items,
  };
  scheduleBackground(() => sendCustomerOrderStatusWhatsApp(order));
  res.json({ success: true, status });
});

app.get('/api/notifications', requireAuth, async (req, res) => {
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 8));
  let query = supabaseAdmin.from('merchant_notifications')
    .select('id,merchant_id,customer_order_id,title,body,read_at,created_at,customer_orders(request_no,status)')
    .order('created_at', { ascending: false }).limit(limit);
  if (req.auth.profile.role === 'merchant') query = query.eq('merchant_id', req.auth.profile.merchant_id);
  const { data, error } = await query;
  if (error) return res.status(500).json({ success: false, error: error.message });
  const notifications = (data || []).map((item) => ({
    id: item.id, merchantId: item.merchant_id, customerOrderId: item.customer_order_id,
    title: item.title, body: item.body, readAt: item.read_at, createdAt: item.created_at,
    requestNo: item.customer_orders?.request_no || '', status: item.customer_orders?.status || '',
  }));
  res.json({ success: true, notifications, unreadCount: notifications.filter((item) => !item.readAt).length });
});

app.post('/api/notifications/:id/read', requireAuth, async (req, res) => {
  let query = supabaseAdmin.from('merchant_notifications').update({ read_at: new Date().toISOString() })
    .eq('id', cleanText(req.params.id, 100));
  if (req.auth.profile.role === 'merchant') query = query.eq('merchant_id', req.auth.profile.merchant_id);
  const { error } = await query;
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true });
});

app.get('/api/offers', requireAuth, async (req, res) => {
  const paging = paginationFromRequest(req, 20, 50);
  const status = cleanText(req.query.status, 30);
  const allowedStatuses = new Set(['pending', 'approved', 'rejected']);
  let query = supabaseAdmin.from('offers').select(
    'id,merchant_id,title,description,category,audience,image_path,expires_at,status,rejection_reason,reviewed_at,broadcast_at,created_at,updated_at,merchants(name,merchant_code),offer_campaigns(id,status,total_recipients,queued_count,processing_count,sent_count,delivered_count,read_count,failed_count,skipped_count,started_at,completed_at,created_at)',
    { count: 'exact' },
  ).order('created_at', { ascending: false });
  if (req.auth.profile.role === 'merchant') {
    query = query.eq('merchant_id', req.auth.profile.merchant_id);
  }
  if (allowedStatuses.has(status)) query = query.eq('status', status);
  const category = cleanText(req.query.category, 80);
  if (category) query = query.eq('category', category);
  if (paging.search) {
    const pattern = `%${paging.search}%`;
    query = query.or(`title.ilike.${pattern},description.ilike.${pattern}`);
  }
  query = query.range(paging.from, paging.to);
  const { data, error, count } = await query;
  if (error) return res.status(500).json({ success: false, error: error.message });
  const campaignIds = (data || []).flatMap((row) => {
    const campaign = Array.isArray(row.offer_campaigns)
      ? row.offer_campaigns[0] : row.offer_campaigns;
    return campaign?.id ? [campaign.id] : [];
  });
  const failureByCampaign = new Map();
  if (campaignIds.length) {
    const { data: failures, error: failureError } = await supabaseAdmin
      .from('offer_recipients')
      .select('campaign_id,error_code,error_message,updated_at')
      .in('campaign_id', campaignIds)
      .eq('status', 'failed')
      .order('updated_at', { ascending: false })
      .limit(100);
    if (failureError) {
      return res.status(500).json({ success: false, error: failureError.message });
    }
    for (const failure of failures || []) {
      if (!failureByCampaign.has(failure.campaign_id)) {
        failureByCampaign.set(failure.campaign_id, failure);
      }
    }
  }
  return res.json({
    success: true,
    offers: await Promise.all((data || []).map((row) => {
      const campaign = Array.isArray(row.offer_campaigns)
        ? row.offer_campaigns[0] : row.offer_campaigns;
      return offerDto(row, failureByCampaign.get(campaign?.id));
    })),
    pagination: paginationMeta(paging, count),
  });
});

app.get('/api/merchant/loyal-customers', requireAuth, requireRole('merchant'), async (req, res) => {
  const result = await supabaseAdmin.rpc('loyal_customers', { p_merchant_id: req.auth.profile.merchant_id });
  if (result.error) return res.status(503).json({ error: 'Loyalty is not available. Apply supabase-loyalty.sql first.' });
  return res.json({ customers: result.data || [] });
});

app.post('/api/merchant/loyalty-bonus', requireAuth, requireRole('merchant'), async (req, res) => {
  const points = Number(req.body.points);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!Number.isInteger(points) || points < 1 || points > 100 || !uuid.test(req.body.customerId || '') || !uuid.test(req.body.requestId || '')) return res.status(400).json({ error: 'Select a customer and enter 1–100 whole points.' });
  const result = await supabaseAdmin.rpc('award_loyalty_bonus', { p_merchant_id: req.auth.profile.merchant_id, p_customer_id: req.body.customerId, p_points: points, p_request_id: req.body.requestId, p_created_by: req.auth.user.id });
  if (result.error) return res.status(400).json({ error: result.error.message });
  let notificationSent = false;
  let claim;
  try {
    await firebaseInitializationPromise;
    const { getFirestore } = await import('firebase-admin/firestore');
    claim = getFirestore().collection('ae_loyalty_notifications').doc(String(result.data.id));
    // Atomic claim prevents duplicate pushes when the award request is retried.
    await claim.create({ bonus_id: result.data.id, created_at: new Date().toISOString() });
    notificationSent = await pushToCustomer(
      req.body.customerId,
      'Thank you for your loyalty! 💙',
      `You received ${result.data.points} AE loyalty points. Thank you for your loyalty!`,
      { url: '/customer/notifications', bonus_id: String(result.data.id), type: 'loyalty_bonus' },
    );
    if (!notificationSent) await claim.delete();
  } catch (error) {
    if (error.code !== 6 && error.code !== 'already-exists') console.warn('Loyalty notification failed:', error.message);
  }
  return res.json({ success: true, bonus: result.data, notificationSent });
});

app.post(
  '/api/offers',
  requireAuth,
  requireRole('merchant'),
  offerImageMiddleware,
  async (req, res) => {
    const title = cleanText(req.body.title, 120);
    const description = cleanText(req.body.description, 1000);
    const category = cleanText(req.body.category, 80) || null;
    const expiresAt = new Date(req.body.expiresAt);
    if (!title || !description || !Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Title, description, and a future expiry date are required',
      });
    }
    if (!validOfferImage(req.file)) {
      return res.status(400).json({
        success: false,
        error: 'Upload a JPEG, PNG, or WebP offer image',
      });
    }

    let imagePath;
    try {
      imagePath = await uploadOfferImage(req.auth.profile.merchant_id, req.file);
      const { data: offer, error } = await supabaseAdmin.from('offers').insert({
        merchant_id: req.auth.profile.merchant_id,
        title,
        description,
        category,
        audience: req.body.audience === 'loyal' ? 'loyal' : 'all',
        image_path: imagePath,
        expires_at: expiresAt.toISOString(),
        status: 'pending',
        submitted_by: req.auth.user.id,
      }).select(
        'id,merchant_id,title,description,category,audience,image_path,expires_at,status,rejection_reason,reviewed_at,broadcast_at,created_at,updated_at,merchants(name,merchant_code)',
      ).single();
      if (error) throw error;
      await pushToRole('admin', 'New merchant offer', `${title} is waiting for approval.`, { url: '/offers', offerId: offer.id });
      return res.status(201).json({ success: true, offer: await offerDto(offer) });
    } catch (error) {
      if (imagePath) {
        await supabaseAdmin.storage.from(OFFER_IMAGE_BUCKET).remove([imagePath]);
      }
      return res.status(400).json({ success: false, error: error.message });
    }
  },
);

app.put(
  '/api/offers/:id',
  requireAuth,
  requireRole('merchant'),
  offerImageMiddleware,
  async (req, res) => {
    const offerId = cleanText(req.params.id, 100);
    const { data: currentOffer } = await supabaseAdmin.from('offers')
      .select('id,merchant_id,status,image_path')
      .eq('id', offerId)
      .eq('merchant_id', req.auth.profile.merchant_id)
      .maybeSingle();
    if (!currentOffer) {
      return res.status(404).json({ success: false, error: 'Offer was not found' });
    }
    if (currentOffer.status !== 'rejected') {
      return res.status(409).json({ success: false, error: 'Only rejected offers can be edited' });
    }

    const title = cleanText(req.body.title, 120);
    const description = cleanText(req.body.description, 1000);
    const category = cleanText(req.body.category, 80) || null;
    const expiresAt = new Date(req.body.expiresAt);
    if (!title || !description || !Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Title, description, and a future expiry date are required',
      });
    }
    if (req.file && !validOfferImage(req.file)) {
      return res.status(400).json({
        success: false,
        error: 'Upload a JPEG, PNG, or WebP offer image',
      });
    }

    let replacementPath = currentOffer.image_path;
    let uploadedPath = '';
    try {
      if (req.file) {
        uploadedPath = await uploadOfferImage(req.auth.profile.merchant_id, req.file);
        replacementPath = uploadedPath;
      }
      const { data: offer, error } = await supabaseAdmin.from('offers').update({
        title,
        description,
        category,
        image_path: replacementPath,
        expires_at: expiresAt.toISOString(),
        status: 'pending',
        rejection_reason: null,
        reviewed_by: null,
        reviewed_at: null,
        submitted_by: req.auth.user.id,
        updated_at: new Date().toISOString(),
      }).eq('id', offerId).select(
        'id,merchant_id,title,description,category,audience,image_path,expires_at,status,rejection_reason,reviewed_at,broadcast_at,created_at,updated_at,merchants(name,merchant_code)',
      ).single();
      if (error) throw error;
      if (uploadedPath) {
        await supabaseAdmin.storage.from(OFFER_IMAGE_BUCKET).remove([currentOffer.image_path]);
      }
      return res.json({ success: true, offer: await offerDto(offer) });
    } catch (error) {
      if (uploadedPath) {
        await supabaseAdmin.storage.from(OFFER_IMAGE_BUCKET).remove([uploadedPath]);
      }
      return res.status(400).json({ success: false, error: error.message });
    }
  },
);

app.post('/api/offers/:id/approve', requireAuth, requireRole('admin'), async (req, res) => {
  const offerId = cleanText(req.params.id, 100);
  const { data: pendingOffer } = await supabaseAdmin.from('offers').select('merchant_id,title').eq('id', offerId).maybeSingle();
  const { data: offer, error } = await supabaseAdmin.from('offers').update({
    status: 'approved',
    rejection_reason: null,
    reviewed_by: req.auth.user.id,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', offerId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .select('id,status')
    .maybeSingle();
  if (error) return res.status(400).json({ success: false, error: error.message });
  if (!offer) {
    return res.status(409).json({
      success: false,
      error: 'Only pending, unexpired offers can be approved',
    });
  }
  if (pendingOffer) await pushToMerchant(pendingOffer.merchant_id, 'Offer approved', `${pendingOffer.title} is now approved and visible to customers.`, { url: '/offers', offerId });
  return res.json({ success: true, offer });
});

app.post('/api/offers/:id/reject', requireAuth, requireRole('admin'), async (req, res) => {
  const offerId = cleanText(req.params.id, 100);
  const { data: pendingOffer } = await supabaseAdmin.from('offers').select('merchant_id,title').eq('id', offerId).maybeSingle();
  const reason = cleanText(req.body.reason, 500);
  if (!reason) {
    return res.status(400).json({ success: false, error: 'A rejection reason is required' });
  }
  const { data: offer, error } = await supabaseAdmin.from('offers').update({
    status: 'rejected',
    rejection_reason: reason,
    reviewed_by: req.auth.user.id,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', offerId)
    .eq('status', 'pending')
    .select('id,status,rejection_reason')
    .maybeSingle();
  if (error) return res.status(400).json({ success: false, error: error.message });
  if (!offer) {
    return res.status(409).json({ success: false, error: 'Only pending offers can be rejected' });
  }
  if (pendingOffer) await pushToMerchant(pendingOffer.merchant_id, 'Offer rejected', `${pendingOffer.title} needs changes before it can be published.`, { url: '/offers', offerId });
  return res.json({ success: true, offer });
});

app.post('/api/offers/:id/send', requireAuth, requireRole('admin'), async (req, res) => {
  if (!WA_TOKEN || !WA_PHONE_ID || !WA_OFFER_TEMPLATE) {
    return res.status(503).json({
      success: false,
      error: 'The WhatsApp offer template is not configured',
    });
  }
  const offerId = cleanText(req.params.id, 100);
  const { data, error } = await supabaseAdmin.rpc('create_offer_campaign', {
    p_offer_id: offerId,
    p_created_by: req.auth.user.id,
  });
  if (error) return res.status(400).json({ success: false, error: error.message });
  const campaign = data?.[0];
  if (!campaign) {
    return res.status(500).json({ success: false, error: 'Offer campaign could not be created' });
  }
  if (campaign.campaign_status !== 'completed') {
    scheduleBackground(() => processOfferQueue(2));
  }
  return res.status(202).json({
    success: true,
    campaign: {
      id: campaign.campaign_id,
      totalRecipients: campaign.total_recipients,
      status: campaign.campaign_status,
    },
  });
});

app.post('/api/offers/:id/retry', requireAuth, requireRole('admin'), async (req, res) => {
  const offerId = cleanText(req.params.id, 100);
  const { data: offer, error: offerError } = await supabaseAdmin
    .from('offers')
    .select('id,expires_at,offer_campaigns(id)')
    .eq('id', offerId)
    .maybeSingle();
  if (offerError) return res.status(400).json({ success: false, error: offerError.message });
  if (!offer) return res.status(404).json({ success: false, error: 'Offer was not found' });
  if (new Date(offer.expires_at) <= new Date()) {
    return res.status(409).json({ success: false, error: 'Expired offers cannot be retried' });
  }
  const campaign = Array.isArray(offer.offer_campaigns)
    ? offer.offer_campaigns[0] : offer.offer_campaigns;
  if (!campaign?.id) {
    return res.status(404).json({ success: false, error: 'Campaign was not found' });
  }
  const now = new Date().toISOString();
  const { data: retried, error } = await supabaseAdmin
    .from('offer_recipients')
    .update({
      status: 'queued',
      attempts: 0,
      next_attempt_at: now,
      error_code: null,
      error_message: null,
      status_timestamp: null,
      updated_at: now,
    })
    .eq('campaign_id', campaign.id)
    .eq('status', 'failed')
    .select('id');
  if (error) return res.status(400).json({ success: false, error: error.message });
  if (!retried?.length) {
    return res.status(409).json({ success: false, error: 'There are no failed recipients to retry' });
  }
  await supabaseAdmin.rpc('refresh_offer_campaign', { p_campaign_id: campaign.id });
  scheduleBackground(() => processOfferQueue(2));
  return res.status(202).json({ success: true, retried: retried.length });
});

app.get('/api/offers/:id/campaign', requireAuth, async (req, res) => {
  const offerId = cleanText(req.params.id, 100);
  let query = supabaseAdmin.from('offer_campaigns')
    .select('id,offer_id,merchant_id,status,total_recipients,queued_count,processing_count,sent_count,delivered_count,read_count,failed_count,skipped_count,started_at,completed_at,created_at')
    .eq('offer_id', offerId);
  if (req.auth.profile.role === 'merchant') {
    query = query.eq('merchant_id', req.auth.profile.merchant_id);
  }
  const { data: campaign, error } = await query.maybeSingle();
  if (error) return res.status(500).json({ success: false, error: error.message });
  if (!campaign) return res.status(404).json({ success: false, error: 'Campaign was not found' });
  return res.json({ success: true, campaign: campaignDto(campaign) });
});

app.post('/api/internal/offers/process', async (req, res) => {
  const supplied = req.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
  if (!OFFER_QUEUE_SECRET || supplied.length !== OFFER_QUEUE_SECRET.length) {
    return res.status(401).json({ success: false, error: 'Invalid queue credentials' });
  }
  const valid = crypto.timingSafeEqual(
    Buffer.from(supplied),
    Buffer.from(OFFER_QUEUE_SECRET),
  );
  if (!valid) return res.status(401).json({ success: false, error: 'Invalid queue credentials' });
  try {
    const processed = await processOfferQueue(3);
    return res.json({ success: true, processed });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
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
      .select('id,customer_code,name,phone,email,registration_source,created_at', { count: 'exact' })
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
        .select('id,customer_code,name,phone,email,registration_source,created_at')
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
          registrationSource: customer.registration_source || 'merchant',
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

app.get('/api/customers/phone-status', requireAuth, async (req, res) => {
  const phone = normalizePhone(req.query.phone);
  const merchantId = req.auth.profile.role === 'admin'
    ? cleanText(req.query.merchantId, 100)
    : req.auth.profile.merchant_id;
  if (!phone) {
    return res.status(400).json({ success: false, error: 'Enter a valid 10-digit Indian mobile number' });
  }

  const { data: customer, error } = await supabaseAdmin
    .from('customers')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();
  if (error) return res.status(500).json({ success: false, error: error.message });
  if (!customer) {
    return res.json({ success: true, registered: false, registeredWithMerchant: false });
  }

  let registeredWithMerchant = false;
  if (merchantId) {
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('customer_merchants')
      .select('customer_id')
      .eq('customer_id', customer.id)
      .eq('merchant_id', merchantId)
      .maybeSingle();
    if (membershipError) {
      return res.status(500).json({ success: false, error: membershipError.message });
    }
    registeredWithMerchant = Boolean(membership);
  }

  return res.json({ success: true, registered: true, registeredWithMerchant });
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
  await supabaseAdmin.from('customer_product_list_requests').delete().eq('customer_id', customer.id);
  await supabaseAdmin.from('customer_feedback').delete().eq('customer_id', customer.id);
  await supabaseAdmin.from('customer_orders').delete().eq('customer_id', customer.id);
  // Settlement tables use restrictive foreign keys, so clear them before orders/customers.
  const { data: customerLots } = await supabaseAdmin.from('reward_lots').select('id').eq('customer_id', customer.id);
  const lotIds = (customerLots || []).map((row) => row.id).filter(Boolean);
  if (lotIds.length) {
    await supabaseAdmin.from('reversals').delete().in('reward_lot_id', lotIds);
    await supabaseAdmin.from('redemption_allocations').delete().in('reward_lot_id', lotIds);
    await supabaseAdmin.from('merchant_funding_obligations').delete().in('reward_lot_id', lotIds);
  }
  await supabaseAdmin.from('vouchers').delete().eq('customer_id', customer.id);
  await supabaseAdmin.from('merchant_funding_obligations').delete().eq('customer_id', customer.id);
  await supabaseAdmin.from('refunds').delete().eq('customer_id', customer.id);
  await supabaseAdmin.from('redemptions').delete().eq('customer_id', customer.id);
  await supabaseAdmin.from('reward_ledger').delete().eq('customer_id', customer.id);
  await supabaseAdmin.from('reward_lots').delete().eq('customer_id', customer.id);
  const { error: orderDeleteError } = await supabaseAdmin.from('orders').delete().eq('customer_id', customer.id);
  if (orderDeleteError) return res.status(400).json({ success: false, error: orderDeleteError.message });
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
  const selectedPoints = Number(req.body.rewardPercentage); // We reuse this field for points per 100
  if (!Number.isInteger(selectedPoints) || selectedPoints < 1 || selectedPoints > 100) return res.status(400).json({ success: false, error: 'Points per ₹100 must be a whole number between 1 and 100. Maximum 100 points can be issued per purchase.' });
  const adminConfig = await getAdminRewardConfig();
  const merchantId = req.auth.profile.role === 'admin'
    ? cleanText(req.body.merchantId, 100)
    : req.auth.profile.merchant_id;
  if (
    !name ||
    !phone ||
    (email && !isEmail(email)) ||
    !merchantId ||
    !Number.isFinite(amount) ||
    amount < 10
  ) {
    return res.status(400).json({
      success: false,
      error: `Enter valid customer details and a purchase amount of ₹10 or more.`,
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
    const { data: merchantData } = await supabaseAdmin.from('merchants').select('network_id').eq('id', merchantId).single();
    const networkId = merchantData?.network_id;

    const customerCode = `C${Date.now().toString(36).toUpperCase()}`;
    const temporaryPassword = phone.replace(/\D/g, '').slice(-6).padStart(6, '0');
    const passwordHash = hashPassword(temporaryPassword);
    
    const created = await supabaseAdmin.from('customers').insert({
      customer_code: customerCode,
      name,
      phone,
      email: email || null,
      merchant_id: merchantId,
      network_id: networkId,
      whatsapp_opt_in_at: new Date().toISOString(),
      password_hash: passwordHash,
      must_change_password: true,
    }).select('id,customer_code,name,phone,email,created_at').single();
    if (created.error) return res.status(400).json({ success: false, error: created.error.message });
    customer = created.data;
    customer.temporaryPassword = temporaryPassword;
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

  const earnRateWithCap = await getMerchantEarnRateWithCap(merchantId);
  // If cap is reached (0), we issue 0 points, otherwise we use the selected points
  const pointsToIssue = earnRateWithCap === 0 ? 0 : selectedPoints;
  const { data: purchases, error: purchaseError } = await processPurchase({
    p_customer_code: customer.customer_code,
    p_merchant_id: merchantId,
    p_amount: amount,
    p_points_per_100: pointsToIssue,
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
  // Attach temporary password to purchase so it is included in the welcome QR template
  if (customer.temporaryPassword) {
    purchase.temporary_password = customer.temporaryPassword;
  }
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
      temporaryPassword: customer.temporaryPassword,
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
  const identifier = cleanText(req.params.code, 100);
  // Older customer apps encoded the full database UUID instead of customer_code.
  // Match an exact identifier only; abbreviated display IDs are not unique.
  const isDatabaseId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('id,customer_code,name,phone,email')
    .eq(isDatabaseId ? 'id' : 'customer_code', identifier)
    .maybeSingle();
  if (error) {
    return res.status(500).json({ success: false, error: 'Customer verification is temporarily unavailable. Please try again.' });
  }
  if (!data) {
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
  const requestedRate = Number(req.body.rewardPercentage || 10);
  if (!Number.isFinite(requestedRate) || requestedRate < 1 || requestedRate > 100) {
    return res.status(400).json({ success: false, error: 'Points per INR 100 must be between 1 and 100.' });
  }
  const pointsToRedeem = Number(req.body.pointsToRedeem || 0);
  const discountType = req.body.discountType === 'flat' ? 'flat' : 'percentage';
  const paymentTransactionId = cleanText(req.body.paymentTransactionId, 100);
  if (
    !customerCode ||
    !Number.isFinite(amount) ||
    amount < 100
  ) {
    return res.status(400).json({
      success: false,
      error: `Purchase must be at least 100.`,
    });
  }
  const paymentSettings = await readMerchantPaymentSettings(req.auth.profile.merchant_id);
  if (paymentSettings.paymentEnabled) {
    if (!paymentTransactionId) return res.status(402).json({ success: false, error: 'Verified payment is required before completing this checkout.' });
    const { data: verifiedPayment } = await supabaseAdmin.from('payment_transactions').select('id,merchant_id,customer_id,status,amount,customers(customer_code)').eq('id', paymentTransactionId).maybeSingle();
    const paymentRewardSettings = await getMerchantRewardSettings(req.auth.profile.merchant_id);
    const discount = pointsToRedeem === 100 ? redemptionDiscount(amount, discountType, req.body.discountValue ?? (paymentRewardSettings.redeem_discount_per_100 || 5)) : null;
    if (pointsToRedeem === 100 && !discount) return res.status(400).json({ success: false, error: 'Discount value must be zero or greater.' });
    const payableAmount = Math.round((amount - (discount?.amount || 0)) * 100);
    if (!verifiedPayment || verifiedPayment.merchant_id !== req.auth.profile.merchant_id || verifiedPayment.customers?.customer_code !== customerCode || verifiedPayment.status !== 'paid' || Math.round(Number(verifiedPayment.amount) * 100) !== payableAmount) return res.status(402).json({ success: false, error: 'Payment does not match this customer and checkout amount.' });
  }
  if (!Number.isFinite(pointsToRedeem) || (pointsToRedeem !== 0 && pointsToRedeem !== 100)) {
    return res.status(400).json({ success: false, error: 'Redeem points must be exactly 100, or 0 when no redemption is selected.' });
  }
  let redemptionContext = null;
  if (pointsToRedeem > 0) {
    const customerIsUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerCode);
    const { data: customer, error: customerError } = await supabaseAdmin.from('customers').select('id, reward_points').eq(customerIsUuid ? 'id' : 'customer_code', customerCode).maybeSingle();
    if (customerError) return res.status(500).json({ success: false, error: 'Unable to read customer balance. Please try again.' });
    const { data: membership } = customer ? await supabaseAdmin.from('customer_merchants').select('reward_points').eq('customer_id', customer.id).eq('merchant_id', req.auth.profile.merchant_id).maybeSingle() : { data: null };
    if (!customer || !membership || Number(membership.reward_points || 0) < pointsToRedeem) return res.status(400).json({ success: false, error: 'Insufficient points balance at this store.' });
    const rewardSettings = await getMerchantRewardSettings(req.auth.profile.merchant_id);
    const discount = redemptionDiscount(amount, discountType, req.body.discountValue ?? (rewardSettings.redeem_discount_per_100 || 5));
    if (!discount) return res.status(400).json({ success: false, error: 'Discount value must be zero or greater.' });
    redemptionContext = { customer, membership, discountPercentage: discount.percentage, discountAmount: discount.amount, discountType: discount.type, discountValue: discount.value };
  }
  
  const { data, error } = await processPurchase({
    p_customer_code: customerCode,
    p_merchant_id: req.auth.profile.merchant_id,
    p_amount: amount,
    // The database function expects the earning rate (points per ₹100),
    // not the already-calculated transaction total. Passing selectedPoints
    // here caused ₹10,000 purchases to award 10,000 points.
    p_points_per_100: requestedRate,
    p_source: 'qr',
    p_location: cleanText(req.body.location, 160) || 'In-store',
  }, req.get('Idempotency-Key'));
  if (error || !data?.[0]) {
    return res.status(400).json({ success: false, error: error?.message || 'Checkout failed' });
  }
  const purchase = data[0];
  let redemption = null;
  if (redemptionContext) {
    const { data: redemptionRow, error: redemptionError } = await supabaseAdmin.from('point_redemptions').insert({ customer_id: redemptionContext.customer.id, merchant_id: req.auth.profile.merchant_id, transaction_amount: amount, points_redeemed: pointsToRedeem, discount_percentage: redemptionContext.discountPercentage, discount_amount: redemptionContext.discountAmount }).select().single();
    if (redemptionError) return res.status(500).json({ success: false, error: redemptionError.message });
    redemption = redemptionRow;
    await supabaseAdmin.from('customers').update({ reward_points: Math.max(0, Number(redemptionContext.customer.reward_points || 0) - pointsToRedeem + Number(purchase.points_earned || 0)) }).eq('id', redemptionContext.customer.id);
    await supabaseAdmin.from('customer_merchants').update({ reward_points: Math.max(0, Number(redemptionContext.membership.reward_points || 0) - pointsToRedeem + Number(purchase.points_earned || 0)) }).eq('customer_id', redemptionContext.customer.id).eq('merchant_id', req.auth.profile.merchant_id);
  }
  const { data: merchantForNotification } = await supabaseAdmin
    .from('merchants')
    .select('name')
    .eq('id', req.auth.profile.merchant_id)
    .maybeSingle();
  const merchantName = merchantForNotification?.name || 'your merchant';
  if (redemption) await pushToCustomer(purchase.customer_id, 'Points redeemed', `${merchantName} redeemed ${pointsToRedeem} points. Discount: ₹${Number(redemptionContext.discountAmount).toFixed(2)}.`, { url: '/customer/transactions', transactionId: redemption.id, merchantName });
  await pushToCustomer(purchase.customer_id, 'Points received', `${merchantName} added ${purchase.points_earned || 0} points to your account.`, { url: '/customer/transactions', orderId: purchase.id, merchantName });
  await pushToMerchant(req.auth.profile.merchant_id, 'Purchase recorded', `A customer purchase of ₹${amount} was recorded.`, { url: '/customer-orders', orderId: purchase.id });
  // Purchases use native push notifications only. WhatsApp is reserved for
  // onboarding (welcome and temporary-password messages).
  res.status(201).json({ success: true, purchase, redemption, discountAmount: redemptionContext?.discountAmount || 0, whatsapp: { skipped: true, reason: 'push_only' } });
});

app.get('/api/orders', requireAuth, (req, res, next) => {
  if (!['admin', 'merchant'].includes(req.auth.profile.role)) return res.status(403).json({ error: 'Order data is restricted to Admin and Merchant roles' });
  next();
}, async (req, res) => {
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
  const templateName = kind === 'registration'
    ? WA_REGISTRATION_TEMPLATE
    : (kind === 'redeem' ? WA_REDEEM_TEMPLATE : WA_REWARD_TEMPLATE);
  const { data, error } = await supabaseAdmin.from('whatsapp_messages').insert({
    customer_id: purchase.customer_id,
    order_id: purchase.order_id,
    merchant_id: purchase.merchant_id || null,
    message_type: kind === 'registration' ? 'qr' : (kind === 'redeem' ? 'redeem' : 'order'),
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
    if (kind === 'registration') tasks.push(sendRegistrationWhatsApp(purchase, whatsappJob.logId));
    else if (kind === 'redeem') tasks.push(sendRedeemWhatsApp(purchase, whatsappJob.logId));
    else tasks.push(sendRewardWhatsApp(purchase, whatsappJob.logId));
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

const INDIA_OFFSET_MS = 330 * 60 * 1000;

function indiaDateKey(value) {
  return new Date(new Date(value).getTime() + INDIA_OFFSET_MS).toISOString().slice(0, 10);
}

function dailyDashboardIntervals(orders, from, to) {
  const dates = [];
  for (
    let cursor = from.getTime();
    cursor < to.getTime();
    cursor += 24 * 60 * 60 * 1000
  ) {
    dates.push(indiaDateKey(cursor));
  }
  const shortRange = dates.length <= 7;
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
  });
  const intervals = dates.map((date) => ({
    date,
    label: shortRange
      ? weekday.format(new Date(`${date}T00:00:00+05:30`))
      : `${date.slice(8, 10)}/${date.slice(5, 7)}`,
    orders: 0,
    revenue: 0,
  }));
  const byDate = new Map(intervals.map((item) => [item.date, item]));
  for (const order of orders) {
    const interval = byDate.get(indiaDateKey(order.created_at));
    if (!interval) continue;
    interval.orders += 1;
    interval.revenue += Number(order.amount);
  }
  return intervals.map(({ date: _date, ...interval }) => interval);
}

function weeklyDashboardIntervals(orders, from, to) {
  const startTime = from.getTime();
  const endTime = to.getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const intervals = Array.from({ length: Math.ceil((endTime - startTime) / weekMs) }, (_, index) => ({
    label: `Week ${index + 1}`,
    orders: 0,
    revenue: 0,
  }));

  for (const order of orders) {
    const orderTime = new Date(order.created_at).getTime();
    if (orderTime < startTime || orderTime >= endTime) continue;
    const intervalIndex = Math.floor((orderTime - startTime) / weekMs);
    intervals[intervalIndex].orders += 1;
    intervals[intervalIndex].revenue += Number(order.amount);
  }

  return intervals;
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
  const bucket = ['daily', 'weekly'].includes(req.query.bucket) ? req.query.bucket : 'six-hour';
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) {
    return res.status(400).json({ success: false, error: 'Valid from and to dates are required' });
  }

  const merchantId = req.auth.profile.role === 'merchant'
    ? req.auth.profile.merchant_id
    : null;
  const redeemedQuery = supabaseAdmin.from('point_redemptions').select('points_redeemed').gte('created_at', from.toISOString()).lt('created_at', to.toISOString());
  if (merchantId) redeemedQuery.eq('merchant_id', merchantId);
  const redeemedResult = await redeemedQuery;
  const totalPointsRedeemed = (redeemedResult.data || []).reduce((sum, row) => sum + Number(row.points_redeemed || 0), 0);
  const analyticsResult = await supabaseAdmin.rpc('get_dashboard_analytics', {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_merchant_id: merchantId,
  });
  if (!analyticsResult.error && analyticsResult.data) {
    if (bucket === 'six-hour') return res.json({ ...analyticsResult.data, summary: { ...analyticsResult.data.summary, totalPointsRedeemed } });

    let dailyOrdersQuery = supabaseAdmin.from('orders')
      .select('amount,created_at')
      .gte('created_at', from.toISOString())
      .lt('created_at', to.toISOString())
      .limit(10000);
    if (merchantId) dailyOrdersQuery = dailyOrdersQuery.eq('merchant_id', merchantId);
    const dailyOrdersResult = await dailyOrdersQuery;
    if (dailyOrdersResult.error) {
      return res.status(500).json({ success: false, error: dailyOrdersResult.error.message });
    }
    return res.json({
      ...analyticsResult.data,
      summary: { ...analyticsResult.data.summary, totalPointsRedeemed },
      intervals: bucket === 'weekly'
        ? weeklyDashboardIntervals(dailyOrdersResult.data || [], from, to)
        : dailyDashboardIntervals(dailyOrdersResult.data || [], from, to),
    });
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
    label: ['12 AM–6 AM', '6 AM–12 PM', '12 PM–6 PM', '6 PM–12 AM'][index],
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
  const responseIntervals = bucket === 'daily'
    ? dailyDashboardIntervals(orders, from, to)
    : bucket === 'weekly'
      ? weeklyDashboardIntervals(orders, from, to)
      : intervals;

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
      totalPointsRedeemed,
      totalCustomers: customersResult.data?.length || 0,
    },
    intervals: responseIntervals,
    retention: {
      lifetimeCustomers: lifetimeRetained,
      selectedVisits: orders.filter((order) => order.is_returning).length,
      todayVisits: returningVisits.filter((order) => new Date(order.created_at) >= startOfToday).length,
      weekVisits: returningVisits.filter((order) => new Date(order.created_at) >= startOfWeek).length,
      monthVisits: returningVisits.filter((order) => new Date(order.created_at) >= startOfMonth).length,
    },
  });
});

app.get('/api/settings/reward', requireAuth, async (req, res) => {
  try {
    const adminConfig = await getAdminRewardConfig();
    
    if (req.auth.profile.role === 'admin') {
      res.json({ success: true, rewardOptions: adminConfig.earnOptions, redeemOptions: adminConfig.redeemOptions, subscription: adminConfig.subscription });
    } else {
      const merchantSettings = await getMerchantRewardSettings(req.auth.profile.merchant_id);
      res.json({ 
        success: true, 
        earnOptions: adminConfig.earnOptions, 
        redeemOptions: adminConfig.redeemOptions,
        merchantEarnPoints: merchantSettings.earn_points_per_100,
        merchantRedeemDiscount: merchantSettings.redeem_discount_per_100,
        merchantDiscountType: merchantSettings.redeem_discount_type || 'percentage',
        merchantFlatDiscount: merchantSettings.redeem_flat_amount ?? 50
        ,subscription: adminConfig.subscription
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/settings/reward', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { earnOptions, redeemOptions } = req.body;
    if (earnOptions) {
      await supabaseAdmin.from('app_settings').upsert({ key: 'earn_options', value: JSON.stringify(earnOptions) });
    }
    if (redeemOptions) {
      await supabaseAdmin.from('app_settings').upsert({ key: 'redeem_options', value: JSON.stringify(redeemOptions) });
    }
    const subscription = req.body.subscription || {};
    const subscriptionValues = {
      subscription_price: subscription.price,
      subscription_points: subscription.points,
      subscription_days: subscription.days,
    };
    for (const [key, value] of Object.entries(subscriptionValues)) {
      if (value !== undefined && Number(value) > 0) {
        await supabaseAdmin.from('app_settings').upsert({ key, value: String(Number(value)) });
      }
    }
    if (Array.isArray(subscription.plans) && subscription.plans.length) {
      await supabaseAdmin.from('app_settings').upsert({ key: 'subscription_plans', value: JSON.stringify(subscription.plans) });
    }
    const adminConfig = await getAdminRewardConfig();
    res.json({ success: true, rewardOptions: adminConfig.earnOptions, redeemOptions: adminConfig.redeemOptions, subscription: adminConfig.subscription });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/merchants/:id/reward-settings', requireAuth, async (req, res) => {
  try {
    if (req.auth.profile.role !== 'admin' && req.auth.profile.merchant_id !== req.params.id) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }
    const { earn_points_per_100, redeem_discount_per_100, redeem_discount_type = 'percentage', redeem_flat_amount = 50 } = req.body;
    const earn = Number(earn_points_per_100), percent = Number(redeem_discount_per_100), flat = Number(redeem_flat_amount);
    if (!Number.isInteger(earn) || earn < 1 || earn > 100 || !Number.isInteger(percent) || percent < 0 || percent > 100 || !['percentage', 'flat'].includes(redeem_discount_type) || !Number.isFinite(flat) || flat < 0 || flat > 1000000) return res.status(400).json({ error: 'Invalid reward settings. Percentage must be 0–100 and flat rupees must be 0–1,000,000.' });
    const { error: saveError } = await supabaseAdmin.from('merchants').update({
      earn_points_per_100: Number(earn_points_per_100),
      redeem_discount_per_100: percent,
      redeem_discount_type,
      redeem_flat_amount: Math.round(flat * 100) / 100
    }).eq('id', req.params.id);
    if (saveError) return res.status(400).json({ error: saveError.message });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
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

  const entries = req.body?.entry || [];
  const statuses = entries.flatMap((entry) => entry.changes?.flatMap((change) => change.value?.statuses || []) || []);
  const messages = entries.flatMap((entry) => entry.changes?.flatMap((change) => change.value?.messages || []) || []);
  res.sendStatus(200);
  scheduleBackground(async () => {
    const statusRank = { queued: 0, sent: 1, delivered: 2, read: 3, failed: 4 };
    for (const item of statuses) {
      const status = item.status;
      if (!(status in statusRank) || !item.id) continue;
      const { data: existing } = await supabaseAdmin
        .from('whatsapp_messages')
        .select('id,status,offer_recipient_id,campaign_id')
        .eq('meta_message_id', item.id)
        .maybeSingle();
      if (!existing || statusRank[status] < statusRank[existing.status]) continue;
      const error = item.errors?.[0];
      await supabaseAdmin.from('whatsapp_messages').update({
        status,
        error_code: error?.code ? String(error.code) : null,
        error_message: error?.title || error?.message || null,
        status_timestamp: item.timestamp ? new Date(Number(item.timestamp) * 1000).toISOString() : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id);
      if (existing.offer_recipient_id) {
        await supabaseAdmin.from('offer_recipients').update({
          status,
          error_code: error?.code ? String(error.code) : null,
          error_message: error?.title || error?.message || null,
          status_timestamp: item.timestamp ? new Date(Number(item.timestamp) * 1000).toISOString() : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', existing.offer_recipient_id);
        if (existing.campaign_id) await supabaseAdmin.rpc('refresh_offer_campaign', { p_campaign_id: existing.campaign_id });
      }
    }
    for (const message of messages) {
      if (!message?.id || !message?.from) continue;
      const { error } = await supabaseAdmin.from('whatsapp_inbound_messages').insert({
        meta_message_id: message.id,
        sender: normalizePhone(message.from),
        message_type: message.type || 'unknown',
        payload: message,
      });
      if (error?.code === '23505') continue;
      if (error) throw error;
      await handleIncomingCustomerWhatsApp(message);
    }
  });
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
          image: { id: mediaId, caption: `🎉 Welcome to *${merchant}*, ${name}!\n\nYour ID: *${cid}*\n\n📲 Save the QR and show it at checkout for instant recognition!\n\n— AE` },
        }, { headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' } });
      } else {
        await axios.post(WA_URL, {
          messaging_product: 'whatsapp', to: toPhone, type: 'text',
          text: { body: `🎉 Welcome to *${merchant}*, ${name}!\n\nYour Customer ID: *${cid}*\n\n📲 Show the ID at checkout for instant recognition.\n\n— AE` },
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
        from: `AE <${process.env.RESEND_FROM_EMAIL}>`,
        to:   [email],
        subject: `Welcome to ${merchant} — Your AE ID: ${cid}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#0a0a0f;color:#f0f0fa;border-radius:16px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#7c6ef7,#e84d8a);padding:30px;text-align:center">
            <h1 style="margin:0;font-size:22px;color:#fff">Welcome to AE</h1>
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
            <p style="color:#8888aa;font-size:11px;margin:0">© ${new Date().getFullYear()} AE</p>
          </div>
        </div>`,
        text: `Hi ${name}, welcome to ${merchant}!\nYour ID: ${cid}\nQR sent to WhatsApp: ${phone}\n\n— AE`,
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
    waMerchantCredentialsTemplate: WA_MERCHANT_CREDENTIALS_TEMPLATE,
    waOfferTemplate: WA_OFFER_TEMPLATE,
    offerQueue: Boolean(OFFER_QUEUE_SECRET),
    waTemplateLanguage: WA_TEMPLATE_LANGUAGE,
  });
});

app.post('/api/payments/create-subscription', requireAuth, async (req, res) => {
  try {
    const { merchant_id } = req.body;
    if (!razorpay) return res.status(500).json({ success: false, error: 'Razorpay is not configured' });
    
    const PLAN_ID = process.env.RAZORPAY_MONTHLY_PLAN_ID || 'plan_YourPlanIdHere';
    const subscription = await razorpay.subscriptions.create({
      plan_id: PLAN_ID,
      customer_notify: 1,
      total_count: 120, // max 10 years for monthly
      notes: { merchant_id }
    });
    res.json({ success: true, data: subscription });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Failed to create Razorpay subscription' });
  }
});

app.post('/api/payments/create-order', requireAuth, async (req, res) => {
  try {
    const merchantId = cleanText(req.body.merchant_id || req.auth.profile.merchant_id, 100);
    if (req.auth.profile.role === 'merchant' && merchantId !== req.auth.profile.merchant_id) return res.status(403).json({ success: false, error: 'Forbidden' });
    const amount = Number(req.body.amount);
    if (!merchantId || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, error: 'A valid payment amount is required' });
    const settings = await readMerchantPaymentSettings(merchantId);
    if (!settings.paymentEnabled || !settings.upiId) return res.status(400).json({ success: false, error: 'Merchant UPI payments are not enabled' });
    if (!razorpay) return res.status(503).json({ success: false, error: 'Razorpay is not configured' });
    const razorpayOrder = await razorpay.orders.create({ amount: Math.round(amount * 100), currency: 'INR', receipt: cleanText(req.body.receipt || `ae_${Date.now()}`, 40), notes: { merchant_id: merchantId, customer_id: cleanText(req.body.customer_id, 100) } });
    const { data, error } = await supabaseAdmin.from('payment_transactions').insert({ merchant_id: merchantId, customer_id: cleanText(req.body.customer_id, 100) || null, order_id: cleanText(req.body.order_id, 100) || null, razorpay_order_id: razorpayOrder.id, amount, metadata: req.body.metadata || {} }).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, payment: data, razorpay: { orderId: razorpayOrder.id, keyId: process.env.RAZORPAY_KEY_ID, amount: razorpayOrder.amount, currency: razorpayOrder.currency, upiId: settings.upiId, displayName: settings.displayName } });
  } catch (err) { res.status(500).json({ success: false, error: err.message || 'Could not create payment order' }); }
});

app.post('/api/payments/verify', requireAuth, async (req, res) => {
  try {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
    if (!orderId || !paymentId || !signature || !process.env.RAZORPAY_KEY_SECRET) return res.status(400).json({ success: false, error: 'Payment verification details are incomplete' });
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
    if (expected !== signature) return res.status(400).json({ success: false, error: 'Invalid payment signature' });
    const { data, error } = await supabaseAdmin.from('payment_transactions').update({ razorpay_payment_id: paymentId, status: 'paid', updated_at: new Date().toISOString() }).eq('razorpay_order_id', orderId).neq('status', 'paid').select().maybeSingle();
    if (error || !data) return res.status(404).json({ success: false, error: 'Payment order not found or already processed' });
    if (data.customer_id) await pushToCustomer(data.customer_id, 'Payment successful', `Your payment of ₹${Number(data.amount).toFixed(2)} was verified.`, { url: '/customer/transactions', paymentId: data.id });
    res.json({ success: true, payment: data });
  } catch (err) { res.status(500).json({ success: false, error: err.message || 'Could not verify payment' }); }
});

app.post('/api/merchants/:id/subscription', requireAuth, (_req, res) => {
  res.status(403).json({ success: false, error: 'Subscriptions are coming soon. Ask Admin to allocate points.' });
});

app.post('/api/merchants/:id/top-up', requireAuth, (_req, res) => {
  res.status(403).json({ success: false, error: 'Self-service top-ups are unavailable. Ask Admin to allocate points.' });
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
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(path.join(reactBuildPath, 'index.html'));
  });
}

module.exports = app;

const PORT = process.env.PORT || 3000;
if (require.main === module) app.listen(PORT, () => {
  console.log(`\n🚀  AE → http://localhost:${PORT}`);
  console.log(`    Resend   : ${process.env.RESEND_API_KEY ? '✅' : '❌ RESEND_API_KEY not set'}`);
  console.log(`    WhatsApp : ${WA_TOKEN && WA_PHONE_ID    ? '✅' : '❌ WA_TOKEN / WA_PHONE_ID not set'}\n`);
});

// ══════════════════════════════════════════

app.post('/api/merchants/:id/redeem', requireAuth, requireRole('merchant'), async (req, res) => {
  try {
    const merchantId = req.params.id;
    if (req.auth.profile.merchant_id !== merchantId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }
    
    const { customerCode, transactionAmount, pointsToRedeem } = req.body;
    const discountType = req.body.discountType === 'flat' ? 'flat' : 'percentage';
    
    if (!customerCode || !Number.isFinite(transactionAmount) || !Number.isFinite(pointsToRedeem)) {
      return res.status(400).json({ success: false, error: 'Invalid parameters' });
    }
    
    if (transactionAmount < 100) return res.status(400).json({ success: false, error: 'Minimum transaction for redemption is ₹100' });
    if (pointsToRedeem !== 100) return res.status(400).json({ success: false, error: 'Redemption is fixed at exactly 100 points' });

    // 1. Get Merchant settings
    const settings = await getMerchantRewardSettings(merchantId);
    const discountPer100 = settings.redeem_discount_per_100;
    
    // 2. Get Customer
    const cleanPhone = (phone) => phone ? String(phone).replace(/\D/g, '') : '';
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerCode);
    const orQuery = isUUID 
      ? `id.eq.${customerCode}` 
      : `customer_code.eq.${customerCode},phone.eq.${cleanPhone(customerCode)}`;
      
    const { data: customer, error: custError } = await supabaseAdmin
      .from('customers')
      .select('id, reward_points, name, phone')
      .or(orQuery)
      .single();
    if (custError || !customer) return res.status(404).json({ success: false, error: 'Customer not found' });
    
    const { data: cm } = await supabaseAdmin.from('customer_merchants').select('reward_points, merchants(name)').eq('customer_id', customer.id).eq('merchant_id', merchantId).single();
    if (!cm || cm.reward_points < pointsToRedeem) {
      return res.status(400).json({ success: false, error: 'Insufficient points balance at this store' });
    }
    
    // 3. Calculate Discount
    const discount = redemptionDiscount(transactionAmount, discountType, req.body.discountValue ?? discountPer100);
    if (!discount) return res.status(400).json({ success: false, error: 'Discount value must be zero or greater' });
    const discountPercentage = discount.percentage;
    const discountAmount = discount.amount;
    
    // 4. Perform deduction transaction in Supabase
    const { data: redemption, error: redError } = await supabaseAdmin.from('point_redemptions').insert({
      customer_id: customer.id,
      merchant_id: merchantId,
      transaction_amount: transactionAmount,
      points_redeemed: pointsToRedeem,
      discount_percentage: discountPercentage,
      discount_amount: discountAmount
    }).select().single();
    
    if (redError) throw redError;
    
    // Deduct points from global customer balance
    const { error: deductCustError } = await supabaseAdmin.from('customers')
      .update({ reward_points: Math.max(0, customer.reward_points - pointsToRedeem) })
      .eq('id', customer.id);
      
    if (deductCustError) {
      console.error('Failed to deduct global points:', deductCustError);
      throw new Error(`Failed to deduct global points: ${deductCustError.message}`);
    }

    // Deduct points from merchant-specific balance
    const { error: deductMerchError } = await supabaseAdmin.from('customer_merchants')
      .update({ reward_points: Math.max(0, cm.reward_points - pointsToRedeem) })
      .eq('customer_id', customer.id)
      .eq('merchant_id', merchantId);
      
    if (deductMerchError) {
      console.error('Failed to deduct merchant points:', deductMerchError);
      throw new Error(`Failed to deduct merchant points: ${deductMerchError.message}`);
    }
    
    const newBalance = cm.reward_points - pointsToRedeem;
    
    const fakePurchase = {
      customer_id: customer.id,
      customer_name: customer.name || 'Customer',
      customer_phone: customer.phone,
      merchant_id: merchantId,
      merchant_name: cm.merchants?.name || 'Store',
      order_id: null,
      order_no: `RD-${String(Date.now()).slice(-6)}`,
      amount: transactionAmount,
      reward_percentage: discountPercentage,
      points_earned: -pointsToRedeem,
      total_points: newBalance
    };

    await pushToCustomer(
      customer.id,
      'Points redeemed',
      `${fakePurchase.merchant_name} redeemed ${pointsToRedeem} points and gave you ₹${discountAmount.toFixed(2)} discount.`,
      { url: '/customer/transactions', transactionId: redemption.id, merchantName: fakePurchase.merchant_name },
    );
    
    res.json({ success: true, discountAmount, newBalance, whatsapp: { skipped: true, reason: 'push_only' } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
