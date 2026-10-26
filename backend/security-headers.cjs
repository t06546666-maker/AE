const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Keep existing Firebase, Maps, camera and payment integrations working.
  // A full script-source policy needs a separate inventory of those integrations.
  'Content-Security-Policy': "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
};

function securityHeaders(req, res, next) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
  if (req.path === '/api' || req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
}

module.exports = { SECURITY_HEADERS, securityHeaders };
