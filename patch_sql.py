import re

with open('supabase-rewards-engine-update.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Fix line 86
sql = sql.replace(
    'WHERE customer_id = v_customer.id AND merchant_id = p_merchant_id',
    'WHERE customer_merchants.customer_id = v_customer.id AND customer_merchants.merchant_id = p_merchant_id'
)

# Fix line 124
sql = sql.replace(
    'WHERE id = v_customer.id;',
    'WHERE customers.id = v_customer.id;'
)

with open('supabase-rewards-engine-update.sql', 'w', encoding='utf-8') as f:
    f.write(sql)
