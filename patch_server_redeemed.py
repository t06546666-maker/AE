import re

with open('server.js', 'r', encoding='utf-8') as f:
    js = f.read()

old_merchant = """  const { data, error } = await supabaseAdmin
    .from('merchants')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) return res.status(500).json({ success: false, error: error.message });
  if (!data) return res.status(404).json({ success: false, error: 'Merchant not found' });
  return res.json({ success: true, data });"""

new_merchant = """  const { data, error } = await supabaseAdmin
    .from('merchants')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) return res.status(500).json({ success: false, error: error.message });
  if (!data) return res.status(404).json({ success: false, error: 'Merchant not found' });
  
  const { data: redemptionData } = await supabaseAdmin
    .from('point_redemptions')
    .select('points_redeemed')
    .eq('merchant_id', req.params.id);
  
  data.total_points_redeemed = (redemptionData || []).reduce((sum, r) => sum + r.points_redeemed, 0);
  
  return res.json({ success: true, data });"""

js = js.replace(old_merchant, new_merchant)

with open('server.js', 'w', encoding='utf-8') as f:
    f.write(js)
