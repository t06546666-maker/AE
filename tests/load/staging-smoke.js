import http from 'k6/http';
import { check, fail, sleep } from 'k6';

// Initial application/API baseline only. This does not test checkout, OTP or device crashes.
const base = (__ENV.AE_TEST_URL || 'http://127.0.0.1:3020').replace(/\/$/, '');
const target = /^http:\/\/127\.0\.0\.1:3020$/.test(base) || /^https:\/\/[a-z0-9-]*staging[a-z0-9-]*\.vercel\.app$/.test(base);
if (!target) throw new Error('Use the isolated staging app on port 3020 or its staging Vercel URL.');
export const options = {
  vus: 1,
  duration: '20s',
  maxRedirects: 0,
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '10s' }],
    checks: ['rate==1'],
    http_req_duration: ['p(95)<2000'],
  },
};
export function setup() {
  const response = http.get(base + '/api/health');
  let data; try { data = response.json(); } catch { fail('Staging identity check failed.'); }
  if (response.status !== 200 || data.environment !== 'staging' || data.stagingProject !== 'gcojiipcmwzpvmlixqsk') fail('Refusing to test an unverified staging app.');
}
export default function () {
  const response = http.get(base + '/api/customer/categories', { tags: { name: 'customer_categories' } });
  check(response, {
    'categories return HTTP 200': r => r.status === 200,
    'category response is valid': r => { try { const data = r.json(); return data.success === true && Array.isArray(data.categories) && data.categories.length > 0; } catch { return false; } },
  });
  sleep(2);
}
export function handleSummary(data) {
  return { 'k6-staging-summary.json': JSON.stringify(data, null, 2) };
}
