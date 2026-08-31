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

// --- Affiliate AE Settlement Engine ---
const { recordRewardEarned } = require('./src/modules/affiliate/rewards');
const { toPaise } = require('./src/modules/affiliate/common/money');
const networksRouter = require('./src/modules/affiliate/networks');
const redemptionsRouter = require('./src/modules/affiliate/redemptions');
const { router: rewardsRouter } = require('./src/modules/affiliate/rewards');
const { router: settlementsRouter } = require('./src/modules/affiliate/settlements');
const paymentsRouter = require('./src/modules/affiliate/payments');
// --------------------------------------

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
const WA_REGISTRATION_TEMPLATE = process.env.WA_REGISTRATION_TEMPLATE || 'customer_welcome_qr';
const WA_QR_TEMPLATE = cleanText(process.env.WA_QR_TEMPLATE, 512);
const WA_REWARD_TEMPLATE = process.env.WA_REWARD_TEMPLATE || 'reward_receipt';
const WA_MERCHANT_CREDENTIALS_TEMPLATE = cleanText(
  process.env.WA_MERCHANT_CREDENTIALS_TEMPLATE || 'merchant_account_ready',
  512,
);
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
  const { data } = await supabaseAdmin.from('app_settings').select('key,value').in('key', ['earn_options', 'redeem_options']);
  let earn = EARN_OPTIONS;
  let redeem = REDEEM_OPTIONS;
  if (data) {
    const earnStr = data.find(r => r.key === 'earn_options')?.value;
    const redeemStr = data.find(r => r.key === 'redeem_options')?.value;
    if (earnStr) earn = JSON.parse(earnStr);
    if (redeemStr) redeem = JSON.parse(redeemStr);
  }
  return { earnOptions: earn, redeemOptions: redeem };
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
  const { data, error } = await supabaseAdmin.from('merchants').select('earn_points_per_100, redeem_discount_per_100').eq('id', merchantId).single();
  if (error || !data) return { earn_points_per_100: 10, redeem_discount_per_100: 5 };
  return data;
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
  
  // -- Affiliate AE Reward Engine Hook --
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
      console.error('Affiliate AE Reward Engine Hook Failed:', engineError);
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
        message_type: messageType,
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
  const templateName = WA_QR_TEMPLATE || WA_REGISTRATION_TEMPLATE;
  const bodyParameters = WA_QR_TEMPLATE
    ? [
      { type: 'text', text: purchase.customer_name },
      { type: 'text', text: purchase.customer_code },
      { type: 'text', text: formatPoints(purchase.total_points) },
    ]
    : [
      { type: 'text', text: purchase.customer_name },
      { type: 'text', text: purchase.merchant_name },
      { type: 'text', text: purchase.customer_code },
      { type: 'text', text: `${Number(purchase.reward_percentage)}%` },
      { type: 'text', text: formatPoints(purchase.points_earned) },
      { type: 'text', text: formatPoints(purchase.total_points) },
    ];
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
    return sendWhatsAppTemplate({
      customerId: purchase.customer_id,
      orderId: purchase.order_id,
      recipient: purchase.customer_phone,
      templateName,
      logId,
      components: [
        { type: 'header', parameters: [{ type: 'image', image: { id: mediaId } }] },
        bodyComponent,
      ],
    });
  } catch (error) {
    if (WA_QR_TEMPLATE) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await supabaseAdmin.from('whatsapp_messages').update({
        status: 'failed',
        error_message: errorMessage,
        status_timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', logId);
      return { sent: false, error: errorMessage };
    }
    const fallback = await sendWhatsAppTemplate({
      customerId: purchase.customer_id,
      orderId: purchase.order_id,
      recipient: purchase.customer_phone,
      templateName,
      logId,
      components: [bodyComponent],
    });
    if (fallback.sent) return fallback;
    return { sent: false, error: `${error.message}; fallback: ${fallback.error}` };
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
      sections: [{ title: 'Affiliate AE', rows: rows.slice(0, 10).map((row) => ({
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
  return sendCustomerOrderList(customer.phone, 'Welcome to Affiliate AE. Choose the shop you want to order from.', 'Choose shop', rows);
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
    await sendWhatsAppText(from, 'This WhatsApp number is not registered with Affiliate AE. Please register at a participating merchant first.');
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

// --- Affiliate AE Settlement Engine Modules ---
app.use('/api/networks', requireAuth, networksRouter);
app.use('/api/customers', requireAuth, rewardsRouter); 
app.use('/api/redemptions', requireAuth, redemptionsRouter);
app.use('/api/settlements', requireAuth, settlementsRouter);
app.use('/api/payments', paymentsRouter);
// ----------------------------------------------

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
    .select('id, full_name, role, merchant_id, must_change_password, password_reset_at, password_changed_at')
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

app.get('/api/merchants/:id', requireAuth, async (req, res, next) => {
  if (req.params.id === 'summary' || req.params.id === 'reset-password') return next(); // Skip specific routes
  const { data, error } = await supabaseAdmin
    .from('merchants')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) return res.status(500).json({ success: false, error: error.message });
  if (!data) return res.status(404).json({ success: false, error: 'Merchant not found' });
  return res.json({ success: true, data });
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

app.post('/api/merchants', requireAuth, requireRole('admin'), async (req, res) => {
  const name = cleanText(req.body.name, 120);
  const email = cleanText(req.body.email, 254).toLowerCase();
  const phone = normalizePhone(req.body.phone);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!name || !email || !isEmail(email) || !phone || !isStrongPassword(password)) {
    return res.status(400).json({
      success: false,
      error: 'Name, valid email/phone, and a strong temporary password are required',
    });
  }

  const { data: merchant, error: merchantError } = await supabaseAdmin
    .from('merchants')
    .insert({ name, email, phone, network_id: req.body.network_id || '00000000-0000-0000-0000-000000000000' })
    .select('id,merchant_code,name,email,phone,created_at')
    .single();
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

  const whatsapp = await sendMerchantAccountReadyWhatsApp(merchant);
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

app.post('/api/merchants/:id/reset-password', requireAuth, requireRole('admin'), async (req, res) => {
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
    'id,merchant_id,title,description,image_path,expires_at,status,rejection_reason,reviewed_at,broadcast_at,created_at,updated_at,merchants(name,merchant_code),offer_campaigns(id,status,total_recipients,queued_count,processing_count,sent_count,delivered_count,read_count,failed_count,skipped_count,started_at,completed_at,created_at)',
    { count: 'exact' },
  ).order('created_at', { ascending: false });
  if (req.auth.profile.role === 'merchant') {
    query = query.eq('merchant_id', req.auth.profile.merchant_id);
  }
  if (allowedStatuses.has(status)) query = query.eq('status', status);
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

app.post(
  '/api/offers',
  requireAuth,
  requireRole('merchant'),
  offerImageMiddleware,
  async (req, res) => {
    const title = cleanText(req.body.title, 120);
    const description = cleanText(req.body.description, 1000);
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
        image_path: imagePath,
        expires_at: expiresAt.toISOString(),
        status: 'pending',
        submitted_by: req.auth.user.id,
      }).select(
        'id,merchant_id,title,description,image_path,expires_at,status,rejection_reason,reviewed_at,broadcast_at,created_at,updated_at,merchants(name,merchant_code)',
      ).single();
      if (error) throw error;
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
        image_path: replacementPath,
        expires_at: expiresAt.toISOString(),
        status: 'pending',
        rejection_reason: null,
        reviewed_by: null,
        reviewed_at: null,
        submitted_by: req.auth.user.id,
        updated_at: new Date().toISOString(),
      }).eq('id', offerId).select(
        'id,merchant_id,title,description,image_path,expires_at,status,rejection_reason,reviewed_at,broadcast_at,created_at,updated_at,merchants(name,merchant_code)',
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
  return res.json({ success: true, offer });
});

app.post('/api/offers/:id/reject', requireAuth, requireRole('admin'), async (req, res) => {
  const offerId = cleanText(req.params.id, 100);
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
  const selectedPoints = Number(req.body.rewardPercentage); // We reuse this field for points per 100
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
    amount < 100
  ) {
    return res.status(400).json({
      success: false,
      error: `Purchase must be at least 100.`,
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
    const created = await supabaseAdmin.from('customers').insert({
      customer_code: customerCode,
      name,
      phone,
      email: email || null,
      merchant_id: merchantId,
      network_id: networkId,
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
  const selectedPoints = Number(req.body.rewardPercentage);
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
  
  const earnRateWithCap = await getMerchantEarnRateWithCap(req.auth.profile.merchant_id);
  const pointsToIssue = earnRateWithCap === 0 ? 0 : selectedPoints;

  const { data, error } = await processPurchase({
    p_customer_code: customerCode,
    p_merchant_id: req.auth.profile.merchant_id,
    p_amount: amount,
    p_points_per_100: pointsToIssue,
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
  const templateName = kind === 'registration'
    ? WA_QR_TEMPLATE || WA_REGISTRATION_TEMPLATE
    : WA_REWARD_TEMPLATE;
  const { data, error } = await supabaseAdmin.from('whatsapp_messages').insert({
    customer_id: purchase.customer_id,
    order_id: purchase.order_id,
    merchant_id: purchase.merchant_id || null,
    message_type: kind === 'registration' ? 'qr' : 'order',
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
  const intervals = Array.from({ length: 4 }, (_, index) => ({
    label: `Week ${index + 1}`,
    orders: 0,
    revenue: 0,
  }));

  for (const order of orders) {
    const orderTime = new Date(order.created_at).getTime();
    if (orderTime < startTime || orderTime >= endTime) continue;
    const intervalIndex = Math.min(3, Math.floor((orderTime - startTime) / weekMs));
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
  const analyticsResult = await supabaseAdmin.rpc('get_dashboard_analytics', {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_merchant_id: merchantId,
  });
  if (!analyticsResult.error && analyticsResult.data) {
    if (bucket === 'six-hour') return res.json(analyticsResult.data);

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
      res.json({ success: true, rewardOptions: adminConfig.earnOptions, redeemOptions: adminConfig.redeemOptions });
    } else {
      const merchantSettings = await getMerchantRewardSettings(req.auth.profile.merchant_id);
      res.json({ 
        success: true, 
        earnOptions: adminConfig.earnOptions, 
        redeemOptions: adminConfig.redeemOptions,
        merchantEarnPoints: merchantSettings.earn_points_per_100,
        merchantRedeemDiscount: merchantSettings.redeem_discount_per_100
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
    const adminConfig = await getAdminRewardConfig();
    res.json({ success: true, rewardOptions: adminConfig.earnOptions, redeemOptions: adminConfig.redeemOptions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/merchants/:id/reward-settings', requireAuth, async (req, res) => {
  try {
    if (req.auth.profile.role !== 'admin' && req.auth.profile.merchant_id !== req.params.id) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }
    const { earn_points_per_100, redeem_discount_per_100 } = req.body;
    await supabaseAdmin.from('merchants').update({
      earn_points_per_100: Number(earn_points_per_100),
      redeem_discount_per_100: Number(redeem_discount_per_100)
    }).eq('id', req.params.id);
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
    waQrTemplate: WA_QR_TEMPLATE || null,
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

app.post('/api/merchants/:id/subscription', requireAuth, async (req, res) => {
  try {
    const { payment_reference, mandate_id, signature } = req.body;
    const merchantId = req.params.id;
    
    if (!payment_reference) return res.status(400).json({ success: false, error: 'Payment reference required' });
    
    if (mandate_id && signature) {
      if (!process.env.RAZORPAY_KEY_SECRET) return res.status(500).json({ success: false, error: 'Razorpay secret missing' });
      const text = `${payment_reference}|${mandate_id}`;
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(text)
        .digest('hex');
      if (generatedSignature !== signature) {
        return res.status(400).json({ success: false, error: 'Invalid Razorpay signature. Payment verification failed.' });
      }
    }

    const { data: merchant, error: fetchError } = await supabaseAdmin
      .from('merchants')
      .select('point_balance, subscription_expires_at')
      .eq('id', merchantId)
      .single();
      
    if (fetchError || !merchant) return res.status(404).json({ success: false, error: 'Merchant not found' });

    const currentPoints = merchant.point_balance || 0;
    const now = new Date();
    const expiryDate = merchant.subscription_expires_at && new Date(merchant.subscription_expires_at) > now
      ? new Date(merchant.subscription_expires_at)
      : now;
    expiryDate.setDate(expiryDate.getDate() + 30);
    
    const updatePayload = {
      point_balance: currentPoints + 100,
      subscription_expires_at: expiryDate.toISOString(),
    };
    if (mandate_id) updatePayload.subscription_mandate_id = mandate_id;

    const { error: updateError } = await supabaseAdmin
      .from('merchants')
      .update(updatePayload)
      .eq('id', merchantId);

    if (updateError) throw updateError;
    
    res.json({ success: true, message: 'Subscription purchased successfully. 100 points added.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Failed to process subscription' });
  }
});

app.post('/api/merchants/:id/top-up', requireAuth, async (req, res) => {
  try {
    const { points, payment_reference } = req.body;
    const merchantId = req.params.id;
    if (!points || points < 50) return res.status(400).json({ success: false, error: 'Minimum top-up is 50 points' });
    if (!payment_reference) return res.status(400).json({ success: false, error: 'Payment reference required' });

    // In a real scenario, you'd verify a one-time Razorpay payment signature here 
    // similar to the subscription route. For now, we simulate success if reference is provided.
    
    const { data: merchant, error: fetchError } = await supabaseAdmin
      .from('merchants')
      .select('point_balance')
      .eq('id', merchantId)
      .single();
      
    if (fetchError || !merchant) return res.status(404).json({ success: false, error: 'Merchant not found' });

    const currentPoints = merchant.point_balance || 0;
    
    const { error: updateError } = await supabaseAdmin
      .from('merchants')
      .update({ point_balance: currentPoints + points })
      .eq('id', merchantId);

    if (updateError) throw updateError;
    
    res.json({ success: true, message: `${points} points topped up successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Failed to process top-up' });
  }
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
  console.log(`\n🚀  Affiliate AE → http://localhost:${PORT}`);
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
    
    if (!customerCode || !Number.isFinite(transactionAmount) || !Number.isFinite(pointsToRedeem)) {
      return res.status(400).json({ success: false, error: 'Invalid parameters' });
    }
    
    if (transactionAmount < 100) return res.status(400).json({ success: false, error: 'Minimum transaction for redemption is ₹100' });
    if (pointsToRedeem < 100) return res.status(400).json({ success: false, error: 'Minimum points to redeem is 100' });
    if (pointsToRedeem > 1000) return res.status(400).json({ success: false, error: 'Maximum points to redeem is 1000' });

    // 1. Get Merchant settings
    const settings = await getMerchantRewardSettings(merchantId);
    const discountPer100 = settings.redeem_discount_per_100;
    
    // 2. Get Customer
    const cleanPhone = (phone) => phone ? String(phone).replace(/\D/g, '') : '';
    const { data: customer, error: custError } = await supabaseAdmin
      .from('customers')
      .select('id, reward_points, name, phone')
      .or(`customer_code.eq.${customerCode},phone.eq.${cleanPhone(customerCode)}`)
      .single();
    if (custError || !customer) return res.status(404).json({ success: false, error: 'Customer not found' });
    
    const { data: cm } = await supabaseAdmin.from('customer_merchants').select('reward_points, merchants(name)').eq('customer_id', customer.id).eq('merchant_id', merchantId).single();
    if (!cm || cm.reward_points < pointsToRedeem) {
      return res.status(400).json({ success: false, error: 'Insufficient points balance at this store' });
    }
    
    // 3. Calculate Discount
    const discountPercentage = (pointsToRedeem / 100) * discountPer100;
    const discountAmount = transactionAmount * (discountPercentage / 100);
    
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
    
    // Deduct points
    await supabaseAdmin.rpc('deduct_customer_points', {
      p_customer_id: customer.id,
      p_merchant_id: merchantId,
      p_points: pointsToRedeem
    });
    
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

    const whatsapp = await queueWhatsApp(fakePurchase, 'reward');
    if (whatsapp.queued) {
      scheduleBackground(() => sendRewardWhatsApp(fakePurchase, whatsapp.logId));
    }
    
    res.json({ success: true, discountAmount, newBalance, whatsapp });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
