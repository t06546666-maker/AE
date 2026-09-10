import re

with open('server.js', 'r', encoding='utf-8') as f:
    code = f.read()

old_insert = """    const customerCode = `C${Date.now().toString(36).toUpperCase()}`;
    const created = await supabaseAdmin.from('customers').insert({
      customer_code: customerCode,
      name,
      phone,
      email: email || null,
      merchant_id: merchantId,
      network_id: '00000000-0000-0000-0000-000000000000',
      whatsapp_opt_in_at: new Date().toISOString(),
    }).select('id,customer_code,name,phone,email,created_at').single();"""

new_insert = """    const { data: merchantData } = await supabaseAdmin.from('merchants').select('network_id').eq('id', merchantId).single();
    const networkId = merchantData?.network_id;

    const customerCode = `C${Date.now().toString(36).toUpperCase()}`;
    const created = await supabaseAdmin.from('customers').insert({
      customer_code: customerCode,
      name,
      phone,
      email: email || null,
      merchant_id: merchantId,
      network_id: networkId,
      whatsapp_opt_in_at: new Date().toISOString(),
    }).select('id,customer_code,name,phone,email,created_at').single();"""

code = code.replace(old_insert, new_insert)

with open('server.js', 'w', encoding='utf-8') as f:
    f.write(code)
