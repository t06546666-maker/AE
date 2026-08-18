const express = require('express');
const { MockPaymentProvider } = require('./MockPaymentProvider');
const router = express.Router();

const provider = new MockPaymentProvider();

// Webhook endpoint for Payment Provider callbacks
router.post('/callbacks', async (req, res) => {
  try {
    // In production, verify signature
    // provider.verifyCallback(req.body, req.headers['x-signature']);
    
    await provider.handleCallback(req.body);
    res.json({ success: true });
  } catch (err) {
    console.error('Payment callback error:', err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
