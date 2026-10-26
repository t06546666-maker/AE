const express = require('express');
const router = express.Router();
// This legacy URL used a development provider that accepts any signature.
// Real provider webhooks have their own signature-verified routes. Never let
// an unauthenticated caller submit fake payment results through this mock.
router.post('/callbacks', (_req, res) => {
  res.status(410).json({ success: false, error: 'This development callback is disabled.' });
});

module.exports = router;
