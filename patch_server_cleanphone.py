import re

with open('server.js', 'r', encoding='utf-8') as f:
    js = f.read()

old_block = """    const { data: customer, error: custError } = await supabaseAdmin
      .from('customers')
      .select('id, reward_points')
      .or(`customer_code.eq.${customerCode},phone.eq.${cleanPhone(customerCode)}`)
      .single();"""

new_block = """    const cleanPhone = (phone) => phone ? String(phone).replace(/\D/g, '') : '';
    const { data: customer, error: custError } = await supabaseAdmin
      .from('customers')
      .select('id, reward_points')
      .or(`customer_code.eq.${customerCode},phone.eq.${cleanPhone(customerCode)}`)
      .single();"""

js = js.replace(old_block, new_block)

with open('server.js', 'w', encoding='utf-8') as f:
    f.write(js)
