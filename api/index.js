// Use an explicit Vercel handler wrapper so module-load failures are captured
// and reported as a response instead of an opaque FUNCTION_INVOCATION_FAILED.
let app;
let startupError;
try {
  app = require('../server');
} catch (error) {
  startupError = error;
  console.error('AE API startup failed:', error);
}

module.exports = (req, res) => {
  if (startupError) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: false, error: 'API startup failed' }));
  }
  return app(req, res);
};
