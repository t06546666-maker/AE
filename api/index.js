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

module.exports = async (req, res) => {
  if (startupError) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: false, error: 'API startup failed' }));
  }
  try {
    return await app(req, res);
  } catch (error) {
    console.error('AE API request failed:', error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
    }
    return undefined;
  }
};
