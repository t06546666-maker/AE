// Fail closed before any cloud client is constructed. Production behavior is unchanged.
const productionRefs = new Set(['zrsjgbgzkaxccetjahcy', 'zrsjbgzkaxccetjahcy']);
const productionFirebase = 'ae2026-27134';
function assertStaging(env, { backend = true } = {}) {
  if (env.AE_ENV !== 'staging') return;
  const fail = message => { throw new Error('Staging safety: ' + message); };
  const ref = env.AE_STAGING_SUPABASE_REF;
  const project = env.AE_STAGING_FIREBASE_PROJECT;
  if (!ref || productionRefs.has(ref) || !/^[a-z]{20}$/.test(ref)) fail('a dedicated Supabase project reference is required');
  if (!project || project === productionFirebase || !project.includes('staging')) fail('a dedicated staging Firebase project is required');
  for (const name of ['SUPABASE_URL', 'VITE_SUPABASE_URL']) {
    if (env[name] !== `https://${ref}.supabase.co`) fail(name + ' must match the dedicated staging project');
  }
  if (env.VITE_FIREBASE_PROJECT_ID !== project || env.VITE_FIREBASE_AUTH_DOMAIN !== `${project}.firebaseapp.com`) fail('Firebase browser settings must match staging');
  for (const name of ['SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', ...(backend ? ['SUPABASE_SERVICE_ROLE_KEY'] : [])]) {
    if (!env[name]) fail(name + ' is missing');
    try { const payload = JSON.parse(Buffer.from(env[name].split('.')[1], 'base64url').toString()); if (payload.ref && payload.ref !== ref) fail(name + ' belongs to another project'); }
    catch (e) { if (e.message.startsWith('Staging safety:')) throw e; }
  }
  for (const name of ['WA_TOKEN', 'WA_PHONE_ID', 'WA_APP_SECRET', 'WA_VERIFY_TOKEN', 'RESEND_API_KEY', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'OFFER_QUEUE_SECRET', 'GOOGLE_APPLICATION_CREDENTIALS']) {
    if (env[name]) fail('remove outbound/production credential ' + name);
  }
  if (backend) {
    let account; try { account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}'); } catch { fail('invalid Firebase staging credentials'); }
    if (account.project_id !== project || !account.private_key) fail('Firebase Admin must use staging-only credentials');
    if (!env.CUSTOMER_JWT_SECRET || env.CUSTOMER_JWT_SECRET.length < 48) fail('use a separate random JWT secret of at least 48 characters');
  }
  let api; try { api = new URL(env.VITE_API_URL); } catch { fail('VITE_API_URL is required'); }
  if (!['127.0.0.1', 'localhost'].includes(api.hostname) && !(api.protocol === 'https:' && api.hostname.includes('staging') && api.hostname.endsWith('.vercel.app'))) fail('API must be localhost or a dedicated staging Vercel hostname');
  if (env.AE_STAGING_PUSH_MODE !== 'disabled') fail('real push delivery must remain disabled');
}
module.exports = { assertStaging };
