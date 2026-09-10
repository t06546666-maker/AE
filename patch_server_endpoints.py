import re

with open('server.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Fix /api/customers
old_customers = """  const amount = Number(req.body.amount);
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
  }"""

new_customers = """  const amount = Number(req.body.amount);
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
  }"""

# Replace in code
code = code.replace(old_customers, new_customers)

# Update the call to processPurchase in /api/customers
old_customers_process = """  const earnRate = await getMerchantEarnRateWithCap(merchantId);
  const { data: purchases, error: purchaseError } = await processPurchase({
    p_customer_code: customer.customer_code,
    p_merchant_id: merchantId,
    p_amount: amount,
    p_points_per_100: earnRate,
    p_source: 'registration',
    p_location: cleanText(req.body.location, 160) || 'In-store',
  }, req.get('Idempotency-Key'));"""

new_customers_process = """  const earnRateWithCap = await getMerchantEarnRateWithCap(merchantId);
  // If cap is reached (0), we issue 0 points, otherwise we use the selected points
  const pointsToIssue = earnRateWithCap === 0 ? 0 : selectedPoints;
  const { data: purchases, error: purchaseError } = await processPurchase({
    p_customer_code: customer.customer_code,
    p_merchant_id: merchantId,
    p_amount: amount,
    p_points_per_100: pointsToIssue,
    p_source: 'registration',
    p_location: cleanText(req.body.location, 160) || 'In-store',
  }, req.get('Idempotency-Key'));"""

code = code.replace(old_customers_process, new_customers_process)


# 2. Fix /api/checkouts
old_checkouts = """  const amount = Number(req.body.amount);
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
  }, req.get('Idempotency-Key'));"""

new_checkouts = """  const amount = Number(req.body.amount);
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
  }, req.get('Idempotency-Key'));"""

code = code.replace(old_checkouts, new_checkouts)

with open('server.js', 'w', encoding='utf-8') as f:
    f.write(code)
