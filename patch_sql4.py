import re

with open('supabase-rewards-engine-update.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Fix qr_scans ambiguity
old_block = "      qr_scans = qr_scans + CASE WHEN p_source = 'qr' THEN 1 ELSE 0 END"
new_block = "      qr_scans = customer_merchants.qr_scans + CASE WHEN p_source = 'qr' THEN 1 ELSE 0 END"

sql = sql.replace(old_block, new_block)

with open('supabase-rewards-engine-update.sql', 'w', encoding='utf-8') as f:
    f.write(sql)
