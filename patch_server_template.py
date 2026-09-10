import re

with open('server.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Replace the text message with the reward template
old_whatsapp = """    // Attempt to send a WhatsApp notification
    const newBalance = cm.reward_points - pointsToRedeem;
    const message = `🎉 *Redemption Successful!*\n\nHi ${customer.name || 'Customer'},\nYou just redeemed ${pointsToRedeem} points for a discount of ₹${discountAmount.toFixed(2)} at our store.\n\nYour new point balance is ${newBalance} points.\nThank you!`;
    
    let whatsapp = { sent: false };
    if (customer.phone) {
       whatsapp = await sendWhatsAppText(customer.phone, message).catch(e => ({ sent: false, error: e.message }));
    }
    
    res.json({ success: true, discountAmount, newBalance, whatsapp });"""

new_whatsapp = """    const newBalance = cm.reward_points - pointsToRedeem;
    
    const fakePurchase = {
      customer_id: customer.id,
      customer_name: customer.name || 'Customer',
      customer_phone: customer.phone,
      merchant_id: merchantId,
      merchant_name: merchantName || 'Store',
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
    
    res.json({ success: true, discountAmount, newBalance, whatsapp });"""

js = js.replace(old_whatsapp, new_whatsapp)

# Wait, `merchantName` isn't defined inside the `redeem` endpoint.
# Let's fix that. In `redeem`, `const settings = await getMerchantRewardSettings(merchantId);` is there, but merchant name?
# Wait! Let's just find where `merchantName` can be extracted. 
# `customer_merchants` can select `merchants(name)`.
