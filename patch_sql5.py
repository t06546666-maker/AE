import re

with open('supabase-rewards-engine-update.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Change points_earned and total_points to numeric
sql = sql.replace('  points_earned integer,\n  total_points integer,', '  points_earned numeric,\n  total_points numeric,')

# Change v_points to numeric
sql = sql.replace('  v_points integer;', '  v_points numeric;')

# Also deduct_customer_points p_points integer to numeric
sql = sql.replace('p_points INTEGER', 'p_points NUMERIC')

with open('supabase-rewards-engine-update.sql', 'w', encoding='utf-8') as f:
    f.write(sql)
