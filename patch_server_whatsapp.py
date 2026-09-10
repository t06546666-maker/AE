import re

with open('server.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Update the customer select in /api/merchants/:id/redeem
old_select = """    const cleanPhone = (phone) => phone ? String(phone).replace(/\D/g, '') : '';
    const { data: customer, error: custError } = await supabaseAdmin
      .from('customers')
      .select('id, reward_points')
      .or(`customer_code.eq.${customerCode},phone.eq.${cleanPhone(customerCode)}`)
      .single();"""

new_select = """    const cleanPhone = (phone) => phone ? String(phone).replace(/\D/g, '') : '';
    const { data: customer, error: custError } = await supabaseAdmin
      .from('customers')
      .select('id, reward_points, name, phone')
      .or(`customer_code.eq.${customerCode},phone.eq.${cleanPhone(customerCode)}`)
      .single();"""

js = js.replace(old_select, new_select)

# Add the sendWhatsAppText call after deduction
old_deduct = """    // Deduct points
    await supabaseAdmin.rpc('deduct_customer_points', {
      p_customer_id: customer.id,
      p_merchant_id: merchantId,
      p_points: pointsToRedeem
    });
    
    res.json({ success: true, discountAmount, newBalance: cm.reward_points - pointsToRedeem });"""

new_deduct = """    // Deduct points
    await supabaseAdmin.rpc('deduct_customer_points', {
      p_customer_id: customer.id,
      p_merchant_id: merchantId,
      p_points: pointsToRedeem
    });
    
    // Attempt to send a WhatsApp notification
    const newBalance = cm.reward_points - pointsToRedeem;
    const message = `🎉 *Redemption Successful!*\n\nHi ${customer.name || 'Customer'},\nYou just redeemed ${pointsToRedeem} points for a discount of ₹${discountAmount.toFixed(2)} at our store.\n\nYour new point balance is ${newBalance} points.\nThank you!`;
    
    let whatsapp = { sent: false };
    if (customer.phone) {
       whatsapp = await sendWhatsAppText(customer.phone, message).catch(e => ({ sent: false, error: e.message }));
    }
    
    res.json({ success: true, discountAmount, newBalance, whatsapp });"""

js = js.replace(old_deduct, new_deduct)

with open('server.js', 'w', encoding='utf-8') as f:
    f.write(js)
